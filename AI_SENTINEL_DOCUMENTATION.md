# AI Sentinel - Documentazione Progetto

## Panoramica

**AI Sentinel** è un modulo enterprise di sicurezza per modelli di intelligenza artificiale, progettato per rilevare vulnerabilità, backdoor, data poisoning e verificare la conformità alle normative europee (AI Act e Cyber Resilience Act).

## Caratteristiche Principali

### 1. **Model Integrity Scanner**
Sistema di scansione automatica che analizza i modelli AI per rilevare:
- **Backdoor**: Porte di accesso nascoste intenzionalmente inserite nei modelli
- **Data Poisoning**: Manipolazione dei dati di training per compromettere le prestazioni
- **Anomalie strutturali**: Modifiche sospette all'architettura del modello
- **Weight anomalies**: Valori anomali nei pesi del modello che potrebbero indicare manomissioni

### 2. **Trust Score & Risk Assessment**
Ogni modello riceve:
- **Trust Score**: Punteggio di affidabilità da 0 a 100%
  - 85-100%: Trust elevato (verde)
  - 70-84%: Trust medio (giallo)
  - 50-69%: Trust basso (arancione)
  - 0-49%: Trust critico (rosso)

- **Risk Level**: Classificazione del rischio
  - Low: Nessun rischio significativo rilevato
  - Medium: Rischi minori da monitorare
  - High: Rischi importanti che richiedono azione
  - Critical: Rischi critici che richiedono intervento immediato

### 3. **Compliance Check**
Verifica automatica della conformità a:
- **EU AI Act**: Classificazione del rischio, trasparenza, obblighi documentali
- **Cyber Resilience Act**: Sicurezza dei prodotti digitali, vulnerabilità, patching
- **GDPR**: Privacy by design, data minimization (quando applicabile)
- **NIS2**: Gestione rischi ICT (per modelli in infrastrutture critiche)

### 4. **Supply Chain & Provenance Tracking**
Tracciamento completo della catena di provenienza:
- Organizzazione sorgente del modello
- URL di origine (es. HuggingFace, GitHub)
- Versione del modello
- Stato di verifica della provenienza
- Hash crittografico SHA-256 per garantire l'integrità

### 5. **Continuous Monitoring**
Sistema di monitoraggio continuo che permette di:
- Pianificare scansioni periodiche automatiche
- Ricevere alert in caso di anomalie
- Tracciare l'evoluzione del Trust Score nel tempo
- Monitorare modifiche e aggiornamenti ai modelli

## Architettura Tecnica

### Database Schema

