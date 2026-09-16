-- Gap analysis: verifica documentale per requisito (tutti gli stati, non solo i gap)
alter table public.compliance_assessments
  add column if not exists requirement_checks jsonb;

comment on column public.compliance_assessments.requirement_checks is
  'Esito della verifica documentale per ogni requisito analizzato: {version, generated_at, counts, documents_analyzed, unreadable_documents, checks[]}';

alter table public.identified_gaps
  add column if not exists evidence jsonb,
  add column if not exists coverage_status text,
  add column if not exists severity text;

comment on column public.identified_gaps.evidence is 'Citazioni verificate dai documenti caricati: [{document, quote}]';
comment on column public.identified_gaps.coverage_status is 'missing = nessuna evidenza; partial = documentazione incompleta';
comment on column public.identified_gaps.severity is 'Gravità dell''obbligo dal catalogo (critical/high/medium/low), indipendente dallo stato documentale';
