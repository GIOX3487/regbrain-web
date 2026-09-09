// Script per caricare il Cyber Resilience Act nel RAG
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function loadCRA() {
  try {
    console.log('🚀 Caricamento Cyber Resilience Act nel RAG...');

    // Leggi il file PDF
    const pdfPath = path.join(__dirname, '../public/documents/cyber-resilience-act-2024.pdf');
    const pdfBuffer = fs.readFileSync(pdfPath);
    const base64data = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

    console.log('📄 File PDF letto correttamente');

    // Chiama la funzione process-document
    const { data, error } = await supabase.functions.invoke('process-document', {
      body: {
        file_data: base64data,
        file_name: 'cyber-resilience-act-2024.pdf',
        title: 'Cyber Resilience Act - IT',
        version: 'Reg. 2024/2847',
        jurisdiction: 'EU',
        sector: 'Cybersecurity',
        source_url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=OJ:L_202402847',
        language: 'IT',
      }
    });

    if (error) {
      console.error('❌ Errore durante il caricamento:', error);
      process.exit(1);
    }

    console.log('✅ Cyber Resilience Act caricato con successo!');
    console.log(`📊 Chunks creati: ${data.chunks_created}`);
    console.log(`🆔 Document ID: ${data.document_id}`);
    
  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
}

loadCRA();