#### Tabella: `ai_models`
```sql
- id: UUID (PK)
- user_id: UUID (FK -> auth.users)
- name: TEXT (nome del modello)
- model_type: TEXT (pytorch, tensorflow, onnx, etc.)
- file_size: BIGINT (dimensione in bytes)
- file_hash: TEXT (SHA-256 hash)
- status: TEXT (pending, scanning, completed, error)
- metadata: JSONB (informazioni aggiuntive)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### Tabella: `model_scans`
```sql
- id: UUID (PK)
- model_id: UUID (FK -> ai_models)
- scan_type: TEXT (integrity, anomaly, compliance)
- scan_date: TIMESTAMP
- trust_score: INTEGER (0-100)
- risk_level: TEXT (low, medium, high, critical)
- findings: JSONB (array di vulnerabilità rilevate)
- recommendations: JSONB (array di raccomandazioni)
- scan_duration_ms: INTEGER
- metadata: JSONB
```

#### Tabella: `model_provenance`
```sql
- id: UUID (PK)
- model_id: UUID (FK -> ai_models)
- source_url: TEXT
- source_organization: TEXT
- version: TEXT
- verification_status: TEXT (verified, unverified, suspicious)
- verification_date: TIMESTAMP
- metadata: JSONB
```

#### Tabella: `sentinel_monitoring`
```sql
- id: UUID (PK)
- model_id: UUID (FK -> ai_models)
- active: BOOLEAN
- frequency: TEXT (daily, weekly, monthly)
- last_check: TIMESTAMP
- next_check: TIMESTAMP
- alert_threshold: INTEGER
- notification_settings: JSONB
```

### Edge Functions

#### `analyze-ai-model`
**Percorso**: `supabase/functions/analyze-ai-model/index.ts`

**Funzionalità**:
- Esegue scansioni di sicurezza sui modelli AI
- Supporta tre tipi di scansione:
  - `integrity`: Verifica hash, tampering, anomalie strutturali
  - `anomaly`: Backdoor detection, data poisoning, weight anomalies
  - `compliance`: Conformità AI Act, CRA, GDPR, NIS2

**Input**:
```typescript
{
  modelId: string,
  scanType: 'integrity' | 'anomaly' | 'compliance'
}
```

**Output**:
```typescript
{
  trustScore: number,
  riskLevel: 'low' | 'medium' | 'high' | 'critical',
  findings: Array<{
    title: string,
    severity: string,
    description: string,
    evidence?: string,
    regulation?: string
  }>,
  recommendations: Array<{
    action: string,
    description?: string,
    priority?: string
  }>
}
```

**Logica di Analisi**:
1. **Integrity Scan**:
   - Verifica hash SHA-256 del file
   - Controlla anomalie strutturali
   - Valida formato del modello
   - Trust Score base: 90%

2. **Anomaly Detection**:
   - Simula analisi statistica dei pesi
   - Rileva pattern sospetti nei layers
   - Identifica possibili backdoor
   - Trust Score base: 75%

3. **Compliance Check**:
   - Verifica requisiti AI Act
   - Controlla obblighi CRA
   - Valuta documentazione tecnica
   - Trust Score base: 85%

## Componenti Frontend

### 1. **AISentinel.tsx** - Dashboard principale
**Percorso**: `src/pages/AISentinel.tsx`

Funzionalità:
- Visualizzazione statistiche aggregate (modelli totali, rischi critici, trust score medio)
- Lista modelli AI registrati
- Tabs per accesso a Scan, Monitoring, Reports
- Istruzioni d'uso integrate

### 2. **AISentinelUpload.tsx** - Caricamento modelli
**Percorso**: `src/pages/AISentinelUpload.tsx`

Funzionalità:
- Form di upload modelli AI
- Supporto formati: PyTorch (.pt, .pth), ONNX (.onnx), TensorFlow (.pb, .h5), SafeTensors, Scikit-learn (.pkl, .joblib)
- Calcolo hash SHA-256 lato client
- Inserimento metadati provenance opzionali
- Auto-detect tipo modello da estensione file

### 3. **AISentinelModel.tsx** - Dettaglio modello
**Percorso**: `src/pages/AISentinelModel.tsx`

Funzionalità:
- Visualizzazione dettagli modello
- Avvio scansioni di sicurezza
- Storico scansioni con dettagli findings
- Tab Provenance per supply chain tracking
- Tab Compliance per verifica normative
- Esportazione report (funzionalità futura)

## Flusso Utente

### 1. Registrazione Modello
```
Utente -> Upload modello -> Calcolo hash SHA-256 -> 
Inserimento in database -> Registrazione provenance ->
Redirect a pagina dettaglio modello
```

### 2. Scansione Sicurezza
```
Utente -> Seleziona tipo scan -> Avvia scansione ->
Edge function analizza modello -> Calcola Trust Score ->
Genera findings & raccomandazioni -> Salva in database ->
Mostra risultati all'utente
```

### 3. Monitoraggio Continuo
```
Utente -> Abilita monitoring -> Configura frequenza ->
Scheduler automatico avvia scan periodici ->
Alert inviati se Trust Score scende sotto soglia ->
Report aggregati generati automaticamente
```

## Casi d'Uso

### 1. **Vendor Risk Assessment**
Prima di integrare un modello AI di terze parti:
1. Carica il modello in AI Sentinel
2. Esegui Integrity Scan per verificare hash e tampering
3. Esegui Anomaly Detection per backdoor
4. Verifica Compliance Check per normative EU
5. Abilita Continuous Monitoring per controlli periodici

### 2. **Internal Model Governance**
Per modelli sviluppati internamente:
1. Registra modelli durante il training
2. Traccia versioni e modifiche via provenance
3. Esegui scansioni regolari pre-deployment
4. Mantieni audit trail completo per conformità
5. Genera report per auditor esterni

### 3. **Supply Chain Security**
Per garantire la sicurezza della supply chain AI:
1. Verifica provenienza da fonti affidabili (HuggingFace verified, etc.)
2. Controlla hash SHA-256 contro repository ufficiali
3. Monitora eventuali manomissioni post-download
4. Traccia aggiornamenti e patch di sicurezza
5. Documenta per conformità CRA

## Conformità Normativa

### EU AI Act
- **Art. 9**: Requisiti di trasparenza e tracciabilità
- **Art. 10**: Data governance e documentazione training
- **Art. 15**: Accuratezza, robustezza e cybersecurity
- **Allegato IV**: Documentazione tecnica richiesta

AI Sentinel supporta:
- ✅ Documentazione automatica dei modelli
- ✅ Tracciabilità completa (provenance tracking)
- ✅ Valutazione rischi automatizzata
- ✅ Audit trail di tutte le modifiche

### Cyber Resilience Act
- **Art. 10**: Cybersecurity by design
- **Art. 11**: Vulnerability handling
- **Art. 14**: Reporting di vulnerabilità
- **Allegato I**: Essential cybersecurity requirements

AI Sentinel supporta:
- ✅ Security scanning automatico
- ✅ Vulnerability detection
- ✅ Report dettagliati di sicurezza
- ✅ Continuous monitoring

## Metriche di Successo

### Trust Score Calculation
```
Trust Score = Base Score - Σ(Finding Severity Penalties)

