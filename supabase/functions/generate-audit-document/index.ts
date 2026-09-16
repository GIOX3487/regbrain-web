import { protect } from '../_shared/access.ts';
import { aiFetch as fetch, getAIKey, getAIModel } from '../_shared/ai.ts';
import { serve as denoServe } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

denoServe(protect(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    const { documentType, assessmentId, conversationHistory, language = 'it', mode = 'standard', userConfig = null } = body;
    let userDocumentsSummary: string = body.userDocumentsSummary || '';
    const normalizedLanguage = String(language || 'it').toLowerCase().startsWith('it') ? 'it' : String(language || 'it').toLowerCase();
    const normalizedMode = ['breve', 'standard', 'audit'].includes(mode) ? mode : 'standard';

    // ── CHECK: Is this a background worker call? ──
    if (body._backgroundDocId) {
      console.log('Background worker started for document:', body._backgroundDocId);
      await doGenerateDocument(supabase, {
        docId: body._backgroundDocId,
        userId: user.id,
        documentType,
        assessmentId: assessmentId || '',
        conversationHistory,
        normalizedLanguage,
        normalizedMode,
        userDocumentsSummary,
        userConfig,
        assessment: body._assessment,
        profile: body._profile,
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── PHASE 1: Create pending record and return immediately ──
    const fromChat = body.source === 'chat' && !assessmentId;
    if (!['dpia', 'ropa', 'lia', 'gap_report', 'risk_analysis'].includes(String(documentType))) {
      throw new Error('Tipo di documento non supportato');
    }
    console.log('Creating pending document:', documentType, fromChat ? 'from chat context' : `for assessment: ${assessmentId}`);

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    let assessment: any = null;
    let chatHistory: any[] = Array.isArray(conversationHistory) ? conversationHistory : [];
    if (fromChat) {
      const built = buildAssessmentFromChat(body.chatContext, profile);
      assessment = built.assessment;
      chatHistory = built.history;
      if (!userDocumentsSummary && typeof body.chatContext?.attachedDocsSummary === 'string') {
        userDocumentsSummary = body.chatContext.attachedDocsSummary.substring(0, 40000);
      }
    } else {
      const { data: found } = await supabase
        .from('compliance_assessments')
        .select('*, identified_gaps(*)')
        .eq('id', assessmentId)
        .single();
      if (!found) {
        throw new Error('Assessment not found');
      }
      assessment = found;
    }

    const { data: pendingDoc, error: pendingError } = await supabase
      .from('generated_documents')
      .insert({
        user_id: user.id,
        assessment_id: fromChat ? null : assessmentId,
        document_type: documentType,
        title: getDefaultTitle(documentType, assessment, normalizedLanguage),
        content: { _status: 'generating', _started_at: new Date().toISOString() },
        metadata: {
          generated_at: new Date().toISOString(),
          based_on_assessment: fromChat ? null : assessmentId,
          source: fromChat ? 'chat' : 'assessment',
          goal: fromChat ? assessment.title : undefined,
          regulations: assessment.scope_regulations,
          mode: normalizedMode,
          status: 'generating',
        }
      })
      .select()
      .single();

    if (pendingError) {
      console.error('Error creating pending document:', pendingError);
      throw pendingError;
    }

    console.log('Pending document created:', pendingDoc.id, '— firing background worker');

    const selfUrl = `${supabaseUrl}/functions/v1/generate-audit-document`;
    fetch(selfUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        _backgroundDocId: pendingDoc.id,
        documentType,
        assessmentId: fromChat ? undefined : assessmentId,
        source: fromChat ? 'chat' : undefined,
        conversationHistory: chatHistory,
        language: normalizedLanguage,
        mode: normalizedMode,
        userDocumentsSummary,
        userConfig,
        _assessment: assessment,
        _profile: profile,
      }),
    }).catch(err => console.error('Background worker fire-and-forget error (non-critical):', err));

    return new Response(
      JSON.stringify({
        success: true,
        document: pendingDoc,
        status: 'generating',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-audit-document function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}, false, true));

// ── Background worker: does the actual heavy AI generation ──
async function doGenerateDocument(supabase: any, params: {
  docId: string;
  userId: string;
  documentType: string;
  assessmentId: string;
  conversationHistory: any[];
  normalizedLanguage: string;
  normalizedMode: string;
  userDocumentsSummary: string;
  userConfig?: any;
  assessment: any;
  profile: any;
}) {
  const { docId, userId, documentType, assessmentId, normalizedLanguage, normalizedMode, userDocumentsSummary, userConfig, assessment, profile } = params;
  
  try {
    const conversationContext = params.conversationHistory 
      ? formatConversationHistory(params.conversationHistory)
      : '';

    const regulatoryContext = await fetchRegulatoryContext(supabase, documentType);
    console.log(`Fetched ${regulatoryContext ? regulatoryContext.length : 0} chars of regulatory context for ${documentType}`);

    const LOVABLE_API_KEY = getAIKey();
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const documentPrompt = buildDocumentPrompt(
      documentType,
      assessment,
      profile,
      conversationContext,
      normalizedLanguage,
      normalizedMode,
      regulatoryContext,
      userDocumentsSummary,
      userConfig
    );

    const modeInstruction = normalizedMode === 'breve'
      ? '\n\nMODALITÀ BREVE: Genera una versione EXECUTIVE SUMMARY sintetica. Ogni sezione deve essere concisa (max 3-5 righe) mantenendo i punti chiave. Il documento deve essere di 5-8 pagine equivalenti.'
      : normalizedMode === 'audit'
      ? '\n\nMODALITÀ AUDIT: Aggiungi checklist ISO 27001 + GDPR mapping completo. Per ogni sezione includi riferimento incrociato ai controlli ISO 27001:2022 (Annex A). Aggiungi sezione extra di mappatura GDPR ↔ ISO 27001. Il documento deve essere di 40+ pagine equivalenti.'
      : '\n\nMODALITÀ STANDARD: Genera documento professionale completo e dettagliato, pronto per audit. Il documento deve essere di 25-30 pagine equivalenti.';

    const dataRule = `\n\nREGOLA DATI AZIENDALI:
- Usa i dati reali dall'assessment e dal profilo utente dove disponibili (settore: ${assessment.scope_sector}, giurisdizione: ${assessment.scope_jurisdiction}, ruolo: ${profile?.compliance_role || 'DPO'})
- Per dati aziendali specifici NON disponibili nel contesto (ragione sociale, P.IVA, PEC, telefono, nomi persone, indirizzi), usa SEMPRE il placeholder '[DA COMPLETARE - descrizione del dato richiesto]'
- È preferibile un campo da completare piuttosto che un dato inventato e falso
- I placeholder devono essere in formato: [DA COMPLETARE - descrizione del dato richiesto]
- NON inventare MAI nomi di persone, ragioni sociali, codici fiscali, numeri di telefono o indirizzi PEC
- For language=it, ALL narrative content must be in Italian only (never English words like assessment, mitigation, high risk, controller, processor, yes/no). Use exclusively Sì/No and terminology GDPR in italiano.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: getDocumentSystemPrompt(documentType, normalizedLanguage, normalizedMode)
          },
          {
            role: 'user',
            content: documentPrompt + modeInstruction + dataRule + '\n\nIMPORTANT: You MUST use the generate_compliance_document function to return the document. Always call the function with the complete document data. Fill EVERY section with detailed, specific, professional content.'
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_compliance_document',
            description: `Generate a professional ${documentType.toUpperCase()} compliance document. You MUST call this function with all required fields filled with detailed professional content.`,
            parameters: getDocumentSchema(documentType, normalizedMode)
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_compliance_document' } }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received, processing...');
    
    let documentContent: Record<string, any>;
    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
    
    if (toolCall) {
      try {
        documentContent = JSON.parse(toolCall.function.arguments);
        console.log('Document parsed from tool call');
      } catch (parseError) {
        console.error('Error parsing tool call arguments:', parseError);
        throw new Error('Failed to parse AI response');
      }
    } else {
      const messageContent = aiData.choices[0]?.message?.content;
      console.log('No tool call, attempting to parse content directly');
      
      if (messageContent) {
        try {
          const jsonMatch = messageContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            documentContent = JSON.parse(jsonMatch[0]);
          } else {
            documentContent = { title: getDefaultTitle(documentType, assessment, normalizedLanguage), raw_content: messageContent };
          }
        } catch (parseError) {
          documentContent = { title: getDefaultTitle(documentType, assessment, normalizedLanguage), raw_content: messageContent };
        }
      } else {
        throw new Error('No valid response from AI');
      }
    }

    // ── FIX: Detect when AI returns { content: "plain text string" } instead of structured sections ──
    // This happens when the AI ignores the tool call schema and returns a narrative document
    if (documentContent.content && typeof documentContent.content === 'string' && !documentContent.section_1_premessa && !documentContent.section_1_introduzione) {
      console.log('AI returned unstructured content string instead of sections — forcing retry via repair');
      const requiredFields = getTemplateRequiredFields(documentType);
      const missingFields = requiredFields.filter(f => f !== 'title' && !(f in documentContent));
      if (missingFields.length > 0) {
        // Remove the raw content string so repair can generate proper structured content
        delete documentContent.content;
        const repairIssues = missingFields.map(f => `Sezione mancante: ${f}`);
        console.log('Triggering repair for missing structured sections:', repairIssues.length);
        const repairedContent = await repairDocumentWithAI({
          apiKey: LOVABLE_API_KEY,
          documentType,
          language: normalizedLanguage,
          mode: normalizedMode,
          assessment,
          profile,
          conversationContext,
          currentContent: documentContent,
          issues: repairIssues,
          regulatoryContext,
        });
        if (repairedContent) {
          documentContent = repairedContent;
          console.log('Repair produced structured content successfully');
        }
      }
    }

    if (!documentContent.title) {
      documentContent.title = getDefaultTitle(documentType, assessment, normalizedLanguage);
    }

    documentContent._mode = normalizedMode;

    // Fix dates
    const todayStr = new Date().toISOString().split('T')[0];
    if (documentContent.section_2_informazioni_essenziali) {
      documentContent.section_2_informazioni_essenziali.data_generazione_documento = todayStr;
      if (!documentContent.section_2_informazioni_essenziali.data_creazione_analisi) {
        documentContent.section_2_informazioni_essenziali.data_creazione_analisi = todayStr;
      }
      if (!documentContent.section_2_informazioni_essenziali.versione) {
        documentContent.section_2_informazioni_essenziali.versione = '1.0';
      }
    }

    if (documentContent.section_11_piano_revisione) {
      const sec11 = documentContent.section_11_piano_revisione;
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      sec11.prossima_revisione = nextYear.toISOString().split('T')[0];
      if (Array.isArray(sec11.log_versioni)) {
        for (const v of sec11.log_versioni) {
          if (v.data && new Date(v.data) < new Date(todayStr)) {
            v.data = todayStr;
          }
        }
      }
    }

    if (documentContent.section_4_informazioni_trattamento) {
      const sec4fix = documentContent.section_4_informazioni_trattamento;
      if (sec4fix.data_ultima_modifica && new Date(sec4fix.data_ultima_modifica).getFullYear() < 2025) {
        sec4fix.data_ultima_modifica = todayStr;
      }
      if (sec4fix.data_creazione && new Date(sec4fix.data_creazione).getFullYear() < 2025) {
        sec4fix.data_creazione = todayStr;
      }
    }

    // Force unique codice identificativo
    if (documentContent.section_4_informazioni_trattamento) {
      const shortId = String(assessmentId || docId).substring(0, 8).toUpperCase();
      const dateCode = new Date().toISOString().split('T')[0].replace(/-/g, '');
      documentContent.section_4_informazioni_trattamento.codice_identificativo = `DPIA-${dateCode}-${shortId}`;
    }

    // ── POST-PROCESSING: Enforce decision logic based on residual risk (Point 1) ──
    if (documentType === 'dpia' && documentContent.section_7_valutazione_rischio && documentContent.section_10_decisione_finale) {
      const riepilogo = documentContent.section_7_valutazione_rischio.riepilogo;
      const rischioComplessivo = riepilogo?.rischio_complessivo_residuo?.toLowerCase() || '';
      const sec10 = documentContent.section_10_decisione_finale;

      if (rischioComplessivo.includes('altissimo') || rischioComplessivo.includes('gravissimo')) {
        sec10.decisione = 'Consultazione preventiva obbligatoria ex Art. 36 del Regolamento (UE) 2016/679';
        sec10.motivazione = `Il Titolare del trattamento, preso atto che il livello di rischio complessivo residuo risulta "${riepilogo.rischio_complessivo_residuo}", dichiara che le misure di mitigazione identificate non sono sufficienti a ridurre il rischio a un livello accettabile. Ai sensi dell'Art. 36 del Regolamento (UE) 2016/679, il Titolare è tenuto a consultare l'Autorità Garante per la protezione dei dati personali prima di procedere al trattamento.`;
        sec10.condizioni_vincoli = 'Il trattamento NON può essere avviato o proseguito fino al completamento della consultazione preventiva con l\'Autorità Garante e al recepimento delle eventuali prescrizioni. Il Titolare si impegna a sospendere ogni attività di trattamento in attesa dell\'esito della consultazione.';
        sec10.consultazione_preventiva = 'Sì — Obbligatoria ai sensi dell\'Art. 36 GDPR. Il rischio residuo complessivo è stato classificato come "Altissimo" e le misure individuate non consentono una riduzione sufficiente. La consultazione deve essere avviata entro 30 giorni dalla data di approvazione della presente DPIA.';
      } else if (rischioComplessivo.includes('alto') || rischioComplessivo.includes('grave')) {
        sec10.decisione = 'Proseguire il trattamento con riserva';
        sec10.motivazione = `Il Titolare del trattamento, preso atto che il livello di rischio complessivo residuo risulta "${riepilogo.rischio_complessivo_residuo}", dichiara di accettare temporaneamente il rischio residuo subordinatamente all'implementazione completa delle misure correttive identificate nella Sezione 7 del presente documento. La presente decisione è soggetta a rivalutazione obbligatoria entro 6 mesi dalla data di approvazione.`;
        sec10.condizioni_vincoli = 'Condizioni vincolanti: (1) Implementazione di tutte le misure "Da applicare" entro le scadenze stabilite nel piano d\'azione correttivo (Sezione 7.3); (2) Rivalutazione obbligatoria della DPIA entro 6 mesi; (3) Se alla rivalutazione il rischio residuo non risulta ridotto ad un livello "Medio" o inferiore, il Titolare è tenuto a procedere con la consultazione preventiva ex Art. 36 del Regolamento (UE) 2016/679; (4) Monitoraggio continuo degli indicatori di efficacia delle misure implementate.';
        sec10.consultazione_preventiva = 'Non immediatamente necessaria, ma condizionata alla rivalutazione semestrale. Se entro 6 mesi il rischio complessivo residuo non scende al livello "Medio", il Titolare procederà alla consultazione preventiva ai sensi dell\'Art. 36 GDPR.';
      }
      // For "Medio" or "Basso" the AI-generated text is acceptable (proseguire il trattamento)

      // ── POST-PROCESSING: Enforce residual risk constraint for "Da applicare" measures (Point 5) ──
      if (Array.isArray(documentContent.section_7_valutazione_rischio.valutazione_minacce)) {
        for (const minaccia of documentContent.section_7_valutazione_rischio.valutazione_minacce) {
          if (minaccia.rischio_iniziale && minaccia.rischio_residuo && Array.isArray(minaccia.misure_mitigazione)) {
            // Check if ALL measures are "Da applicare" (check piano_azione_correttivo too)
            const allMeasuresPending = Array.isArray(minaccia.piano_azione_correttivo) &&
              minaccia.piano_azione_correttivo.every((a: any) => a.stato === 'Da applicare' || !a.stato);
            
            if (allMeasuresPending || !minaccia.piano_azione_correttivo) {
              // If all measures are pending, residual probability can't drop more than 1
              const maxReduction = 1;
              const minResidualP = Math.max(1, minaccia.rischio_iniziale.probabilita_p - maxReduction);
              if (minaccia.rischio_residuo.probabilita_p < minResidualP) {
                minaccia.rischio_residuo.probabilita_p = minResidualP;
                minaccia.rischio_residuo.valore_R = minaccia.rischio_residuo.impatto_M * minResidualP;
                // Recalculate level
                const r = minaccia.rischio_residuo.valore_R;
                minaccia.rischio_residuo.livello = r >= 9 ? 'Altissimo' : r >= 5 ? 'Alto' : r >= 3 ? 'Medio' : 'Basso';
              }
            }
          }
        }
      }

      // ── POST-PROCESSING: Assign MIT-NNN IDs to measures (Point 9) ──
      if (Array.isArray(documentContent.section_7_valutazione_rischio.valutazione_minacce)) {
        let mitCounter = 1;
        for (const minaccia of documentContent.section_7_valutazione_rischio.valutazione_minacce) {
          if (Array.isArray(minaccia.piano_azione_correttivo)) {
            for (const azione of minaccia.piano_azione_correttivo) {
              if (!azione.id_misura || !azione.id_misura.startsWith('MIT-')) {
                azione.id_misura = `MIT-${String(mitCounter).padStart(3, '0')}`;
              }
              mitCounter++;
            }
          }
        }
      }
    }

    // ── POST-PROCESSING BUG 1: Fix checklist dates — must be FUTURE from generation date ──
    if (Array.isArray(documentContent.checklist_gdpr)) {
      const genDate = new Date();
      const checklistDateOffsets: Record<string, number> = {
        'piano d\'azione approvato dal management': 30,
        'piano d\'azione approvato': 30,
        'budget stanziato per le misure correttive': 30,
        'budget stanziato': 30,
        'misure di mitigazione identificate': 180,
        'consultazione interessati pianificata': 120,
      };
      
      for (const item of documentContent.checklist_gdpr) {
        if (item.stato && item.stato.toLowerCase().includes('verificare')) {
          // Check if date is missing or in the past
          let needsDateFix = !item.data_verifica_prevista;
          if (item.data_verifica_prevista) {
            const parsed = new Date(item.data_verifica_prevista.replace(/(\d{2})[-/](\d{2})[-/](\d{4})/, '$3-$2-$1'));
            if (!isNaN(parsed.getTime()) && parsed <= genDate) {
              needsDateFix = true;
            }
            // Also try ISO format
            const parsedISO = new Date(item.data_verifica_prevista);
            if (!isNaN(parsedISO.getTime()) && parsedISO <= genDate) {
              needsDateFix = true;
            }
          }
          
          if (needsDateFix) {
            // Find matching offset
            const elemLower = (item.elemento || '').toLowerCase();
            let offsetDays = 90; // default
            for (const [pattern, days] of Object.entries(checklistDateOffsets)) {
              if (elemLower.includes(pattern)) {
                offsetDays = days;
                break;
              }
            }
            const targetDate = new Date(genDate);
            targetDate.setDate(targetDate.getDate() + offsetDays);
            item.data_verifica_prevista = targetDate.toISOString().split('T')[0];
          }
        }
      }
    }

    // ── POST-PROCESSING BUG 2: Fix risk label mismatch in motivazione_accettazione ──
    if (Array.isArray(documentContent.section_7_valutazione_rischio?.valutazione_minacce)) {
      const riskLabelFromScore = (r: number): string => {
        if (r >= 9) return 'Altissimo';
        if (r >= 5) return 'Alto';
        if (r >= 3) return 'Medio';
        return 'Basso';
      };
      
      for (const minaccia of documentContent.section_7_valutazione_rischio.valutazione_minacce) {
        if (minaccia.rischio_residuo && minaccia.motivazione_accettazione) {
          const rr = minaccia.rischio_residuo;
          // Recalculate valore_R from components to ensure consistency
          if (rr.impatto_M && rr.probabilita_p) {
            rr.valore_R = rr.impatto_M * rr.probabilita_p;
            const correctLabel = riskLabelFromScore(rr.valore_R);
            rr.livello = correctLabel;
            
            // Fix motivazione_accettazione to use correct label
            const wrongLabels = ['Basso', 'Medio', 'Alto', 'Altissimo', 'Gravissimo'];
            let motivazione = minaccia.motivazione_accettazione;
            for (const wl of wrongLabels) {
              if (wl !== correctLabel) {
                // Replace wrong risk label mentions like 'rischio residuo "Alto"' with correct one
                const patterns = [
                  new RegExp(`rischio\\s+residuo\\s*(?:[""\u201C\u201D]?)${wl}(?:[""\u201C\u201D]?)`, 'gi'),
                  new RegExp(`livello\\s*(?:[""\u201C\u201D]?)${wl}(?:[""\u201C\u201D]?)`, 'gi'),
                ];
                for (const p of patterns) {
                  motivazione = motivazione.replace(p, (match: string) => match.replace(new RegExp(wl, 'gi'), correctLabel));
                }
              }
            }
            minaccia.motivazione_accettazione = motivazione;
          }
        }
      }
    }

    // ── POST-PROCESSING BUG 3: Ensure at least 3 sub-responsabili ──
    if (documentContent.section_4_informazioni_trattamento) {
      const sec4 = documentContent.section_4_informazioni_trattamento;
      if (!Array.isArray(sec4.sub_responsabili)) {
        sec4.sub_responsabili = [];
      }
      
      const defaultSubResponsabili = [
        {
          ragione_sociale: '[DA COMPLETARE - Fornitore infrastruttura cloud IaaS/PaaS]',
          servizio: 'Hosting infrastruttura cloud, storage dati, computing (IaaS/PaaS)',
          contratto_art28: 'Da verificare — Rif. Gap 3 - Art. 28 GDPR'
        },
        {
          ragione_sociale: '[DA COMPLETARE - Fornitore CRM / gestione clienti]',
          servizio: 'Gestione relazioni clienti, CRM, comunicazioni commerciali',
          contratto_art28: 'Da verificare — Rif. Gap 3 - Art. 28 GDPR'
        },
        {
          ragione_sociale: '[DA COMPLETARE - Fornitore analytics / monitoring]',
          servizio: 'Analytics, monitoring applicativo, reportistica e log management',
          contratto_art28: 'Da verificare — Rif. Gap 3 - Art. 28 GDPR'
        },
      ];
      
      while (sec4.sub_responsabili.length < 3) {
        const idx = sec4.sub_responsabili.length;
        if (idx < defaultSubResponsabili.length) {
          // Check if a similar one already exists
          const existing = sec4.sub_responsabili.some((sr: any) => 
            (sr.servizio || '').toLowerCase().includes(defaultSubResponsabili[idx].servizio.split(',')[0].toLowerCase())
          );
          if (!existing) {
            sec4.sub_responsabili.push(defaultSubResponsabili[idx]);
          } else {
            break; // avoid infinite loop
          }
        } else {
          break;
        }
      }
    }

    // ── POST-PROCESSING BUG 4 & 5: Ensure every gap has a corresponding threat + coherence check ──
    if (documentType === 'dpia' && Array.isArray(assessment.identified_gaps) && assessment.identified_gaps.length > 0) {
      const minacce = documentContent.section_7_valutazione_rischio?.valutazione_minacce || [];
      const allMinacceText = JSON.stringify(minacce).toLowerCase();
      
      // Con il catalogo completo i gap possono essere molte decine: solo i più gravi
      // diventano minacce esplicite, altrimenti la valutazione del rischio diventa illeggibile.
      const dpiaGapRank: Record<string, number> = { critical: 0, high: 0, medium: 1, low: 2 };
      const dpiaGaps = [...assessment.identified_gaps]
        .sort((a: any, b: any) => (dpiaGapRank[String(a.risk_level).toLowerCase()] ?? 3) - (dpiaGapRank[String(b.risk_level).toLowerCase()] ?? 3) || (a.priority || 9) - (b.priority || 9))
        .slice(0, 25);
      for (let gIdx = 0; gIdx < dpiaGaps.length; gIdx++) {
        const gap = dpiaGaps[gIdx];
        const gapNum = gIdx + 1;
        const gapRef = gap.requirement_reference || '';
        const gapRefLower = gapRef.toLowerCase();
        
        // Check if this gap has a corresponding threat
        const gapPattern = `gap ${gapNum}`;
        const artPattern = gapRefLower.replace(/\s+/g, '').replace('art.', 'art');
        const hasMatchingThreat = allMinacceText.includes(gapPattern) || 
          allMinacceText.includes(gapRefLower) ||
          allMinacceText.includes(artPattern);
        
        if (!hasMatchingThreat) {
          // Generate a threat for this gap
          const riskMap: Record<string, {m: number, p: number}> = {
            'critical': {m: 4, p: 3},
            'high': {m: 3, p: 3},
            'medium': {m: 2, p: 2},
            'low': {m: 2, p: 1},
          };
          const risk = riskMap[gap.risk_level] || {m: 2, p: 2};
          const riskLabelFromScore = (r: number): string => r >= 9 ? 'Altissimo' : r >= 5 ? 'Alto' : r >= 3 ? 'Medio' : 'Basso';
          const initialR = risk.m * risk.p;
          const residualP = Math.max(1, risk.p - 1);
          const residualR = risk.m * residualP;
          
          // Determine areas based on gap description
          const descLower = (gap.gap_description || '').toLowerCase();
          const areas = [];
          if (descLower.includes('accesso') || descLower.includes('riservatezza') || descLower.includes('consenso')) areas.push('Riservatezza');
          if (descLower.includes('integrità') || descLower.includes('registro') || descLower.includes('tracciabilità') || descLower.includes('documentazione')) areas.push('Integrità');
          if (descLower.includes('disponibilità') || descLower.includes('backup') || descLower.includes('continuità')) areas.push('Disponibilità');
          if (areas.length === 0) areas.push('Riservatezza', 'Integrità');
          
          const newThreat: any = {
            nome_minaccia: `${gap.gap_description?.substring(0, 80) || 'Non conformità'} (Rif. Gap ${gapNum} - ${gapRef})`,
            aree_impatto: areas,
            fonti_rischio: ['Contesto organizzativo', 'Strumenti'],
            rischio_iniziale: {
              impatto_M: risk.m,
              probabilita_p: risk.p,
              valore_R: initialR,
              livello: riskLabelFromScore(initialR),
            },
            misure_mitigazione: [],
            indicatori_efficacia: [],
            rischio_residuo: {
              impatto_M: risk.m,
              probabilita_p: residualP,
              valore_R: residualR,
              livello: riskLabelFromScore(residualR),
            },
            motivazione_accettazione: `Il Titolare del trattamento dichiara di accettare il rischio residuo "${riskLabelFromScore(residualR)}" subordinatamente all'implementazione delle misure correttive identificate nel piano d'azione. Il rischio sarà rivalutato alla prossima revisione della DPIA.`,
            piano_azione_correttivo: [],
          };
          
          // Add measures from gap recommended_actions
          const actions = gap.recommended_actions;
          if (actions) {
            if (Array.isArray(actions)) {
              for (const a of actions) {
                const actionText = typeof a === 'string' ? a : (a.action || JSON.stringify(a));
                newThreat.misure_mitigazione.push(actionText);
                newThreat.indicatori_efficacia.push(`Verifica semestrale dell'implementazione: ${actionText.substring(0, 60)}`);
              }
            } else if (typeof actions === 'string') {
              newThreat.misure_mitigazione.push(actions);
              newThreat.indicatori_efficacia.push('Audit semestrale di verifica implementazione');
            }
          }
          if (newThreat.misure_mitigazione.length === 0) {
            newThreat.misure_mitigazione.push(`Implementare le misure correttive per ${gapRef}`);
            newThreat.indicatori_efficacia.push('Audit semestrale di verifica conformità');
          }
          
          if (!documentContent.section_7_valutazione_rischio) {
            documentContent.section_7_valutazione_rischio = { valutazione_minacce: [] };
          }
          if (!Array.isArray(documentContent.section_7_valutazione_rischio.valutazione_minacce)) {
            documentContent.section_7_valutazione_rischio.valutazione_minacce = [];
          }
          documentContent.section_7_valutazione_rischio.valutazione_minacce.push(newThreat);
          console.log(`BUG4/5: Added missing threat for Gap ${gapNum} - ${gapRef}`);
        }
      }
      
      // Re-assign MIT IDs after adding new threats (re-run MIT assignment)
      let mitCounter = 1;
      for (const minaccia of documentContent.section_7_valutazione_rischio.valutazione_minacce) {
        if (Array.isArray(minaccia.piano_azione_correttivo)) {
          for (const azione of minaccia.piano_azione_correttivo) {
            azione.id_misura = `MIT-${String(mitCounter).padStart(3, '0')}`;
            mitCounter++;
          }
        }
        // Also create piano_azione_correttivo entries for new threats without them
        if (!Array.isArray(minaccia.piano_azione_correttivo) || minaccia.piano_azione_correttivo.length === 0) {
          minaccia.piano_azione_correttivo = [];
          if (Array.isArray(minaccia.misure_mitigazione)) {
            for (const misura of minaccia.misure_mitigazione) {
              const misuraText = typeof misura === 'string' ? misura : String(misura);
              const effortMap: Record<string, string> = { 'critical': 'Molto alto', 'high': 'Alto', 'medium': 'Medio', 'low': 'Basso' };
              const scadenzaMap: Record<string, number> = { 'critical': 30, 'high': 60, 'medium': 90, 'low': 180 };
              const prioritaMap: Record<string, string> = { 'critical': 'Critica', 'high': 'Alta', 'medium': 'Media', 'low': 'Bassa' };
              // Determine priority from risk level
              const ri = minaccia.rischio_iniziale;
              const riskLevel = ri?.valore_R >= 9 ? 'critical' : ri?.valore_R >= 5 ? 'high' : ri?.valore_R >= 3 ? 'medium' : 'low';
              
              minaccia.piano_azione_correttivo.push({
                id_misura: `MIT-${String(mitCounter).padStart(3, '0')}`,
                descrizione: misuraText,
                responsabile: misuraText.toLowerCase().includes('dpo') ? 'DPO' : 
                             misuraText.toLowerCase().includes('sicurezza') || misuraText.toLowerCase().includes('security') ? 'CISO' :
                             misuraText.toLowerCase().includes('registro') || misuraText.toLowerCase().includes('documentazione') ? 'DPO' :
                             'Responsabile IT',
                scadenza_giorni: scadenzaMap[riskLevel] || 90,
                effort: effortMap[riskLevel] || 'Medio',
                priorita: prioritaMap[riskLevel] || 'Media',
                stato: 'Da applicare',
              });
              mitCounter++;
            }
          }
        }
      }
    }

    const qualityCheck = validateDocumentQuality(documentType, documentContent, normalizedLanguage);
    if (!qualityCheck.valid) {
      console.warn('Initial quality check failed, attempting automatic repair:', qualityCheck.issues.join('; '));
      documentContent = await repairDocumentWithAI({
        apiKey: LOVABLE_API_KEY,
        documentType,
        language: normalizedLanguage,
        mode: normalizedMode,
        assessment,
        profile,
        conversationContext,
        currentContent: documentContent,
        issues: qualityCheck.issues,
        regulatoryContext,
      });

      const repairedCheck = validateDocumentQuality(documentType, documentContent, normalizedLanguage);
      if (!repairedCheck.valid) {
        console.error('Document failed quality gate after repair:', repairedCheck.issues);
        throw new Error(`Quality gate failed: ${repairedCheck.issues.join(', ')}`);
      }
    }

    // Update the pending document with the final content
    const { error: updateError } = await supabase
      .from('generated_documents')
      .update({
        title: documentContent.title,
        content: documentContent,
        metadata: {
          generated_at: new Date().toISOString(),
          based_on_assessment: assessmentId || null,
          source: assessment?._source === 'chat' ? 'chat' : 'assessment',
          goal: assessment?._source === 'chat' ? assessment.title : undefined,
          regulations: assessment.scope_regulations,
          mode: normalizedMode,
          status: 'completed',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', docId);

    if (updateError) {
      console.error('Error updating document:', updateError);
      throw updateError;
    }

    console.log('Document generated successfully:', docId);

  } catch (error) {
    console.error('Background document generation failed:', error);
    await supabase
      .from('generated_documents')
      .update({
        content: { _status: 'failed', _error: error instanceof Error ? error.message : 'Unknown error' },
        metadata: { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' },
        updated_at: new Date().toISOString(),
      })
      .eq('id', docId);
  }
}

// =====================================================================
// FIX #2: Fetch regulatory context from RAG
// =====================================================================

async function fetchRegulatoryContext(supabase: any, documentType: string): Promise<string> {
  try {
    let articleNumbers: number[];
    if (documentType === 'dpia') {
      articleNumbers = [5, 6, 9, 13, 14, 15, 17, 20, 25, 28, 30, 32, 33, 34, 35, 36];
    } else if (documentType === 'lia') {
      articleNumbers = [6, 13, 14, 21];
    } else {
      articleNumbers = [30];
    }

    const { data: gdprDocs } = await supabase
      .from('documents')
      .select('id')
      .or('title.ilike.%GDPR%,title.ilike.%2016/679%,title.ilike.%protezione dati%')
      .limit(5);

    if (!gdprDocs || gdprDocs.length === 0) {
      console.log('No GDPR documents found in knowledge base');
      return '';
    }

    const docIds = gdprDocs.map((d: any) => d.id);
    const articlePatterns = articleNumbers.map(n => `articolo ${n}`);
    const allChunks: string[] = [];
    
    for (const artNum of articleNumbers) {
      const { data: structuredChunks } = await supabase
        .from('structured_chunks')
        .select('article_reference, chunk_text')
        .in('document_id', docIds)
        .eq('article_number', artNum)
        .limit(2);

      if (structuredChunks && structuredChunks.length > 0) {
        for (const chunk of structuredChunks) {
          allChunks.push(`[${chunk.article_reference || `Art. ${artNum}`}]: ${chunk.chunk_text}`);
        }
      }
    }

    if (allChunks.length < 5) {
      for (const pattern of articlePatterns.slice(0, 10)) {
        if (allChunks.length >= 20) break;
        const { data: regularChunks } = await supabase
          .from('chunks')
          .select('content')
          .in('document_id', docIds)
          .ilike('content', `%${pattern}%`)
          .limit(2);

        if (regularChunks) {
          for (const chunk of regularChunks) {
            allChunks.push(chunk.content);
          }
        }
      }
    }

    const maxChunks = 20;
    const selectedChunks = allChunks.slice(0, maxChunks);
    
    if (selectedChunks.length === 0) {
      return '';
    }

    return selectedChunks.join('\n\n---\n\n');
  } catch (error) {
    console.error('Error fetching regulatory context:', error);
    return '';
  }
}

// =====================================================================
// Helper functions
// =====================================================================

// Builds an assessment-shaped context from a guided chat (goal, facts the user gave, recent messages)
function buildAssessmentFromChat(chatContext: any, profile: any): { assessment: any; history: any[] } {
  const ctx = chatContext && typeof chatContext === 'object' ? chatContext : {};
  const goal = typeof ctx.goal === 'string' && ctx.goal.trim() ? ctx.goal.trim().substring(0, 200) : '';
  const facts: Array<{ question: string; answer: string }> = Array.isArray(ctx.caseContext)
    ? ctx.caseContext
      .filter((f: any) => f && typeof f.question === 'string' && typeof f.answer === 'string')
      .slice(0, 20)
      .map((f: any) => ({ question: f.question.substring(0, 300), answer: f.answer.substring(0, 600) }))
    : [];
  const history: any[] = Array.isArray(ctx.history)
    ? ctx.history
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-12)
      .map((m: any) => ({ role: m.role, content: m.content.substring(0, m.role === 'user' ? 2500 : 4000) }))
    : [];
  const attached = typeof ctx.attachedDocsSummary === 'string' ? ctx.attachedDocsSummary.substring(0, 40000) : '';
  const factLines = facts.map((f) => `- ${f.question} ${f.answer}`).join('\n');
  const description = [
    goal ? `Obiettivo dichiarato dall'utente: ${goal}` : '',
    facts.length > 0 ? `Informazioni fornite dall'utente:\n${factLines}` : '',
    attached ? `L'utente ha allegato documenti aziendali: vedi la sezione dedicata.` : '',
  ].filter(Boolean).join('\n\n') || 'Trattamento descritto dall\'utente in chat.';
  const sizeMap: Record<string, string> = {
    micro: 'micro impresa (meno di 10 addetti)', small: 'piccola impresa (10-49 addetti)',
    medium: 'media impresa (50-249 addetti)', large: 'grande impresa (250 addetti o più)',
  };
  const roleMap: Record<string, string> = {
    controller: 'titolare del trattamento', processor: 'responsabile del trattamento', both: 'titolare e responsabile a seconda del servizio',
  };
  return {
    assessment: {
      _source: 'chat',
      id: null,
      title: goal || 'Trattamento descritto in chat',
      description,
      scope_sector: profile?.sector || 'Non specificato',
      scope_jurisdiction: profile?.jurisdiction || 'IT',
      scope_regulations: ['GDPR'],
      company_size_label: sizeMap[profile?.company_size] || null,
      data_role_label: roleMap[profile?.data_role] || null,
      status: 'chat',
      completed_at: null,
      identified_gaps: [],
      overall_compliance_percentage: null,
      overall_risk_score: null,
    },
    history,
  };
}

function getDefaultTitle(type: string, assessment: any, language: string = 'it'): string {
  const titles: Record<string, string> = {
    dpia: `DPIA - ${assessment.title || 'Valutazione Impatto Protezione Dati'}`,
    ropa: `RoPA - ${assessment.title || 'Registro Attività di Trattamento'}`,
    lia: `LIA - ${assessment.title || 'Legitimate Interest Assessment'}`,
    gap_report: `Gap Analysis Report - ${assessment.title || 'Valutazione Conformità'}`,
    risk_analysis: `Analisi dei Rischi ex Art. 24 GDPR - ${assessment.title || 'Valutazione Rischi Protezione Dati'}`,
  };
  return titles[type] || `Documento di Conformità - ${assessment.title}`;
}

function formatMitigationActionsForPrompt(actions: any): string {
  if (!actions) return 'Nessuna azione raccomandata';
  if (typeof actions === 'string') return actions;
  if (Array.isArray(actions)) {
    return actions.map((item: any, i: number) => {
      if (typeof item === 'string') return `${i + 1}. ${item}`;
      if (item.action) return `${i + 1}. ${item.action}`;
      return `${i + 1}. ${JSON.stringify(item)}`;
    }).join('; ');
  }
  if (actions.action) return actions.action;
  return JSON.stringify(actions);
}

function formatConversationHistory(history: any[]): string {
  if (!history || !Array.isArray(history)) return '';
  return history.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n');
}

function getTemplateRequiredFields(type: string): string[] {
  if (type === 'dpia') {
    return [
      'title',
      'section_1_introduzione',
      'section_2_informazioni_essenziali',
      'section_3_pre_assessment',
      'section_4_informazioni_trattamento',
      'section_5_proporzionalita',
      'section_6_diritti_principi',
      'section_7_valutazione_rischio',
      'section_8_coinvolgimento_parti',
      'section_9_note_conclusioni',
      'section_10_decisione_finale',
      'section_11_piano_revisione',
    ];
  }

  if (type === 'ropa') {
    return ['title', 'intestazione', 'attivita_trattamento'];
  }

  if (type === 'lia') {
    return ['title', 'informazioni_generali', 'purpose_test', 'necessity_test', 'balancing_test', 'conclusione'];
  }

  if (type === 'gap_report') {
    return ['title', 'executive_summary', 'risultati_per_normativa', 'conclusioni'];
  }

  if (type === 'risk_analysis') {
    return [
      'title',
      'section_1_premessa',
      'section_2_metodologia',
      'section_3_inventario_trattamenti',
      'section_4_identificazione_minacce',
      'section_5_rischio_inerente',
      'section_6_misure_mitigazione',
      'section_7_rischio_residuo',
      'section_8_piano_trattamento',
      'section_9_accettazione_rischio',
      'section_10_monitoraggio',
    ];
  }

  return ['title'];
}

function findMissingTopLevelFields(type: string, content: any): string[] {
  if (!content || typeof content !== 'object') return getTemplateRequiredFields(type);
  return getTemplateRequiredFields(type).filter((field) => !(field in content));
}

function hasMinimumRopaActivities(content: any): boolean {
  if (!content?.attivita_trattamento || !Array.isArray(content.attivita_trattamento)) return false;
  return content.attivita_trattamento.length >= 6;
}

function collectAllStringValues(value: unknown, output: string[] = []): string[] {
  if (typeof value === 'string') {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectAllStringValues(item, output));
    return output;
  }
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => collectAllStringValues(item, output));
  }
  return output;
}

