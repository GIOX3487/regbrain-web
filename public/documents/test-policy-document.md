# Policy Aziendale di Sicurezza e Privacy - TechCorp S.r.l.

**Versione:** 1.0  
**Data:** Gennaio 2025  
**Settore:** Tecnologia e Servizi IT  
**Giurisdizione:** Italia / Unione Europea

## 1. INTRODUZIONE E SCOPE

TechCorp S.r.l. è un'azienda che fornisce servizi di cloud computing e sviluppo software per clienti B2B in tutta Europa. L'azienda gestisce dati personali di circa 50.000 utenti finali e opera con un'infrastruttura cloud ibrida.

### 1.1 Obiettivi del Documento
Questo documento definisce le policy di sicurezza informatica e protezione dati dell'azienda in conformità con:
- Regolamento GDPR (UE) 2016/679
- Direttiva NIS2 (UE) 2022/2555
- Regolamento AI Act (UE) 2024/1689
- Cyber Resilience Act

### 1.2 Ambito di Applicazione
Le policy si applicano a:
- Tutti i dipendenti (120 persone)
- Fornitori e partner
- Sistemi IT e infrastruttura
- Processi di trattamento dati

## 2. GESTIONE DATI PERSONALI (GDPR)

### 2.1 Base Giuridica
Il trattamento dei dati si basa su:
- Consenso esplicito per marketing
- Esecuzione contrattuale per servizi
- Legittimo interesse per analytics

### 2.2 Dati Trattati
- Dati identificativi (nome, cognome, email)
- Dati di navigazione e utilizzo servizi
- Dati di pagamento (tramite gateway esterno)
- Log di accesso ai sistemi

### 2.3 Misure di Sicurezza Implementate
**Implementato:**
- Cifratura dati in transito (TLS 1.3)
- Password policy: minimo 8 caratteri
- Backup giornalieri
- Firewall perimetrale

**Non implementato:**
- Cifratura dati at-rest
- Autenticazione a due fattori (2FA)
- Pseudonimizzazione dei dati
- Data Loss Prevention (DLP)
- Privacy Impact Assessment (DPIA)

### 2.4 Diritti degli Interessati
Processo per:
- Diritto di accesso: risposta entro 45 giorni
- Diritto di cancellazione: procedura manuale
- Diritto di portabilità: formato CSV
- Diritto di opposizione: valutazione caso per caso

**CARENZA:** Non è definito un processo automatizzato per la gestione delle richieste.

### 2.5 Data Protection Officer (DPO)
- **Status:** NON NOMINATO
- **Registro trattamenti:** Parzialmente compilato
- **Valutazioni impatto:** Mai effettuate

## 3. SICUREZZA DELLE RETI E DEI SISTEMI (NIS2)

### 3.1 Classificazione Entità
TechCorp rientra nella categoria "Essenziale" per i servizi cloud forniti.

### 3.2 Incident Response
**Piano di risposta incidenti:**
- Procedura documentata: NO
- Team di risposta: 2 persone IT
- Tempi di notifica ACN: Non definiti
- Esercitazioni: Mai effettuate

**CARENZA CRITICA:** Mancanza di un piano formale di incident response conforme a NIS2.

### 3.3 Gestione Rischi
- Risk assessment: Effettuato nel 2023 (non aggiornato)
- Business Continuity Plan: In bozza
- Disaster Recovery: RPO 24h, RTO 48h
- Test DR: Mai effettuati

### 3.4 Supply Chain Security
- Fornitori critici: 8 identificati
- Due diligence: Solo per fornitori >50k€
- Contratti con SLA: 60% dei fornitori
- Audit fornitori: Mai effettuati

**CARENZA:** Mancanza di valutazione sistematica della supply chain.

### 3.5 Notifiche ACN
- Procedura notifica incidenti: NON DEFINITA
- Contatto ACN: NON REGISTRATO
- Registro incidenti: Informale (email)

## 4. INTELLIGENZA ARTIFICIALE (AI ACT)

### 4.1 Sistemi AI Utilizzati
L'azienda utilizza:
- Chatbot per customer service (rischio limitato)
- Sistema di raccomandazione prodotti (rischio minimo)
- Analytics predittivi per churn (rischio limitato)

### 4.2 Classificazione Rischio
- **Alto rischio:** Nessun sistema
- **Rischio limitato:** 2 sistemi
- **Rischio minimo:** 1 sistema

### 4.3 Documentazione Tecnica
**Per sistemi a rischio limitato:**
- Documentazione tecnica: Parziale
- Dataset utilizzati: Non documentati
- Metriche performance: Monitorate informalmente
- Bias assessment: Mai effettuato

**CARENZA:** Mancanza di documentazione completa per conformità AI Act.

### 4.4 Human Oversight
- Supervisione umana: Presente per chatbot
- Procedure di escalation: Definite informalmente
- Training del personale: Non effettuato

