# RegBrain — audit delle modifiche del socio, 15 settembre 2026

## Perimetro verificato

Repository `GIOX3487/regbrain-web`, confronto `33e6ab6` → `ded7ca2c992343b8517778562d7fc0030113ad75`: 9 commit, 8 file. Copia di analisi: `work/regbrain-partner-2026-09-15`. Nessuna modifica ai sorgenti del socio durante questo audit. Le correzioni RAG locali precedenti restano in `work/regbrain-rag-2026-09-15` e richiedono integrazione selettiva, non sovrascrittura di rag-query.

## Risultati

- Ingestione EUR-Lex Formex per articolo, paragrafo, considerando e allegato, con metadati e copia speculare in chunks.
- Correzione dei confini di parola nel riconoscimento delle norme, conservazione dei candidati semantici, ordinamento delle unità strutturate e completamento delle parti di un paragrafo.
- Archivio del vecchio corpus ZIP con RLS; ricostruzione indici riservata a service_role.
- Nuove automazioni GitHub per backend e frontend. Nessun cambiamento al frontend o a vercel.json negli 8 file.

## Verifica live (lettura soltanto)

Supabase `ndwozjlasabsdfqcyeoy`: rag-query ACTIVE v11, sorgente identico al commit GitHub analizzato. Corpus pubblico: 2.905 unità in chunks e 2.905 in structured_chunks, tutte con embedding. Ripartizione: AI Act 788, CRA 460, Data Act 356, DORA 383, GDPR 563, NIS2 355. Nessun input structured_chunks supera 8.000 caratteri inclusa l'intestazione. Non è stata lanciata alcuna nuova ingestione o ricostruzione indici.

Il vecchio conteggio 60/1.538 è superato dal lavoro del socio. La presenza degli embedding non dimostra da sola accuratezza delle risposte o disponibilità della quota per le nuove richieste.

## Verifiche eseguite

- GitHub Actions Verify application source sul commit ded7ca2: successo (installazione, controlli sintassi, 19 test backend, TypeScript, build).
- Ripetuti localmente: 19 test backend superati; 27 file del controllo sintattico senza errori.
- Controllo aggiuntivo del nuovo ingest-eurlex-formex: zero errori sintattici; non era incluso nell'elenco originario dello script.
- Fixture sintetica splitLongUnit: una riga di 10.000 caratteri rimane una singola parte da 10.000; embedBatch tronca l'input a 8.000. Il corpus pubblico attuale non presenta input oltre soglia.
- Nessuna valutazione completa della qualità delle risposte AI è implicata da questi controlli.

## Problemi e interventi successivi

1. **Deploy automatico Vercel bloccato.** Il tentativo HtUtFHoWMVi3dNALWu5sjezwKNmo su ded7ca2 segnala autore MatteoPiccirilli senza account Vercel collegato a GitHub. L'alternativa GitHub Deploy frontend to Vercel fallisce perché il secret VERCEL_DEPLOY_HOOK è assente. Per l'automazione stabile, collegare correttamente l'account GitHub del socio al suo account Vercel nel team oppure configurare il hook con accesso controllato. Non sono stati modificati account o permessi.
2. **Ingestione può concludersi con vettori mancanti.** embedBatch restituisce null dopo i tentativi falliti; l'handler inserisce comunque e risponde success/done avanzando l'offset. Occorre distinguere completamento testuale e vettoriale e prevedere ripresa dei soli elementi mancanti. Non osservato nel corpus attuale, interamente indicizzato.
3. **Importazioni non atomiche.** reset cancella prima di generare embedding; i lotti cancellano e reinseriscono in due tabelle con chiamate separate. Un errore può lasciare un corpus parziale o copie non allineate. Per future reingestioni: preparazione separata e pubblicazione atomica della nuova versione.
4. **Taglio silenzioso di righe lunghe.** La divisione per righe non garantisce il limite massimo. Aggiungere un secondo livello di divisione per frasi/parole e testare intestazione inclusa.
5. **Correzioni RAG locali ancora necessarie.** Persistono la regex che perde parole italiane, il confronto non esatto di numeri articolo, l'appiattimento dei paragrafi, il punteggio elevato senza citazioni e il ripiego con riferimento fisso a D.Lgs. 138/2024. Integrare i fix locali preservando le nuove strategie del socio. La sua modifica alla rimozione dei marker per singola frase va riconciliata esplicitamente con la rimozione dei passaggi non sostenuti.
6. **Automazioni non subordinate alla verifica.** I workflow di deploy partono indipendentemente da Verify application source; quello del hook segnala solo l'avvio, non attende READY, e la pipeline curl/head senza pipefail può mascherare errori. Subordinare la pubblicazione ai controlli e verificare il risultato finale.

## Pubblicazione

Team di destinazione verificato nella dashboard: Regbrain (`regbrain`), progetto esistente regbrain-web, dominio regbrain-web.vercel.app. Il connettore Vercel è ancora autorizzato soltanto al vecchio team e restituisce 403 sul nuovo; per questa operazione si usa la dashboard autenticata. Esito finale del nuovo deploy da registrare al termine.

## Riferimenti

- Commit: https://github.com/GIOX3487/regbrain-web/commit/ded7ca2c992343b8517778562d7fc0030113ad75
- CI verifica: https://github.com/GIOX3487/regbrain-web/actions/runs/34987058735
- CI hook fallito: https://github.com/GIOX3487/regbrain-web/actions/runs/34987058799
- Dashboard: https://vercel.com/regbrain/regbrain-web