function containsLikelyEnglishText(value: unknown): boolean {
  const allTexts = collectAllStringValues(value).join(' ').toLowerCase();
  const englishPatterns = [
    /\bnot applicable\b/i,
    /\bprivacy policy\b/i,
    /\bsecurity measures?\b/i,
    /\bdata subject rights\b/i,
    /\bthe following\b/i,
    /\bplease note\b/i,
    /\bin order to\b/i,
    /\bthis document\b/i,
  ];
  const matchCount = englishPatterns.filter((pattern) => pattern.test(allTexts)).length;
  return matchCount >= 3;
}

// =====================================================================
// FIX #6: Enhanced quality validation
// =====================================================================

function validateDocumentQuality(type: string, content: any, language: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  const missingFields = findMissingTopLevelFields(type, content);
  if (missingFields.length > 0) {
    issues.push(`campi obbligatori mancanti: ${missingFields.join(', ')}`);
  }

  if (type === 'ropa' && !hasMinimumRopaActivities(content)) {
    issues.push('il RoPA deve includere almeno 6 attività di trattamento');
  }

  if (language === 'it' && containsLikelyEnglishText(content)) {
    issues.push('testo con termini inglesi rilevati');
  }

  // --- DPIA-specific quality checks ---
  if (type === 'dpia') {
    const threats = content?.section_7_valutazione_rischio?.valutazione_minacce;
    if (!threats || !Array.isArray(threats) || threats.length < 3) {
      issues.push('la Sezione 7 deve contenere almeno 3 minacce nella valutazione rischi');
    } else {
      for (let i = 0; i < threats.length; i++) {
        const t = threats[i];
        const ri = t?.rischio_iniziale;
        if (!ri || !ri.impatto_M || ri.impatto_M < 1 || !ri.probabilita_p || ri.probabilita_p < 1) {
          issues.push(`minaccia ${i + 1}: rischio_iniziale deve avere valori numerici > 0`);
          break;
        }
        const rr = t?.rischio_residuo;
        if (ri && rr && rr.valore_R > ri.valore_R) {
          issues.push(`minaccia "${t.nome_minaccia || i + 1}": il rischio residuo (${rr.valore_R}) non può essere superiore al rischio iniziale (${ri.valore_R})`);
          break;
        }
      }
    }

    const sec4Desc = content?.section_4_informazioni_trattamento?.descrizione;
    if (sec4Desc && typeof sec4Desc === 'string' && sec4Desc.length < 150) {
      issues.push('la descrizione del trattamento (Sezione 4) deve avere almeno 150 caratteri');
    }

    const diritti = content?.section_6_diritti_principi?.diritti_interessato;
    if (diritti) {
      let rightCount = 0;
      if (Array.isArray(diritti)) {
        rightCount = diritti.length;
      } else if (typeof diritti === 'object') {
        rightCount = Object.keys(diritti).length;
      }
      if (rightCount < 5) {
        issues.push('la Sezione 6 deve includere almeno 5 diritti dell\'interessato compilati');
      }
    }
  }

  // --- RoPA-specific quality checks ---
  if (type === 'ropa' && content?.attivita_trattamento && Array.isArray(content.attivita_trattamento)) {
    for (let i = 0; i < content.attivita_trattamento.length; i++) {
      const att = content.attivita_trattamento[i];
      
      if (!att.descrizione_estesa || typeof att.descrizione_estesa !== 'string' || att.descrizione_estesa.length < 80) {
        issues.push(`attività ${att.codice || i + 1}: la descrizione estesa deve avere almeno 80 caratteri`);
        break;
      }

      if (att.condizioni_liceita && typeof att.condizioni_liceita === 'string') {
        const cl = att.condizioni_liceita.trim();
        if (!cl.toLowerCase().startsWith('art.') && !cl.toLowerCase().startsWith('art ')) {
          issues.push(`attività ${att.codice || i + 1}: le condizioni di liceità devono iniziare con "Art." (riferimento GDPR)`);
          break;
        }
      }

      if (!att.categorie_trattamento || !Array.isArray(att.categorie_trattamento) || att.categorie_trattamento.length < 3) {
        issues.push(`attività ${att.codice || i + 1}: le categorie di trattamento devono essere almeno 3`);
        break;
      }
    }
  }

  // --- Risk Analysis Art. 24 quality checks ---
  if (type === 'risk_analysis') {
    if (!content?.section_4_identificazione_minacce || !Array.isArray(content.section_4_identificazione_minacce) || content.section_4_identificazione_minacce.length < 3) {
      issues.push('l\'analisi rischi deve includere almeno 3 minacce identificate');
    }
    if (!content?.section_5_rischio_inerente || !Array.isArray(content.section_5_rischio_inerente) || content.section_5_rischio_inerente.length < 3) {
      issues.push('la valutazione del rischio inerente deve coprire almeno 3 minacce');
    }
  }

  return { valid: issues.length === 0, issues };
}