### 4.5 Trasparenza
- Informativa agli utenti sull'uso AI: Presente nel footer
- Spiegazione delle decisioni: Non implementata
- Diritto di contestazione: Non definito

## 5. CYBER RESILIENCE ACT (CRA)

### 5.1 Prodotti Software
L'azienda sviluppa e distribuisce:
- SaaS platform per gestione progetti
- API per integrazione terze parti
- Mobile app iOS/Android

### 5.2 Sicurezza by Design
**Pratiche implementate:**
- Code review: Solo per modifiche critiche
- Testing sicurezza: Manuale, non sistematico
- Dependency scanning: Mai effettuato
- SBOM (Software Bill of Materials): Non generato

**CARENZE:**
- Mancanza di processo sistematico per sicurezza by design
- Nessun processo per vulnerability disclosure
- Aggiornamenti sicurezza: Non pianificati

### 5.3 Vulnerabilità
- Processo gestione vulnerabilità: Informale
- Tempo medio patch critica: Non tracciato
- Notifica clienti: Non definita
- CVE tracking: Non implementato

### 5.4 Supporto e Aggiornamenti
- Periodo supporto prodotti: 2 anni
- Aggiornamenti sicurezza: Best effort
- End-of-life policy: Non definita

## 6. FORMAZIONE E AWARENESS

### 6.1 Programma Formativo
- Formazione sicurezza generale: Annuale (2 ore)
- Formazione GDPR: Solo per HR
- Formazione NIS2: Mai effettuata
- Phishing simulation: Mai effettuata

**CARENZA:** Programma formativo insufficiente.

### 6.2 Awareness
- Policy di sicurezza: Comunicate via email
- Campagne awareness: Nessuna
- Testing conoscenza: Mai effettuato

## 7. CONTROLLI TECNICI

### 7.1 Accessi e Identità
- IAM centralizzato: NO
- MFA obbligatoria: NO
- Password manager aziendale: NO
- Revisione accessi: Annuale

### 7.2 Network Security
- Segmentazione rete: Parziale
- IDS/IPS: NON implementato
- SIEM: NON implementato
- Log retention: 30 giorni

### 7.3 Endpoint Security
- Antivirus: Presente (Windows Defender)
- EDR: NON implementato
- Disk encryption: Solo per laptop dirigenti
- Patch management: Manuale

### 7.4 Cloud Security
- Cloud provider: AWS
- Configurazione sicura: Parziale
- Cloud Security Posture Management: NO
- Backup cloud: Sì (retention 7 giorni)

## 8. AUDIT E COMPLIANCE

### 8.1 Audit Interni
- Frequenza: Mai effettuati
- Scope: N/A
- Findings tracking: N/A

### 8.2 Audit Esterni
- Ultimo audit: Mai effettuato
- Certificazioni: Nessuna
- Penetration test: Mai effettuato

### 8.3 Documentazione Compliance
- Registro trattamenti: Incompleto (40%)
- Procedure operative: Parziali
- Policy sicurezza: Questo documento
- Contratti DPA: Presenti per fornitori principali

## 9. GOVERNANCE

### 9.1 Struttura Organizzativa
- CISO: NON NOMINATO
- DPO: NON NOMINATO
- Security team: 2 persone part-time
- Budget sicurezza: 3% IT budget

### 9.2 Comitato Sicurezza
- Frequenza riunioni: Mai istituito
- Partecipanti: N/A
- Reporting al board: Mai effettuato

## 10. GAP IDENTIFICATI - RIEPILOGO

### CRITICITÀ ALTE (Rischio elevato)
1. Mancanza DPO nominato (GDPR)
2. Nessun piano incident response formale (NIS2)
3. Assenza notifica ACN e procedura per incidenti significativi (NIS2)
4. Nessun DPIA mai effettuata per trattamenti ad alto rischio (GDPR)
5. Mancanza 2FA per accessi privilegiati (NIS2/CRA)
6. Nessun EDR o SIEM implementato (NIS2)

### CRITICITÀ MEDIE (Rischio medio)
7. Cifratura at-rest non implementata (GDPR/NIS2)
8. Supply chain security non valutata sistematicamente (NIS2)
9. Documentazione AI incompleta (AI Act)
10. Vulnerability management informale (CRA)
11. Backup retention limitata (NIS2)
12. Formazione insufficiente (Tutte le normative)

### CRITICITÀ BASSE (Rischio basso)
13. Audit interni mai effettuati
14. Penetration test mai condotto
15. SBOM non generato per prodotti software (CRA)
16. Policy end-of-life prodotti non definita (CRA)

## 11. CONTATTI E RESPONSABILITÀ

**IT Manager:** mario.rossi@techcorp.it  
**HR Manager:** giulia.bianchi@techcorp.it  
**CEO:** luca.verdi@techcorp.it

**Prossima revisione policy:** Giugno 2025

---

*Questo documento è classificato come INTERNO e contiene informazioni sensibili sulla postura di sicurezza aziendale.*
