-- Console di amministrazione: feedback degli utenti, registro eventi della
-- piattaforma, funzioni di lettura riservate agli amministratori e
-- assegnazione del ruolo admin legata a un'email confermata.
--
-- Nota sulla pulizia delle demo: cleanup_expired_demo_sessions() cancella le
-- righe di ogni tabella pubblica che ha una colonna "user_id". Feedback ed
-- eventi usano di proposito "author_id" e "actor_id", così restano anche dopo
-- la scadenza della demo che li ha generati.

-- ---------------------------------------------------------------------------
-- 1. Feedback (pollice su / giù, commento facoltativo)
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  author_email text,
  is_demo boolean not null default false,
  source text not null check (source in ('rag', 'gap_analysis', 'gap_item')),
  target_key text not null check (char_length(target_key) between 1 and 200),
  rating smallint not null check (rating in (-1, 1)),
  comment text check (comment is null or char_length(comment) <= 1000),
  query_log_id uuid references public.query_log(id) on delete set null,
  assessment_id uuid references public.compliance_assessments(id) on delete set null,
  context jsonb not null default '{}'::jsonb check (pg_column_size(context) <= 60000),
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists feedback_author_target_key on public.feedback (author_id, target_key);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists feedback_assessment_idx on public.feedback (assessment_id);

create or replace function public.feedback_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_is_admin boolean := caller is not null and public.has_role(caller, 'admin');
  meta jsonb;
  mail text;
begin
  if tg_op = 'INSERT' then
    if caller is not null then
      new.author_id := caller;
    end if;
    select u.email, u.raw_app_meta_data into mail, meta from auth.users u where u.id = new.author_id;
    new.author_email := mail;
    new.is_demo := coalesce(meta->>'is_demo', 'false') = 'true';
    new.seen_at := null;
    new.created_at := now();
    new.updated_at := now();
    -- Si possono collegare solo conversazioni e analisi proprie.
    if new.query_log_id is not null and not exists (
      select 1 from public.query_log q where q.id = new.query_log_id and q.user_id = new.author_id
    ) then
      new.query_log_id := null;
    end if;
    if new.assessment_id is not null and not exists (
      select 1 from public.compliance_assessments a where a.id = new.assessment_id and a.user_id = new.author_id
    ) then
      new.assessment_id := null;
    end if;
    return new;
  end if;

  -- UPDATE
  if caller is null then
    return new; -- service role
  end if;
  if caller = old.author_id then
    -- L'autore può cambiare solo voto e commento; ogni modifica torna "da leggere".
    new.id := old.id; new.author_id := old.author_id; new.author_email := old.author_email;
    new.is_demo := old.is_demo; new.source := old.source; new.target_key := old.target_key;
    new.query_log_id := old.query_log_id; new.assessment_id := old.assessment_id;
    new.context := old.context; new.created_at := old.created_at;
    if new.rating is distinct from old.rating or new.comment is distinct from old.comment then
      new.seen_at := null;
      new.updated_at := now();
    else
      new.seen_at := old.seen_at;
      new.updated_at := old.updated_at;
    end if;
    return new;
  end if;
  if caller_is_admin then
    -- L'amministratore può solo segnare come letto.
    new.id := old.id; new.author_id := old.author_id; new.author_email := old.author_email;
    new.is_demo := old.is_demo; new.source := old.source; new.target_key := old.target_key;
    new.rating := old.rating; new.comment := old.comment;
    new.query_log_id := old.query_log_id; new.assessment_id := old.assessment_id;
    new.context := old.context; new.created_at := old.created_at; new.updated_at := old.updated_at;
    return new;
  end if;
  raise exception 'Operazione non consentita';
end;
$$;

drop trigger if exists feedback_guard on public.feedback;
create trigger feedback_guard
  before insert or update on public.feedback
  for each row execute function public.feedback_guard();

alter table public.feedback enable row level security;

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback
  for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "feedback_select_own_or_admin" on public.feedback;