async function repairDocumentWithAI({
  apiKey,
  documentType,
  language,
  mode,
  assessment,
  profile,
  conversationContext,
  currentContent,
  issues,
  regulatoryContext,
}: {
  apiKey: string;
  documentType: string;
  language: string;
  mode: string;
  assessment: any;
  profile: any;
  conversationContext: string;
  currentContent: any;
  issues: string[];
  regulatoryContext: string;
}): Promise<any> {
  const repairPrompt = `Correggi il seguente documento ${documentType.toUpperCase()} per rispettare rigorosamente il modello professionale richiesto.

Requisiti non rispettati:
- ${issues.join('\n- ')}

VINCOLI OBBLIGATORI:
- Mantieni TUTTA la struttura prevista dal modello.
- NON lasciare campi vuoti o parziali.
- Se la lingua è italiana, usa SOLO italiano professionale (mai inglese nei contenuti).
- Per RoPA, includi almeno 6 attività complete con descrizione_estesa di almeno 80 caratteri ciascuna.
- Per DPIA, TUTTE le 11 sezioni devono essere presenti e complete.
- Per DPIA, la Sezione 7 deve avere almeno 3 minacce con valori numerici coerenti (rischio residuo <= rischio iniziale).
- Per dati aziendali non disponibili, usa '[DA COMPLETARE - descrizione dato]' — NON inventare dati falsi.

Contesto assessment:
${buildDocumentPrompt(documentType, assessment, profile, conversationContext, language, mode, regulatoryContext)}

Documento attuale da correggere:
${JSON.stringify(currentContent)}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: getDocumentSystemPrompt(documentType, language, mode) },
        { role: 'user', content: repairPrompt },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'generate_compliance_document',
          description: `Return the corrected ${documentType.toUpperCase()} document with all required fields completed.`,
          parameters: getDocumentSchema(documentType, mode),
        },
      }],
      tool_choice: { type: 'function', function: { name: 'generate_compliance_document' } },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI repair API error:', response.status, errorText);
    throw new Error('Errore durante la correzione automatica del documento');
  }

  const data = await response.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error('Correzione automatica non riuscita: risposta AI non valida');
  }

  try {
    return JSON.parse(toolCall.function.arguments);
  } catch (error) {
    console.error('Failed to parse repaired document:', error);
    throw new Error('Correzione automatica non riuscita: parsing documento fallito');
  }
}

// =====================================================================
// SYSTEM PROMPTS - Professional templates with 11 sections for DPIA
// =====================================================================

function getDocumentSystemPrompt(type: string, language: string = 'it', mode: string = 'standard'): string {
  if (type === 'dpia') {
    const modeNote = mode === 'breve'
      ? '\n\n⚡ MODALITÀ BREVE: Genera una versione executive summary sintetica. Ogni sezione 3-5 righe max. Focus su punti chiave, rischi e decisioni.'
      : mode === 'audit'
      ? '\n\n🔍 MODALITÀ AUDIT: Oltre al documento DPIA completo, aggiungi per ogni sezione il mapping ai controlli ISO 27001:2022 (Annex A). Aggiungi checklist ISO 27001 + GDPR dettagliata.'
      : '';

    return `Agisci come consulente legale e privacy officer senior esperto in GDPR e nelle linee guida WP248 rev.01 del WP29.
Genera una DPIA COMPLETA seguendo ESATTAMENTE la struttura del modello professionale italiano con 11 sezioni.
Lo stile deve essere formale, tecnico-legale ma leggibile. Il linguaggio deve essere giuridico: i riferimenti normativi completi la prima volta (es. "Art. 35 del Regolamento (UE) 2016/679") e abbreviati nelle occorrenze successive ("Art. 35 GDPR"). Le motivazioni di accettazione del rischio devono essere formulate come dichiarazioni del Titolare del trattamento, non come osservazioni generiche.
Il documento deve essere pronto per:
- Consegna al DPO
- Presentazione in audit
- Difesa in sede ispettiva davanti all'Autorità Garante
- Archiviazione come documentazione ufficiale
${modeNote}

## STRUTTURA OBBLIGATORIA DEL DOCUMENTO (11 SEZIONI)

### 1. INTRODUZIONE
Paragrafo introduttivo: "Il presente documento 'Valutazione d'impatto - [Gestione NOME TRATTAMENTO]' ha lo scopo di valutare l'impatto sulla protezione dei dati dell'attività di trattamento '[Nome]', l'impatto è valutato con particolare attenzione ai diritti e alle libertà degli interessati."
Include: sommario del documento con numerazione sezioni.

### 2. INFORMAZIONI ESSENZIALI
Tabella con: Data creazione analisi | Data generazione documento | Stato (In lavorazione/Approvata) | Reporter (nome persona) | Versione documento

### 3. STIMA DEL RISCHIO E PRE-ASSESSMENT
**Pre-Assessment:** Tabella con TUTTE queste tipologie di trattamento (rispondi Sì/No per ciascuna):
- Trattamenti valutativi o di scoring su larga scala, profilazione
- Trattamenti automatizzati con "effetti giuridici"
- Utilizzo sistematico di dati per osservazione/monitoraggio/controllo
- Trattamento categorie particolari di dati (Art. 9) interconnessi
- Dati con carattere estremamente personale su larga scala
- Interconnessione/combinazione/raffronto di informazioni
- Dati relativi a soggetti vulnerabili (minori, disabili, anziani, pazienti)
- Uso di tecnologie innovative (IoT, AI, assistenti vocali, wearable)
- Trattamenti nell'ambito del rapporto di lavoro con controllo a distanza
- Scambio tra diversi titolari su larga scala
- Trattamenti sistematici di dati biometrici
- Trattamenti sistematici di dati genetici

**REGOLA DI COERENZA INTERNA:** Se un criterio del Pre-Assessment è marcato "Sì" (es. "Impedimento all'esercizio dei diritti"), questo DEVE essere riflesso come minaccia specifica nella Sezione 7 con scoring proprio.

**Stima del Rischio (criteri WP29):** Tabella con Sì/No per ciascun criterio:
- Valutazione/scoring con profilazione e previsione
- Processo decisionale automatizzato con effetto giuridico
- Monitoraggio sistematico
- Dati sensibili o altamente personali
- Trattamento su larga scala
- Corrispondenze o combinazione insiemi di dati
- Interessati vulnerabili
- Uso innovativo di nuove soluzioni tecnologiche
- Impedimento all'esercizio di diritti

### 4. INFORMAZIONI SUL TRATTAMENTO
- Codice identificativo, Nome, Data creazione, Data ultima modifica
- **Descrizione** ESTESA e DETTAGLIATA del trattamento (minimo 150 parole): cosa si fa, con quali sistemi, chi è coinvolto, quali processi
- **Finalità del trattamento** con riferimento specifico
- **Basi giuridiche**: Art. 6 (specificare lettera) e Art. 9 (se applicabile) con citazione completa
- **Riferimenti normativi** specifici (leggi, decreti, regolamenti)
- **Origine dei dati**: Raccolti presso l'interessato / Terze parti
- **Modalità del trattamento**: Informatizzato / Cartaceo / Misto
- **Categorie di dati**: Elenco TASSATIVO delle categorie effettivamente trattate. NON usare MAI formule vaghe come "a titolo esemplificativo" o "tutte le categorie trattate dall'azienda". Elenca SOLO e TUTTE le categorie specifiche. Se il trattamento include dati Art. 9 (es. dati sanitari dei dipendenti), dichiararlo ESPLICITAMENTE con la base giuridica specifica (es. "Art. 9 par. 2 lett. b) — obbligo in ambito lavorativo").
- **Titolare, Sub-responsabili, DPO** con contatti completi
- **Periodi di conservazione**: Differenziare SEMPRE per finalità specifica, MAI un periodo unico generico. Per ciascun periodo indicare la base normativa o motivazione (es. "10 anni — Art. 2220 c.c. per documenti contabili", "24 mesi — provvedimento Garante su marketing diretto", "6 mesi — provvedimento Garante su cookie"). Se il trattamento copre dipendenti, includere periodi specifici per dati HR (es. buste paga 10 anni, cartelle sanitarie 40 anni ex Art. 25 D.Lgs. 81/08).
- **Applicativi** utilizzati con descrizione

**Descrizione sistematica delle componenti del trattamento:**
- **Componenti organizzative**: soggetti, procedure, formazione, relazioni
- **Componenti tecnologiche** (tabella dettagliata):
  - Soggetti interni: autorizzazioni, sistema centralizzato gestione utenti
  - Soggetti esterni: sub-responsabili, catena di responsabilità contrattuale (Art. 28), servizi erogati
  - Software/Applicativi: funzionalità, cruscotti, autenticazione IAM, notifiche, reportistica
  - Connessioni di rete: HTTPS, cifratura end-to-end
- **Componenti fisiche**: infrastruttura, data center, sedi, risorse materiali

### 5. VALUTAZIONE DELLA PROPORZIONALITÀ IN RELAZIONE ALLA FINALITÀ
Dichiarazione del titolare: "Tenuto conto che l'attività di trattamento sottoposta a valutazione comporta il trattamento delle categorie di dati personali sopra menzionati, in relazione alle categorie di interessati precedentemente citati, il titolare ritiene che dette categorie di dati siano necessarie e proporzionali al perseguimento della finalità: [finalità specifica]"

### 6. DIRITTI E PRINCIPI FONDAMENTALI
**Diritti dell'interessato** - Per CIASCUNO descrivere la procedura concreta con riferimento email/modulistica:
- Accesso (Art. 15): procedura completa con modulistica e canale
- Rettifica (Art. 16): procedura specifica
- Cancellazione (Art. 17): procedura ed eccezioni
- Portabilità (Art. 20): formato strutturato, modalità trasmissione
- Opposizione (Art. 21): procedura specifica
- Limitazione trattamento (Art. 18): procedura
- Revoca del consenso: se applicabile
- Non essere sottoposto a decisioni automatizzate (Art. 22)

**Principi** - Descrivere applicazione concreta per ciascuno:
- Liceità, correttezza e trasparenza (con riferimento informativa Art. 13/14)
- Limitazione della finalità
- Minimizzazione dei dati
- Limitazione della conservazione
- Integrità e riservatezza

### 7. VALUTAZIONE DEL RISCHIO
**METODOLOGIA OBBLIGATORIA:** R = f(M, p)
- IMPATTO (M): Lieve=1, Medio=2, Alto/Grave=3, Altissimo/Gravissimo=4
- PROBABILITÀ (p): Improbabile=1, Poco probabile=2, Probabile=3, Altamente probabile=4
- RISCHIO (R = M × p): Basso=1-2, Medio=3-4, Alto=5-8, Altissimo=9-16
- RISCHIO RESIDUO: R2 = R1 - Mn (dove Mn sono le misure di sicurezza)

**7.1 Misure di sicurezza:**
Tabella "Misure trasversali relative ai trattamenti" con colonne: Categoria | Misura di sicurezza | Stato (Applicata/Da applicare):
- Politiche, regolamenti e manuali
- Sicurezza ICT e protezione dati nei progetti
- Documento politiche di accesso
- Formazione processo/applicativo
- Formazione protezione dati
- Privacy by design e by default

Tabella "Misure di sicurezza relative agli asset":
a) Credenziali: qualità password (8+ car.), non riutilizzo, sostituzione periodica, blocco tentativi falliti, MFA, SSO, timeout sessione, validazione input
b) Protezione dati: cifratura, separazione, anonimizzazione, differential privacy, privilegio minimo, log accessi, SSL/TLS
c) Cifratura: chiavi personali, cifratura disco e database
d) Backup: frequenza, test ripristino, cifratura copie, conservazione >500km, ridondanza
e) Hardware e luoghi fisici: configurazione dispositivi, antincendio, controllo accessi
f) Certificazioni e continuità: ISO 9001/27001, disaster recovery, gestione credenziali e privilegi

