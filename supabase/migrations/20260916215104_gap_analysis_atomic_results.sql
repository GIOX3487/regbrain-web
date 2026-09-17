-- Service-only leases serialize analysis workers. Browser sessions cannot acquire them.
create table public.gap_analysis_leases (
  assessment_id uuid primary key references public.compliance_assessments(id) on delete cascade,
  token uuid not null,
  expires_at timestamptz not null
);
alter table public.gap_analysis_leases enable row level security;
revoke all on public.gap_analysis_leases from public, anon, authenticated;
grant select, insert, update, delete on public.gap_analysis_leases to service_role;

create function public.acquire_gap_analysis_lease(p_assessment_id uuid, p_user_id uuid, p_token uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare acquired uuid;
begin
  if not exists (select 1 from public.compliance_assessments where id=p_assessment_id and user_id=p_user_id) then
    raise exception 'Assessment not found';
  end if;
  insert into public.gap_analysis_leases as l (assessment_id, token, expires_at)
    values (p_assessment_id, p_token, clock_timestamp() + interval '10 minutes')
    on conflict (assessment_id) do update set token=excluded.token, expires_at=excluded.expires_at
    where l.expires_at < clock_timestamp() or l.token = p_token
    returning token into acquired;
  return acquired is not null;
end $$;

create function public.save_gap_analysis_progress(p_assessment_id uuid, p_token uuid, p_state jsonb, p_checks jsonb default '[]')
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.gap_analysis_leases where assessment_id=p_assessment_id and token=p_token
    and expires_at > clock_timestamp() for update;
  if not found then raise exception 'Analysis lease expired'; end if;
  insert into public.assessment_requirement_checks (assessment_id, requirement_id, check_payload)
    select p_assessment_id, item->>'requirement_id', item from jsonb_array_elements(p_checks) item
    on conflict (assessment_id, requirement_id) do update set check_payload=excluded.check_payload;
  update public.compliance_assessments set analysis_progress=p_state, status='in_progress' where id=p_assessment_id;
  if not found then raise exception 'Assessment not found'; end if;
  update public.gap_analysis_leases set expires_at=clock_timestamp()+interval '10 minutes' where assessment_id=p_assessment_id;
end $$;

create function public.finalize_gap_analysis(p_assessment_id uuid, p_token uuid, p_final jsonb,
  p_progress jsonb, p_gaps jsonb, p_risk numeric, p_compliance numeric)
returns void language plpgsql security invoker set search_path = '' as $$
declare g jsonb; a jsonb; gap_id uuid; actual_count integer;
begin
  perform 1 from public.gap_analysis_leases where assessment_id=p_assessment_id and token=p_token
    and expires_at > clock_timestamp() for update;
  if not found then raise exception 'Analysis lease expired'; end if;
  select count(*) into actual_count from public.assessment_requirement_checks where assessment_id=p_assessment_id;
  if actual_count=0 or actual_count <> (p_progress->>'total')::integer
    or actual_count <> jsonb_array_length(p_final->'checks')
    or jsonb_array_length(p_progress->'pending') <> 0 then
    raise exception 'Incomplete requirement results';
  end if;
  -- All replacement writes, the completed flag and staging cleanup share one transaction.
  delete from public.action_plans where assessment_id=p_assessment_id;
  delete from public.identified_gaps where assessment_id=p_assessment_id;
  for g in select value from jsonb_array_elements(p_gaps) loop
    gap_id := (g->>'id')::uuid;
    insert into public.identified_gaps (
      id, assessment_id, requirement_reference, requirement_description, current_state, gap_description,
      risk_level, risk_score, priority, remediation_effort, recommended_actions,
      source_chunk_id, article_text_excerpt, detection_method, evidence, coverage_status, severity
    ) values (
      gap_id, p_assessment_id, g->>'requirement_reference', g->>'requirement_description', g->>'current_state', g->>'gap_description',
      g->>'risk_level', (g->>'risk_score')::numeric, (g->>'priority')::integer, g->>'remediation_effort', g->'recommended_actions',
      (g->>'source_chunk_id')::uuid, g->>'article_text_excerpt', g->>'detection_method', g->'evidence', g->>'coverage_status', g->>'severity'
    );
    if (g->>'priority')::integer <= 3 then
      for a in select value from jsonb_array_elements(g->'recommended_actions') limit 3 loop
        insert into public.action_plans (assessment_id, gap_id, title, description, priority, status)
          values (p_assessment_id, gap_id, g->>'requirement_reference', a->>'action', (g->>'priority')::integer, 'pending');
      end loop;
    end if;
  end loop;
  update public.compliance_assessments set overall_risk_score=p_risk, overall_compliance_percentage=p_compliance,
    requirement_checks=p_final, analysis_progress=p_progress, status='completed', completed_at=clock_timestamp()
    where id=p_assessment_id;
  if not found then raise exception 'Assessment not found'; end if;
  delete from public.assessment_requirement_checks where assessment_id=p_assessment_id;
end $$;

revoke execute on function public.acquire_gap_analysis_lease(uuid,uuid,uuid) from public, anon, authenticated;
revoke execute on function public.save_gap_analysis_progress(uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
revoke execute on function public.finalize_gap_analysis(uuid,uuid,jsonb,jsonb,jsonb,numeric,numeric) from public, anon, authenticated;
grant execute on function public.acquire_gap_analysis_lease(uuid,uuid,uuid) to service_role;
grant execute on function public.save_gap_analysis_progress(uuid,uuid,jsonb,jsonb) to service_role;
grant execute on function public.finalize_gap_analysis(uuid,uuid,jsonb,jsonb,jsonb,numeric,numeric) to service_role;