Base Scores:
- Integrity Scan: 90%
- Anomaly Detection: 75%
- Compliance Check: 85%

Penalties:
- Critical finding: -25%
- High finding: -15%
- Medium finding: -10%
- Low finding: -5%

Minimum Trust Score: 0%
```

### Risk Level Thresholds
```
Trust Score >= 85% → Low Risk
Trust Score 70-84% → Medium Risk
Trust Score 50-69% → High Risk
Trust Score < 50% → Critical Risk
```

## Roadmap Futura

### Versione 1.1 (Q2 2025)
- [ ] Monitoring automatico con scheduler
- [ ] Alert via email/webhook
- [ ] Export report PDF/JSON
- [ ] Integrazione con model registry esterni

### Versione 2.0 (Q3 2025)
- [ ] Analisi dataset training (data poisoning detection)
- [ ] Model explainability integration
- [ ] Adversarial attack simulation
- [ ] Multi-framework support esteso

### Versione 3.0 (Q4 2025)
- [ ] AI Act full compliance automation
- [ ] Integration con security orchestration (SOAR)
- [ ] Blockchain-based provenance
- [ ] Federated learning security

## Limitazioni Attuali

1. **File Processing**: Solo metadati e hash, non analisi dei pesi effettiva
2. **Anomaly Detection**: Simulata, non basata su ML reale
3. **Scalabilità**: Ottimizzato per modelli < 5GB
4. **Storage**: Hash e metadati only, non storage completo modelli
5. **Monitoring**: Schedulazione manuale, non automatica

## Note di Sicurezza

- ⚠️ I modelli non vengono caricati su storage esterno
- ⚠️ Solo hash SHA-256 e metadati vengono salvati
- ⚠️ Nessuna telemetria dei pesi del modello
- ⚠️ Tutte le scansioni avvengono in ambiente isolato
- ⚠️ Conformità GDPR per dati di training sensibili

## Requisiti Tecnici

### Backend
- Supabase (PostgreSQL 15+)
- Edge Functions (Deno runtime)
- Storage per eventuali report generati

### Frontend
- React 18+
- TypeScript 5+
- Shadcn UI components
- Crypto API (per hash SHA-256)

### Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

## Contatti e Supporto

Per domande tecniche o richieste di integrazione:
- Email: support@regbrain.ai
- Documentazione: https://docs.regbrain.ai/ai-sentinel
- GitHub: https://github.com/regbrain/ai-sentinel

---

**Ultimo aggiornamento**: 2025-01-09
**Versione documentazione**: 1.0
**Autore**: RegBrain Development Team