**7.2 Valutazione delle minacce:**
Per OGNI minaccia (Accesso illegittimo ai dati, Modifiche indesiderate dei dati, Perdita di dati):
- Categoria e aree impatto (Riservatezza/Integrità/Disponibilità)
- Fonti rischio (Umano/Contesto/Strumenti)
- RISCHIO INIZIALE: Impatto(1-4) × Probabilità(1-4) = Valore e Livello
- Misure di mitigazione applicate (lista)
- **Indicatore di efficacia** per OGNI misura: descrivere come si verificherà che la misura funzioni (es. "Audit semestrale dei log di accesso con report documentato", "Test di penetrazione annuale con report di terza parte")
- RISCHIO RESIDUO: Impatto(1-4) × Probabilità(1-4) = Valore e Livello
  - **VINCOLO:** Se TUTTE le misure sono "Da applicare", il rischio residuo NON PUÒ scendere di più di 1 punto sulla scala di probabilità rispetto al rischio iniziale
- Mitigazione totale impatto e probabilità
- Motivazione accettazione rischio: deve essere formulata come DICHIARAZIONE DEL TITOLARE (es. "Il Titolare dichiara di accettare il rischio residuo in quanto...")

**7.3 Piano d'azione correttivo:**
Per OGNI misura con stato "Da applicare", generare automaticamente:
- ID misura progressivo (MIT-001, MIT-002, MIT-003...)
- Descrizione della misura
- Responsabile (ruolo, NON nome — es. "DPO", "CISO", "Responsabile IT", "Responsabile HR")
- Scadenza suggerita: 30 giorni (priorità critica), 60 giorni (priorità alta), 90 giorni (priorità media), 180 giorni (priorità bassa)
- Livello di effort: Basso / Medio / Alto / Molto alto
- Priorità: Critica / Alta / Media / Bassa
- Stato: Da applicare
Ordinare le misure per priorità decrescente (Critica prima, Bassa ultima).

Tabella riepilogativa: Minaccia | Rischio iniziale | Rischio residuo
Livello rischio per area (Riservatezza, Integrità, Disponibilità)
Livello rischio complessivo residuo

### 8. COINVOLGIMENTO DELLE PARTI INTERESSATE
- Opinioni degli interessati o dei rappresentanti raccolte? Sì/No con dettagli
- Se le opinioni NON sono state raccolte: la motivazione DEVE essere dettagliata e DEVE includere un piano con data per raccoglierle successivamente (es. survey online entro [data], focus group entro [data], consultazione pubblica). NON è sufficiente scrivere "non è stato possibile": specificare PERCHÉ e QUANDO sarà fatto.
- DPO coinvolto? Sì - specificare ruolo svolto
- Parere finale del DPO sulla correttezza e coerenza con il GDPR

### 9. NOTE E CONCLUSIONI
Esito finale della DPIA con parere professionale:
- Se rischio residuo basso: dichiarazione che il trattamento non comporta rischio elevato
- Se rischio residuo alto: necessità consultazione preventiva Art. 36
- Piano d'azione con responsabili e scadenze

### 10. DECISIONE FINALE
**LOGICA OBBLIGATORIA basata sul rischio complessivo residuo della Sezione 7:**
- Se rischio residuo = Medio o Basso: "Proseguire il trattamento" con motivazione
- Se rischio residuo = Alto: "Proseguire il trattamento con riserva" — con obbligo di rivalutazione entro 6 mesi e consultazione preventiva Art. 36 se il rischio non scende a Medio
- Se rischio residuo = Altissimo: "Consultazione preventiva obbligatoria ex Art. 36 del Regolamento (UE) 2016/679"
La motivazione DEVE sempre includere le condizioni vincolanti e le scadenze.
Il campo condizioni_vincoli DEVE elencare le condizioni concrete.
Il campo consultazione_preventiva DEVE specificare se necessaria, quando e perché.

### 11. PIANO DI REVISIONE E CHECKLIST
- Frequenza di revisione della DPIA (es. annuale, semestrale)
- Trigger di revisione straordinaria (nuove tecnologie, incidenti, modifiche normative)
- Responsabile della revisione
- Log delle versioni precedenti
- Prossima data di revisione programmata

### CHECKLIST FINALE GDPR
Tabella con elementi di conformità e stato (Conforme / Da verificare / Non conforme):
- Necessità della DPIA accertata
- Descrizione sistematica del trattamento
- Valutazione necessità e proporzionalità
- Valutazione rischi per diritti e libertà
- Misure di mitigazione identificate
- Parere DPO acquisito
- Decisione finale documentata
- Piano revisione definito
- Consultazione interessati pianificata
- Piano d'azione approvato dal management
- Budget stanziato per le misure correttive
Per ogni elemento con stato "Da verificare", aggiungere la data prevista di verifica e il responsabile.

### SUGGERIMENTI PRIVACY BY DESIGN
Aggiungi suggerimenti concreti di miglioramento privacy-by-design specifici per il settore e il trattamento analizzato. Includi:
- Rischi comuni nel settore specifico
- Misure tecniche consigliate
- Best practice di settore

### FIRMA FINALE
Spazio per firme:
- Il Titolare del Trattamento: [DA COMPLETARE] _________________ Data: ___/___/______
- Il Responsabile della Protezione dei Dati (DPO): [DA COMPLETARE] _________________ Data: ___/___/______
- Approvato dal Management: [DA COMPLETARE] _________________ Data: ___/___/______

### COERENZA INTERNA DEL DOCUMENTO
REGOLE TASSATIVE:
- Se un Gap è citato nel documento (es. Gap 1 - Art. 12), deve esistere almeno una misura correttiva collegata con ID tracciabile (MIT-NNN)
- I riferimenti ai Gap devono essere consistenti in tutto il documento (usare sempre lo stesso formato: "Gap N - Art. XX")
- Eliminare TUTTI i caratteri non stampabili (sostituire frecce Unicode rotte con "->" o testo equivalente)
- Usare numerazione progressiva MIT-001, MIT-002 per le misure
- I riferimenti normativi completi la prima volta: "Art. 35 del Regolamento (UE) 2016/679", poi abbreviati "Art. 35 GDPR"

REGOLE:
- Compila OGNI sezione con contenuti SPECIFICI, mai generici
- USA valori numerici concreti per OGNI minaccia nella matrice R=f(M,p)
- Per le misure indica SEMPRE stato: Applicata / Da applicare
- Scrivi TUTTO in italiano professionale, senza termini inglesi
- Usa SEMPRE Sì/No (mai Yes/No)
- Per dati aziendali non disponibili (ragione sociale, P.IVA, PEC, telefono, nomi persone), usa '[DA COMPLETARE - descrizione dato]'
- NON inventare MAI nomi di persone, ragioni sociali, codici fiscali, numeri di telefono o indirizzi PEC
- Evita formulazioni troppo colloquiali o gergali

Always use the generate_compliance_document function to return your response.`;
  }

  if (type === 'ropa') {
    const modeNote = mode === 'breve'
      ? '\n\n⚡ MODALITÀ BREVE: Genera versione sintetica con almeno 6 attività ma descrizioni ridotte (30-40 parole per la descrizione estesa).'
      : mode === 'audit'
      ? '\n\n🔍 MODALITÀ AUDIT: Per ogni attività aggiungi mapping ai controlli ISO 27001:2022. Aggiungi sezione extra di compliance mapping GDPR ↔ ISO 27001.'
      : '';

    return `Agisci come consulente legale e privacy officer senior esperto in GDPR.
Genera un REGISTRO DELLE ATTIVITÀ DI TRATTAMENTO (RoPA) COMPLETO conforme all'Art. 30 GDPR seguendo ESATTAMENTE la struttura del modello professionale italiano.
Lo stile deve essere formale, tecnico-legale ma leggibile. Il documento deve essere pronto per:
- Consegna al DPO
- Presentazione in audit
- Esibizione all'Autorità Garante in caso di ispezione
- Archiviazione come documentazione ufficiale
${modeNote}

## STRUTTURA OBBLIGATORIA

### INTESTAZIONE
- Titolo: "REGISTRO DELLE ATTIVITA' DI TRATTAMENTO DEL TITOLARE (ai sensi dell'art. 30 GDPR)"
- Nome azienda, P.IVA
- Data del documento
- Versione documento

### ATTIVITÀ DI TRATTAMENTO
Per OGNI attività (genera almeno 6-10 attività tipiche per il settore), usa ESATTAMENTE questa struttura:

---
**Codice:** [NNN] (progressivo: 001, 002, 003...)

**Denominazione:** [NOME IN MAIUSCOLO]

**Descrizione sintetica:** 1-2 frasi riassuntive del trattamento

**Descrizione estesa:** Paragrafo DETTAGLIATO (minimo 80 parole) che spiega:
- Cosa si fa concretamente con i dati
- Quali sistemi/strumenti vengono utilizzati
- Come vengono archiviati (server, cartaceo, cloud, faldoni)
- Chi è coinvolto nel processo
- Se si agisce come Titolare o Responsabile
- Eventuali sub-trattamenti

**Data di inserimento nel registro:** [data]

**Titolare del Trattamento:**
- Ragione sociale
- Indirizzo completo
- Telefono
- PEC
- E-mail

**Responsabile del Trattamento (Art. 28):**
Per ogni responsabile:
- Ragione sociale
- Indirizzo completo
- Telefono
- E-mail
- Descrizione servizio fornito

**Responsabile della protezione dei dati:**
- Nome e cognome
- Indirizzo completo
- Telefono
- Cellulare
- PEC
- E-mail

**Categorie del Trattamento (Art. 30 c.2 a-b):**
Lista SPECIFICA dei dati trattati (almeno 3 categorie), es:
- Nominativo, indirizzo o altri elementi di identificazione personale
- Codice fiscale ed altri numeri di identificazione personale
- Dati di contatto (tel, e-mail...)
- Coordinate bancarie
- REDDITO - STIPENDIO
- Attività economiche, commerciali, finanziarie e assicurative
- Dati relativi alla famiglia o a situazioni personali
- Provincia di residenza
- Stato di salute (se applicabile)
- Idoneità al lavoro (se applicabile)

**Ulteriore finalità:** [se presente, altrimenti vuoto]

**Tempi di conservazione (Art. 30 c.1 f):**
- Data inizio del trattamento: [data specifica]
- Conclusione: [durata specifica es. "10 anni" o "Durata illimitata" con giustificazione]

**Comunicazione e Trasferimento all'estero (Art. 30 c.2 c):**
[Dettagli o "Non previsto"]

**Funzioni:**
- Unità organizzativa (es. PERSONALE, AMMINISTRAZIONE, COMMERCIALE, IT, PROGETTAZIONE)
- Formazione e istruzione autorizzati al trattamento
- Profilazione di dominio per accesso filemanager

**Misure di Sicurezza (organizzative e tecnologiche e backup) (Art. 30 c.2 d):**
- Credenziali di accesso agli applicativi
- Sistema di back up
- Antivirus e antimalware
- Datacenter ad accesso riservato
- Postazioni di lavoro (endpoint) sottoposte a monitoraggio continuo delle criticità e degli aggiornamenti
- Sistema di gestione del supporto tecnico
- [Altre misure specifiche per il trattamento]

**Ulteriori informazioni:**
- Trattamento riguarda minori: Sì/No
- Dati raccolti presso l'interessato: Sì/No
- Dati utilizzati per profilazione o processi automatizzati: Sì/No

**Condizioni di Liceità:**
[Articolo GDPR specifico, es. "art. 6 par. 1 b)" o "art. 6 par. 1 c)" o "art. 9 par. 2 h)"]
---

### SUGGERIMENTI PRIVACY BY DESIGN
Aggiungi suggerimenti concreti di miglioramento specifici per il settore:
- Rischi comuni nel settore
- Misure tecniche consigliate
- Best practice di settore

### LOG REVISIONE DOCUMENTO
Tabella con: Versione | Data | Autore | Modifiche apportate

### FIRMA FINALE
- Il Titolare del Trattamento: [DA COMPLETARE] _________________ Data: ___/___/______
- Il Responsabile della Protezione dei Dati (DPO): [DA COMPLETARE] _________________ Data: ___/___/______

REGOLE CRITICHE:
- Genera ALMENO 6-10 attività di trattamento specifiche per il settore
- Ogni attività DEVE avere TUTTI i campi sopra elencati compilati
- Le descrizioni estese devono essere DETTAGLIATE (80+ parole)
- Per dati aziendali non disponibili (ragione sociale, P.IVA, PEC, telefono, nomi persone), usa '[DA COMPLETARE - descrizione dato]'
- NON inventare MAI nomi di persone, ragioni sociali, codici fiscali, numeri di telefono o indirizzi PEC
- I contatti del Titolare e DPO devono essere coerenti in tutte le attività
- Usa la struttura ESATTA con Codici progressivi (001, 002, 003...)
- Scrivi TUTTO in italiano professionale, senza termini inglesi
- Usa SEMPRE Sì/No (mai Yes/No)

Always use the generate_compliance_document function to return your response.`;
  }

  if (type === 'lia') {
    return `Agisci come consulente legale senior esperto in GDPR e AI Act. Genera un LEGITIMATE INTEREST ASSESSMENT (LIA) COMPLETO, noto anche come Valutazione del Legittimo Interesse, conforme all'Art. 6(1)(f) GDPR e alle linee guida WP217 del WP29. Lo stile deve essere formale, tecnico-legale ma leggibile. Il documento deve essere pronto per presentazione al Garante.

STRUTTURA OBBLIGATORIA DEL LIA

