-- Gli indici HNSW perdono richiamo dopo cancellazioni e reinserimenti massivi
-- (re-ingestione del corpus): la ricerca vettoriale restituiva vicini sbagliati
-- finché l'indice non veniva ricostruito. Questa funzione, riservata alla chiave
-- di servizio, ricostruisce gli indici vettoriali e aggiorna le statistiche.
create or replace function public.rebuild_embedding_indexes()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  reindex index public.chunks_embedding_idx;
  reindex index public.idx_structured_chunks_embedding;
  analyze public.chunks;
  analyze public.structured_chunks;
end;
$$;

revoke all on function public.rebuild_embedding_indexes() from public, anon, authenticated;
grant execute on function public.rebuild_embedding_indexes() to service_role;
