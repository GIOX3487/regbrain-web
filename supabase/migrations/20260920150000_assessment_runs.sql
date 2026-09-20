-- Una riga per ogni giro di analisi completato.
--
-- Serve a tenere l'esito di ieri accanto a quello di oggi: l'analisi diventa un documento
-- datato invece di un risultato che viene sovrascritto a ogni rifacimento, e il confronto
-- fra due versioni si puo' leggere. Applicata in produzione il 20 settembre 2026.
create table if not exists public.assessment_runs (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.compliance_assessments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  run_number integer not null,
  engine_version text not null,
  reused_from_cache boolean not null default false,
  compliance_percentage numeric,
  risk_score numeric,
  counts jsonb,
  documents jsonb,
  checks jsonb not null,
  created_at timestamptz not null default now(),
  unique (assessment_id, run_number)
);

create index if not exists assessment_runs_assessment_idx
  on public.assessment_runs (assessment_id, run_number desc);

alter table public.assessment_runs enable row level security;

drop policy if exists "Users can read own assessment runs" on public.assessment_runs;
create policy "Users can read own assessment runs"
  on public.assessment_runs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own assessment runs" on public.assessment_runs;
create policy "Users can insert own assessment runs"
  on public.assessment_runs for insert
  with check (auth.uid() = user_id);