1. INFORMAZIONI GENERALI
Data, versione, autore, organizzazione
Descrizione del trattamento oggetto della valutazione
Base giuridica invocata: Art. 6(1)(f) GDPR - Legittimo interesse

2. TEST IN TRE FASI (Three-Part Test)

2.1 FASE 1 — PURPOSE TEST (Test di finalità)
Qual è l'interesse legittimo perseguito?
L'interesse è reale, attuale e non speculativo?
L'interesse è lecito (non contrario alla legge)?
Il trattamento è necessario per perseguire l'interesse? Esistono alternative meno invasive?
Valutazione DETTAGLIATA con motivazione per ogni punto

2.2 FASE 2 — NECESSITY TEST (Test di necessità)
Il trattamento è strettamente necessario per raggiungere la finalità?
Esistono modi meno intrusivi per raggiungere lo stesso obiettivo?
I dati trattati sono proporzionati alla finalità?
La durata della conservazione è giustificata?
Valutazione DETTAGLIATA con motivazione

2.3 FASE 3 — BALANCING TEST (Test di bilanciamento)
Quali sono i diritti e le libertà fondamentali degli interessati coinvolti?
Qual è l'impatto ragionevolmente prevedibile sugli interessati?
Gli interessati possono ragionevolmente aspettarsi questo trattamento?
Esistono categorie vulnerabili tra gli interessati (minori, dipendenti)?
Quali misure di mitigazione sono implementate (pseudonimizzazione, opt-out, trasparenza)?
Il bilanciamento è favorevole al titolare? Con quale margine?
Valutazione DETTAGLIATA con tabella di bilanciamento

3. MISURE DI SALVAGUARDIA
Misure tecniche implementate (cifratura, pseudonimizzazione, controllo accessi)
Misure organizzative (formazione, procedure, limitazione accesso)
Diritto di opposizione: come viene garantito (Art. 21 GDPR)
Informativa: come gli interessati vengono informati (Art. 13-14 GDPR)
Revisione periodica del bilanciamento

4. CONCLUSIONE E DECISIONE
Esito del test di bilanciamento: il legittimo interesse prevale / non prevale
Condizioni e vincoli per il proseguimento del trattamento
Obblighi residui (informativa, diritto di opposizione)
Data di revisione programmata

5. FIRMA E APPROVAZIONE
Titolare del trattamento
DPO (se designato)
Data di approvazione

REGOLE:
Compila OGNI sezione con contenuti SPECIFICI basati sul settore e contesto dell'organizzazione
Usa valutazioni concrete con Sì/No e motivazioni dettagliate
Per il test di bilanciamento usa una tabella: Interesse del titolare vs Diritti dell'interessato
Scrivi TUTTO in italiano professionale
Usa SEMPRE Sì/No (mai Yes/No)
Per i dati aziendali non disponibili usa [DA COMPLETARE]

Always use the generate_compliance_document function to return your response.`;
  }

  if (type === 'gap_report') {
    return `Agisci come consulente senior di compliance normativa. Genera un REPORT ESECUTIVO DI GAP ANALYSIS basato sui risultati della verifica documentale fornita. Il documento deve essere pronto per presentazione al management e agli auditor.

STRUTTURA OBBLIGATORIA

1. EXECUTIVE SUMMARY
Sintesi dei risultati in 5-8 righe: normative analizzate, numero di requisiti verificati, quanti risultano documentati, quanti presentano gap (per profilo di rischio: alto, medio, basso), quanti sono da verificare. Conformità documentale complessiva. Raccomandazione principale.

2. AMBITO DELL'ANALISI
Normative analizzate, settore, giurisdizione, documenti analizzati (ed eventuali documenti esclusi perché non leggibili), metodologia: verifica documentale requisito per requisito con evidenze testuali citate dai documenti; profilo di rischio ottenuto combinando gravità dell'obbligo e stato della documentazione.

3. RISULTATI PER NORMATIVA
Per ogni normativa: conformità documentale, elenco dei gap con riferimento all'articolo, cosa risulta dai documenti, cosa manca, profilo di rischio (alto/medio/basso), azioni raccomandate.

4. REQUISITI DOCUMENTATI
Elenco dei requisiti che risultano soddisfatti, con la sintesi dell'evidenza trovata (documento e contenuto). Se nessuno, dichiararlo.

5. REQUISITI DA VERIFICARE
Obblighi condizionali la cui applicabilità non risulta dai documenti, con la verifica da fare. Se nessuno, dichiararlo.

6. PIANO DI REMEDIATION PRIORITIZZATO
Azioni immediate (0-30 giorni) per i gap a rischio alto; breve termine (1-3 mesi) per i gap medi; medio termine (3-6 mesi) per i gap bassi; miglioramenti continui. Ogni azione deve derivare dalle azioni raccomandate dei gap, senza stime di ore, costi o sanzioni.

7. CONCLUSIONI E RACCOMANDAZIONI
Valutazione complessiva della postura di conformità documentale, top 3 priorità immediate, prossimi passi, e il limite dell'analisi: valuta ciò che risulta dai documenti, non l'effettiva applicazione delle misure, e non sostituisce il parere legale.

REGOLE:
Basati ESCLUSIVAMENTE sui dati dell'assessment forniti (gap, requisiti verificati, evidenze, azioni)
NON quantificare sanzioni in euro, NON stimare ore o costi
Cita le evidenze documentali con il nome del documento
Scrivi in italiano professionale
NON inventare gap, requisiti o evidenze non presenti nell'assessment

Always use the generate_compliance_document function to return your response.`;
  }

  if (type === 'risk_analysis') {
    return `Agisci come Risk Manager senior esperto in protezione dei dati personali e conformità GDPR.
Genera un'Analisi dei Rischi ex Art. 24 GDPR COMPLETA che segua rigorosamente la struttura professionale a 10 sezioni.

IMPORTANTE: Questo documento NON è una DPIA (Art. 35). NON riguarda un singolo trattamento specifico.
È un'analisi COMPLESSIVA delle misure tecniche e organizzative dell'organizzazione per garantire e dimostrare la conformità GDPR (principio di accountability).

Il documento deve essere conforme a:
- Art. 24 GDPR (Responsabilità del titolare)
- Art. 5, par. 2 GDPR (Principio di responsabilizzazione/accountability)
- Art. 32 GDPR (Sicurezza del trattamento)
- Linee guida ENISA sulla gestione del rischio
- Standard ISO 31000:2018 (Gestione del rischio)

## STRUTTURA OBBLIGATORIA (10 SEZIONI)

### 1. PREMESSA E AMBITO
Descrizione dell'organizzazione, settore, dimensioni, perimetro dell'analisi (quali trattamenti, quali sedi, quali sistemi). Riferimenti normativi applicabili. Data dell'analisi e versione del documento.

### 2. METODOLOGIA
Approccio adottato per la valutazione del rischio. Scala di valutazione: Impatto (1=Trascurabile, 2=Limitato, 3=Significativo, 4=Massimo) e Probabilità (1=Improbabile, 2=Poco probabile, 3=Probabile, 4=Molto probabile). Matrice rischio 4x4 con livelli: Basso (1-4), Medio (5-8), Alto (9-12), Altissimo (13-16). Criteri per la determinazione dell'impatto: danno economico, danno reputazionale, danno operativo, danno ai diritti delle persone.

### 3. INVENTARIO DEI TRATTAMENTI
Tabella sintetica dei principali trattamenti dell'organizzazione. Per ogni trattamento: codice, denominazione, categorie di dati, categorie di interessati, base giuridica, volume stimato. Derivare dall'assessment e dal settore dell'organizzazione.

### 4. IDENTIFICAZIONE DELLE MINACCE
Per ogni area di rischio (Governance, Diritti interessati, Sicurezza tecnica, Gestione fornitori, Trasferimenti internazionali), identificare: minaccia specifica, asset/processo coinvolto, vulnerabilità sfruttata, fonte del rischio (umana, tecnica, organizzativa, contesto).
COLLEGAMENTO GAP: Ogni minaccia DEVE corrispondere a un gap reale dell'assessment. Se il gap è su Art. 12, la minaccia è "Impossibilità per gli interessati di esercitare i propri diritti". Se il gap è su Art. 28, la minaccia è "Trattamento non autorizzato da parte di fornitori senza DPA".

### 5. VALUTAZIONE DEL RISCHIO INERENTE
Matrice Impatto × Probabilità per ogni minaccia PRIMA dell'implementazione delle misure correttive.
MAPPATURA: Usare il risk_level dei gap per determinare i valori:
- Gap critical → Impatto 4, Probabilità 3-4
- Gap high → Impatto 3, Probabilità 2-3
- Gap medium → Impatto 2, Probabilità 2
- Gap low → Impatto 1-2, Probabilità 1

### 6. MISURE DI MITIGAZIONE
Per ogni minaccia, elencare:
- Misure GIÀ IMPLEMENTATE (stato: Applicata) — derivare dal contesto dell'organizzazione
- Misure DA IMPLEMENTARE (stato: Da applicare) — derivare dalle azioni raccomandate dei gap
Per ogni misura: descrizione, tipo (tecnica/organizzativa/contrattuale), responsabile, stato, scadenza prevista.

### 7. VALUTAZIONE DEL RISCHIO RESIDUO
Ricalcolare Impatto × Probabilità DOPO le misure pianificate.
Il rischio residuo NON può essere Basso se il gap è critical e le misure sono "Da applicare".
Includere motivazione dell'accettazione del rischio residuo per ogni minaccia.

### 8. PIANO DI TRATTAMENTO DEL RISCHIO
Tabella prioritizzata delle azioni correttive: azione, responsabile, scadenza, costo stimato, priorità (1=immediata, 2=breve termine, 3=medio termine).
Derivare direttamente dal piano d'azione dell'assessment (ore, costi, priorità).

### 9. ACCETTAZIONE DEL RISCHIO
Dichiarazione formale del Titolare che:
- Identifica i rischi residui accettati e le condizioni di accettazione
- Stabilisce le soglie di rischio oltre le quali è necessario intervenire
- Definisce le responsabilità per il monitoraggio continuo

### 10. PIANO DI MONITORAGGIO E REVISIONE
Frequenza di revisione (semestrale/annuale), KPI di monitoraggio, trigger per revisione straordinaria, responsabile della revisione.

