---
date: 2026-09-19
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["SITE-03"]
state_review: updated
state_reason: Va registrata la ripulitura della barra laterale della chat, che toglie due voci senza effetto e introduce l'eliminazione delle conversazioni.
roadmap_review: updated
roadmap_reason: Aggiunto SITE-03 per gli interventi sull'interfaccia della chat.
files: ["src/pages/Chat.tsx", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Usando la chat sono emerse tre cose nella barra laterale: il tasto Audit Log ripete lo storico gia'
presente subito sotto come conversazioni recenti, il tasto Chat non fa nulla perche' quella barra
compare solo dentro la chat stessa, e mancava un modo per cancellare una conversazione.

## Modifiche e motivazione

Tolto il tasto Audit Log dalla navigazione. La pagina resta raggiungibile dalla rotta `/audit`, che
non e' stata toccata: cambia solo che non occupa piu' una riga per mostrare quello che l'elenco
sotto mostra gia', con il titolo della domanda e la data.

Tolto il tasto Chat. La barra laterale e' definita dentro `Chat.tsx` e compare solo in quella
pagina, quindi quel tasto portava sempre dove l'utente era gia'. Non lascia nessuno bloccato: dal
Compliance Hub il ritorno alla chat esiste gia'.

Il tasto "Nuova conversazione" diventa un piu' nell'intestazione dell'elenco delle conversazioni
recenti, con descrizione al passaggio del cursore. La posizione non e' casuale: il piu' sta sopra
l'elenco che riempie, dove l'occhio lo cerca quando vuole una conversazione in piu', e restituisce
una riga intera alla navigazione invece di spenderla per un'azione che si capisce da un'icona.

Ogni conversazione dell'elenco ha ora un cestino che compare al passaggio del cursore e con il
fuoco da tastiera. Il cestino sta sulla riga che elimina, non in un menu a parte, cosi' non e'
possibile cancellare la conversazione sbagliata. La conferma e' esplicita e riporta il testo della
domanda. Se la conversazione eliminata e' quella aperta, la schermata torna vuota invece di
continuare a mostrare un contenuto che non esiste piu'.

L'eliminazione cancella la riga da `query_log`. La politica di riga `Users can delete own queries`
esiste gia' sulla tabella e limita la cancellazione alle righe dell'utente: nessuna modifica al
database.

Corretto anche il testo mostrato quando non ci sono conversazioni, che rimandava all'Audit Log.

## Verifiche ed esiti

Controllo dei tipi del frontend e build di produzione completati senza errori. La struttura della
riga e' stata riscritta per non annidare un pulsante dentro un altro, che non e' HTML valido: la
riga e' ora un contenitore con il pulsante di apertura e quello di eliminazione affiancati.

Nessuna modifica al database, alle funzioni edge o alle rotte.

## Rischi e limiti

L'eliminazione e' definitiva e non ha un annulla: la conferma e' l'unica protezione. Su un elenco
lungo qualcuno potrebbe volere anche un "elimina tutte", che non e' stato aggiunto perche' non
richiesto e perche' e' l'operazione piu' facile da rimpiangere.

Il cestino compare al passaggio del cursore. Su touch non c'e' passaggio del cursore: il pulsante
resta raggiungibile con il tocco perche' e' sempre nel documento, ma e' trasparente finche' non
riceve il fuoco. Va guardato su telefono prima di considerarlo chiuso.

La verifica e' stata fatta su controllo dei tipi e build, non su una prova a schermo con un utente
autenticato.

## Prossimo passo

Guardare la barra laterale su telefono e verificare il comportamento del cestino al tocco. Se
risulta scomodo, mostrarlo sempre visibile sotto una certa larghezza invece che al passaggio del
cursore.
