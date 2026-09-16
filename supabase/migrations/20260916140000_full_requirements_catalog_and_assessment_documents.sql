-- Catalogo completo delle disposizioni: campi usati dall'auditor documentale
alter table public.regulatory_requirements
  add column if not exists evidence_expected_it text,
  add column if not exists conditional boolean not null default false,
  add column if not exists applicability_note_it text,
  add column if not exists article_title text,
  add column if not exists source_document_id uuid,
  add column if not exists generated_at timestamptz;

create index if not exists regulatory_requirements_regulation_active_idx
  on public.regulatory_requirements (regulation, active);

-- Documenti caricati per una valutazione: permettono di proseguire l'analisi a tranche
create table if not exists public.assessment_documents (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.compliance_assessments(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  type text,
  content text not null,
  content_hash text,
  content_length integer,
  created_at timestamptz not null default now()
);
create index if not exists assessment_documents_assessment_idx on public.assessment_documents (assessment_id);

alter table public.assessment_documents enable row level security;
drop policy if exists "assessment_documents_owner_select" on public.assessment_documents;
create policy "assessment_documents_owner_select" on public.assessment_documents
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "assessment_documents_owner_delete" on public.assessment_documents;
create policy "assessment_documents_owner_delete" on public.assessment_documents
  for delete to authenticated using (user_id = auth.uid());
-- inserimenti e aggiornamenti avvengono solo dalla funzione edge con service role

-- I default privilege del progetto non coprono le tabelle nuove: concessioni esplicite
grant select, insert, update, delete on public.assessment_documents to service_role;
grant select, delete on public.assessment_documents to authenticated;

-- Embedding del requisito calcolato una volta sola e riusato da ogni analisi
alter table public.regulatory_requirements
  add column if not exists embedding vector(768);

-- Avanzamento leggero dell'analisi, letto dalla pagina durante la verifica
alter table public.compliance_assessments
  add column if not exists analysis_progress jsonb;

-- Esiti dei singoli requisiti mentre l'analisi è in corso (il blob finale si compone alla fine)
create table if not exists public.assessment_requirement_checks (
  assessment_id uuid not null references public.compliance_assessments(id) on delete cascade,
  requirement_id text not null,
  check_payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (assessment_id, requirement_id)
);
alter table public.assessment_requirement_checks enable row level security;
drop policy if exists "arc_owner_select" on public.assessment_requirement_checks;
create policy "arc_owner_select" on public.assessment_requirement_checks
  for select to authenticated using (
    exists (select 1 from public.compliance_assessments a where a.id = assessment_id and a.user_id = auth.uid())
  );
grant select, insert, update, delete on public.assessment_requirement_checks to service_role;
grant select on public.assessment_requirement_checks to authenticated;