Scrivi INTERAMENTE in italiano professionale. NON inventare nomi di persone o aziende — usa [DA COMPLETARE].
Il documento deve essere pronto per esibizione in caso di ispezione del Garante.`;
  }

  return `Agisci come consulente legale e privacy officer senior esperto in GDPR. Scrivi TUTTO in italiano professionale. Always use the generate_compliance_document function to return your response.`;
}

// =====================================================================
// SCHEMAS - Match EXACTLY the structure of the DPIA (11 sections) and RoPA
// =====================================================================

function getDocumentSchema(type: string, mode: string = 'standard'): any {
  if (type === 'dpia') {
    const baseSchema: any = {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titolo: "Valutazione d\'impatto sulla protezione dei dati - [Nome Trattamento]"' },
        section_1_introduzione: {
          type: 'string',
          description: 'Sezione 1: Paragrafo introduttivo completo che spiega scopo e contesto della DPIA con sommario sezioni'
        },
        section_2_informazioni_essenziali: {
          type: 'object',
          description: 'Sezione 2: Informazioni essenziali del documento',
          properties: {
            data_creazione_analisi: { type: 'string' },
            data_generazione_documento: { type: 'string' },
            stato: { type: 'string', description: 'In lavorazione / Approvata' },
            reporter: { type: 'string', description: 'Nome della persona responsabile' },
            versione: { type: 'string', description: 'Versione del documento es. 1.0' }
          }
        },
        section_3_pre_assessment: {
          type: 'object',
          description: 'Sezione 3: Stima del rischio e pre-assessment',
          properties: {
            pre_assessment_tipologie: {
              type: 'array',
              description: 'Tabella pre-assessment: per ogni tipologia di trattamento indica se applicabile',
              items: {
                type: 'object',
                properties: {
                  tipologia: { type: 'string', description: 'Descrizione della tipologia di trattamento' },
                  risposta: { type: 'string', description: 'Sì / No / Non applicabile' },
                  motivazione: { type: 'string', description: 'Giustificazione della risposta' }
                }
              }
            },
            stima_rischio_wp29: {
              type: 'array',
              description: 'Criteri WP29 per la stima del rischio',
              items: {
                type: 'object',
                properties: {
                  criterio: { type: 'string', description: 'Nome del criterio WP29' },
                  risposta: { type: 'string', description: 'Sì / No' },
                  motivazione: { type: 'string' }
                }
              }
            }
          }
        },
        section_4_informazioni_trattamento: {
          type: 'object',
          description: 'Sezione 4: Informazioni dettagliate sul trattamento',
          properties: {
            codice_identificativo: { type: 'string' },
            nome: { type: 'string' },
            data_creazione: { type: 'string' },
            data_ultima_modifica: { type: 'string' },
            descrizione: { type: 'string', description: 'Descrizione ESTESA del trattamento (min 150 parole)' },
            finalita: { type: 'string', description: 'Finalità del trattamento con riferimento specifico' },
            basi_giuridiche: { type: 'string', description: 'Art. 6 e Art. 9 GDPR con citazione completa' },
            riferimenti_normativi: { type: 'string', description: 'Leggi, decreti, regolamenti specifici' },
            origine_dati: { type: 'string', description: 'Raccolti presso interessato / Terze parti' },
            modalita_trattamento: { type: 'string', description: 'Informatizzato / Cartaceo / Misto' },
            categorie_dati: {
              type: 'object',
              properties: {
                dati_personali: { type: 'array', items: { type: 'string' }, description: 'Elenco TASSATIVO: Nominativo, CF, contatti, sesso... MAI formule vaghe' },
                categorie_particolari: { type: 'array', items: { type: 'string' }, description: 'Stato di salute, dati biometrici... con base giuridica Art. 9 specifica' }
              }
            },
            titolare: { type: 'object', properties: { ragione_sociale: { type: 'string' }, indirizzo: { type: 'string' }, telefono: { type: 'string' }, pec: { type: 'string' }, email: { type: 'string' } } },
            sub_responsabili: { type: 'array', items: { type: 'object', properties: { ragione_sociale: { type: 'string' }, servizio: { type: 'string' }, contratto_art28: { type: 'string' } } } },
            dpo: { type: 'object', properties: { nome: { type: 'string' }, email: { type: 'string' }, telefono: { type: 'string' } } },
            periodi_conservazione: {
              type: 'array',
              description: 'Periodi di conservazione DIFFERENZIATI per finalità specifica, con base normativa',
              items: {
                type: 'object',
                properties: {
                  finalita: { type: 'string', description: 'Finalità specifica (es. Contabilità, Marketing, Gestione HR)' },
                  periodo: { type: 'string', description: 'Durata (es. 10 anni, 24 mesi, 6 mesi)' },
                  base_normativa: { type: 'string', description: 'Riferimento normativo (es. Art. 2220 c.c., Provvedimento Garante, Art. 25 D.Lgs. 81/08)' }
                }
              }
            },
            periodo_conservazione: { type: 'string', description: 'DEPRECATO: usare periodi_conservazione array. Fallback se periodi_conservazione non presente' },
            applicativi: { type: 'array', items: { type: 'object', properties: { nome: { type: 'string' }, descrizione: { type: 'string' } } } },
            componenti_organizzative: { type: 'string', description: 'Soggetti, procedure, formazione, relazioni' },
            componenti_tecnologiche: {
              type: 'object',
              properties: {
                soggetti_interni: { type: 'string' },
                soggetti_esterni: { type: 'string' },
                software_applicativi: { type: 'string' },
                connessioni_rete: { type: 'string' }
              }
            },
            componenti_fisiche: { type: 'string', description: 'Infrastruttura, data center, sedi' }
          }
        },
        section_5_proporzionalita: {
          type: 'string',
          description: 'Sezione 5: Dichiarazione di proporzionalità del titolare'
        },
        section_6_diritti_principi: {
          type: 'object',
          description: 'Sezione 6: Diritti e principi fondamentali',
          properties: {
            diritti_interessato: {
              type: 'object',
              description: 'Per ogni diritto: procedura concreta',
              properties: {
                accesso_art15: { type: 'string' },
                rettifica_art16: { type: 'string' },
                cancellazione_art17: { type: 'string' },
                portabilita_art20: { type: 'string' },
                opposizione_art21: { type: 'string' },
                limitazione_art18: { type: 'string' },
                revoca_consenso: { type: 'string' },
                decisioni_automatizzate_art22: { type: 'string' }
              }
            },
            principi: {
              type: 'object',
              properties: {
                liceita_correttezza_trasparenza: { type: 'string' },
                limitazione_finalita: { type: 'string' },
                minimizzazione: { type: 'string' },
                limitazione_conservazione: { type: 'string' },
                integrita_riservatezza: { type: 'string' }
              }
            }
          }
        },
        section_7_valutazione_rischio: {
          type: 'object',
          description: 'Sezione 7: Valutazione del rischio con metodologia R=f(M,p)',
          properties: {
            misure_sicurezza_trattamenti: {
              type: 'array',
              description: 'Misure trasversali: Categoria | Misura | Stato (Applicata/Da applicare)',
              items: {
                type: 'object',
                properties: {
                  categoria: { type: 'string' },
                  misura: { type: 'string' },
                  stato: { type: 'string', description: 'Applicata / Da applicare' }
                }
              }
            },
            misure_sicurezza_asset: {
              type: 'object',
              description: 'Misure relative agli asset',
              properties: {
                credenziali: { type: 'array', items: { type: 'object', properties: { misura: { type: 'string' }, stato: { type: 'string' } } } },
                protezione_dati: { type: 'array', items: { type: 'object', properties: { misura: { type: 'string' }, stato: { type: 'string' } } } },
                cifratura: { type: 'array', items: { type: 'object', properties: { misura: { type: 'string' }, stato: { type: 'string' } } } },
                backup: { type: 'array', items: { type: 'object', properties: { misura: { type: 'string' }, stato: { type: 'string' } } } },
                hardware_fisico: { type: 'array', items: { type: 'object', properties: { misura: { type: 'string' }, stato: { type: 'string' } } } },
                certificazioni_continuita: { type: 'array', items: { type: 'object', properties: { misura: { type: 'string' }, stato: { type: 'string' } } } }
              }
            },
            valutazione_minacce: {
              type: 'array',
              description: 'Per ogni minaccia: rischio iniziale R=M*p, misure con indicatore efficacia, piano azione correttivo, rischio residuo',
              items: {
                type: 'object',
                properties: {
                  nome_minaccia: { type: 'string', description: 'Es: Accesso illegittimo ai dati, Modifiche indesiderate, Perdita di dati' },
                  categoria: { type: 'string' },
                  aree_impatto: { type: 'array', items: { type: 'string' }, description: 'Riservatezza / Integrità / Disponibilità' },
                  fonti_rischio: { type: 'array', items: { type: 'string' }, description: 'Umano / Contesto / Strumenti' },
                  rischio_iniziale: {
                    type: 'object',
                    properties: {
                      impatto_M: { type: 'integer', description: '1-4' },
                      probabilita_p: { type: 'integer', description: '1-4' },
                      valore_R: { type: 'integer', description: 'M * p' },
                      livello: { type: 'string', description: 'Basso/Medio/Alto/Altissimo' }
                    }
                  },
                  misure_mitigazione: { type: 'array', items: { type: 'string' } },
                  indicatori_efficacia: {
                    type: 'array',
                    description: 'Per ogni misura, come si verificherà che funzioni (es. Audit semestrale, Pen test annuale)',
                    items: { type: 'string' }
                  },
                  piano_azione_correttivo: {
                    type: 'array',
                    description: 'Per ogni misura "Da applicare": ID, descrizione, responsabile (ruolo), scadenza, effort, priorità',
                    items: {
                      type: 'object',
                      properties: {
                        id_misura: { type: 'string', description: 'ID progressivo: MIT-001, MIT-002...' },
                        descrizione: { type: 'string' },
                        responsabile: { type: 'string', description: 'Ruolo (DPO, CISO, Resp. IT, Resp. HR), MAI nomi' },
                        scadenza_giorni: { type: 'integer', description: '30/60/90/180 giorni in base alla priorità' },
                        effort: { type: 'string', description: 'Basso / Medio / Alto / Molto alto' },
                        priorita: { type: 'string', description: 'Critica / Alta / Media / Bassa' },
                        stato: { type: 'string', description: 'Da applicare' }
                      }
                    }
                  },
                  rischio_residuo: {
                    type: 'object',
                    properties: {
                      impatto_M: { type: 'integer' },
                      probabilita_p: { type: 'integer' },
                      valore_R: { type: 'integer' },
                      livello: { type: 'string' }
                    }
                  },
                  motivazione_accettazione: { type: 'string', description: 'Dichiarazione del Titolare: "Il Titolare dichiara di accettare il rischio residuo in quanto..."' }
                }
              }
            },
            riepilogo: {
              type: 'object',
              properties: {
                rischio_riservatezza: { type: 'string' },
                rischio_integrita: { type: 'string' },
                rischio_disponibilita: { type: 'string' },
                rischio_complessivo_residuo: { type: 'string', description: 'Basso / Medio / Alto / Altissimo' }
              }
            }
          }
        },
        section_8_coinvolgimento_parti: {
          type: 'object',
          description: 'Sezione 8: Coinvolgimento delle parti interessate',
          properties: {
            opinioni_interessati_raccolte: { type: 'string', description: 'Sì/No con dettagli. Se No: motivazione dettagliata + piano con data per raccoglierle (survey, focus group, consultazione pubblica)' },
            piano_consultazione_interessati: { type: 'string', description: 'Se opinioni non raccolte: piano dettagliato con metodo (survey/focus group/consultazione pubblica), data prevista, responsabile' },
            dpo_coinvolto: { type: 'string', description: 'Sì - specificare ruolo svolto nella DPIA' },
            parere_dpo: { type: 'string', description: 'Parere finale del DPO sulla correttezza e coerenza con il GDPR' }
          }
        },
        section_9_note_conclusioni: {
          type: 'string',
          description: 'Sezione 9: Note e conclusioni - Esito finale della DPIA con valutazione rischio residuo e eventuali necessità di consultazione preventiva Art. 36'
        },
        section_10_decisione_finale: {
          type: 'object',
          description: 'Sezione 10: Decisione finale del Titolare — LOGICA: Basso/Medio=Proseguire, Alto=Con riserva+rivalutazione 6 mesi, Altissimo=Consultazione Art.36 obbligatoria',
          properties: {
            decisione: { type: 'string', description: 'Proseguire il trattamento / Proseguire il trattamento con riserva / Consultazione preventiva obbligatoria ex Art. 36 GDPR' },
            motivazione: { type: 'string', description: 'Motivazione dettagliata come dichiarazione del Titolare, con condizioni vincolanti e scadenze' },
            condizioni_vincoli: { type: 'string', description: 'Condizioni vincolanti concrete per il proseguimento' },
            consultazione_preventiva: { type: 'string', description: 'Necessità di consultazione preventiva con Autorità Garante (Art. 36 GDPR) - Sì/No con motivazione e tempistiche' }
          }
        },
        section_11_piano_revisione: {
          type: 'object',
          description: 'Sezione 11: Piano di revisione della DPIA',
          properties: {
            frequenza_revisione: { type: 'string', description: 'Es. annuale, semestrale' },
            trigger_revisione_straordinaria: { type: 'array', items: { type: 'string' }, description: 'Eventi che attivano revisione: nuove tecnologie, incidenti, modifiche normative' },
            responsabile_revisione: { type: 'string' },
            log_versioni: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  versione: { type: 'string' },
                  data: { type: 'string' },
                  autore: { type: 'string' },
                  modifiche: { type: 'string' }
                }
              }
            },
            prossima_revisione: { type: 'string', description: 'Data prossima revisione programmata' }
          }
        },
        checklist_gdpr: {
          type: 'array',
          description: 'Checklist finale GDPR con stato conformità. Per elementi "Da verificare" aggiungere data_verifica e responsabile',
          items: {
            type: 'object',
            properties: {
              elemento: { type: 'string', description: 'Elemento di conformità da verificare' },
              stato: { type: 'string', description: 'Conforme / Da verificare / Non conforme' },
              note: { type: 'string' },
              data_verifica_prevista: { type: 'string', description: 'Solo per stato "Da verificare": data prevista di verifica' },
              responsabile_verifica: { type: 'string', description: 'Solo per stato "Da verificare": ruolo responsabile della verifica' }
            }
          }
        },
        suggerimenti_privacy_by_design: {
          type: 'array',
          description: 'Suggerimenti concreti di miglioramento privacy-by-design',
          items: {
            type: 'object',
            properties: {
              area: { type: 'string', description: 'Area di intervento' },
              suggerimento: { type: 'string', description: 'Suggerimento specifico' },
              priorita: { type: 'string', description: 'Alta / Media / Bassa' },
              rischi_settore: { type: 'string', description: 'Rischi comuni nel settore correlati' }
            }
          }
        },
        firma_finale: {
          type: 'object',
          description: 'Sezione firma finale con spazio management',
          properties: {
            titolare_nome: { type: 'string' },
            dpo_nome: { type: 'string' },
            management_nome: { type: 'string', description: 'Approvato dal Management: [DA COMPLETARE]' },
            data_firma: { type: 'string' },
            luogo: { type: 'string' }
          }
        }
      },
      required: ['title', 'section_1_introduzione', 'section_2_informazioni_essenziali', 'section_3_pre_assessment', 'section_4_informazioni_trattamento', 'section_5_proporzionalita', 'section_6_diritti_principi', 'section_7_valutazione_rischio', 'section_8_coinvolgimento_parti', 'section_9_note_conclusioni', 'section_10_decisione_finale', 'section_11_piano_revisione']
    };

    if (mode === 'audit') {
      baseSchema.properties.iso27001_mapping = {
        type: 'array',
        description: 'Mappatura GDPR <-> ISO 27001:2022 Annex A',
        items: {
          type: 'object',
          properties: {
            requisito_gdpr: { type: 'string' },
            controllo_iso27001: { type: 'string' },
            stato_implementazione: { type: 'string' },
            note: { type: 'string' }
          }
        }
      };
    }

    return baseSchema;
  }

  if (type === 'ropa') {
    const baseSchema: any = {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'REGISTRO DELLE ATTIVITA\' DI TRATTAMENTO DEL TITOLARE (ai sensi dell\'art. 30 GDPR)' },
        intestazione: {
          type: 'object',
          properties: {
            nome_azienda: { type: 'string' },
            partita_iva: { type: 'string' },
            data_documento: { type: 'string' },
            versione: { type: 'string', description: 'Versione del documento es. 1.0' }
          }
        },
        attivita_trattamento: {
          type: 'array',
          description: 'Lista completa delle attività di trattamento (almeno 6-10)',
          items: {
            type: 'object',
            properties: {
              codice: { type: 'string', description: 'Codice progressivo: 001, 002, 003...' },
              denominazione: { type: 'string', description: 'NOME IN MAIUSCOLO es. GESTIONE UTENTI E AUTENTICAZIONE' },
              descrizione_sintetica: { type: 'string', description: '1-2 frasi riassuntive' },
              descrizione_estesa: { type: 'string', description: 'Paragrafo dettagliato (80+ parole): cosa si fa, sistemi usati, archiviazione, soggetti coinvolti' },
              data_inserimento_registro: { type: 'string' },
              titolare_trattamento: {
                type: 'object',
                properties: {
                  ragione_sociale: { type: 'string' },
                  indirizzo: { type: 'string' },
                  telefono: { type: 'string' },
                  pec: { type: 'string' },
                  email: { type: 'string' }
                }
              },
              responsabile_trattamento: {
                type: 'object',
                properties: {
                  ragione_sociale: { type: 'string' },
                  indirizzo: { type: 'string' },
                  telefono: { type: 'string' },
                  email: { type: 'string' },
                  servizio: { type: 'string' }
                }
              },
              dpo: {
                type: 'object',
                properties: {
                  nome_cognome: { type: 'string' },
                  indirizzo: { type: 'string' },
                  telefono: { type: 'string' },
                  cellulare: { type: 'string' },
                  pec: { type: 'string' },
                  email: { type: 'string' }
                }
              },
              categorie_trattamento: {
                type: 'array',
                items: { type: 'string' },
                description: 'Almeno 3 categorie specifiche: Nominativo, CF, Contatti, Coordinate bancarie, Reddito, ecc.'
              },
              finalita: { type: 'string' },
              ulteriore_finalita: { type: 'string' },
              tempi_conservazione: {
                type: 'object',
                properties: {
                  data_inizio: { type: 'string' },
                  conclusione: { type: 'string' }
                }
              },
              comunicazione_trasferimento: { type: 'string', description: 'Dettagli trasferimento estero o "Non previsto"' },
              funzioni: {
                type: 'object',
                properties: {
                  unita_organizzativa: { type: 'string', description: 'Es. PERSONALE, AMMINISTRAZIONE, COMMERCIALE' },
                  formazione_istruzione: { type: 'string' },
                  profilazione_dominio: { type: 'string', description: 'Profilazione di dominio per accesso filemanager' }
                }
              },
              misure_sicurezza: {
                type: 'array',
                items: { type: 'string' },
                description: 'Lista misure: credenziali, backup, antivirus, datacenter, endpoint monitoring, supporto tecnico'
              },
              ulteriori_informazioni: {
                type: 'object',
                properties: {
                  riguarda_minori: { type: 'string', description: 'Sì / No' },
                  dati_raccolti_presso_interessato: { type: 'string', description: 'Sì / No' },
                  profilazione_processi_automatizzati: { type: 'string', description: 'Sì / No' }
                }
              },
              condizioni_liceita: { type: 'string', description: 'Articolo GDPR specifico es. "art. 6 par. 1 b)"' }
            }
          }
        },
        suggerimenti_privacy_by_design: {
          type: 'array',
          description: 'Suggerimenti privacy-by-design specifici per il settore',
          items: {
            type: 'object',
            properties: {
              area: { type: 'string' },
              suggerimento: { type: 'string' },
              priorita: { type: 'string' }
            }
          }
        },
        log_revisione: {
          type: 'array',
          description: 'Log revisione documento',
          items: {
            type: 'object',
            properties: {
              versione: { type: 'string' },
              data: { type: 'string' },
              autore: { type: 'string' },
              modifiche: { type: 'string' }
            }
          }
        },
        firma_finale: {
          type: 'object',
          properties: {
            titolare_nome: { type: 'string' },
            dpo_nome: { type: 'string' },
            data_firma: { type: 'string' },
            luogo: { type: 'string' }
          }
        }
      },
      required: ['title', 'intestazione', 'attivita_trattamento']
    };

    if (mode === 'audit') {
      baseSchema.properties.iso27001_mapping = {
        type: 'array',
        description: 'Mappatura GDPR <-> ISO 27001:2022 per ogni attività',
        items: {
          type: 'object',
          properties: {
            attivita: { type: 'string' },
            controlli_iso: { type: 'array', items: { type: 'string' } },
            stato: { type: 'string' }
          }
        }
      };
    }

    return baseSchema;
  }

  if (type === 'lia') {
    return {
      type: 'object',
      properties: {
        title: { type: 'string' },
        informazioni_generali: {
          type: 'object',
          properties: {
            data: { type: 'string' },
            versione: { type: 'string' },
            autore: { type: 'string' },
            organizzazione: { type: 'string' },
            descrizione_trattamento: { type: 'string', description: 'Descrizione dettagliata del trattamento (100+ parole)' },
            base_giuridica: { type: 'string' }
          }
        },
        purpose_test: {
          type: 'object',
          properties: {
            interesse_legittimo: { type: 'string', description: "Descrizione dell'interesse legittimo perseguito" },
            interesse_reale_attuale: { type: 'string', description: 'Sì/No con motivazione' },
            interesse_lecito: { type: 'string', description: 'Sì/No con motivazione' },
            necessita_trattamento: { type: 'string', description: 'Valutazione necessità e alternative' },
            esito: { type: 'string', description: 'Superato / Non superato' }
          }
        },
        necessity_test: {
          type: 'object',
          properties: {
            stretta_necessita: { type: 'string' },
            alternative_meno_intrusive: { type: 'string' },
            proporzionalita_dati: { type: 'string' },
            durata_conservazione: { type: 'string' },
            esito: { type: 'string', description: 'Superato / Non superato' }
          }
        },
        balancing_test: {
          type: 'object',
          properties: {
            diritti_interessati: { type: 'string' },
            impatto_prevedibile: { type: 'string' },
            aspettativa_ragionevole: { type: 'string' },
            categorie_vulnerabili: { type: 'string' },
            misure_mitigazione: { type: 'string' },
            esito_bilanciamento: { type: 'string', description: 'Favorevole al titolare / Non favorevole / Marginale' },
            tabella_bilanciamento: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  criterio: { type: 'string' },
                  interesse_titolare: { type: 'string' },
                  diritto_interessato: { type: 'string' },
                  valutazione: { type: 'string' }
                }
              }
            }
          }
        },
        misure_salvaguardia: {
          type: 'object',
          properties: {
            misure_tecniche: { type: 'array', items: { type: 'string' } },
            misure_organizzative: { type: 'array', items: { type: 'string' } },
            diritto_opposizione: { type: 'string' },
            informativa: { type: 'string' },
            revisione_periodica: { type: 'string' }
          }
        },
        conclusione: {
          type: 'object',
          properties: {
            esito: { type: 'string', description: 'Il legittimo interesse prevale / Non prevale' },
            condizioni: { type: 'string' },
            obblighi_residui: { type: 'string' },
            data_revisione: { type: 'string' }
          }
        },
        firma: {
          type: 'object',
          properties: {
            titolare: { type: 'string' },
            dpo: { type: 'string' },
            data_approvazione: { type: 'string' }
          }
        }
      },
      required: ['title', 'informazioni_generali', 'purpose_test', 'necessity_test', 'balancing_test', 'conclusione']
    };
  }

  if (type === 'gap_report') {
    return {
      type: 'object',
      properties: {
        title: { type: 'string' },
        executive_summary: { type: 'string', description: 'Sintesi esecutiva dei risultati (5-8 righe)' },
        ambito_analisi: {
          type: 'object',
          properties: {
            normative: { type: 'array', items: { type: 'string' } },
            settore: { type: 'string' },
            giurisdizione: { type: 'string' },
            documenti_analizzati: { type: 'array', items: { type: 'string' } },
            documenti_esclusi: { type: 'array', items: { type: 'string' } },
            metodologia: { type: 'string' }
          }
        },
        risultati_per_normativa: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              normativa: { type: 'string' },
              conformita_percentuale: { type: 'number' },
              gap_identificati: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    riferimento: { type: 'string' },
                    cosa_risulta: { type: 'string', description: 'Cosa risulta dai documenti' },
                    cosa_manca: { type: 'string', description: 'Elementi mancanti' },
                    stato_documentale: { type: 'string', enum: ['assente', 'parziale'] },
                    profilo_rischio: { type: 'string', enum: ['alto', 'medio', 'basso'] },
                    evidenze: { type: 'array', items: { type: 'string' }, description: 'Citazioni con nome del documento' },
                    azioni: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['riferimento', 'cosa_manca', 'profilo_rischio']
                }
              }
            }
          }
        },
        requisiti_documentati: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              riferimento: { type: 'string' },
              sintesi: { type: 'string' },
              evidenza: { type: 'string' }
            }
          }
        },
        requisiti_da_verificare: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              riferimento: { type: 'string' },
              motivo: { type: 'string' },
              verifica_da_fare: { type: 'string' }
            }
          }
        },
        piano_remediation: {
          type: 'object',
          properties: {
            immediate: { type: 'array', items: { type: 'string' }, description: '0-30 giorni' },
            breve_termine: { type: 'array', items: { type: 'string' }, description: '1-3 mesi' },
            medio_termine: { type: 'array', items: { type: 'string' }, description: '3-6 mesi' },
            continuo: { type: 'array', items: { type: 'string' } }
          }
        },
        conclusioni: { type: 'string' },
        raccomandazioni_top3: { type: 'array', items: { type: 'string' } },
        limiti_analisi: { type: 'string' }
      },
      required: ['title', 'executive_summary', 'risultati_per_normativa', 'conclusioni']
    };
  }

  if (type === 'risk_analysis') {
    return {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titolo del documento' },
        section_1_premessa: {
          type: 'object',
          properties: {
            ambito: { type: 'string', description: 'Descrizione organizzazione e perimetro analisi (min 150 parole)' },
            riferimenti_normativi: { type: 'string', description: 'Normative applicabili: GDPR Art. 24, 5(2), 32, etc.' },
            data_analisi: { type: 'string', description: 'Data creazione analisi' },
            versione: { type: 'string', description: 'Versione documento' },
            redattore: { type: 'string', description: 'Nome redattore [DA COMPLETARE]' },
          }
        },
        section_2_metodologia: {
          type: 'object',
          properties: {
            approccio: { type: 'string', description: 'Metodologia adottata (ISO 31000, ENISA, etc.)' },
            scala_impatto: { type: 'string', description: 'Scala impatto 1-4 con descrizione livelli' },
            scala_probabilita: { type: 'string', description: 'Scala probabilità 1-4 con descrizione livelli' },
            matrice_rischio: { type: 'string', description: 'Matrice 4x4 con livelli Basso/Medio/Alto/Altissimo' },
            criteri_impatto: { type: 'string', description: 'Criteri: danno economico, reputazionale, operativo, ai diritti' },
          }
        },
        section_3_inventario_trattamenti: {
          type: 'array',
          description: 'Inventario sintetico dei trattamenti principali',
          items: {
            type: 'object',
            properties: {
              codice: { type: 'string' },
              denominazione: { type: 'string' },
              categorie_dati: { type: 'string' },
              interessati: { type: 'string' },
              base_giuridica: { type: 'string' },
              volume_stimato: { type: 'string' },
            }
          }
        },
        section_4_identificazione_minacce: {
          type: 'array',
          description: 'Minacce identificate, una per ogni gap dell\'assessment',
          items: {
            type: 'object',
            properties: {
              area: { type: 'string', description: 'Area: Governance/Diritti/Sicurezza/Fornitori/Trasferimenti' },
              minaccia: { type: 'string', description: 'Descrizione della minaccia' },
              asset_coinvolti: { type: 'string' },
              vulnerabilita: { type: 'string' },
              fonte_rischio: { type: 'string', description: 'Umana/Tecnica/Organizzativa/Contesto' },
              gap_correlato: { type: 'string', description: 'Riferimento al gap dell\'assessment (es. "Gap Art. 12")' },
            }
          }
        },
        section_5_rischio_inerente: {
          type: 'array',
          description: 'Valutazione rischio inerente per ogni minaccia',
          items: {
            type: 'object',
            properties: {
              minaccia: { type: 'string' },
              impatto: { type: 'number', description: '1-4' },
              probabilita: { type: 'number', description: '1-4' },
              livello_rischio: { type: 'number', description: 'Impatto x Probabilità' },
              classificazione: { type: 'string', description: 'Basso/Medio/Alto/Altissimo' },
            }
          }
        },
        section_6_misure_mitigazione: {
          type: 'array',
          description: 'Misure per ogni minaccia',
          items: {
            type: 'object',
            properties: {
              minaccia: { type: 'string' },
              misure_applicate: { type: 'array', items: { type: 'string' }, description: 'Misure già implementate' },
              misure_da_applicare: { type: 'array', items: { type: 'string' }, description: 'Misure pianificate (dalle azioni dei gap)' },
              tipo: { type: 'string', description: 'Tecnica/Organizzativa/Contrattuale' },
              responsabile: { type: 'string' },
            }
          }
        },
        section_7_rischio_residuo: {
          type: 'array',
          description: 'Rischio residuo dopo le misure',
          items: {
            type: 'object',
            properties: {
              minaccia: { type: 'string' },
              impatto_residuo: { type: 'number' },
              probabilita_residua: { type: 'number' },
              livello_residuo: { type: 'number' },
              classificazione_residua: { type: 'string' },
              motivazione_accettazione: { type: 'string' },
            }
          }
        },
        section_8_piano_trattamento: {
          type: 'array',
          description: 'Piano azioni prioritizzate',
          items: {
            type: 'object',
            properties: {
              azione: { type: 'string' },
              responsabile: { type: 'string' },
              scadenza: { type: 'string' },
              costo_stimato: { type: 'string' },
              priorita: { type: 'number', description: '1=immediata, 2=breve, 3=medio termine' },
              ore_stimate: { type: 'number' },
            }
          }
        },
        section_9_accettazione_rischio: {
          type: 'object',
          properties: {
            dichiarazione: { type: 'string', description: 'Dichiarazione formale del Titolare' },
            rischi_accettati: { type: 'string', description: 'Elenco rischi residui accettati con condizioni' },
            soglie_intervento: { type: 'string', description: 'Soglie oltre le quali è necessario intervenire' },
            firma_titolare: { type: 'string', description: '[DA COMPLETARE]' },
            data_firma: { type: 'string' },
          }
        },
        section_10_monitoraggio: {
          type: 'object',
          properties: {
            frequenza_revisione: { type: 'string' },
            kpi: { type: 'array', items: { type: 'string' }, description: 'KPI di monitoraggio' },
            trigger_revisione: { type: 'array', items: { type: 'string' }, description: 'Trigger per revisione straordinaria' },
            responsabile: { type: 'string' },
            prossima_revisione: { type: 'string' },
          }
        },
      },
      required: ['title', 'section_1_premessa', 'section_4_identificazione_minacce', 'section_5_rischio_inerente']
    };
  }

  // Fallback schema
  return {
    type: 'object',
    properties: {
      title: { type: 'string' },
      content: { type: 'string' }
    },
    required: ['title']
  };
}

// =====================================================================
// FIX #5: Sector-specific RoPA activity mapping
// =====================================================================

function getSectorActivities(sector: string): string {
  const s = (sector || '').toLowerCase();

  if (s.includes('tech') || s.includes('it') || s.includes('software') || s.includes('digital')) {
    return `ATTIVITÀ DI TRATTAMENTO SPECIFICHE PER IL SETTORE TECHNOLOGY/IT:
