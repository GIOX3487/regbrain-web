---
date: 2026-09-21
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["GAP-10", "GAP-12"]
state_review: updated
state_reason: Lo stato descriveva il riquadro delle versioni come parte della pagina dell'analisi; va registrato che non c'e' piu' e che la cronologia resta solo sul server.
roadmap_review: updated
roadmap_reason: GAP-10 citava il confronto fra versioni nell'interfaccia; ora il confronto non e' visibile e torna solo insieme a un modo per ripetere l'analisi, legato a GAP-12.
files: ["src/pages/AssessmentDetail.tsx", "src/components/compliance/AnalysisVersions.tsx", "src/lib/engine-version.ts", "deployment/engine-version.test.mjs", "package.json", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Dopo aver ridotto il riquadro delle versioni ai soli casi utili (analisi fatta con una versione
precedente del sistema, oppure analisi precedente con cui confrontarsi), e' stato chiesto di
togliere anche quei due casi: la pagina dell'analisi deve mostrare l'esito e basta.

## Modifiche e motivazione

Tolti dalla pagina dell'analisi il riquadro delle versioni, il caricamento della cronologia dei giri,
la funzione di ripetizione e i relativi messaggi nelle cinque lingue. Eliminati il componente
`AnalysisVersions.tsx`, la costante con la versione del motore nel frontend e il test che la
confrontava con quella del server, perche' senza il riquadro nessuno li usava piu'.

I due casi vanno via insieme per coerenza: senza il pulsante di ripetizione un'analisi non puo'
avere una versione precedente dall'interfaccia, quindi il confronto non comparirebbe mai.

## Verifiche ed esiti

tsc e build puliti, 27 test di backend verdi (il ventottesimo era quello eliminato). Nel bundle non
compaiono le stringhe del riquadro. Il comportamento del server non cambia: congelamento, riuso a
parita' di documenti, soglia di riuso e registrazione dei giri restano quelli verificati il 20 e il
21 settembre.

## Rischi e limiti

Quando il motore verra' corretto, chi ha un'analisi prodotta con la versione precedente non ne sara'
avvisato e non avra' un modo per ripeterla dall'interfaccia: l'esito consegnato resta quello. La
cronologia dei giri continua a essere registrata e puo' essere letta dal database se servisse
ricostruire cosa e' cambiato.

## Prossimo passo

Con GAP-12, quando si potra' rispondere a una domanda di ambito rimasta aperta, valutare se riportare
la ripetizione dell'analisi e con essa il confronto fra versioni.
