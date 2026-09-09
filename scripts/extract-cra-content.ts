// Script per estrarre il contenuto del CRA dal PDF parsato
// Esegui questo script per ottenere il contenuto completo da copiare nella funzione

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Leggi il file parsato (usa il path del file tool-results che hai)
const parsedContent = `[INSERIRE QUI IL CONTENUTO COMPLETO DEL FILE PARSATO]`;

console.log('Lunghezza totale:', parsedContent.length);
console.log('Numero di parole stimato:', parsedContent.split(/\s+/).length);
console.log('Numero di chunks stimato (2000 char/chunk):', Math.ceil(parsedContent.length / 2000));