001 - GESTIONE UTENTI E AUTENTICAZIONE
002 - SVILUPPO SOFTWARE E TESTING
003 - GESTIONE INFRASTRUTTURA CLOUD
004 - ASSISTENZA CLIENTI E TICKETING
005 - MARKETING DIGITALE E ANALYTICS
006 - GESTIONE PERSONALE DIPENDENTI
007 - GESTIONE FORNITORI E SUBPROCESSOR
008 - LOG DI SISTEMA E MONITORAGGIO SICUREZZA
009 - CONTABILITÀ E FATTURAZIONE
010 - GESTIONE COOKIE E TRACCIAMENTO WEB`;
  }

  if (s.includes('health') || s.includes('sanit') || s.includes('medic') || s.includes('hospital') || s.includes('pharma')) {
    return `ATTIVITÀ DI TRATTAMENTO SPECIFICHE PER IL SETTORE SANITARIO:
001 - GESTIONE CARTELLE CLINICHE PAZIENTI
002 - SORVEGLIANZA SANITARIA DIPENDENTI
003 - TELEMEDICINA E CONSULTI A DISTANZA
004 - GESTIONE FARMACIA E PRESCRIZIONI
005 - RICERCA CLINICA E STUDI
006 - GESTIONE PERSONALE SANITARIO
007 - CONTABILITÀ E FATTURAZIONE SANITARIA
008 - VIDEOSORVEGLIANZA STRUTTURA
009 - GESTIONE FORNITORI DISPOSITIVI MEDICI
010 - GESTIONE CONSENSI PAZIENTI`;
  }

  if (s.includes('financ') || s.includes('bank') || s.includes('assicur') || s.includes('insurance') || s.includes('finanz')) {
    return `ATTIVITÀ DI TRATTAMENTO SPECIFICHE PER IL SETTORE FINANZIARIO:
001 - GESTIONE CONTI E RAPPORTI CLIENTI
002 - ANTIRICICLAGGIO E KYC
003 - GESTIONE OPERAZIONI DI CREDITO
004 - SEGNALAZIONI VIGILANZA (Banca d'Italia, CONSOB)
005 - GESTIONE PERSONALE DIPENDENTI
006 - MARKETING E CRM CLIENTI
007 - GESTIONE FORNITORI E OUTSOURCING
008 - VIDEOSORVEGLIANZA FILIALI
009 - CONTABILITÀ E REPORTING
010 - LOG E MONITORAGGIO TRANSAZIONI`;
  }

  if (s.includes('manufactur') || s.includes('industr') || s.includes('produz')) {
    return `ATTIVITÀ DI TRATTAMENTO SPECIFICHE PER IL SETTORE MANIFATTURIERO:
001 - SORVEGLIANZA SANITARIA DIPENDENTI
002 - GESTIONE DEL PERSONALE E BUSTE PAGA
003 - GESTIONE CLIENTI E ORDINI
004 - CONTABILITÀ E FATTURAZIONE
005 - GESTIONE FORNITORI E APPALTI
006 - VIDEOSORVEGLIANZA STABILIMENTO
007 - CONTROLLO ACCESSI E BADGE
008 - GESTIONE QUALITÀ E CERTIFICAZIONI
009 - FORMAZIONE SICUREZZA LAVORO
010 - MARKETING E COMUNICAZIONE`;
  }

  return `ATTIVITÀ DI TRATTAMENTO: Genera 6-10 attività REALISTICHE e SPECIFICHE per il settore "${sector}". NON usare attività generiche non pertinenti al settore.`;
}

// =====================================================================
// FIX #1 + #4: Build gap-to-risk mapping instructions
// =====================================================================

function buildGapRiskMapping(gaps: any[]): string {
  if (!gaps || gaps.length === 0) return '';

  // Cap: con il catalogo completo i gap ad alto rischio possono essere decine
  const criticalHighGaps = gaps.filter((g: any) => g.risk_level === 'critical' || g.risk_level === 'high').slice(0, 20);
  
  let mapping = `\n\n## COLLEGAMENTO GAP → VALUTAZIONE RISCHIO

ISTRUZIONI OBBLIGATORIE: Le minacce e il livello di rischio nella Sezione 7 DEVONO riflettere i gap identificati nell'assessment. Concretamente:

### MAPPATURA PROFILO DI RISCHIO DEL GAP → MATRICE R=f(M,p):
- Gap con profilo ALTO (risk_level 'high' o 'critical'): Impatto=3-4, Probabilità=3 -> Rischio iniziale Alto/Altissimo
- Gap con profilo MEDIO (risk_level 'medium'): Impatto=2-3, Probabilità=2 -> Rischio iniziale Medio
- Gap con profilo BASSO (risk_level 'low'): Impatto=1-2, Probabilità=1 -> Rischio iniziale Basso

### REGOLE RISCHIO RESIDUO:
- Se il gap indica remediation_effort 'low' e ci sono azioni concrete: ridurre Probabilità di 2
- Se il gap indica remediation_effort 'high' o 'very_high': ridurre Probabilità di massimo 1
- Il rischio residuo NON può mai essere 'Basso' se il gap corrispondente ha risk_level 'critical' e non ci sono misure già 'Applicate'
- VINCOLO CRITICO: Se TUTTE le misure di una minaccia sono "Da applicare", il rischio residuo NON può scendere di più di 1 punto sulla scala di probabilità rispetto al rischio iniziale

### REGOLE DI COLLEGAMENTO SPECIFICHE:
`;

  for (const gap of gaps) {
    const ref = (gap.requirement_reference || '').toLowerCase();
    if (ref.includes('art. 32') || ref.includes('art.32') || ref.includes('articolo 32')) {
      mapping += `- Gap su Art. 32 GDPR (sicurezza) trovato: le misure nella sezione 7.1 relative alla sicurezza dei dati devono essere indicate come 'Da applicare'\n`;
    }
    if (ref.includes('art. 33') || ref.includes('art. 34') || ref.includes('art.33') || ref.includes('art.34')) {
      mapping += `- Gap su Art. 33-34 GDPR (breach notification) trovato: INCLUDI una minaccia specifica "Violazione dati senza procedura di notifica" con rischio iniziale Alto\n`;
    }
    if (ref.includes('art. 25') || ref.includes('art.25') || ref.includes('articolo 25')) {
      mapping += `- Gap su Art. 25 GDPR (privacy by design) trovato: i suggerimenti privacy by design devono affrontare SPECIFICAMENTE questo gap\n`;
    }
  }

  if (criticalHighGaps.length > 0) {
    mapping += `\n### GAP CRITICI/ALTI CHE RICHIEDONO MINACCE CORRISPONDENTI:\n`;
    for (const gap of criticalHighGaps) {
      mapping += `- [${gap.risk_level.toUpperCase()}] ${gap.requirement_reference}: "${String(gap.gap_description || '').substring(0, 300)}" -> DEVE esserci una minaccia corrispondente\n`;
      mapping += `  Azioni raccomandate (da usare come "Misure da applicare"): ${formatMitigationActionsForPrompt(gap.recommended_actions)}\n`;
    }
  }

  return mapping;
}

function buildGapRopaMapping(gaps: any[]): string {
  if (!gaps || gaps.length === 0) return '';

  const art30Gaps = gaps.filter((g: any) => {
    const ref = (g.requirement_reference || '').toLowerCase();
    return ref.includes('art. 30') || ref.includes('art.30') || ref.includes('articolo 30');
  });

  if (art30Gaps.length === 0) return '';

  let mapping = `\n\n## COLLEGAMENTO GAP ART. 30 → ATTIVITÀ DI TRATTAMENTO

ATTENZIONE: Sono stati identificati gap specifici sull'Art. 30 GDPR (registro trattamenti). Le attività nel RoPA devono evidenziare i campi carenti:
`;
  for (const gap of art30Gaps) {
    mapping += `- Gap: "${gap.gap_description}"\n  Stato attuale: ${gap.current_state || 'Non documentato'}\n  Azioni: ${formatMitigationActionsForPrompt(gap.recommended_actions)}\n`;
  }

  return mapping;
}

// =====================================================================
// DOCUMENT PROMPTS - Context from assessment data
// =====================================================================

