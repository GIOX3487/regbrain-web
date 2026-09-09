import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, FileText, Shield } from "lucide-react";
import { Progress } from "@/components/ui/progress";

// ISO 27001 Templates content extracted from uploaded documents
const iso27001Templates = [
  { title: "Analisi del Contesto ISO 27001", code: "Mod. 4.1", content: `Analisi del Contesto - Rif. UNI CEI ISO/IEC 27001:2022

1. LA SOCIETÀ
L'azienda deve condurre un'analisi del contesto che tiene in considerazione sia i fattori interni che quelli esterni all'organizzazione.

2. FATTORI ESTERNI / PASSIVI
2.1. Requisiti legali: Regolamento UE n. 679/2016 (GDPR), D. Lgs. 81/08, D. Lgs. 152/06
2.2. Concorrenza: Valutazione rischi di divulgazione informazioni
2.3. Dati: Classificazione e protezione
2.4. Accessi: Controllo accessi non autorizzati
2.5. Pressioni economiche

3. FATTORI INTERNI / ATTIVI
3.1. Sistemi Informatici: Valutazione obsolescenza
3.2. Processi: Mappatura processi critici
3.3. Risorse umane: Gestione turnover e competenze
3.4. Governance: Definizione ruoli e responsabilità
3.5. Contratti: Gestione contrattuale sicurezza
3.6. Linee guida: Standard e policy adottate
3.7. Asset: Inventario e classificazione

4. PARTI INTERESSATE
Identificazione e analisi delle esigenze delle parti interessate rilevanti per il SGSI.` },

  { title: "Politica per la Sicurezza delle Informazioni", code: "Mod. 5.2", content: `Politica per la Sicurezza delle Informazioni - ISO 27001

La Direzione dell'organizzazione ha ufficializzato il suo impegno a garantire la sicurezza dei dati e delle informazioni gestite.

OBIETTIVI E PRINCIPI GUIDA:
- Il miglioramento continuo del sistema di gestione per la sicurezza dei dati e delle informazioni
- La valutazione dei rischi relativi alla gestione dei dati con particolare attenzione a: riservatezza, integrità, disponibilità
- L'applicazione sistematica dei requisiti di Legge cogenti e ogni altro requisito/norma/regolamento
- L'impegno alla prevenzione di eventi negativi (sottrazione, perdita, violazione del dato)
- L'indagine delle anomalie e la rimozione delle cause
- Il consolidamento dei rapporti con tutte le parti interessate
- La formazione continua del personale sui rischi della sicurezza delle informazioni

CAPISALDI DELLA POLITICA:
- Sistema di gestione dinamico e adeguato alle necessità
- Risorse umane motivate, formate, aggiornate e dinamiche
- Collaborazione con fornitori qualificati
- Ambienti di lavoro e infrastrutture adeguate
- Riguardo ambientale ed etica professionale

La Direzione è impegnata ad attuare, sostenere e verificare periodicamente questa Politica.` },

  { title: "Gestione Accessi - Access Control", code: "Mod. 5.2b", content: `Gestione Accessi - ISO/IEC 27001 A.9

1. SCOPO E AMBITO
Garantire che l'accesso logico e fisico ai sistemi di informazione sia controllato e le procedure garantiscano la protezione dei sistemi informativi.

2. CONTROLLO DEGLI ACCESSI LOGICI
2.1. Sicurezza Logica: Protezione informazioni e sistemi con misure tecnologiche ed organizzative
2.2. Gestione Accesso Utenti:
   - Gestione accessi alla Rete
   - Gestione accessi alle Applicazioni  
   - Gestione utenze amministrative
   - Gestione accessi da Remoto
   - Gestione accessi WiFi Aziendale

3. MACRO PROCESSO GESTIONE CREDENZIALI
- Anagrafica utenti autorizzati
- Richiesta nuova utenza
- Generazione e consegna credenziali
- Gestione chiavi di accesso
- Revisione profili autorizzazione
- Revoca credenziali

4. GESTIONE PASSWORD
Policy password: lunghezza minima, complessità, scadenza, storico

5. CONTROLLO ACCESSO FISICO
- Accesso personale interno
- Accesso personale esterno
- Classificazione ambienti (non classificati, interni, riservati)

6. VIOLAZIONI
Procedure per gestione violazioni policy accessi.` },

  { title: "Mansionario Sicurezza Informazioni", code: "Mod. 5.3a", content: `Mansionario - Ruoli e Responsabilità ISO 27001

DIREZIONE:
- Approva politiche e obiettivi aziendali
- Effettua il riesame della Direzione
- Approva il piano delle verifiche ispettive
- Approva la qualificazione del personale
- Approva la documentazione del SGSI

AMMINISTRAZIONE:
- Gestisce rapporti esterni amministrativi
- Coordina contabilità generale

RSG (Responsabile Sistema Gestione):
- Gestisce ed aggiorna il Manuale e documentazione
- Gestisce procedure e documentazione di supporto
- Controlla la documentazione del Sistema
- Gestisce Non Conformità e Azioni Correttive
- Coordina certificazione ISMS
- Pianifica formazione e addestramento
- Gestisce Audit Interni

RSPP:
- Consulenza valutazione rischi
- Designazione addetti prevenzione
- Misure di prevenzione e protezione

RLS:
- Ricezione informazioni rischi
- Promozione misure prevenzione` },

  { title: "Valutazione dei Rischi", code: "Mod. 6.1", content: `Valutazione dei Rischi ISO 27001 - Mod. 6.1

METODOLOGIA DI VALUTAZIONE:
Calcolo Effetto = R x I x D (Riservatezza x Integrità x Disponibilità)
Calcolo Rischio = E x V x C (Effetto x Verosimiglianza x Conseguenze)

FATTORI ESTERNI:
1. Concorrenza - Rischio divulgazione informazioni (Riservatezza)
2. Accessi non autorizzati - Hackering (Riservatezza)  
3. Utenze e connessione - Sbalzi tensione (Integrità)
4. Accesso ai locali - Furti (Riservatezza)
5. Pressioni economiche - Divulgazione fraudolenta

FATTORI INTERNI:
6. Sistemi informatici - Obsolescenza (Integrità)
7. Risorse umane - Turnover e furto dati (Riservatezza/Disponibilità)
8. Governance - Ruoli non definiti (Riservatezza)

ASSET:
- Postazioni PC
- Dispositivi mobili
- Smartphone
- Impianti
- Server
- Archivi fisici

TRATTAMENTO: Accettazione, Riduzione, Trasferimento, Evitamento` },

  { title: "Piano di Trattamento del Rischio", code: "Mod. 6.1.3", content: `Piano di Trattamento del Rischio - ISO 27001

1. SCOPO E CAMPO DI APPLICAZIONE
Documentare implementazione azioni di trattamento del rischio.

2. RIFERIMENTI
Norma UNI CEI ISO/IEC 27001:2022

3. GENERALITÀ
Identificazione rischi specifici e strategie di mitigazione.

4. MODALITÀ OPERATIVE
4.1. Azioni proposte: Definizione controlli da implementare
4.2. Risorse: Identificazione risorse necessarie
4.3. Modalità di monitoraggio: KPI e metriche
4.4. Responsabilità: Assegnazione ownership

ESEMPIO TRATTAMENTO:
- Rischio: Accessi non autorizzati
- Azione: Installazione videosorveglianza
- Responsabile: RSG
- Timeline: Da definire
- Verifica: Controllo periodico funzionamento` },

  { title: "Obiettivi Sicurezza Informazioni", code: "Mod. 6.2", content: `Obiettivi Sicurezza Informazioni - ISO 27001

OBIETTIVI STRATEGICI:

1. SISTEMA DI GESTIONE
- Traguardo: Migliorare gestione privacy e sicurezza informazioni
- Attività: Definizione ed attuazione del sistema di gestione, avvio certificazione

2. RISORSE
- Traguardo: Migliorare gestione del personale
- Attività: Applicazione politiche comportamentali

3. CONTROLLI OPERATIVI
- Traguardo: Ridurre rischio violazioni sicurezza informatica
- Attività: Identificare minacce, implementare controlli accesso

4. BUSINESS CONTINUITY
- Traguardo: Assicurare ripristino operazioni
- Attività: Identificare rischi, pianificare recovery

MISURAZIONE OBIETTIVI:
- Responsabile
- Data chiusura prevista
- Risultato verifica
- Commenti e azioni correttive` },

  { title: "Programma della Formazione", code: "Mod. 7.2", content: `Programma della Formazione ISO 27001 - Mod. 7.2

PIANIFICAZIONE FORMAZIONE:

CORSI PIANIFICATI:
1. UNI CEI ISO/IEC 27001 - Formazione generale
2. Formazione sulla Gestione dei Rischi
3. Formazione sulla Privacy dei Dati
4. Consapevolezza Sicurezza Informazioni
5. Incident Response e Data Breach

CONTENUTI FORMAZIONE ISO 27001:
- 4.1 Contesto
- 5.1 Impegno della Direzione
- 5.2 Politica per la qualità
- 6.1 Pianificazione e analisi del rischio
- 6.2 Obiettivi
- 7.1-7.5 Risorse e documentazione
- 8.1-8.3 Controllo operativo e rischio
- 9.1-9.3 Monitoraggio, Audit, Riesame
- 10.2 Miglioramento

VALUTAZIONE EFFICACIA:
- Esame finale
- Valutazione pratica
- Feedback partecipanti` },

  { title: "Registro Incidenti", code: "Mod. 8.1A", content: `Registro Incidenti Sicurezza - ISO 27001

STRUTTURA REGISTRO:
- Data incidente
- Tipologia incidente
- Descrizione dettagliata
- Dati coinvolti
- Azioni di ripristino
- Responsabile gestione

TIPOLOGIE INCIDENTI:
- Accesso non autorizzato
- Malware/Virus
- Data breach
- Perdita dati
- Guasto hardware/software
- Violazione policy

PROCESSO GESTIONE:
1. Rilevazione e segnalazione
2. Classificazione severità
3. Contenimento immediato
4. Investigazione cause
5. Ripristino operatività
6. Documentazione lessons learned
7. Azioni preventive` },

  { title: "Programma Audit Interni", code: "Mod. 9.2", content: `Programma Audit Interni ISO 27001 - Mod. 9.2

PIANIFICAZIONE AUDIT TRIENNALE

AREE DA VERIFICARE:
- Contesto dell'organizzazione
- Leadership e commitment
- Valutazione dei rischi
- Obiettivi sicurezza
- Controlli operativi
- Risorse e competenze
- Sistema di gestione documentale
- Attività operative
- Monitoraggio e misurazione
- Risultati audit precedenti
- Riesame della Direzione

PROCESSO AUDIT:
1. Pianificazione annuale
2. Preparazione checklist
3. Esecuzione audit
4. Rapporto findings
5. Azioni correttive
6. Follow-up verifica efficacia

QUALIFICA AUDITOR:
- Corso Verifiche Ispettive accreditato
- Conoscenza ISO 27001
- Almeno 2 V.I.I. in affiancamento` },

  { title: "Riesame della Direzione", code: "Mod. 9.3", content: `Riesame della Direzione - ISO 27001

ELEMENTI IN INGRESSO:
1. Politica sicurezza informazioni
2. Risultati azioni precedente riesame
3. Feedback parti interessate
4. Stato delle attività
5. Stato dei progetti
6. Prestazioni:
   a. Risultati Audit Interno
   b. Stato Azioni Correttive
   c. Risultati monitoraggio
   d. Raggiungimento obiettivi
7. Efficacia azioni per rischi e opportunità

ELEMENTI IN USCITA:
8. Nuovi obiettivi
9. Aggiornamento analisi rischi
10. Proposte modifiche al SGSI
11. Raccomandazioni miglioramento
12. Segnalazioni e suggerimenti

FREQUENZA: Almeno annuale o su necessità` },

  { title: "Registro Non Conformità e Azioni Correttive", code: "Mod. 10.2", content: `Registro NC e Azioni Correttive - ISO 27001

STRUTTURA REGISTRO:
- Numero progressivo
- Data rilevazione
- NC/OSS (Non Conformità/Osservazione)
- Punto ISO 27001 riferimento
- Origine: Interno/Esterno
- Descrizione NC/OSS
- Analisi cause
- Trattamento immediato
- Responsabile
- Descrizione Azione Correttiva
- Data verifica efficacia
- Esito verifica

PROCESSO GESTIONE NC:
1. Rilevazione e registrazione
2. Analisi causa radice
3. Definizione trattamento
4. Implementazione azione correttiva
5. Verifica efficacia
6. Chiusura NC` },

  { title: "Gestione Privacy GDPR", code: "IS01", content: `Procedura Gestione Privacy - GDPR/ISO 27001

1. GENERALITÀ
Definizione regole per adempimenti trattamento dati personali.

2. RUOLI E RESPONSABILITÀ:
- Titolare del Trattamento
- Responsabile del Trattamento
- Incaricato del Trattamento  
- DPO (ove nominato)
- Amministratore di Sistema

3. MODALITÀ GESTIONE DATI:
- Registro dei Trattamenti (Art. 30 GDPR)
- DPIA - Data Protection Impact Assessment
- Informativa trattamento dati
- Consenso al trattamento
- Raccolta, utilizzo e conservazione dati
- Archivi cartacei e informatici
- Comunicazione e diffusione dati
- Trasferimento dati all'estero

4. DIRITTI DELL'INTERESSATO:
- Diritto di accesso
- Diritto di rettifica
- Diritto alla portabilità
- Diritto di limitazione
- Diritto di opposizione
- Diritto alla cancellazione (oblio)

5. MISURE DI SICUREZZA:
- Protezione dati in rete
- Protezione dati su PC locale
- Cifratura
- Pseudonimizzazione

6. DATA BREACH:
- Notifica violazione al Garante (72 ore)
- Comunicazione agli interessati` },

  { title: "Acceptable Use Policy", code: "IS02", content: `Acceptable Use Policy - ISO 27001 A.8.1.3

CONTROLLI APPLICATI:
A.7.1.2 Termini e condizioni di impiego
A.7.2.2 Consapevolezza sicurezza
A.8.1.3 Uso accettabile dei beni
A.9.1.1 Politica controllo accessi
A.9.3.1 Uso informazioni segrete
A.12.2.1 Controlli malware

1. USO POSTAZIONE DI LAVORO
- Uso esclusivo per attività lavorative
- Divieto installazione software non autorizzato
- Blocco schermo in caso di assenza

2. INTERNET E POSTA ELETTRONICA
- Uso professionale
- Divieto siti inappropriati
- Attenzione phishing
- Email disclaimer obbligatorio

3. ANTIVIRUS
- Aggiornamento automatico
- Scansione periodica
- Segnalazione alert

4. DISPOSITIVI PERSONALI (BYOD)
- Regole di utilizzo
- Separazione dati personali/aziendali

5. VIOLAZIONI
- Sistema disciplinare
- Segnalazione incidenti` },

  { title: "Access Control Policy", code: "IS03", content: `Access Control Policy - ISO 27001 A.9

CONTROLLI:
A.9.1.1 Politica controllo accessi
A.9.1.2 Accesso reti e servizi
A.9.2.1 Registrazione utenti
A.9.2.2 Provisioning accessi
A.9.2.3 Gestione privilegi
A.9.2.4 Gestione credenziali
A.9.2.5 Revisione diritti accesso
A.9.2.6 Rimozione diritti
A.9.3.1 Uso informazioni segrete
A.9.4.1 Restrizione accesso informazioni

1. PRINCIPI
- Need-to-know
- Least privilege
- Segregation of duties

2. SISTEMI E ACCESSO INFORMAZIONI
- Classificazione utenti
- Livelli di autorizzazione
- Matrici di accesso

3. DE-REGISTRAZIONE UTENTI
- Processo offboarding
- Revoca tempestiva accessi
- Audit trail

4. ACCESSO FISICO
- Badge identificativi
- Aree riservate
- Log accessi` },

  { title: "Asset Management Policy", code: "IS04", content: `Asset Management Policy - ISO 27001 A.8

CONTROLLI:
A.6.2.1 Dispositivi portatili
A.8.1.1 Inventario asset
A.8.1.2 Responsabilità asset
A.8.1.3 Uso accettabile
A.8.1.4 Restituzione asset
A.8.2.1-3 Classificazione informazioni
A.8.3.1-3 Gestione supporti

1. TIPOLOGIE ASSET:
- Informazioni e sistemi informativi
- Software (licenze, applicazioni)
- Fisici (hardware, dispositivi)
- Servizi (cloud, outsourcing)

2. INVENTARIO ASSET
- Registro centralizzato
- Responsabile assegnato
- Classificazione criticità

3. CLASSIFICAZIONE INFORMAZIONI:
- Pubblico
- Interno
- Riservato
- Strettamente riservato

4. GESTIONE CICLO VITA:
- Acquisizione
- Utilizzo
- Manutenzione
- Dismissione sicura` },

  { title: "Encryption Policy", code: "IS07", content: `Encryption Policy - ISO 27001 A.10

CONTROLLI:
A.10.1.1 Politica uso controlli crittografici
A.10.1.2 Gestione delle chiavi

1. APPLICAZIONE CIFRATURA:
- Dati at rest (storage)
- Dati in transit (comunicazioni)
- Dati in use (memoria)

2. METODI CRITTOGRAFICI:
- AES-256 per dati sensibili
- TLS 1.2+ per comunicazioni
- Hashing per password (bcrypt, Argon2)

3. GESTIONE CHIAVI:
- Generazione sicura
- Distribuzione protetta
- Storage sicuro (HSM, vault)
- Rotazione periodica
- Revoca e distruzione

4. DISPOSITIVI PORTATILI:
- Cifratura full-disk obbligatoria
- Cifratura supporti rimovibili` },

  { title: "ICT Security Policy", code: "IS08", content: `ICT Security Policy - ISO 27001

PRINCIPI:
1. USO AUTORIZZATO
- Solo personale autorizzato
- Formazione obbligatoria

2. USO ACCETTABILE
- Finalità lavorative
- Rispetto policy aziendali

3. CONSAPEVOLEZZA PROTEZIONE
- Formazione continua
- Campagne awareness

4. BUSINESS CONTINUITY
- Backup regolari
- Disaster recovery plan
- Test periodici

5. MONITORAGGIO E REPORTING
- Log centralized
- Alert automatici
- Incident response

6. VALUTAZIONE RISCHIO
- Assessment periodici
- Vulnerability scan
- Penetration test

7. GESTIONE ASSET
- Inventario aggiornato
- Patch management
- Lifecycle management

8. SANZIONI
- Violazioni policy
- Procedura disciplinare` },

  { title: "Backup and Restore Policy", code: "IS09", content: `Information Backup and Restore Policy - ISO 27001 A.12.3

CONTROLLI:
A.12.3.1 Backup delle informazioni
A.17.1.2 Attuazione continuità sicurezza

1. SISTEMI IT/DATA BACKUPS
- Backup giornaliero incrementale
- Backup settimanale completo
- Retention: 30 giorni online, 1 anno offline
- Storage geograficamente distribuito

2. RESPONSABILITÀ UTENTE
- Salvataggio su aree condivise
- No storage locale critico
- Segnalazione anomalie

3. DATA RESTORES
- Procedure documentate
- Test restore periodici
- RTO/RPO definiti
- Escalation path

4. CRITTOGRAFIA BACKUP
- Cifratura at rest
- Protezione chiavi` },

  { title: "Password Policy", code: "IS14", content: `Password Policy - ISO 27001 A.9.4.3

REQUISITI PASSWORD:
- Lunghezza minima: 12 caratteri
- Complessità: maiuscole, minuscole, numeri, simboli
- No parole dizionario
- No dati personali
- No sequenze comuni

GESTIONE:
- Scadenza: 90 giorni
- Storico: ultimi 12 non riutilizzabili
- Blocco: 5 tentativi errati
- Reset: procedura verificata

ACCOUNT PRIVILEGIATI:
- Password 16+ caratteri
- Cambio 30 giorni
- MFA obbligatorio

PROTEZIONE:
- No condivisione
- No annotazione visibile
- Password manager autorizzati` },

  { title: "Security Incident Management Policy", code: "IS19", content: `Security Incident Management Policy - ISO 27001 A.16

TIPOLOGIE INCIDENTI:
1. Computer incustoditi non bloccati
2. Rivelazioni password
3. Virus/Malware warnings
4. Perdita supporti informatici
5. Smarrimento badge
6. Perdita/divulgazione informazioni
7. Abuso informazioni personali
8. Violazioni sicurezza fisica
9. Violazioni controllo accessi
10. Corrispondenza mancante
11. Perdita/furto IT

PROCESSO GESTIONE:
1. Rilevazione e segnalazione
2. Triage e classificazione
3. Contenimento
4. Investigazione
5. Eradicazione
6. Recovery
7. Lessons learned

COMUNICAZIONI:
- Escalation interna
- Notifica autorità (se richiesto)
- Comunicazione interessati` },

  { title: "Supplier Security Policy", code: "IS21", content: `Supplier Security Policy - ISO 27001 A.15

CONTROLLI:
A.15.1.1 Politica sicurezza fornitori
A.15.1.2 Sicurezza accordi fornitori
A.15.1.3 Supply chain ICT
A.15.2.1 Monitoraggio fornitori
A.15.2.2 Gestione modifiche servizi

REQUISITI FORNITORI:
- Valutazione sicurezza pre-contratto
- Clausole contrattuali sicurezza
- NDA obbligatorio
- Certificazioni richieste (ISO 27001)

ACCESSO INFORMAZIONI:
- Minimo necessario
- Monitoraggio attività
- Audit periodici

GESTIONE RISCHI:
- Valutazione criticità fornitore
- Piano continuità
- Exit strategy` },

  { title: "Gestione Informazioni Documentate", code: "PG1", content: `Procedura Gestione Informazioni Documentate - ISO 27001 7.5

1. SCOPO
Descrivere modalità per emissione, distribuzione, gestione, conservazione e archiviazione documenti.

2. INFORMAZIONI DOCUMENTATE INTERNE:
- Identificazione (codice, revisione, data)
- Emissione e approvazione
- Distribuzione controllata
- Modifiche e aggiornamenti
- Archiviazione e conservazione
- Controllo accesso
- Eliminazione

3. DOCUMENTI ORIGINE ESTERNA:
- Identificazione
- Registrazione
- Distribuzione

4. CLASSIFICAZIONE:
- Pubblico
- Uso interno
- Riservato
- Strettamente riservato

5. RESPONSABILITÀ:
- RSG: gestione sistema documentale
- Funzioni: redazione documenti area` },

  { title: "Procedura Audit Interni", code: "PG2", content: `Procedura Audit Interni - ISO 27001 9.2

1. SCOPO
Descrivere criteri e modalità per verifiche ispettive interne.

2. TIPOLOGIE AUDIT:
- Programmati (piano annuale)
- Su richiesta direzione
- Follow-up azioni correttive

3. QUALIFICA AUDITOR:
- Corso VI accreditato
- Conoscenza ISO 27001
- 2+ audit in affiancamento
- Indipendenza da area auditata

4. PROCESSO:
4.1 Pianificazione (programma annuale)
4.2 Preparazione (checklist, documenti)
4.3 Esecuzione (riunione apertura, verifica, riunione chiusura)
4.4 Rapporto (findings, NC, osservazioni)
4.5 Follow-up (verifica AC)

5. REGISTRAZIONI:
- Programma audit
- Piano audit
- Checklist
- Rapporto audit
- Registro NC` },

  { title: "Gestione Non Conformità e AC", code: "PG3", content: `Procedura Gestione NC e Azioni Correttive - ISO 27001 10.1

DEFINIZIONI:
- NC: mancato soddisfacimento requisito
- AC: azione per eliminare causa NC

PROCESSO:

1. RILEVAZIONE
Chiunque riscontri anomalia segnala a RSG

2. GESTIONE NC
- Registrazione nel registro NC
- Numero progressivo identificativo
- Analisi causa radice (5 Why, Ishikawa)

3. TRATTAMENTO
- Azione immediata contenimento
- Responsabile e tempistica

4. AZIONE CORRETTIVA
- Eliminazione causa radice
- Prevenzione ricorrenza

5. VERIFICA EFFICACIA
- Controllo implementazione
- Valutazione risultati
- Chiusura NC` },

  { title: "Procedura Valutazione del Rischio", code: "PG4", content: `Procedura Valutazione del Rischio - ISO 27001 6.1

1. SCOPO
Definire criteri per valutazione rischi sicurezza informazioni.

2. FREQUENZA VALUTAZIONE:
- Cambiamenti significativi contesto
- Nuovi contratti impattanti sicurezza
- Post incidenti
- Almeno ogni 3 anni
- Riesame direzione

3. METODOLOGIA:

3.1 Individuazione fattori pericolo:
- Fattori esterni (concorrenza, accessi, utenze, pressioni)
- Fattori interni (sistemi, processi, risorse, governance)
- Asset (hardware, software, dati, persone)

3.2 Analisi rischio:
Effetto = MAX(Riservatezza, Integrità, Disponibilità)
Rischio = Effetto x Verosimiglianza x Conseguenze

3.3 Criteri accettabilità:
- Basso (1-6): accettabile
- Medio (7-12): monitoraggio
- Alto (13-18): trattamento
- Critico (19-25): immediato

4. TRATTAMENTO:
- Riduzione (controlli)
- Trasferimento (assicurazione)
- Evitamento (cessazione attività)
- Accettazione (consapevole)` },

  { title: "Procedura Gestione Incidenti", code: "PG6", content: `Procedura Gestione Incidenti - ISO 27001 A.16

1. SCOPO
Criteri e modalità per gestione incidenti informatici.

2. DEFINIZIONE INCIDENTE
Imprevisto rispetto al normale funzionamento: malfunzionamento, attacco, abuso sistema.

3. TIPOLOGIE:
- Malware, Virus, Worm, Trojan
- Ransomware
- Phishing, Social engineering
- DoS/DDoS
- Data breach
- Accesso non autorizzato

4. PROCESSO INCIDENT RESPONSE:

4.1 Interventi preventivi
- Awareness
- Controlli tecnici
- Monitoring

4.2 Incident response
- Identificazione
- Contenimento
- Eradicazione
- Recovery

4.3 Post-incident
- Analisi cause
- Lessons learned
- Miglioramento controlli

5. COMUNICAZIONE
- Escalation interna
- Notifica Garante (data breach 72h)
- Comunicazione interessati` },

  { title: "Procedura Gestione del Personale", code: "PG7", content: `Procedura Gestione del Personale - ISO 27001 A.7

1. SELEZIONE
1.1 Definizione requisiti minimi (mansionario)
1.2 Colloqui con comunicazione policy
1.3 Sottoscrizione contratto con clausole sicurezza
1.4 Background check (se applicabile)

2. FORMAZIONE
2.1 Requisiti minimi competenza per ruolo
2.2 Individuazione destinatari e momenti
2.3 Erogazione formazione
2.4 Registrazione (verbali, attestati)
2.5 Valutazione efficacia

3. CONSAPEVOLEZZA
- Policy sicurezza
- Responsabilità individuali
- Conseguenze violazioni

4. RESPONSABILITÀ PERSONALE
- Rispetto policy
- Segnalazione incidenti
- Protezione credenziali

5. CESSAZIONE RAPPORTO
- Revoca accessi immediata
- Restituzione asset
- NDA post-impiego` },

  { title: "Procedura Gestione Fornitori", code: "PG8", content: `Procedura Gestione Fornitori - ISO 27001 A.15

1. SCOPO
Controllo fornitori con impatto su sicurezza informazioni.

2. TIPOLOGIE:
Materiali: Hardware, Software, Materiale ufficio
Servizi: Consulenza, Provider, Progettazione

3. OUTSOURCING
Attività affidate all'esterno:
- Gestione server
- Server di posta
- Acquisto HW

4. VALUTAZIONE FORNITORI
Criteri (punteggio 1-5):
- Prezzo (rapporto qualità/prezzo)
- Assistenza (disponibilità, tempistiche)
- Certificazioni (ISO 27001 = qualificante)
- Storicità (rapporti continuativi)
- Qualità (livelli servizio)

5. QUALIFICA:
- 4-5: Qualificato
- 3: Da monitorare
- <3: Non qualificato

6. REVISIONE: Almeno annuale` },

  { title: "Dichiarazione di Applicabilità (SOA)", code: "DIA", content: `Dichiarazione di Applicabilità - Statement of Applicability ISO 27001 Annex A

STRUTTURA SOA:
Per ogni controllo Annex A:
- Applicabilità (Sì/No)
- Giustificazione inclusione/esclusione
- Stato implementazione (%)
- Documenti di riferimento

AREE CONTROLLI ANNEX A:

A.5 Politiche sicurezza informazioni
A.6 Organizzazione sicurezza
A.7 Sicurezza risorse umane
A.8 Gestione asset
A.9 Controllo accessi
A.10 Crittografia
A.11 Sicurezza fisica
A.12 Sicurezza operazioni
A.13 Sicurezza comunicazioni
A.14 Acquisizione, sviluppo sistemi
A.15 Relazioni con fornitori
A.16 Gestione incidenti
A.17 Continuità operativa
A.18 Conformità

STATO IMPLEMENTAZIONE GLOBALE: 97%` },

  { title: "Business Continuity Policy", code: "IS05", content: `Business Continuity Policy - ISO 27001 A.17

CONTROLLI:
A.17.1.1 Pianificazione continuità sicurezza
A.17.1.2 Attuazione continuità sicurezza
A.17.1.3 Verifica e riesame continuità
A.17.2.1 Disponibilità strutture elaborazione

1. SCOPO
Garantire la continuità delle operazioni critiche in caso di incidenti o disastri.

2. BUSINESS IMPACT ANALYSIS (BIA)
- Identificazione processi critici
- Valutazione impatto interruzioni
- Definizione RTO (Recovery Time Objective)
- Definizione RPO (Recovery Point Objective)

3. STRATEGIE DI CONTINUITÀ
- Backup e recovery
- Siti alternativi
- Ridondanza sistemi critici
- Procedure manuali di emergenza

4. PIANO DI CONTINUITÀ OPERATIVA (BCP)
- Procedure di attivazione
- Ruoli e responsabilità
- Comunicazioni di emergenza
- Risorse necessarie

5. PIANO DI DISASTER RECOVERY (DRP)
- Procedure tecniche di ripristino
- Priorità di recovery
- Test e verifiche periodiche

6. TEST E MANUTENZIONE
- Test annuali del piano
- Aggiornamento dopo modifiche significative
- Formazione del personale` },

  { title: "Data Classification Policy", code: "IS06", content: `Data Classification Policy - ISO 27001 A.8.2

CONTROLLI:
A.8.2.1 Classificazione delle informazioni
A.8.2.2 Etichettatura delle informazioni
A.8.2.3 Trattamento degli asset

1. SCOPO
Definire criteri per classificazione e gestione delle informazioni in base alla sensibilità.

2. LIVELLI DI CLASSIFICAZIONE

2.1 PUBBLICO
- Informazioni divulgabili senza restrizioni
- Marketing, comunicati stampa

2.2 USO INTERNO
- Informazioni per uso aziendale
- Procedure operative, policy interne

2.3 RISERVATO
- Informazioni sensibili aziendali
- Dati finanziari, strategie commerciali

2.4 STRETTAMENTE RISERVATO
- Massima protezione richiesta
- Dati personali sensibili, segreti industriali

3. CRITERI DI CLASSIFICAZIONE
- Impatto su riservatezza
- Requisiti legali (GDPR)
- Valore commerciale
- Impatto reputazionale

4. GESTIONE PER LIVELLO
- Controlli di accesso
- Cifratura
- Trasmissione sicura
- Conservazione e distruzione

5. ETICHETTATURA
- Documenti cartacei
- File elettronici
- Email e comunicazioni` },

  { title: "Logical Security Policy", code: "IS10", content: `Logical Security Policy - ISO 27001 A.9/A.12

CONTROLLI:
A.9.4.1 Restrizione accesso informazioni
A.9.4.2 Procedure di log-on sicure
A.12.1.1 Procedure operative documentate
A.12.4.1 Registrazione eventi

1. SCOPO
Proteggere sistemi informativi da accessi non autorizzati e minacce logiche.

2. AUTENTICAZIONE
- Identificazione univoca utenti
- Password policy (vedi IS14)
- Multi-Factor Authentication (MFA)
- Single Sign-On (SSO) ove applicabile

3. AUTORIZZAZIONE
- Principio del minimo privilegio
- Segregation of duties
- Matrici di autorizzazione
- Revisione periodica diritti

4. REGISTRAZIONE E MONITORAGGIO
- Log di accesso centralizzati
- Retention log: minimo 12 mesi
- Monitoraggio attività anomale
- Alerting automatico

5. PROTEZIONE SESSIONI
- Timeout inattività
- Blocco dopo tentativi falliti
- Gestione sessioni concorrenti

6. SICUREZZA APPLICAZIONI
- Sviluppo sicuro (OWASP)
- Test di sicurezza
- Gestione vulnerabilità` },

  { title: "Malware Protection Policy", code: "IS11", content: `Malware Protection Policy - ISO 27001 A.12.2

CONTROLLI:
A.12.2.1 Controlli contro il malware

1. SCOPO
Proteggere sistemi da software malevolo (virus, ransomware, trojan, worm).

2. CONTROLLI PREVENTIVI
- Software antivirus/antimalware su tutti i sistemi
- Aggiornamento automatico definizioni
- Scansione in tempo reale
- Scansione periodica completa (settimanale)

3. GESTIONE ENDPOINT
- Protezione workstation
- Protezione server
- Protezione dispositivi mobili
- Email gateway protection

4. POLICY UTENTE
- Divieto software non autorizzato
- Attenzione allegati email sospetti
- Segnalazione immediata anomalie
- No utilizzo supporti USB non autorizzati

5. RISPOSTA INCIDENTI MALWARE
- Isolamento sistema infetto
- Analisi e contenimento
- Bonifica e ripristino
- Lessons learned

6. MONITORAGGIO
- Dashboard centralizzata
- Report infezioni
- Trend analysis` },

  { title: "Network Security Policy", code: "IS12", content: `Network Security Policy - ISO 27001 A.13

CONTROLLI:
A.13.1.1 Controlli di rete
A.13.1.2 Sicurezza servizi di rete
A.13.1.3 Segregazione nelle reti
A.13.2.1 Politiche trasferimento informazioni

1. SCOPO
Proteggere l'infrastruttura di rete e le comunicazioni.

2. ARCHITETTURA DI RETE
- Segmentazione rete (VLAN)
- DMZ per servizi esposti
- Separazione rete guest
- Isolamento sistemi critici

3. CONTROLLI PERIMETRALI
- Firewall perimetrale
- IDS/IPS
- Web Application Firewall
- Filtro contenuti

4. SICUREZZA WIRELESS
- WPA3/WPA2-Enterprise
- Autenticazione 802.1X
- Rete guest separata
- Monitoraggio rogue AP

5. GESTIONE DISPOSITIVI DI RETE
- Hardening configurazioni
- Aggiornamento firmware
- Accesso amministrativo sicuro
- Backup configurazioni

6. VPN E CONNESSIONI ESTERNE
- Cifratura end-to-end
- Autenticazione forte
- Monitoraggio connessioni` },

  { title: "Physical Security Policy", code: "IS13", content: `Physical Security Policy - ISO 27001 A.11

CONTROLLI:
A.11.1.1 Perimetro sicurezza fisica
A.11.1.2 Controlli ingresso fisici
A.11.1.3 Sicurezza uffici e locali
A.11.1.4 Protezione minacce esterne
A.11.2.1 Posizionamento apparecchiature

1. SCOPO
Proteggere locali, apparecchiature e informazioni da accessi fisici non autorizzati.

2. AREE DI SICUREZZA
- Area pubblica (reception)
- Area uffici (uso interno)
- Area riservata (IT, archivi)
- Area ad accesso ristretto (data center)

3. CONTROLLI ACCESSO FISICO
- Badge identificativi
- Lettori badge/biometrici
- Registro visitatori
- Accompagnamento ospiti

4. PROTEZIONE DATA CENTER
- Controllo accessi multifattore
- Videosorveglianza 24/7
- Rilevazione intrusioni
- Protezione antincendio

5. PROTEZIONE APPARECCHIATURE
- Posizionamento sicuro
- Protezione alimentazione (UPS)
- Controllo ambientale (temperatura, umidità)
- Manutenzione programmata

6. DISMISSIONE SICURA
- Cancellazione sicura dati
- Distruzione fisica supporti
- Certificazione dismissione` },

  { title: "Remote Access Policy", code: "IS15", content: `Remote Access Policy - ISO 27001 A.6.2/A.9

CONTROLLI:
A.6.2.1 Politica dispositivi mobili
A.6.2.2 Telelavoro
A.9.1.2 Accesso a reti e servizi
A.13.2.1 Trasferimento informazioni

1. SCOPO
Regolamentare l'accesso remoto ai sistemi aziendali.

2. METODI DI ACCESSO AUTORIZZATI
- VPN aziendale (obbligatoria)
- Portale web sicuro (HTTPS)
- Desktop remoto via VPN
- Applicazioni cloud autorizzate

3. REQUISITI DISPOSITIVI
- Antivirus aggiornato
- Sistema operativo aggiornato
- Cifratura disco
- Firewall personale attivo

4. AUTENTICAZIONE
- Multi-Factor Authentication (MFA) obbligatoria
- Certificati digitali (ove richiesto)
- Timeout sessione

5. TELELAVORO / SMART WORKING
- Postazione sicura (privacy visiva)
- Rete domestica sicura
- Divieto uso reti pubbliche non protette
- Separazione uso personale/lavorativo

6. MONITORAGGIO E LOG
- Registrazione accessi remoti
- Alerting anomalie
- Revisione periodica autorizzazioni` },

  { title: "Scanning and Disposal Policy", code: "IS16", content: `Scanning and Disposal Policy - ISO 27001 A.8.3/A.11.2

CONTROLLI:
A.8.3.1 Gestione supporti rimovibili
A.8.3.2 Dismissione dei supporti
A.8.3.3 Trasferimento supporti fisici
A.11.2.7 Dismissione sicura apparecchiature

1. SCOPO
Gestire la scansione documenti e la dismissione sicura di supporti e apparecchiature.

2. SCANSIONE DOCUMENTI
- Scanner autorizzati
- Qualità minima richiesta
- Formato file standard (PDF/A)
- Metadati e indicizzazione
- Verifica qualità scansione

3. DISMISSIONE DOCUMENTI CARTACEI
- Classificazione documento
- Distruzione con distruggidocumenti (min. DIN 4)
- Servizio esterno certificato per grandi volumi
- Registro dismissioni

4. DISMISSIONE SUPPORTI DIGITALI
- Cancellazione sicura (DoD 5220.22-M o NIST 800-88)
- Degaussing per supporti magnetici
- Distruzione fisica SSD/flash
- Certificazione dismissione

5. DISMISSIONE APPARECCHIATURE
- Rimozione dati completa
- Verifica cancellazione
- Gestione RAEE conforme
- Documentazione tracciabilità` },

  { title: "Secure Desk Policy", code: "IS17", content: `Secure Desk Policy (Clean Desk) - ISO 27001 A.11.2.9

CONTROLLI:
A.11.2.9 Politica scrivania pulita e schermo pulito

1. SCOPO
Proteggere informazioni da accessi non autorizzati mantenendo postazioni ordinate.

2. POLITICA SCRIVANIA PULITA
- Documenti riservati in cassetti chiusi
- Nessun documento sensibile visibile
- Archivi chiusi a chiave
- Pulizia scrivania a fine giornata

3. POLITICA SCHERMO PULITO
- Blocco schermo automatico (max 5 minuti)
- Blocco manuale quando ci si allontana (Win+L)
- Screen saver con password
- Posizionamento monitor (no visibilità esterna)

4. GESTIONE DOCUMENTI
- Stampe ritirate immediatamente
- Secure print per documenti sensibili
- Distruzione documenti non necessari
- No post-it con password

5. AREE COMUNI
- Lavagne cancellate dopo riunioni
- Proiettori spenti
- Documenti raccolti

6. VERIFICHE
- Controlli periodici a campione
- Segnalazione non conformità` },

  { title: "Server Security Policy", code: "IS20", content: `Server Security Policy - ISO 27001 A.12/A.14

CONTROLLI:
A.12.1.2 Gestione dei cambiamenti
A.12.5.1 Installazione software
A.12.6.1 Gestione vulnerabilità tecniche
A.14.2.2 Procedure controllo modifiche

1. SCOPO
Proteggere server aziendali garantendo sicurezza, disponibilità e integrità.

2. HARDENING SERVER
- Installazione minima (no servizi inutili)
- Configurazione sicura baseline
- Disabilitazione account di default
- Rimozione software non necessario

3. PATCH MANAGEMENT
- Scansione vulnerabilità periodica
- Valutazione criticità patch
- Test in ambiente staging
- Deployment pianificato
- Rollback procedure

4. CONTROLLO ACCESSI
- Accesso solo amministratori autorizzati
- MFA per accesso amministrativo
- Segregazione ruoli admin
- Audit log accessi

5. MONITORAGGIO
- Monitoring risorse (CPU, RAM, disco)
- Log centralizzati (SIEM)
- Alerting automatico
- Capacity planning

6. BACKUP E RECOVERY
- Backup giornaliero
- Test restore periodici
- Documentazione recovery
- DR site per sistemi critici` },

  { title: "Information Systems Development Procedure", code: "IS32", content: `Procedura Sviluppo e Manutenzione Sistemi - ISO 27001 A.14

CONTROLLI:
A.14.1.1 Analisi requisiti sicurezza
A.14.2.1 Politica sviluppo sicuro
A.14.2.2 Procedure controllo modifiche
A.14.2.3 Riesame tecnico applicazioni
A.14.2.5 Principi ingegneria sicura
A.14.2.6 Ambiente sviluppo sicuro
A.14.2.8 Test sicurezza sistemi
A.14.2.9 Test accettazione sistemi

1. SCOPO
Garantire che sicurezza sia integrata nel ciclo di sviluppo software (SDLC).

2. REQUISITI SICUREZZA
- Analisi requisiti sicurezza in fase di design
- Threat modeling
- Privacy by design (GDPR)
- Security by default

3. SVILUPPO SICURO
- Linee guida OWASP
- Code review
- Static Application Security Testing (SAST)
- Gestione dipendenze sicura

4. AMBIENTI SEPARATI
- Sviluppo
- Test/Staging
- Produzione
- No dati produzione in test

5. TEST DI SICUREZZA
- Dynamic Application Security Testing (DAST)
- Penetration testing
- Vulnerability assessment
- User Acceptance Testing (UAT)

6. CHANGE MANAGEMENT
- Richiesta di modifica documentata
- Approvazione change
- Test pre-deployment
- Rollback plan` },

  { title: "Laptop and Mobile Device Security Procedure", code: "IS34", content: `Procedura Sicurezza Laptop e Dispositivi Mobili - ISO 27001 A.6.2

CONTROLLI:
A.6.2.1 Politica dispositivi mobili
A.8.3.1 Gestione supporti rimovibili
A.11.2.6 Sicurezza apparecchiature fuori sede

1. SCOPO
Proteggere laptop, smartphone e tablet utilizzati per attività lavorative.

2. LAPTOP AZIENDALI
- Cifratura full-disk (BitLocker/FileVault)
- Password BIOS
- Antivirus/EDR installato
- Firewall personale attivo
- VPN per connessioni esterne

3. SMARTPHONE E TABLET
- MDM (Mobile Device Management)
- PIN/biometria obbligatori
- Cifratura dati
- Remote wipe capability
- Separazione dati personali/aziendali

4. BYOD (Bring Your Own Device)
- Registrazione dispositivo
- Requisiti minimi sicurezza
- Containerizzazione dati aziendali
- Accettazione policy uso

5. UTILIZZO FUORI SEDE
- Attenzione in luoghi pubblici
- No connessione WiFi pubbliche non protette
- Custodia sicura
- Segnalazione immediata smarrimento/furto

6. SMARRIMENTO O FURTO
- Segnalazione immediata IT
- Blocco remoto dispositivo
- Cancellazione remota dati
- Denuncia autorità` },

  { title: "Parti Interessate", code: "Mod. 4.2", content: `Parti Interessate - ISO 27001 4.2

IDENTIFICAZIONE PARTI INTERESSATE E REQUISITI

1. PARTI INTERESSATE INTERNE

1.1 Direzione
- Esigenze: Protezione asset, conformità, reputazione
- Aspettative: Sistema efficace, report periodici

1.2 Dipendenti
- Esigenze: Strumenti sicuri, formazione
- Aspettative: Policy chiare, supporto IT

1.3 IT/Sicurezza
- Esigenze: Risorse adeguate, autorità
- Aspettative: Budget, commitment direzione

2. PARTI INTERESSATE ESTERNE

2.1 Clienti
- Esigenze: Protezione dati, continuità servizio
- Aspettative: Conformità GDPR, SLA

2.2 Fornitori
- Esigenze: Requisiti sicurezza chiari
- Aspettative: Collaborazione, feedback

2.3 Autorità di controllo
- Esigenze: Conformità normativa
- Aspettative: Documentazione, audit trail

2.4 Azionisti/Investitori
- Esigenze: Gestione rischi
- Aspettative: Governance, trasparenza

3. COMUNICAZIONE
Modalità di comunicazione con ciascuna parte interessata.` },

  { title: "Organigramma Sicurezza Informazioni", code: "Mod. 5.3b", content: `Organigramma Sicurezza Informazioni - ISO 27001 5.3

STRUTTURA ORGANIZZATIVA SGSI

1. ALTA DIREZIONE
- Responsabilità ultima SGSI
- Approvazione politiche e risorse
- Riesame della direzione

2. RSG (Responsabile Sistema Gestione)
- Gestione operativa SGSI
- Coordinamento attività
- Reporting alla direzione
- Gestione documentazione

3. CISO / Responsabile Sicurezza (ove presente)
- Strategia sicurezza
- Gestione rischi
- Incident response
- Compliance normativa

4. IT MANAGER
- Implementazione controlli tecnici
- Gestione infrastruttura
- Backup e recovery
- Patch management

5. DPO (ove nominato)
- Consulenza privacy
- Monitoraggio conformità GDPR
- Punto di contatto Garante

6. RSPP
- Sicurezza fisica luoghi lavoro
- Coordinamento con sicurezza informazioni

7. TUTTI I DIPENDENTI
- Rispetto policy
- Segnalazione incidenti
- Partecipazione formazione` },

  { title: "Elenco Risorse", code: "Mod. 7.1", content: `Elenco Risorse - ISO 27001 7.1

RISORSE NECESSARIE PER IL SGSI

1. RISORSE UMANE
- RSG: tempo dedicato gestione SGSI
- IT: implementazione controlli tecnici
- HR: gestione formazione e competenze
- Consulenti esterni (audit, specialisti)

2. RISORSE TECNICHE
- Software gestione documentale
- Strumenti sicurezza (antivirus, firewall, SIEM)
- Strumenti backup e recovery
- Piattaforma formazione

3. RISORSE FINANZIARIE
- Budget annuale sicurezza informazioni
- Costi certificazione
- Costi formazione
- Costi strumenti e licenze

4. INFRASTRUTTURA
- Data center / server room
- Sistemi di controllo accessi
- Videosorveglianza
- Sistemi antincendio

5. COMPETENZE
- Competenze tecniche IT security
- Competenze normative (GDPR, NIS2)
- Competenze audit
- Competenze gestione rischi

6. TEMPO
- Ore dedicate attività SGSI
- Pianificazione audit interni
- Formazione periodica` },

  { title: "Pianificazione e Controllo Operativo", code: "Mod. 8.1", content: `Pianificazione e Controllo Operativo - ISO 27001 8.1

CONTROLLO PROCESSI OPERATIVI

1. PROCESSI OPERATIVI IDENTIFICATI
- Gestione accessi utenti
- Gestione modifiche (change management)
- Gestione incidenti
- Backup e recovery
- Monitoraggio sicurezza

2. CRITERI DI CONTROLLO
Per ogni processo:
- Input richiesti
- Output attesi
- Risorse necessarie
- Responsabilità
- Controlli applicati
- Registrazioni

3. GESTIONE CAMBIAMENTI
- Valutazione impatto sicurezza
- Approvazione formale
- Test prima implementazione
- Documentazione

4. CONTROLLO PROCESSI ESTERNI
- Requisiti sicurezza fornitori
- Monitoraggio prestazioni
- Audit fornitori critici

5. DOCUMENTAZIONE OPERATIVA
- Procedure operative
- Work instructions
- Checklist operative
- Registrazioni

6. VERIFICA ATTUAZIONE
- Monitoraggio KPI
- Audit interni
- Non conformità e azioni correttive` }
];

