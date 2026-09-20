-- Requires gap_analysis_atomic_results and assessment_runs migrations.
-- Browser clients can read history, but only the analysis worker may append it.
revoke insert on public.assessment_runs from authenticated;

create function public.start_gap_analysis(p_assessment_id uuid, p_token uuid, p_state jsonb, p_checks jsonb default '[]')
returns void language plpgsql security invoker set search_path = '' as $$
declare prior public.compliance_assessments%rowtype;
begin
  perform 1 from public.gap_analysis_leases where assessment_id=p_assessment_id and token=p_token
    and expires_at > clock_timestamp() for update;
  if not found then raise exception 'Analysis lease expired'; end if;
  select * into strict prior from public.compliance_assessments where id=p_assessment_id for update;
  -- Preserve completed assessments created before run history was introduced.
  if jsonb_array_length(coalesce(prior.requirement_checks->'checks','[]')) > 0
    and not exists (select 1 from public.assessment_runs where assessment_id=p_assessment_id) then
    insert into public.assessment_runs (assessment_id,user_id,run_number,engine_version,reused_from_cache,
      compliance_percentage,risk_score,counts,documents,checks)
    values (p_assessment_id,prior.user_id,1,coalesce(prior.requirement_checks->>'version','unknown'),
      coalesce((prior.requirement_checks->>'reused_from_cache')::boolean,false),prior.overall_compliance_percentage,
      prior.overall_risk_score,prior.requirement_checks->'counts',prior.requirement_checks->'documents_analyzed',prior.requirement_checks->'checks');
  end if;
  delete from public.assessment_requirement_checks where assessment_id=p_assessment_id;
  perform public.save_gap_analysis_progress(p_assessment_id,p_token,p_state,p_checks);
  -- Keep the old result available in history; an incomplete run has no final score.
  update public.compliance_assessments set overall_compliance_percentage=null, overall_risk_score=null,
    completed_at=null where id=p_assessment_id;
end $$;

create function public.finalize_gap_analysis_with_history(p_assessment_id uuid,p_token uuid,p_final jsonb,
  p_progress jsonb,p_gaps jsonb,p_risk numeric,p_compliance numeric)
returns void language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid; next_run integer;
begin
  perform 1 from public.gap_analysis_leases where assessment_id=p_assessment_id and token=p_token
    and expires_at > clock_timestamp() for update;
  if not found then raise exception 'Analysis lease expired'; end if;
  select user_id into strict owner_id from public.compliance_assessments where id=p_assessment_id for update;
  -- A matching count alone cannot detect a substituted or duplicated requirement.
  if (select count(distinct item->>'requirement_id') from jsonb_array_elements(p_final->'checks') item)
       <> jsonb_array_length(p_final->'checks')
    or exists (select 1 from jsonb_array_elements(p_final->'checks') item
      where not exists (select 1 from public.assessment_requirement_checks c
        where c.assessment_id=p_assessment_id and c.requirement_id=item->>'requirement_id')) then
    raise exception 'Mismatched requirement results';
  end if;
  perform public.finalize_gap_analysis(p_assessment_id,p_token,p_final,p_progress,p_gaps,p_risk,p_compliance);
  select coalesce(max(run_number),0)+1 into next_run from public.assessment_runs where assessment_id=p_assessment_id;
  insert into public.assessment_runs (assessment_id,user_id,run_number,engine_version,reused_from_cache,
    compliance_percentage,risk_score,counts,documents,checks)
  values (p_assessment_id,owner_id,next_run,p_final->>'version',coalesce((p_final->>'reused_from_cache')::boolean,false),
    p_compliance,p_risk,p_final->'counts',p_final->'documents_analyzed',p_final->'checks');
end $$;

revoke execute on function public.start_gap_analysis(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
revoke execute on function public.finalize_gap_analysis_with_history(uuid,uuid,jsonb,jsonb,jsonb,numeric,numeric) from public,anon,authenticated;
grant execute on function public.start_gap_analysis(uuid,uuid,jsonb,jsonb) to service_role;
grant execute on function public.finalize_gap_analysis_with_history(uuid,uuid,jsonb,jsonb,jsonb,numeric,numeric) to service_role;
