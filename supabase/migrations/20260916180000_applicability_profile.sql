-- Profilo di applicabilita dichiarato dall'organizzazione prima della gap analysis.
-- Serve per gli obblighi che dipendono da chi e' l'organizzazione (fornitore di sistemi di IA,
-- fabbricante di prodotti con elementi digitali, entita' finanziaria, titolare dei dati) e non
-- da cosa e' scritto nei suoi documenti: nessun documento aziendale dichiara queste cose, quindi
-- senza risposta il requisito resterebbe per sempre fra quelli da verificare.
--
-- Forma del valore:
--   {
--     "answers": { "ai_provider": "si" | "no" | "non_so", ... },
--     "size": "piccola impresa (meno di 50 dipendenti)",
--     "declared_at": "2026-09-16T18:00:00.000Z"
--   }
-- Assente o nullo: l'analisi si comporta come prima, valutando tutti gli obblighi.

alter table public.compliance_assessments
  add column if not exists applicability_profile jsonb;

comment on column public.compliance_assessments.applicability_profile is
  'Dichiarazioni di applicabilita rese dall''organizzazione all''avvio della gap analysis';
