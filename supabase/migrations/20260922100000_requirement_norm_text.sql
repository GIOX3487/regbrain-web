-- Testo normativo esatto per ogni obbligo del catalogo.
-- Per ogni requisito si prendono dal corpus strutturato (structured_chunks, testo ufficiale
-- Formex in italiano) i paragrafi indicati nel campo "paragraph" del catalogo; se il catalogo
-- non indica paragrafi si prende l'articolo intero. Il testo è calcolato una volta e salvato:
-- la gap analysis lo legge dal catalogo, senza ricerche a ogni giro, così resta ripetibile.

alter table public.regulatory_requirements
  add column if not exists norm_text text,
  add column if not exists norm_citation text,
  add column if not exists norm_chunk_keys text[],
  add column if not exists norm_refreshed_at timestamptz;

create or replace function public.refresh_requirement_norms()
returns table (requirement_id text, citation text, chars integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  reg_code text;
  wanted int[];
  txt text;
  keys text[];
  cites text[];
  max_chars constant int := 4000;
begin
  for r in select q.requirement_id, q.regulation, q.article_number, q.paragraph
           from public.regulatory_requirements q where q.article_number is not null loop
    reg_code := case r.regulation when 'AI Act' then 'AI_ACT' when 'Data Act' then 'DATA_ACT' else upper(r.regulation) end;

    -- "1-3, 7, 4(a), 2.c" -> {1,2,3,7,4,2}: le lettere portano al paragrafo che le contiene.
    select array_agg(distinct p order by p) into wanted
    from (
      select generate_series(
        (regexp_match(trim(tok), '^(\d+)'))[1]::int,
        coalesce((regexp_match(trim(tok), '^\d+\s*-\s*(\d+)'))[1]::int, (regexp_match(trim(tok), '^(\d+)'))[1]::int)
      ) p
      from unnest(string_to_array(coalesce(r.paragraph, ''), ',')) tok
      where trim(tok) ~ '^\d'
    ) x;

    txt := null; keys := null; cites := null;

    if wanted is not null then
      select string_agg(s.chunk_text, E'\n' order by s.paragraph::int, s.chunk_key),
             array_agg(s.chunk_key order by s.paragraph::int, s.chunk_key)
        into txt, keys
      from public.structured_chunks s
      where s.regulation = reg_code
        and s.unit_type = 'paragrafo'
        and s.chunk_key ~ (':art' || r.article_number || '(:|$)')
        and s.paragraph ~ '^\d+$'
        and s.paragraph::int = any (wanted);
    end if;

    if txt is null then
      -- Articolo senza paragrafi numerati, oppure catalogo senza paragrafi indicati.
      select string_agg(s.chunk_text, E'\n' order by s.chunk_key), array_agg(s.chunk_key order by s.chunk_key)
        into txt, keys
      from public.structured_chunks s
      where s.regulation = reg_code and s.unit_type = 'articolo'
        and s.chunk_key ~ (':art' || r.article_number || '$');
    end if;

    if txt is null then
      select string_agg(s.chunk_text, E'\n' order by (case when s.paragraph ~ '^\d+$' then s.paragraph::int else 0 end), s.chunk_key),
             array_agg(s.chunk_key order by s.chunk_key)
        into txt, keys
      from public.structured_chunks s
      where s.regulation = reg_code and s.unit_type = 'paragrafo'
        and s.chunk_key ~ (':art' || r.article_number || ':');
    end if;

    if txt is not null and length(txt) > max_chars then
      txt := left(txt, max_chars) || ' [...]';
    end if;

    update public.regulatory_requirements q
       set norm_text = txt,
           norm_citation = case when txt is null then null else
             (case reg_code when 'AI_ACT' then 'AI Act' when 'DATA_ACT' then 'Data Act' else reg_code end)
             || ', art. ' || r.article_number
             || case when r.paragraph is not null and wanted is not null then ', par. ' || r.paragraph else '' end
           end,
           norm_chunk_keys = keys,
           norm_refreshed_at = now()
     where q.requirement_id = r.requirement_id;
  end loop;

  return query
    select q.requirement_id, q.norm_citation, coalesce(length(q.norm_text), 0)
    from public.regulatory_requirements q
    where q.active
    order by q.requirement_id;
end;
$$;

revoke all on function public.refresh_requirement_norms() from public, anon, authenticated;
grant execute on function public.refresh_requirement_norms() to service_role;


-- Popola subito il testo per il catalogo esistente.
do $$ begin perform public.refresh_requirement_norms(); end $$;