function buildDocumentPrompt(type: string, assessment: any, profile: any, conversation: string, language: string = 'it', mode: string = 'standard', regulatoryContext: string = '', userDocumentsSummary: string = '', userConfig?: any) {
  const riskLabel = (level: string) => {
    const l = String(level || '').toLowerCase();
    return l === 'critical' || l === 'high' ? 'ALTO (rosso)' : l === 'medium' ? 'MEDIO (arancione)' : 'BASSO (giallo)';
  };
  // Con il catalogo completo un assessment multi-normativa produce molti gap:
  // il prompt riporta per intero i più gravi e in forma sintetica i restanti.
  const allGaps: any[] = Array.isArray(assessment.identified_gaps) ? [...assessment.identified_gaps] : [];
  const riskRank: Record<string, number> = { critical: 0, high: 0, medium: 1, low: 2 };
  allGaps.sort((a, b) => (riskRank[String(a.risk_level).toLowerCase()] ?? 3) - (riskRank[String(b.risk_level).toLowerCase()] ?? 3) || (a.priority || 9) - (b.priority || 9));
  const GAPS_IN_FULL = 45;
  const detailedGaps = allGaps.slice(0, GAPS_IN_FULL);
  const remainingGaps = allGaps.slice(GAPS_IN_FULL);
  const gapsSection = (detailedGaps.map((gap: any, i: number) => `
### Gap ${i + 1}: ${gap.requirement_reference}
- Cosa manca: ${gap.gap_description}
- Cosa risulta dai documenti: ${gap.current_state || 'Nessuna documentazione pertinente'}
- Stato documentale: ${gap.coverage_status === 'partial' ? 'documentazione parziale' : 'documentazione assente'}
- Profilo di rischio: ${riskLabel(gap.risk_level)}
- Priorità: ${gap.priority}
- Effort: ${gap.remediation_effort || 'Da valutare'}
${Array.isArray(gap.evidence) && gap.evidence.length > 0 ? `- Evidenze trovate: ${gap.evidence.map((e: any) => `[${e.document}] "${e.quote}"`).join(' | ')}` : ''}
- Azioni Raccomandate: ${formatMitigationActionsForPrompt(gap.recommended_actions)}
`).join('\n') || 'Nessun gap identificato') + (remainingGaps.length > 0 ? `

### Altri ${remainingGaps.length} gap (in forma sintetica, da riportare comunque nel report)
${remainingGaps.map((g: any) => `- ${g.requirement_reference} | rischio ${riskLabel(g.risk_level)} | ${g.coverage_status === 'partial' ? 'parziale' : 'assente'} | manca: ${String(g.gap_description || '').substring(0, 200)} | azione: ${formatMitigationActionsForPrompt(g.recommended_actions).substring(0, 200)}`).join('\n')}` : '');

  const checksPayload = assessment.requirement_checks && typeof assessment.requirement_checks === 'object' ? assessment.requirement_checks : null;
  const allChecks: any[] = Array.isArray(checksPayload?.checks) ? checksPayload.checks : [];
  const coveredChecks = allChecks.filter((c: any) => c.status === 'covered');
  const toVerifyChecks = allChecks.filter((c: any) => c.status === 'to_verify');
  const notApplicableChecks = allChecks.filter((c: any) => c.status === 'not_applicable');
  const checksSection = allChecks.length > 0 ? `

## REQUISITI VERIFICATI (${allChecks.length} totali: ${coveredChecks.length} documentati, ${assessment.identified_gaps?.length || 0} con gap, ${toVerifyChecks.length} da verificare, ${notApplicableChecks.length} non applicabili)
Documenti analizzati: ${(checksPayload?.documents_analyzed || []).join(', ') || 'non indicati'}
${(checksPayload?.unreadable_documents || []).length > 0 ? `Documenti esclusi perché non leggibili: ${checksPayload.unreadable_documents.join(', ')}` : ''}

### Requisiti documentati
${coveredChecks.slice(0, 60).map((c: any) => `- ${c.reference}: ${String(c.assessment || 'documentato').substring(0, 300)}${Array.isArray(c.evidence) && c.evidence.length > 0 ? ` (evidenza: [${c.evidence[0].document}] "${String(c.evidence[0].quote).substring(0, 160)}")` : ''}`).join('\n') || '- nessuno'}${coveredChecks.length > 60 ? `\n- e altri ${coveredChecks.length - 60} requisiti documentati` : ''}

### Requisiti da verificare (obblighi condizionali, applicabilità non chiara dai documenti)
${toVerifyChecks.slice(0, 60).map((c: any) => `- ${c.reference}: ${String(c.assessment || '').substring(0, 240)}`).join('\n') || '- nessuno'}${toVerifyChecks.length > 60 ? `\n- e altri ${toVerifyChecks.length - 60} requisiti da verificare` : ''}

### Requisiti non applicabili
${notApplicableChecks.slice(0, 40).map((c: any) => `- ${c.reference}: ${String(c.assessment || '').substring(0, 200)}`).join('\n') || '- nessuno'}${notApplicableChecks.length > 40 ? `\n- e altri ${notApplicableChecks.length - 40} requisiti non applicabili` : ''}
` : '';

  const userDocsSection = userDocumentsSummary ? `

## DOCUMENTI AZIENDALI CARICATI DALL'UTENTE
I seguenti documenti sono stati forniti dall'organizzazione durante l'assessment. Usa queste informazioni per compilare la DPIA con dati reali dove disponibili:
${userDocumentsSummary}

REGOLA: Se un documento dell'utente contiene informazioni rilevanti (es. una privacy policy, un registro trattamenti, un DPA), citalo nella DPIA e indica che il documento ESISTE ma potrebbe necessitare aggiornamento. NON scrivere "Nessuna documentazione pertinente individuata" se il documento è stato fornito.
` : '';

  const gapDocEvidence = !userDocumentsSummary ? (() => {
    const evidences = (assessment.identified_gaps || [])
      .filter((g: any) => g.current_state && g.current_state !== 'Non documentato' && g.current_state.length > 20)
      .slice(0, 50)
      .map((g: any) => `- ${g.requirement_reference}: ${String(g.current_state).substring(0, 300)}`);
    if (evidences.length === 0) return '';
    return `

## EVIDENZE DOCUMENTALI DALL'ASSESSMENT
Le seguenti informazioni sono state rilevate nei documenti dell'organizzazione durante la gap analysis:
${evidences.join('\n')}

REGOLA: Usa queste evidenze per descrivere lo stato attuale dell'organizzazione. NON scrivere "Nessuna documentazione pertinente individuata" se esistono evidenze sopra.
`;
  })() : '';

  const baseContext = `
## CONTESTO ORGANIZZATIVO
- Giurisdizione: ${assessment.scope_jurisdiction}
- Settore: ${assessment.scope_sector}
- Normative applicabili: ${assessment.scope_regulations?.join(', ') || 'GDPR'}
- Ruolo Compliance: ${profile?.compliance_role || 'DPO'}
- Titolo Assessment: ${assessment.title || 'Valutazione Compliance'}
- Descrizione: ${assessment.description || 'Non specificata'}
- Fatturato Annuo: EUR ${assessment.annual_revenue_eur?.toLocaleString('it-IT') || 'Non specificato'}

${assessment._source === 'chat' ? `## ORIGINE DELLE INFORMAZIONI
Questo documento nasce da una conversazione guidata con l'utente nella chat RegBrain, NON da un assessment formale: non esistono punteggi di conformità né gap censiti.
${assessment.company_size_label ? `- Dimensione dell'organizzazione: ${assessment.company_size_label}` : ''}
${assessment.data_role_label ? `- Ruolo nel trattamento: ${assessment.data_role_label}` : ''}
REGOLE PER QUESTA ORIGINE:
- Le informazioni fornite dall'utente (nella Descrizione sopra e nella conversazione sotto) sono FATTI ACCERTATI: usale per descrivere trattamento, finalità, categorie di dati e di interessati, strumenti, misure già in essere, criticità.
- Le criticità o i dubbi emersi in conversazione vanno trattati come minacce e rischi nella valutazione, con misure "Da applicare".
- Dove un'informazione manca davvero, usa il placeholder [DA COMPLETARE - descrizione del dato richiesto]: non inventare mai dati, non attribuire misure che l'utente non ha dichiarato.
` : `## RISULTATI ASSESSMENT
- Conformità documentale complessiva: ${assessment.overall_compliance_percentage || 0}%
- Profilo di rischio complessivo: ${(assessment.identified_gaps || []).some((g: any) => ['critical', 'high'].includes(String(g.risk_level).toLowerCase())) ? 'ALTO' : (assessment.identified_gaps || []).some((g: any) => String(g.risk_level).toLowerCase() === 'medium') ? 'MEDIO' : (assessment.identified_gaps || []).length > 0 ? 'BASSO' : 'NESSUN RISCHIO RILEVATO'} (rosso = alto, arancione = medio, giallo = basso, verde = documentato)
- Stato: ${assessment.status}
- Data Completamento: ${assessment.completed_at || 'In corso'}

## GAP IDENTIFICATI (${allGaps.length} totali)
${gapsSection}${checksSection}`}
${userDocsSection}${gapDocEvidence}
${conversation ? `## ${assessment._source === 'chat' ? 'CONVERSAZIONE CON L\'UTENTE (fonte primaria)' : 'CONTESTO AGGIUNTIVO'}:\n${conversation}\n` : ''}`;

  const configBlock = userConfig ? `

## DATI DI CONFIGURAZIONE FORNITI DALL'UTENTE
USA QUESTI DATI per popolare il documento. NON usare [DA COMPLETARE] per i campi forniti.

${JSON.stringify(userConfig, null, 2)}

ISTRUZIONI: Usa i dati sopra direttamente nel documento. Se un campo non è fornito, usa [DA COMPLETARE - descrizione campo]. Se nuovi dati emergono dalla gap analysis che integrano questi, mantieni la coerenza tra le sezioni.
` : '';

  const ragSection = regulatoryContext
    ? `\n## TESTO NORMATIVO DI RIFERIMENTO (usa SOLO queste fonti per citazioni e riferimenti normativi):\n${regulatoryContext}\n`
    : '';

  if (type === 'dpia') {
    const gapRiskMapping = buildGapRiskMapping(assessment.identified_gaps || []);

    return `${baseContext}${configBlock}${ragSection}${gapRiskMapping}

## ISTRUZIONI SPECIFICHE PER LA DPIA

Genera una DPIA che segua ESATTAMENTE la struttura del modello professionale italiano a 11 sezioni.

1. Nella SEZIONE 3 (Pre-assessment), rispondi a TUTTE le tipologie di trattamento e ai criteri WP29 con Sì/No basandoti sul settore ${assessment.scope_sector}. COERENZA: ogni criterio marcato "Sì" DEVE avere una minaccia corrispondente nella Sezione 7.
2. Nella SEZIONE 4, descrivi il trattamento in modo ESTESO (150+ parole) basandoti sul contesto del settore. Includi componenti organizzative, tecnologiche (soggetti interni/esterni, software, rete) e fisiche. Per le CATEGORIE DI DATI: elenco TASSATIVO, mai formule vaghe. Per i PERIODI DI CONSERVAZIONE: differenziare per finalità con base normativa.
3. Nella SEZIONE 7, usa la matrice R=f(M,p) con valori NUMERICI concreti (1-4) per OGNI minaccia. I valori DEVONO essere coerenti con i gap identificati (vedi MAPPATURA sopra). Calcola rischio iniziale E residuo. Includi almeno 3 minacce: Accesso illegittimo, Modifiche indesiderate, Perdita dati + eventuali minacce specifiche dai gap. Per ogni misura aggiungi un INDICATORE DI EFFICACIA. Per ogni misura "Da applicare" genera il PIANO D'AZIONE CORRETTIVO con ID MIT-NNN, responsabile (ruolo), scadenza e effort.
4. Per le misure di sicurezza, indica SEMPRE lo stato: Applicata / Da applicare. Le azioni raccomandate dei gap devono comparire come "Misure da applicare"
5. Nella SEZIONE 8, se le opinioni degli interessati NON sono state raccolte, dettaglia il PERCHÉ e il PIANO per raccoglierle (metodo, data, responsabile)
6. Nella SEZIONE 10, segui la LOGICA OBBLIGATORIA basata sul rischio complessivo residuo: Basso/Medio=Proseguire, Alto=Con riserva+rivalutazione 6 mesi, Altissimo=Art.36 obbligatoria
7. Nella SEZIONE 11, definisci il piano di revisione con frequenza, trigger e responsabile
8. Includi la CHECKLIST GDPR finale con stato di conformità per ogni elemento. Per "Da verificare": aggiungere data e responsabile. Includere anche: Consultazione interessati pianificata, Piano d'azione approvato dal management, Budget stanziato.
9. Aggiungi SUGGERIMENTI PRIVACY BY DESIGN specifici per il settore ${assessment.scope_sector}
10. Compila la sezione FIRMA FINALE con '[DA COMPLETARE]' per i nomi, incluso "Approvato dal Management"
11. COLLEGAMENTO GAP -> BASI GIURIDICHE: Per la Sezione 4 (Basi giuridiche), non limitarti a elencare gli articoli. Per ogni base giuridica invocata:
   - Se esiste un gap correlato nell'assessment (es. gap su Art. 6 liceità), indicalo esplicitamente
   - Se un gap indica mancanza di procedure per l'esercizio dei diritti (Art. 12-22), collega questa carenza alla trasparenza delle basi giuridiche
   - Per ogni base giuridica, indica se è supportata o meno dalla documentazione disponibile
12. COERENZA INTERNA: ogni Gap citato deve avere una misura correttiva MIT-NNN collegata. Usare formato uniforme "Gap N - Art. XX"

Il documento deve essere pronto per presentazione all'Autorità Garante e difendibile in sede ispettiva.
Scrivi INTERAMENTE in italiano professionale. Linguaggio giuridico formale.

IMPORTANTE: Usa SEMPRE la funzione generate_compliance_document per restituire il documento completo.`;
  }

  if (type === 'ropa') {
    const sectorActivities = getSectorActivities(assessment.scope_sector);
    const gapRopaMapping = buildGapRopaMapping(assessment.identified_gaps || []);

    return `${baseContext}${configBlock}${ragSection}${gapRopaMapping}

## ISTRUZIONI SPECIFICHE PER IL RoPA

Genera un Registro delle Attività di Trattamento che segua ESATTAMENTE la struttura del modello professionale italiano.

1. Genera ALMENO 6-10 attività di trattamento SPECIFICHE per il settore "${assessment.scope_sector}":
   ${sectorActivities}

2. Per OGNI attività compila TUTTI i campi:
   - Codice progressivo (001, 002...)
   - Denominazione IN MAIUSCOLO
   - Descrizione sintetica (1-2 frasi)
   - Descrizione estesa DETTAGLIATA (80+ parole)
   - Titolare con contatti (usa '[DA COMPLETARE]' per dati non disponibili)
   - Responsabile Art. 28 con contatti
   - DPO con nome, indirizzo, telefono, cellulare, PEC, email
   - Categorie dati SPECIFICHE (almeno 3: Nominativo, CF, Contatti, Coordinate bancarie, ecc.)
   - Tempi conservazione con data inizio e durata
   - Funzioni (unità organizzativa)
   - Misure sicurezza (lista)
   - Info aggiuntive (minori Sì/No, raccolti presso interessato Sì/No, profilazione Sì/No)
   - Condizioni liceità (art. GDPR specifico, deve iniziare con "Art.")

3. Aggiungi SUGGERIMENTI PRIVACY BY DESIGN specifici per il settore ${assessment.scope_sector}
4. Includi LOG REVISIONE documento con almeno la versione corrente
5. Compila la sezione FIRMA FINALE con '[DA COMPLETARE]' per i nomi

Il documento deve essere pronto per esibizione all'Autorità Garante in caso di ispezione.
Scrivi INTERAMENTE in italiano professionale.

IMPORTANTE: Usa SEMPRE la funzione generate_compliance_document per restituire il documento completo.`;
  }

  if (type === 'lia') {
    return `${baseContext}${configBlock}${ragSection}

## ISTRUZIONI SPECIFICHE PER IL LIA

Genera un Legitimate Interest Assessment basato sul contesto dell'organizzazione nel settore "${assessment.scope_sector}".

Per il PURPOSE TEST: identifica l'interesse legittimo più probabile per un'organizzazione in questo settore (es. marketing diretto, prevenzione frodi, sicurezza informatica, monitoraggio dipendenti)

Per il NECESSITY TEST: valuta le alternative meno intrusive disponibili nel settore

Per il BALANCING TEST: considera i diritti specifici degli interessati tipici del settore

Usa i gap identificati per capire quali trattamenti basati su legittimo interesse potrebbero essere problematici

NON inventare dati aziendali — usa [DA COMPLETARE] per ragione sociale, P.IVA, etc.

IMPORTANTE: Usa SEMPRE la funzione generate_compliance_document per restituire il documento completo.`;
  }

  if (type === 'gap_report') {
    return `${baseContext}${configBlock}${ragSection}

## ISTRUZIONI SPECIFICHE PER IL GAP REPORT

Genera un report esecutivo di gap analysis basato ESCLUSIVAMENTE sui dati dell'assessment sopra.

L'executive summary deve sintetizzare: conformità documentale ${assessment.overall_compliance_percentage}%, ${assessment.identified_gaps?.length || 0} gap identificati con la ripartizione per profilo di rischio (alto/medio/basso), requisiti documentati e requisiti da verificare.

Per ogni gap in "risultati_per_normativa" riporta esattamente: riferimento, cosa risulta dai documenti, cosa manca, stato documentale (assente o parziale), profilo di rischio (alto = rosso, medio = arancione, basso = giallo), evidenze citate con il nome del documento, azioni raccomandate.

Compila "requisiti_documentati" con i requisiti documentati dell'assessment e "requisiti_da_verificare" con quelli da verificare: non inventarne.

Il piano di remediation deve raggruppare le azioni per urgenza in base al profilo di rischio dei gap. Nessuna stima di sanzioni, ore o costi.

NON inventare gap o dati: usa SOLO quelli presenti nelle sezioni "GAP IDENTIFICATI" e "REQUISITI VERIFICATI" sopra.

IMPORTANTE: Usa SEMPRE la funzione generate_compliance_document per restituire il documento completo.`;
  }

  if (type === 'risk_analysis') {
    return `${baseContext}${configBlock}${ragSection}

## ISTRUZIONI SPECIFICHE PER L'ANALISI DEI RISCHI EX ART. 24

Questo documento NON è una DPIA. È un'analisi COMPLESSIVA delle misure dell'organizzazione.

1. Nella SEZIONE 1, descrivi l'organizzazione basandoti sul settore "${assessment.scope_sector}" e sulla giurisdizione "${assessment.scope_jurisdiction}"
2. Nella SEZIONE 3, genera un inventario di 6-10 trattamenti realistici per il settore
3. Nella SEZIONE 4, ogni minaccia DEVE corrispondere a un gap reale dell'assessment sopra
4. Nella SEZIONE 5, usa il risk_level dei gap per i valori della matrice: critical→Impatto 4, Probabilità 4; high→Impatto 3, Probabilità 3
5. Nella SEZIONE 6, le misure "Da applicare" devono essere le azioni raccomandate dei gap
6. Nella SEZIONE 7, il rischio residuo deve essere coerente: gap critical con misure "Da applicare" → rischio residuo resta Alto o Altissimo
7. Nella SEZIONE 8, derivare direttamente le azioni dal piano d'azione dell'assessment, senza stime di ore o costi
8. NON inventare nomi di persone o aziende — usa [DA COMPLETARE]

COLLEGAMENTO GAP → RISCHI (FONDAMENTALE):
Per ogni gap identificato nell'assessment, DEVE esserci:
- Una minaccia corrispondente nella Sezione 4
- Una riga nella matrice di rischio inerente (Sezione 5)
- Misure di mitigazione specifiche (Sezione 6)
- Un'azione nel piano di trattamento (Sezione 8)

Il documento deve essere pronto per presentazione al Garante in caso di ispezione.
Scrivi INTERAMENTE in italiano professionale.

IMPORTANTE: Usa SEMPRE la funzione generate_compliance_document per restituire il documento completo.`;
  }

  return `${baseContext}

Genera un documento di conformità completo e professionale basato sui dati dell'assessment sopra riportati.
Scrivi TUTTO in italiano professionale.

IMPORTANTE: Usa SEMPRE la funzione generate_compliance_document per restituire il documento completo.`;
}