const LoadISO27001Templates = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const { toast } = useToast();

  const handleLoad = async () => {
    setIsLoading(true);
    setProgress(0);
    setLoadedCount(0);

    try {
      const total = iso27001Templates.length;
      
      for (let i = 0; i < iso27001Templates.length; i++) {
        const template = iso27001Templates[i];
        
        const { error } = await supabase.functions.invoke('load-regulatory-documents', {
          body: {
            title: `ISO 27001 - ${template.title}`,
            content: template.content,
            version: template.code,
            jurisdiction: 'EU/IT',
            sector: 'General',
            sourceUrl: 'https://www.iso.org/standard/27001'
          }
        });

        if (error) {
          console.error(`Error loading ${template.title}:`, error);
        }

        setLoadedCount(i + 1);
        setProgress(Math.round(((i + 1) / total) * 100));
      }

      toast({
        title: "Caricamento completato",
        description: `${iso27001Templates.length} template ISO 27001 caricati nel RAG`,
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Errore",
        description: "Errore durante il caricamento",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Carica Template ISO 27001 nel RAG
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Carica nel sistema RAG {iso27001Templates.length} template e procedure ISO 27001:2022 
            per l'analisi conformità e la generazione di documenti.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {iso27001Templates.slice(0, 12).map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                <FileText className="w-4 h-4 text-primary" />
                <span className="truncate">{t.code}</span>
              </div>
            ))}
            {iso27001Templates.length > 12 && (
              <div className="text-sm text-muted-foreground p-2">
                +{iso27001Templates.length - 12} altri...
              </div>
            )}
          </div>

          {isLoading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">
                {loadedCount} / {iso27001Templates.length} template caricati
              </p>
            </div>
          )}

          <Button 
            onClick={handleLoad} 
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Caricamento in corso...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Carica {iso27001Templates.length} Template ISO 27001
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoadISO27001Templates;
