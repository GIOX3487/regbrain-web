-- Archivia il corpus normativo importato da ZIP (chunk fissi da 2000 caratteri,
-- senza metadati di articolo) e lo sostituisce con l'ingestione article-aware da
-- EUR-Lex (edge function ingest-eurlex-formex). Le tabelle di archivio permettono
-- il rollback; i documenti ZIP restano in `documents` ma non pubblici.

create table if not exists public.archive_chunks_zip_20260908 as
  select c.* from public.chunks c
  where c.document_id in (select id from public.documents where version = 'ZIP-2026-09-08');

create table if not exists public.archive_structured_chunks_zip_20260908 as
  select s.* from public.structured_chunks s
  where s.document_id in (select id from public.documents where version = 'ZIP-2026-09-08');

alter table public.archive_chunks_zip_20260908 enable row level security;
alter table public.archive_structured_chunks_zip_20260908 enable row level security;

delete from public.structured_chunks
  where document_id in (select id from public.documents where version = 'ZIP-2026-09-08');
delete from public.chunks
  where document_id in (select id from public.documents where version = 'ZIP-2026-09-08');

update public.documents
  set is_public = false,
      title = title || ' [archiviato, sostituito da EUR-Lex]'
  where version = 'ZIP-2026-09-08' and title not like '%[archiviato%';
