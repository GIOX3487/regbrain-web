-- Verifica di conformità del codice sorgente (Compliance Hub, /compliance/code-check).
-- Si salva l'esito, non il codice: nomi dei file, righe, impronta SHA-256 e le poche righe
-- citate come prova (con i segreti mascherati). Il codice incollato o caricato non resta
-- nel database, perché spesso contiene credenziali e logica riservata.
-- La colonna user_id fa sì che la pulizia delle demo cancelli anche queste righe.

create table if not exists public.code_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Verifica del codice',
  context jsonb not null default '{}'::jsonb,
  files jsonb not null default '[]'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  overall_risk text not null default 'none' check (overall_risk in ('high', 'medium', 'low', 'none')),
  counts jsonb not null default '{}'::jsonb,
  rules_version text,
  model text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists code_checks_user_created_idx on public.code_checks (user_id, created_at desc);

alter table public.code_checks enable row level security;

drop policy if exists "code_checks_select_own" on public.code_checks;
create policy "code_checks_select_own" on public.code_checks
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "code_checks_delete_own" on public.code_checks;
create policy "code_checks_delete_own" on public.code_checks
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "code_checks_admin_read" on public.code_checks;
create policy "code_checks_admin_read" on public.code_checks
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Scrive solo la funzione edge (chiave di servizio): nessuna policy di insert o update.
-- I permessi vanno concessi a mano: una tabella creata fuori dal ruolo postgres non eredita
-- i privilegi predefiniti del progetto, e senza questa riga la funzione edge non può scrivere.
grant all on public.code_checks to service_role;
revoke insert, update on public.code_checks from anon, authenticated;
grant select, delete on public.code_checks to authenticated;
