---
date: 2026-10-19
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["OPS-01", "CODE-01"]
state_review: updated
state_reason: Registrata la causa vera del deploy Supabase fallito (token non valido) e il canale provvisorio usato per pubblicare le due funzioni.
roadmap_review: updated
roadmap_reason: OPS-01 passa da errore passeggero a token da rigenerare; criterio di chiusura aggiornato.
files: ["public/bundles/cc-2026-10-19.txt","public/bundles/gad-2026-10-19.txt","docs/memory/STATE.md","roadmap.md"]
---

## Richiesta e contesto

Dopo l'integrazione della PR #59 (2c8a01a) il frontend è andato su Vercel con RULES_VERSION
2026-10-19.1, ma il run «Deploy Supabase Edge Functions» 39245332578 non ha pubblicato nulla:
ogni funzione ha risposto «unexpected list functions status 401: Invalid access token» e il
ritentativo introdotto nella stessa PR ha solo allungato il run, annullato dopo 34 minuti. Il
segreto SUPABASE_ACCESS_TOKEN del repository (aggiornato il 15 settembre) non è più valido:
non era un errore passeggero, e con ogni probabilità non lo era nemmeno il 6 ottobre. Senza la
funzione nuova la pagina pubblicata dava «Verifica non riuscita» per versione delle regole diversa.

## Modifiche e motivazione

Nessun canale a disposizione dell'agente poteva portare 400 KB di sorgenti a Supabase senza
riscriverli a mano (il computer e il contenitore non raggiungono supabase.co; lo strumento MCP
accetta solo testo digitato). Si è quindi usato il percorso già presente dal 7 ottobre, il
caricatore che legge la tabella `public._code_bundle`, riempiendola senza trascrizione:
i due bundle esbuild (code-compliance e generate-audit-document dai sorgenti di 2c8a01a) sono
compressi in gzip, cifrati con AES-256-CBC con una chiave generata per l'occasione e pubblicati
in `public/bundles/` come base64; dal database, l'estensione `http` scarica i file dal sito,
`pgcrypto` li decifra e il risultato viene inserito nella tabella. I caricatori delle due funzioni
verificano l'impronta SHA-256 del codice decompresso prima di eseguirlo. I file pubblicati sono
illeggibili senza la chiave, che non è nel repository, e vanno rimossi insieme alla tabella quando
il deploy dai sorgenti tornerà a funzionare.

## Verifiche ed esiti

- Bundle eseguiti in Deno locale con client finto: entrambi registrano il gestore e rispondono
  200 a OPTIONS e 401 senza sessione.
- Cifratura e decifratura verificate in locale (openssl) prima della pubblicazione; dopo il deploy
  Vercel l'impronta md5 dei file scaricati dal database va confrontata con quella locale
  (cc 4d8fa71253d23b8162986df16a5007de, gad 9db9b1e415fe76a7d3a80522ab040de0) e il caricatore
  controlla l'impronta SHA-256 del codice.
- Non ancora eseguito al momento della scrittura: importazione nella tabella, deploy dei due
  caricatori, collaudo in produzione.

## Rischi e limiti

Produzione dipende da un caricatore provvisorio per due funzioni invece di una; ogni modifica ai
sorgenti richiede di ripetere la procedura finché il token non viene rigenerato. La chiave di
cifratura è usata una sola volta e non protegge nulla oltre a questi due file. La tabella
`_code_bundle` è leggibile solo dal ruolo di servizio.

## Prossimo passo

Il socio rigenera un token di accesso Supabase e aggiorna il segreto SUPABASE_ACCESS_TOKEN su
GitHub; poi rilancio del workflow, verifica che le funzioni risultino pubblicate dai sorgenti
(entrypoint nel percorso del runner, versione aumentata), eliminazione di `public/bundles/` e
della tabella `_code_bundle`, aggiornamento di questo registro.