create policy "feedback_select_own_or_admin" on public.feedback
  for select to authenticated
  using (author_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "feedback_update_own_or_admin" on public.feedback;
create policy "feedback_update_own_or_admin" on public.feedback
  for update to authenticated
  using (author_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (author_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "feedback_delete_admin" on public.feedback;
create policy "feedback_delete_admin" on public.feedback
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

revoke all on public.feedback from anon;
grant select, insert, update, delete on public.feedback to authenticated;
grant all on public.feedback to service_role;

-- ---------------------------------------------------------------------------
-- 2. Registro eventi della piattaforma
-- ---------------------------------------------------------------------------
create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  level text not null default 'info' check (level in ('info', 'warning', 'error')),
  kind text not null check (char_length(kind) between 1 and 60),
  actor_id uuid,
  actor_email text,
  is_demo boolean not null default false,
  message text not null check (char_length(message) <= 2000),
  details jsonb not null default '{}'::jsonb
);

create index if not exists app_events_created_at_idx on public.app_events (created_at desc);
create index if not exists app_events_level_idx on public.app_events (level, created_at desc);
create index if not exists app_events_kind_idx on public.app_events (kind, created_at desc);

alter table public.app_events enable row level security;

drop policy if exists "app_events_admin_read" on public.app_events;
create policy "app_events_admin_read" on public.app_events
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

revoke all on public.app_events from anon, authenticated;
grant select on public.app_events to authenticated;
grant all on public.app_events to service_role;

create or replace function public.log_app_event(
  p_kind text,
  p_level text,
  p_actor uuid,
  p_message text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mail text;
  meta jsonb;
begin
  if p_actor is not null then
    select u.email, u.raw_app_meta_data into mail, meta from auth.users u where u.id = p_actor;
  end if;
  insert into public.app_events (kind, level, actor_id, actor_email, is_demo, message, details)
  values (
    p_kind,
    coalesce(p_level, 'info'),
    p_actor,
    mail,
    coalesce(meta->>'is_demo', 'false') = 'true',
    left(coalesce(p_message, ''), 2000),
    coalesce(p_details, '{}'::jsonb)
  );
exception when others then
  -- Il registro non deve mai bloccare l'operazione che lo alimenta.
  null;
end;
$$;

revoke all on function public.log_app_event(text, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_app_event(text, text, uuid, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Ruolo admin legato a un'email confermata
-- ---------------------------------------------------------------------------
create table if not exists public.admin_allowlist (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.admin_allowlist enable row level security;
revoke all on public.admin_allowlist from anon, authenticated;
grant all on public.admin_allowlist to service_role;

insert into public.admin_allowlist (email) values ('cecchinoxsempre@gmail.com')
on conflict (email) do nothing;

create or replace function public.grant_admin_if_allowlisted(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role)
  select u.id, 'admin'::public.app_role
  from auth.users u
  join public.admin_allowlist a on a.email = lower(u.email)
  where u.id = p_user
    and u.email_confirmed_at is not null
    and coalesce(u.raw_app_meta_data->>'is_demo', 'false') <> 'true'
  on conflict (user_id, role) do nothing;
end;
$$;
revoke all on function public.grant_admin_if_allowlisted(uuid) from public, anon, authenticated;

-- Account già esistenti e confermati con un'email in elenco.
do $$
declare r record;
begin
  for r in select u.id from auth.users u join public.admin_allowlist a on a.email = lower(u.email) loop
    perform public.grant_admin_if_allowlisted(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Eventi generati dal database
-- ---------------------------------------------------------------------------
create or replace function public.on_auth_user_created_admin_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if coalesce(new.raw_app_meta_data->>'is_demo', 'false') = 'true' then
      perform public.log_app_event('demo_start', 'info', new.id, 'Avviata una sessione demo', '{}'::jsonb);
    else
      perform public.log_app_event('signup', 'info', new.id, 'Nuova registrazione: ' || coalesce(new.email, ''), '{}'::jsonb);
    end if;
    perform public.grant_admin_if_allowlisted(new.id);
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_admin_log on auth.users;
create trigger on_auth_user_created_admin_log
  after insert on auth.users
  for each row execute function public.on_auth_user_created_admin_log();

create or replace function public.on_auth_user_updated_admin_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if new.email_confirmed_at is not null and old.email_confirmed_at is null then
      perform public.log_app_event('email_confirmed', 'info', new.id, 'Email confermata: ' || coalesce(new.email, ''), '{}'::jsonb);
      perform public.grant_admin_if_allowlisted(new.id);
    end if;
    if new.last_sign_in_at is distinct from old.last_sign_in_at
       and coalesce(new.raw_app_meta_data->>'is_demo', 'false') <> 'true'
       and old.last_sign_in_at is not null then
      perform public.log_app_event('login', 'info', new.id, 'Accesso: ' || coalesce(new.email, ''), '{}'::jsonb);
    end if;
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated_admin_log on auth.users;
create trigger on_auth_user_updated_admin_log
  after update of email_confirmed_at, last_sign_in_at on auth.users
  for each row execute function public.on_auth_user_updated_admin_log();

create or replace function public.on_query_log_admin_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_app_event(
    'rag_query', 'info', new.user_id,
    'Domanda alla chat: ' || left(regexp_replace(coalesce(new.question, ''), '\s+', ' ', 'g'), 180),
    jsonb_build_object('query_log_id', new.id, 'latency_ms', new.latency_ms, 'model', new.model,
      'citations', coalesce(jsonb_array_length(case when jsonb_typeof(new.citations) = 'array' then new.citations else '[]'::jsonb end), 0))
  );
  return new;
end;
$$;

drop trigger if exists on_query_log_admin_log on public.query_log;
create trigger on_query_log_admin_log
  after insert on public.query_log
  for each row execute function public.on_query_log_admin_log();

create or replace function public.on_assessment_admin_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_app_event('assessment_created', 'info', new.user_id,
      'Nuova gap analysis: ' || coalesce(new.title, 'senza titolo'),
      jsonb_build_object('assessment_id', new.id, 'regulations', to_jsonb(new.scope_regulations)));
  elsif new.status is distinct from old.status and new.status = 'completed' then
    perform public.log_app_event('assessment_completed', 'info', new.user_id,
      'Gap analysis completata: ' || coalesce(new.title, 'senza titolo')
        || coalesce(' (' || round(new.overall_compliance_percentage)::text || '%)', ''),
      jsonb_build_object('assessment_id', new.id, 'compliance', new.overall_compliance_percentage));
  end if;
  return new;
end;
$$;

drop trigger if exists on_assessment_admin_log on public.compliance_assessments;
create trigger on_assessment_admin_log
  after insert or update of status on public.compliance_assessments
  for each row execute function public.on_assessment_admin_log();

create or replace function public.on_assessment_documents_admin_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare r record;
begin
  for r in select user_id, assessment_id, count(*) n from new_rows group by user_id, assessment_id loop
    perform public.log_app_event('documents_uploaded', 'info', r.user_id,
      'Caricati ' || r.n || case when r.n = 1 then ' documento' else ' documenti' end || ' per una gap analysis',
      jsonb_build_object('assessment_id', r.assessment_id, 'count', r.n));
  end loop;
  return null;
end;
$$;

drop trigger if exists on_assessment_documents_admin_log on public.assessment_documents;
create trigger on_assessment_documents_admin_log
  after insert on public.assessment_documents
  referencing new table as new_rows
  for each statement execute function public.on_assessment_documents_admin_log();

create or replace function public.on_feedback_admin_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  what text := case new.source when 'rag' then 'risposta della chat' when 'gap_analysis' then 'gap analysis' else 'esito di un obbligo' end;
begin
  if tg_op = 'UPDATE' and new.rating is not distinct from old.rating and new.comment is not distinct from old.comment then
    return new;
  end if;
  perform public.log_app_event('feedback', case when new.rating < 0 then 'warning' else 'info' end, new.author_id,
    case when new.rating > 0 then 'Pollice su' else 'Pollice giù' end || ' su ' || what
      || case when new.comment is not null and new.comment <> '' then ': "' || left(new.comment, 160) || '"' else '' end,
    jsonb_build_object('feedback_id', new.id, 'source', new.source, 'rating', new.rating));
  return new;
end;
$$;

drop trigger if exists on_feedback_admin_log on public.feedback;
create trigger on_feedback_admin_log
  after insert or update on public.feedback
  for each row execute function public.on_feedback_admin_log();

-- ---------------------------------------------------------------------------
-- 5. Letture riservate agli amministratori
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Riservato agli amministratori' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users_registered', (select count(*) from auth.users where coalesce(raw_app_meta_data->>'is_demo','false') <> 'true'),
    'users_new_7d', (select count(*) from auth.users where coalesce(raw_app_meta_data->>'is_demo','false') <> 'true' and created_at > now() - interval '7 days'),
    'demo_active', (select count(*) from auth.users where raw_app_meta_data->>'is_demo' = 'true' and (raw_app_meta_data->>'demo_expires_at')::timestamptz > now()),
    'demo_started_7d', (select count(*) from public.app_events where kind = 'demo_start' and created_at > now() - interval '7 days'),
    'active_24h', (select count(distinct actor_id) from public.app_events where actor_id is not null and created_at > now() - interval '24 hours'),
    'assessments_total', (select count(*) from public.compliance_assessments),
    'assessments_in_progress', (select count(*) from public.compliance_assessments where status = 'in_progress'),
    'assessments_completed_7d', (select count(*) from public.compliance_assessments where status = 'completed' and completed_at > now() - interval '7 days'),
    'queries_24h', (select count(*) from public.query_log where created_at > now() - interval '24 hours'),
    'queries_7d', (select count(*) from public.query_log where created_at > now() - interval '7 days'),
    'rag_latency_ms_7d', (select round(avg(latency_ms)) from public.query_log where created_at > now() - interval '7 days' and latency_ms > 0),
    'feedback_up_30d', (select count(*) from public.feedback where rating = 1 and created_at > now() - interval '30 days'),
    'feedback_down_30d', (select count(*) from public.feedback where rating = -1 and created_at > now() - interval '30 days'),
    'feedback_unread', (select count(*) from public.feedback where seen_at is null),
    'errors_24h', (select count(*) from public.app_events where level = 'error' and created_at > now() - interval '24 hours'),
    'warnings_24h', (select count(*) from public.app_events where level = 'warning' and kind <> 'feedback' and created_at > now() - interval '24 hours')
  );
end;
$$;

create or replace function public.admin_users()
returns table (
  id uuid, email text, is_demo boolean, is_admin boolean, created_at timestamptz,
  last_sign_in_at timestamptz, email_confirmed boolean, demo_expires_at timestamptz,
  sector text, assessments bigint, queries bigint, feedback_up bigint, feedback_down bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Riservato agli amministratori' using errcode = '42501';
  end if;
  return query
  select u.id, u.email::text,
    coalesce(u.raw_app_meta_data->>'is_demo','false') = 'true',
    exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin'),
    u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
    nullif(u.raw_app_meta_data->>'demo_expires_at','')::timestamptz,
    p.sector,
    (select count(*) from public.compliance_assessments a where a.user_id = u.id),
    (select count(*) from public.query_log q where q.user_id = u.id),
    (select count(*) from public.feedback f where f.author_id = u.id and f.rating = 1),
    (select count(*) from public.feedback f where f.author_id = u.id and f.rating = -1)
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
end;
$$;

create or replace function public.admin_recent_queries(p_limit integer default 50)
returns table (
  id uuid, created_at timestamptz, email text, is_demo boolean, question text, answer text,
  latency_ms integer, model text, citations integer, rating smallint, comment text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Riservato agli amministratori' using errcode = '42501';
  end if;
  return query
  select q.id, q.created_at, u.email::text,
    coalesce(u.raw_app_meta_data->>'is_demo','false') = 'true',
    left(q.question, 1000), left(q.answer, 4000), q.latency_ms, q.model,
    coalesce(jsonb_array_length(case when jsonb_typeof(q.citations) = 'array' then q.citations else '[]'::jsonb end), 0)::integer,
    f.rating, f.comment
  from public.query_log q
  left join auth.users u on u.id = q.user_id
  left join lateral (
    select f.rating, f.comment from public.feedback f where f.query_log_id = q.id order by f.updated_at desc limit 1
  ) f on true
  order by q.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

create or replace function public.admin_recent_assessments(p_limit integer default 50)
returns table (
  id uuid, created_at timestamptz, completed_at timestamptz, email text, is_demo boolean,
  title text, status text, compliance numeric, regulations text[], progress jsonb,
  documents bigint, runs bigint, feedback_up bigint, feedback_down bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Riservato agli amministratori' using errcode = '42501';
  end if;
  return query
  select a.id, a.created_at, a.completed_at, u.email::text,
    coalesce(u.raw_app_meta_data->>'is_demo','false') = 'true',
    a.title, a.status, a.overall_compliance_percentage, a.scope_regulations,
    case when a.analysis_progress is null then null else jsonb_build_object(
      'done', a.analysis_progress->'done', 'total', a.analysis_progress->'total', 'status', a.analysis_progress->'status') end,
    (select count(*) from public.assessment_documents d where d.assessment_id = a.id),
    (select count(*) from public.assessment_runs r where r.assessment_id = a.id),
    (select count(*) from public.feedback f where f.assessment_id = a.id and f.rating = 1),
    (select count(*) from public.feedback f where f.assessment_id = a.id and f.rating = -1)
  from public.compliance_assessments a
  left join auth.users u on u.id = a.user_id
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_users() from public, anon;
revoke all on function public.admin_recent_queries(integer) from public, anon;
revoke all on function public.admin_recent_assessments(integer) from public, anon;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_users() to authenticated;
grant execute on function public.admin_recent_queries(integer) to authenticated;
grant execute on function public.admin_recent_assessments(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Tempo reale e conservazione
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feedback') then
    execute 'alter publication supabase_realtime add table public.feedback';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_events') then
    execute 'alter publication supabase_realtime add table public.app_events';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'app-events-retention';
    perform cron.schedule('app-events-retention', '17 3 * * *',
      $cron$delete from public.app_events where created_at < now() - interval '90 days'$cron$);
  end if;
end $$;
