---
date: 2026-09-19
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["DOC-01"]
state_review: updated
state_reason: Va registrato che il Gap Report duplicava il referto gia' scaricabile e che i documenti generabili scendono da quattro a tre.
roadmap_review: updated
roadmap_reason: Aggiornato DOC-01 con la rimozione del quarto documento.
files: ["src/pages/AssessmentDetail.tsx", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Togliere il Gap Report dalla sezione "Genera Documentazione Audit-Ready" perche' duplica quanto gia'
scritto nel referto della gap analysis.

## Verifica della duplicazione

Confronto fatto prima di rimuovere. Il pulsante "Esporta PDF" in cima alla pagina produce gia' un
referto che contiene: executive summary con percentuale di conformita', livello, profilo di rischio e
ripartizione dei gap; la base di calcolo con obblighi valutati e da verificare; il piano d'azione
completo; gli elenchi dei requisiti documentati, dei gap con le citazioni testuali, dei da verificare
e dei non applicabili; l'avvertenza sui limiti dell'analisi e i documenti scartati perche' illeggibili.

Il Gap Report generato conteneva `executive_summary`, `risultati_per_normativa` e `conclusioni`:
le stesse informazioni riscritte dal modello in forma discorsiva. Nella prova del 19 settembre i suoi
numeri coincidevano esattamente con quelli del referto, il che conferma che non aggiungeva nulla,
solo un secondo modo di dirlo.

Due documenti che raccontano lo stesso fatto sono due versioni della stessa verita' che col tempo
divergono: basta che una delle due formule cambi e i due testi iniziano a contraddirsi, davanti a un
cliente.

## Modifiche e motivazione

Rimosso il pulsante Gap Report. I documenti generabili restano tre: DPIA, LIA e Analisi Rischi art.
24, che sono documenti che la gap analysis non produce e che vanno costruiti a parte.

Il ramo che formatta un gap_report in `src/lib/document-pdf-export.ts` resta al suo posto: non e'
raggiungibile dall'interfaccia ma continua a rendere leggibile un eventuale documento di quel tipo
gia' generato in passato. Anche il tipo lato funzione edge resta, inerte.

## Verifiche ed esiti

Controllo dei tipi e build di produzione senza errori. Nessun altro punto dell'applicazione offre
quel tipo di documento: l'unico riferimento residuo e' il formattatore del PDF.

## Rischi e limiti

Chi voleva il riassunto discorsivo scritto dal modello, invece dell'esposizione strutturata del
referto, ora non ce l'ha. Se serve, la strada giusta non e' un secondo documento ma una sezione
narrativa dentro il referto stesso, generata dagli stessi numeri.

Resta in giro codice non raggiungibile (il formattatore e il tipo lato funzione). E' voluto, per non
rompere documenti gia' esistenti, ma e' debito da togliere se il tipo non verra' piu' usato.

## Prossimo passo

Se il riassunto discorsivo serve davvero, valutare di aggiungerlo come sezione dell'esportazione PDF
invece che come documento separato.
