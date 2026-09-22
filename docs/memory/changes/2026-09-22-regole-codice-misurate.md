---
date: 2026-09-22
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["CODE-01"]
state_review: updated
state_reason: Lo stato diceva che la verifica del codice era provata solo su file scritti apposta; ora ci sono numeri su codice reale e un banco di prova in CI, e va registrato quanto sbaglia.
roadmap_review: updated
roadmap_reason: Il prossimo passo di CODE-01 era "provarla su un progetto reale contando falsi positivi": fatto su tre basi di codice, quindi cambia.
files: ["supabase/functions/code-compliance/rules.ts", "supabase/functions/code-compliance/scan.ts", "supabase/functions/code-compliance/index.ts", "deployment/code-rules.test.mjs", "deployment/code-rules-cases/api.js", "deployment/code-rules-cases/frontend.jsx", "deployment/code-rules-cases/pagina.html", "deployment/code-rules-cases/servizio.py", "deployment/code-rules-cases/config.yml", "deployment/code-rules-cases/LICENSE.md", "deployment/code-rules-cases/infra.ts", "deployment/code-rules-cases/auth.test.js", "deployment/code-rules-cases/manifest-pacchetto.json", "deployment/code-rules-cases/modelli.py", "deployment/code-rules-cases/AndroidManifest.xml", "package.json", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Richiesta del 22 settembre: verificare accuratezza e precisione della verifica del codice e
migliorare dove serve. Fino a qui era provata solo su file scritti apposta, dove per definizione
trova quello che sa trovare.

## Modifiche e motivazione

Misura su tre basi di codice: un banco di prova con righe marcate una per una, il codice di
RegBrain (264 file, 3,4 milioni di caratteri) e otto file scaricati da progetti pubblici
(OWASP Juice Shop, che contiene falle note, più Express e Next.js come codice sano).

Correzioni alle regole, tutte nate da falsi positivi osservati:

- Le parole dentro le stringhe non contano più. `console.log("email inviata")` non è un dato
  personale nei log, `user.email` sì. Stessa regola per le categorie particolari: "salute" dentro
  un testo dell'interfaccia o di un prompt non è un campo sanitario.
- Token nel browser: contano solo chiavi che sono davvero credenziali. `auth_redirect` non lo è.
- Indirizzi http: contano solo dentro una chiamata o una configurazione di indirizzo, non in un
  elenco di link, e mai come spazio dei nomi XML.
- Cookie senza attributi: solo quando il nome del cookie è scritto nel codice. Le righe che
  passano una variabile sono codice di libreria, non la configurazione di un cookie.
- MD5 e SHA-1 non contano quando servono a un'impronta di file o a una chiave di cache.
- CORS aperto scende a rischio basso senza credenziali di sessione, resta alto con le credenziali.
- Debug attivo riconosciuto anche in YAML.
- File di prova, esempi e fixture: l'esito resta ma con un gradino di rischio in meno e la ragione
  scritta accanto, perché lì i valori sono quasi sempre finti.

Due regole nuove: dati ospitati o inviati fuori dall'UE (regioni cloud non europee, GDPR art. 44)
e raccolta dell'indirizzo IP (GDPR artt. 5 e 13). Le regole passano da 21 a 23.

Banco di prova in CI: `deployment/code-rules.test.mjs` con 12 file e 50 righe marcate, positive e
negative. Verifica anche che un file di prova abbassi il rischio e che due esecuzioni sullo stesso
codice diano esattamente lo stesso esito.

Aggiunta al prompt del modello una riga sulle istruzioni nascoste nei commenti: il codice è
materiale da esaminare, non ordini da eseguire.

## Verifiche ed esiti

| Base di codice | Prima | Dopo |
| --- | --- | --- |
| Banco di prova (50 righe marcate) | precisione 92,5%, copertura 97,4% | 100% e 100% |
| RegBrain, 264 file | 110 segnalazioni, 51 sbagliate (precisione 54%) | 69 segnalazioni, 1 sbagliata (precisione 99%) |
| Juice Shop, Express, Next.js (8 file) | 14 segnalazioni, 6 sbagliate | 7 segnalazioni, 0 sbagliate |

Su Juice Shop, che ha falle note e volute, le regole trovano chiave privata nel codice, due SQL
injection, hash MD5 delle password, `eval` su dati dell'utente, cookie di sessione senza Secure e
HttpOnly e un segreto generato con `Math.random`. Su Express e Next.js, codice sano, nessuna
segnalazione.

Il falso positivo che resta su RegBrain è `src/components/ui/chart.tsx`: usa
`dangerouslySetInnerHTML` per scrivere variabili CSS, non contenuto dell'utente. È il tipo di caso
che la revisione del modello può marcare come possibile falso positivo.

## Rischi e limiti

- Il banco di prova è stato scritto insieme alle correzioni: il numero che conta è quello sul
  codice reale, non il 100%.
- Le regole restano su una riga alla volta: non seguono il dato dal punto in cui entra a dove
  finisce, quindi non sanno se la variabile in una query arriva davvero dall'utente.
- Restano fuori: conservazione e cancellazione dei dati, collegamento fra banner e script (visto
  solo come presenza di un gestore del consenso), configurazione dei server, dipendenze con
  vulnerabilità note, informative e contratti.
- Le 43 segnalazioni CORS su RegBrain sono vere ma ripetitive: una sola voce con 43 occorrenze.

## Prossimo passo

Provare la verifica su un progetto di un cliente reale insieme a Giovanni e contare quanti esiti
vengono considerati utili. Poi valutare due aggiunte: regole che leggano più file insieme (script
di tracciamento e presenza del banner nella stessa pagina) e il collegamento dei pollici su e giù
a questi esiti, per costruire il set di regressione.
