// Ingestione di fonti non legislative e di testi forniti a mano: provvedimenti del Garante,
// linee guida EDPB, AgID e ACN, standard tecnici aperti (OWASP ASVS, WCAG), testi delle
// licenze open source, e leggi italiane in XML Akoma Ntoso caricate dall'amministratore.
//
// Ogni sezione citabile diventa una riga di structured_chunks (con regulation, citation_label,
// context_header, chunk_key) e una riga speculare in chunks, come fa ingest-eurlex-formex,
// così che rag-query le recuperi con le stesse strategie.
//
// Autenticazione: chiave di servizio oppure utente admin.
// Invocazione:
//   POST {source, offset?, limit?, reset?, dryRun?}            fonte del catalogo, scaricata qui
//   POST {source, content, contentType: 'akn'|'nmd'|'markdown'|'text', offset?, limit?, reset?}
//        testo fornito dall'amministratore per una fonte del catalogo (per esempio l'XML di
//        Normattiva, che non si può scaricare dai server di Supabase)
// Per i PDF l'avanzamento è per pagine: offset e limit sono numeri di pagina.

import { createClient } from "npm:@supabase/supabase-js@2.75.0";
import { getDocumentProxy } from "npm:unpdf@1.8.1";
import { configuredServiceKeys, EMBEDDING_MODEL, embedTexts, isServiceRequest } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

type Kind = "garante" | "html" | "pdf" | "markdown" | "text" | "akn" | "nmd";

interface Part {
  url?: string;
  kind: Kind;
  label?: string; // nome della parte nella citazione (es. "Allegato 2")
}

interface SourceSpec {
  regulation: string; // codice usato da rag-query
  title: string; // titolo del documento: deve contenere i termini di ricerca di rag-query
  cite: string; // prefisso della citazione
  lang: "IT" | "EN";
  validFrom: string;
  jurisdiction: "IT" | "EU" | "INT";
  sourceUrl: string;
  parts: Part[];
}

const G = (id: string): Part => ({ url: `https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/${id}`, kind: "garante" });
const ASVS = (file: string): Part => ({ url: `https://raw.githubusercontent.com/OWASP/ASVS/master/5.0/en/${file}`, kind: "markdown" });
// Testi vigenti di Normattiva convertiti in Markdown dal progetto italia-corpus (dataciviclab, MIT),
// aggiornato ogni giorno dall'API OpenData di Normattiva. Normattiva non è raggiungibile dai server
// di Supabase: questa è la copia pubblica più vicina alla fonte. Si sostituisce con l'XML ufficiale
// caricato dall'amministratore quando serve.
const NMD = (path: string): Part => ({ url: `https://raw.githubusercontent.com/dataciviclab/italia-corpus/main/${path.split("/").map(encodeURIComponent).join("/")}`, kind: "nmd" });
const SPDX = (id: string): Part => ({ url: `https://raw.githubusercontent.com/spdx/license-list-data/main/text/${id}.txt`, kind: "text", label: id });

const SOURCES: Record<string, SourceSpec> = {
  // ── Garante privacy ────────────────────────────────────────────────────────
  GARANTE_COOKIE: {
    regulation: "GARANTE_COOKIE", lang: "IT", jurisdiction: "IT", validFrom: "2021-06-10",
    title: "Garante privacy - Linee guida cookie e altri strumenti di tracciamento (10 giugno 2021)",
    cite: "Garante, Linee guida cookie 10/6/2021",
    sourceUrl: "https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9677876",
    parts: [G("9677876")],
  },
  GARANTE_ADS: {
    regulation: "GARANTE_ADS", lang: "IT", jurisdiction: "IT", validFrom: "2008-11-27",
    title: "Garante privacy - Amministratori di sistema (provvedimento 27 novembre 2008 e modifiche 25 giugno 2009)",
    cite: "Garante, Amministratori di sistema",
    sourceUrl: "https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/1577499",
    parts: [{ ...G("1577499"), label: "Provvedimento 27/11/2008" }, { ...G("1626595"), label: "Modifiche 25/6/2009" }],
  },
  GARANTE_METADATI: {
    regulation: "GARANTE_METADATI", lang: "IT", jurisdiction: "IT", validFrom: "2024-06-06",
    title: "Garante privacy - Documento di indirizzo metadati posta elettronica dei lavoratori (6 giugno 2024)",
    cite: "Garante, Documento di indirizzo metadati 6/6/2024",
    sourceUrl: "https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/10026277",
    parts: [G("10026277")],
  },
  GARANTE_EMAIL_INTERNET: {
    regulation: "GARANTE_EMAIL_INTERNET", lang: "IT", jurisdiction: "IT", validFrom: "2007-03-01",
    title: "Garante privacy - Linee guida posta elettronica e internet nel rapporto di lavoro (1 marzo 2007)",
    cite: "Garante, Linee guida posta elettronica e internet 1/3/2007",
    sourceUrl: "https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/1387522",
    parts: [G("1387522")],
  },
  GARANTE_DOSSIER: {
    regulation: "GARANTE_DOSSIER", lang: "IT", jurisdiction: "IT", validFrom: "2015-06-04",
    title: "Garante privacy - Linee guida dossier sanitario elettronico (4 giugno 2015)",
    cite: "Garante, Linee guida dossier sanitario 4/6/2015",
    sourceUrl: "https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/4084632",
    parts: [G("4084632")],
  },
  // ── EDPB ───────────────────────────────────────────────────────────────────
  EDPB_4_2019: {
    regulation: "EDPB_4_2019", lang: "IT", jurisdiction: "EU", validFrom: "2020-10-20",
    title: "EDPB - Linee guida 4/2019 protezione dei dati fin dalla progettazione e per impostazione predefinita (art. 25)",
    cite: "EDPB, Linee guida 4/2019",
    sourceUrl: "https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-42019-article-25-data-protection-design-and_en",
    parts: [{ url: "https://www.edpb.europa.eu/system/files/2021-04/edpb_guidelines_201904_dataprotection_by_design_and_by_default_v2.0_it.pdf", kind: "pdf" }],
  },
  EDPB_2_2023: {
    regulation: "EDPB_2_2023", lang: "IT", jurisdiction: "EU", validFrom: "2024-10-07",
    title: "EDPB - Linee guida 2/2023 ambito tecnico dell'art. 5, par. 3, della direttiva ePrivacy (cookie e tracciamento)",
    cite: "EDPB, Linee guida 2/2023",
    sourceUrl: "https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2023/guidelines-22023-technical-scope-art-53-eprivacy_en",
    parts: [{ url: "https://www.edpb.europa.eu/system/files/2025-02/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_it.pdf", kind: "pdf" }],
  },
  EDPB_3_2022: {
    regulation: "EDPB_3_2022", lang: "IT", jurisdiction: "EU", validFrom: "2023-02-14",
    title: "EDPB - Linee guida 3/2022 modelli di progettazione ingannevoli (dark pattern) nelle interfacce",
    cite: "EDPB, Linee guida 3/2022",
    sourceUrl: "https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-032022-deceptive-design-patterns-social-media_en",
    parts: [{ url: "https://www.edpb.europa.eu/system/files/2025-05/edpb_03-2022_guidelines_on_deceptive_design_patterns_in_social_media_platform_interfaces_v2_it.pdf", kind: "pdf" }],
  },
  EDPB_5_2020: {
    regulation: "EDPB_5_2020", lang: "IT", jurisdiction: "EU", validFrom: "2020-05-04",
    title: "EDPB - Linee guida 05/2020 sul consenso ai sensi del regolamento 2016/679",
    cite: "EDPB, Linee guida 05/2020",
    sourceUrl: "https://www.edpb.europa.eu/documents/guideline/guidelines-052020-on-consent-under-regulation-2016679_en",
    parts: [{ url: "https://www.edpb.europa.eu/system/files/documents/files/file1/edpb_guidelines_202005_consent_it.pdf", kind: "pdf" }],
  },
  EDPB_1_2022: {
    regulation: "EDPB_1_2022", lang: "EN", jurisdiction: "EU", validFrom: "2023-03-28",
    title: "EDPB - Guidelines 01/2022 on data subject rights - Right of access (diritto di accesso)",
    cite: "EDPB, Guidelines 01/2022",
    sourceUrl: "https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-012022-data-subject-rights-right-access_en",
    parts: [{ url: "https://www.edpb.europa.eu/system/files/2023-04/edpb_guidelines_202201_data_subject_rights_access_v2_en.pdf", kind: "pdf" }],
  },
  EDPB_9_2022: {
    regulation: "EDPB_9_2022", lang: "EN", jurisdiction: "EU", validFrom: "2023-03-28",
    title: "EDPB - Guidelines 9/2022 on personal data breach notification (violazione dei dati)",
    cite: "EDPB, Guidelines 9/2022",
    sourceUrl: "https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-92022-personal-data-breach-notification-under_en",
    parts: [{ url: "https://www.edpb.europa.eu/system/files/2023-04/edpb_guidelines_202209_personal_data_breach_notification_v2.0_en.pdf", kind: "pdf" }],
  },
  // ── AgID ───────────────────────────────────────────────────────────────────
  AGID_SW_SICURO: {
    regulation: "AGID_SW_SICURO", lang: "IT", jurisdiction: "IT", validFrom: "2017-01-01",
    title: "AgID - Linee guida sviluppo del software sicuro (allegati 1, 2 e 3)",
    cite: "AgID, Linee guida sviluppo del software sicuro",
    sourceUrl: "https://www.agid.gov.it/it/sicurezza/cert-pa/linee-guida-sviluppo-del-software-sicuro",
    parts: [
      { url: "https://www.agid.gov.it/sites/default/files/repository_files/allegato_1-_linee_guida_per_ladozione_di_un_ciclo_di_sviluppo_di_software_sicuro.pdf", kind: "pdf", label: "Allegato 1, ciclo di sviluppo sicuro" },
      { url: "https://www.agid.gov.it/sites/default/files/repository_files/allegato_2_-_linee_guida_per_lo_sviluppo_sicuro_di_codice.pdf", kind: "pdf", label: "Allegato 2, sviluppo sicuro di codice" },
      { url: "https://www.agid.gov.it/sites/default/files/repository_files/allegato_3_-_linee_guida_per_la_configurazione_per_adeguare_la_sicurezza_del_software_di_base.pdf", kind: "pdf", label: "Allegato 3, configurazione del software di base" },
    ],
  },
  AGID_MISURE_MINIME: {
    regulation: "AGID_MISURE_MINIME", lang: "IT", jurisdiction: "IT", validFrom: "2017-04-18",
    title: "AgID - Misure minime di sicurezza ICT per le pubbliche amministrazioni (circolare 2/2017)",
    cite: "AgID, Misure minime di sicurezza ICT",
    sourceUrl: "https://www.agid.gov.it/it/sicurezza/misure-minime-sicurezza-ict",
    parts: [{ url: "https://cert-agid.gov.it/download/CircolareAgID_170418_n_2_2017_Mis_minime_sicurezza_ICT_PA-GU-103-050517-2.pdf", kind: "pdf" }],
  },
  AGID_ACC_SERVIZI: {
    regulation: "AGID_ACC_SERVIZI", lang: "IT", jurisdiction: "IT", validFrom: "2026-03-12",
    title: "AgID - Linee guida sui requisiti di accessibilità dei servizi (European Accessibility Act, D.Lgs. 82/2022)",
    cite: "AgID, Linee guida accessibilità dei servizi (EAA)",
    sourceUrl: "https://www.agid.gov.it/sites/agid/files/2026-03/Linee_Guida_accessibilit%C3%A0_dei_servizi_%28EAA%29.pdf",
    parts: [{ url: "https://www.agid.gov.it/sites/agid/files/2026-03/Linee_Guida_accessibilit%C3%A0_dei_servizi_%28EAA%29.pdf", kind: "pdf" }],
  },
  AGID_ACC_PA: {
    regulation: "AGID_ACC_PA", lang: "IT", jurisdiction: "IT", validFrom: "2022-12-21",
    title: "AgID - Linee guida sull'accessibilità degli strumenti informatici (Legge Stanca)",
    cite: "AgID, Linee guida accessibilità strumenti informatici",
    sourceUrl: "https://www.agid.gov.it/it/design-servizi/accessibilita/linee-guida-accessibilita-pa",
    parts: [{ url: "https://www.agid.gov.it/sites/default/files/repository_files/linee_guida_accessibilita_versione_rettifica_del_21_dic_2022_rev_rscc.pdf", kind: "pdf" }],
  },
  // ── ACN ────────────────────────────────────────────────────────────────────
  ACN_NIS_BASE: {
    regulation: "ACN_NIS_BASE", lang: "IT", jurisdiction: "IT", validFrom: "2025-11-01",
    title: "ACN - Determinazione obblighi di base NIS e specifiche di base (Determinazione ACN, allegati 1-4)",
    cite: "ACN, Specifiche di base NIS",
    sourceUrl: "https://www.acn.gov.it/portale/nis/modalita-specifiche-base",
    parts: [
      { url: "https://www.acn.gov.it/portale/documents/d/guest/detacn_obblighi_2511-v3_signed", kind: "pdf", label: "Determinazione" },
      { url: "https://www.acn.gov.it/portale/documents/d/guest/allegato-1-v2", kind: "pdf", label: "Allegato 1" },
      { url: "https://www.acn.gov.it/portale/documents/d/guest/allegato-2-v2", kind: "pdf", label: "Allegato 2" },
      { url: "https://www.acn.gov.it/portale/documents/d/guest/allegato-3-v2", kind: "pdf", label: "Allegato 3" },
      { url: "https://www.acn.gov.it/portale/documents/d/guest/allegato-4-v2", kind: "pdf", label: "Allegato 4" },
      { url: "https://www.acn.gov.it/portale/documents/d/guest/guida-alla-lettura-specifiche-di-base", kind: "pdf", label: "Guida alla lettura" },
    ],
  },
  // ── Standard tecnici aperti ────────────────────────────────────────────────
  OWASP_ASVS: {
    regulation: "OWASP_ASVS", lang: "EN", jurisdiction: "INT", validFrom: "2025-05-30",
    title: "OWASP ASVS 5.0 - Application Security Verification Standard (sicurezza applicazioni)",
    cite: "OWASP ASVS 5.0",
    sourceUrl: "https://github.com/OWASP/ASVS/tree/master/5.0/en",
    parts: [
      "0x03-What-is-the-ASVS.md", "0x10-V1-Encoding-and-Sanitization.md", "0x11-V2-Validation-and-Business-Logic.md",
      "0x12-V3-Web-Frontend-Security.md", "0x13-V4-API-and-Web-Service.md", "0x14-V5-File-Handling.md",
      "0x15-V6-Authentication.md", "0x16-V7-Session-Management.md", "0x17-V8-Authorization.md",
      "0x18-V9-Self-contained-Tokens.md", "0x19-V10-OAuth-and-OIDC.md", "0x20-V11-Cryptography.md",
      "0x21-V12-Secure-Communication.md", "0x22-V13-Configuration.md", "0x23-V14-Data-Protection.md",
      "0x24-V15-Secure-Coding-and-Architecture.md", "0x25-V16-Security-Logging-and-Error-Handling.md",
      "0x26-V17-WebRTC.md", "0x92-Appendix-C_Cryptography.md",
    ].map(ASVS),
  },
  WCAG22: {
    regulation: "WCAG22", lang: "EN", jurisdiction: "INT", validFrom: "2023-10-05",
    title: "W3C WCAG 2.2 - Web Content Accessibility Guidelines (accessibilità)",
    cite: "WCAG 2.2",
    sourceUrl: "https://www.w3.org/TR/WCAG22/",
    parts: [{ url: "https://www.w3.org/TR/WCAG22/", kind: "html" }],
  },
  OSS_LICENSES: {
    regulation: "OSS_LICENSES", lang: "EN", jurisdiction: "INT", validFrom: "2007-06-29",
    title: "Licenze open source - testi ufficiali GPL, AGPL, LGPL, MPL, Apache, MIT (SPDX)",
    cite: "Licenza",
    sourceUrl: "https://spdx.org/licenses/",
    parts: ["GPL-3.0-only", "GPL-2.0-only", "AGPL-3.0-only", "LGPL-3.0-only", "LGPL-2.1-only", "MPL-2.0", "Apache-2.0", "MIT", "BSD-3-Clause", "EUPL-1.2"].map(SPDX),
  },
  // ── Leggi italiane (testo XML Akoma Ntoso fornito dall'amministratore) ─────
  CODICE_PRIVACY: {
    regulation: "CODICE_PRIVACY", lang: "IT", jurisdiction: "IT", validFrom: "2018-09-19",
    title: "Codice privacy - D.Lgs. 196/2003 (Codice in materia di protezione dei dati personali)",
    cite: "Codice privacy", sourceUrl: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2003-06-30;196", parts: [NMD("Codici/2003-07-29_003G0218_VIGENZA_2026-03-03_V0.md")],
  },
  STATUTO_LAVORATORI: {
    regulation: "STATUTO_LAVORATORI", lang: "IT", jurisdiction: "IT", validFrom: "1970-05-20",
    title: "Statuto dei lavoratori - L. 300/1970", cite: "L. 300/1970",
    sourceUrl: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1970-05-20;300", parts: [],
  },
  LEGGE_IA: {
    regulation: "LEGGE_IA", lang: "IT", jurisdiction: "IT", validFrom: "2025-10-10",
    title: "Legge sull'intelligenza artificiale - L. 132/2025", cite: "L. 132/2025",
    sourceUrl: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2025-09-23;132", parts: [],
  },
  DLGS_138_2024: {
    regulation: "DLGS_138_2024", lang: "IT", jurisdiction: "IT", validFrom: "2024-10-16",
    title: "D.Lgs. 138/2024 - Recepimento Direttiva NIS2", cite: "D.Lgs. 138/2024",
    sourceUrl: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2024-09-04;138", parts: [NMD("Decreti Legislativi/2024-10-01_24G00155_ORIGINALE_V0.md")],
  },
  DLGS_82_2022: {
    regulation: "DLGS_82_2022", lang: "IT", jurisdiction: "IT", validFrom: "2022-07-01",
    title: "D.Lgs. 82/2022 - Recepimento European Accessibility Act (accessibilità)", cite: "D.Lgs. 82/2022",
    sourceUrl: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2022-05-27;82", parts: [NMD("Atti di recepimento direttive UE/2022-07-01_22G00089_VIGENZA_2026-02-12_V0.md")],
  },
  LEGGE_STANCA: {
    regulation: "LEGGE_STANCA", lang: "IT", jurisdiction: "IT", validFrom: "2004-01-09",
    title: "Legge Stanca - L. 4/2004 (accessibilità degli strumenti informatici)", cite: "L. 4/2004",
    sourceUrl: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2004-01-09;4", parts: [],
  },
  CAD: {
    regulation: "CAD", lang: "IT", jurisdiction: "IT", validFrom: "2005-03-07",
    title: "CAD - Codice dell'amministrazione digitale, D.Lgs. 82/2005", cite: "CAD",
    sourceUrl: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-03-07;82", parts: [NMD("Codici/2005-05-16_005G0104_VIGENZA_2026-05-09_V0.md")],
  },
  CODICE_CONSUMO: {
    regulation: "CODICE_CONSUMO", lang: "IT", jurisdiction: "IT", validFrom: "2005-09-06",
    title: "Codice del consumo - D.Lgs. 206/2005", cite: "Codice del consumo",
    sourceUrl: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-09-06;206", parts: [NMD("Codici/2005-10-08_005G0232_VIGENZA_2026-06-19_V0.md")],
  },
  // Il D.Lgs. 218/2017 recepisce la PSD2 modificando altri atti: il testo da consultare è il
  // D.Lgs. 11/2010 vigente, che contiene le regole sui servizi di pagamento così modificate.
  DLGS_11_2010: {
    regulation: "DLGS_11_2010", lang: "IT", jurisdiction: "IT", validFrom: "2018-01-13",
    title: "D.Lgs. 11/2010 - Servizi di pagamento (recepimento PSD2, come modificato dal D.Lgs. 218/2017)", cite: "D.Lgs. 11/2010",
    sourceUrl: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2010-01-27;11", parts: [NMD("Atti di recepimento direttive UE/2010-02-13_010G0027_VIGENZA_2025-06-12_V0.md")],
  },
  PERIMETRO_CYBER: {
    regulation: "PERIMETRO_CYBER", lang: "IT", jurisdiction: "IT", validFrom: "2019-11-20",
    title: "Perimetro di sicurezza nazionale cibernetica - DL 105/2019 convertito dalla L. 133/2019", cite: "DL 105/2019",
    sourceUrl: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legge:2019-09-21;105", parts: [],
  },
  LEGGE_90_2024: {
    regulation: "LEGGE_90_2024", lang: "IT", jurisdiction: "IT", validFrom: "2024-07-17",
    title: "Legge 90/2024 - Disposizioni in materia di rafforzamento della cybersicurezza nazionale", cite: "L. 90/2024",
    sourceUrl: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2024-06-28;90", parts: [],
  },
  WHISTLEBLOWING: {
    regulation: "WHISTLEBLOWING", lang: "IT", jurisdiction: "IT", validFrom: "2023-03-30",
    title: "Whistleblowing - D.Lgs. 24/2023", cite: "D.Lgs. 24/2023",
    sourceUrl: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2023-03-10;24", parts: [NMD("Atti di recepimento direttive UE/2023-03-15_23G00032_VIGENZA_2026-02-12_V0.md")],
  },
  DLGS_160_2026: {
    regulation: "DLGS_160_2026", lang: "IT", jurisdiction: "IT", validFrom: "2026-09-16",
    title: "D.Lgs. 160/2026 - Adeguamento all'AI Act: intelligenza artificiale per attività di polizia e responsabilità civile e penale",
    cite: "D.Lgs. 160/2026",
    sourceUrl: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2026-09-09;160",
    parts: [NMD("Decreti Legislativi/2026-09-15_26G00179_ORIGINALE_V0.md")],
  },
  LEGGE_AUTORE: {
    regulation: "LEGGE_AUTORE", lang: "IT", jurisdiction: "IT", validFrom: "1941-04-22",
    title: "Legge sul diritto d'autore - L. 633/1941 (programmi per elaboratore)", cite: "L. 633/1941",
    sourceUrl: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1941-04-22;633", parts: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Estrazione del testo
// ─────────────────────────────────────────────────────────────────────────────

interface Block { heading: string | null; text: string; page?: number }

// Postgres rifiuta il carattere nullo e alcuni PDF contengono caratteri di controllo o surrogati
// spaiati: vanno tolti prima di salvare.
function cleanText(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, " ");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/&acute;|&#180;/g, "'").replace(/&rsquo;|&lsquo;/g, "'").replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&agrave;/g, "à").replace(/&egrave;/g, "è").replace(/&eacute;/g, "é").replace(/&igrave;/g, "ì")
    .replace(/&ograve;/g, "ò").replace(/&ugrave;/g, "ù").replace(/&Egrave;/g, "È").replace(/&deg;/g, "°")
    .replace(/&ndash;/g, "-").replace(/&mdash;/g, "-").replace(/&hellip;/g, "...").replace(/&euro;/g, "€")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

/** HTML -> righe di testo con i titoli marcati come "# ". */
function htmlToLines(html: string): string[] {
  let s = html;
  s = s.replace(/<(script|style|noscript|nav|header|footer|form|svg)\b[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, _l, inner) => `\n\n# ${inner.replace(/<[^>]+>/g, " ")}\n\n`);
  s = s.replace(/<li\b[^>]*>/gi, "\n- ");
  s = s.replace(/<(br|\/p|\/div|\/li|\/tr|\/dt|\/dd|\/section|\/table)\b[^>]*>/gi, "\n");
  s = s.replace(/<\/t[dh]>/gi, " | ");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  return s.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).filter((l) => l.length > 0);
}

function linesToBlocks(lines: string[], isHeading: (l: string) => string | null): Block[] {
  const blocks: Block[] = [];
  let heading: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    const text = cleanText(buf.join("\n")).trim();
    if (text.length >= 40) blocks.push({ heading, text });
    buf = [];
  };
  for (const l of lines) {
    const h = isHeading(l);
    // Il titolo apre un nuovo blocco ma resta anche nel testo: nulla del documento va perso e
    // le citazioni restano verificabili parola per parola.
    if (h) { flush(); heading = h.slice(0, 200); buf.push(h); continue; }
    buf.push(l);
  }
  flush();
  return blocks;
}

const markdownHeading = (l: string): string | null => {
  const m = /^#{1,6}\s+(.+)$/.exec(l);
  return m ? m[1].replace(/[*_`]/g, "").trim() : null;
};

// Titoli nei PDF e nei provvedimenti: numerazione a più livelli ("3.2 Titolo"), numero seguito da
// titolo in maiuscolo ("2 ANALISI"), rubriche ("Articolo 5", "ALLEGATO 2") o righe tutte maiuscole.
// Non sono titoli i paragrafi numerati ("29. Il RGPD adotta...") né le note a piè di pagina
// ("12 Gruppo di lavoro..., «Linee guida»"), che iniziano allo stesso modo ma sono frasi.
const pdfHeading = (l: string): string | null => {
  const t = l.trim();
  if (t.length < 3 || t.length > 110) return null;
  if (/^\d+(\.\d+)+\.?\s+[A-ZÀ-Ýa-zà-ý]/.test(t) && !/[.;«»“”]$/.test(t) && !/[«»“”]/.test(t)) return t;
  if (/[«»“”,;]/.test(t) && !/^(Articolo|Art\.|ALLEGATO|Allegato)\b/.test(t)) return null;
  if (/^\d+\.?\s+[A-ZÀ-Ý][A-ZÀ-Ý'’ ]{3,}/.test(t)) return t;
  if (/^\d+\.\s+[A-ZÀ-Ý][^.:]{2,65}$/.test(t)) return t;
  if (/^(Articolo|Art\.|ALLEGATO|Allegato|CAPO|Capo|SEZIONE|Sezione|PARTE|Parte|Annex|ANNEX|Chapter|CHAPTER)\s+[0-9IVXLA-Z]/.test(t) && t.length < 100) return t;
  if (/^[A-ZÀ-Ý0-9 '’()\-]{6,90}$/.test(t) && /[A-ZÀ-Ý]{4}/.test(t)) return t;
  return null;
};

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (RegBrain ingestion)" }, signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return await res.text();
}

async function fetchPdfPages(url: string, from: number, to: number): Promise<{ total: number; pages: Array<{ n: number; text: string }> }> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (RegBrain ingestion)" }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
  const total = pdf.numPages;
  const pages: Array<{ n: number; text: string }> = [];
  for (let n = from; n <= Math.min(to, total); n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    // Ricompone le righe: un elemento con hasEOL chiude la riga.
    let line = "";
    const lines: string[] = [];
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      line += item.str ?? "";
      if (item.hasEOL) { lines.push(line); line = ""; }
    }
    if (line) lines.push(line);
    pages.push({ n, text: lines.map((l) => cleanText(l).replace(/\s+/g, " ").trim()).filter(Boolean).join("\n") });
  }
  return { total, pages };
}

/** Akoma Ntoso (Normattiva): un'unità per comma, o per articolo se non ha commi. */
function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let cur = "";
  for (const sentence of text.split(/(?<=[.;:])\s+(?=[«"a-zA-Z0-9(])/)) {
    if (cur.length + sentence.length + 1 > max && cur.length > 200) { out.push(cur); cur = ""; }
    cur += (cur ? " " : "") + sentence;
    while (cur.length > max * 1.5) { out.push(cur.slice(0, max)); cur = cur.slice(max); }
  }
  if (cur) out.push(cur);
  return out;
}

function aknToUnits(xml: string, spec: SourceSpec, key: string): Unit[] {
  const units: Unit[] = [];
  const strip = (f: string) => cleanText(decodeEntities(f.replace(/<(authorialNote|note|ref)\b[^>]*>([\s\S]*?)<\/\1>/g, (_m, tag, inner) => tag === "ref" ? inner : "").replace(/<[^>]+>/g, " "))).replace(/\s+/g, " ").trim();
  const artRe = /<article\b([^>]*)>([\s\S]*?)<\/article>/g;
  // Capo, titolo o sezione in cui si trova l'articolo: l'ultima intestazione che lo precede.
  const chapters = [...xml.matchAll(/<(chapter|title|section|part)\b[^>]*>\s*(?:<num\b[^>]*>([\s\S]*?)<\/num>\s*)?<heading\b[^>]*>([\s\S]*?)<\/heading>/g)]
    .map((c) => ({ at: c.index ?? 0, text: strip(`${c[2] ? c[2] + " " : ""}${c[3]}`).slice(0, 200) }));
  for (const m of xml.matchAll(artRe)) {
    const inner = m[2];
    const chapter = chapters.filter((c) => c.at < (m.index ?? 0)).pop()?.text || null;
    const numRaw = strip((/<num\b[^>]*>([\s\S]*?)<\/num>/.exec(inner) || [])[1] || "");
    const heading = strip((/<heading\b[^>]*>([\s\S]*?)<\/heading>/.exec(inner) || [])[1] || "");
    const artNumMatch = /(\d+)(?:[-\s]*(bis|ter|quater|quinquies|sexies|septies|octies|novies|decies|undecies|duodecies|terdecies|quaterdecies|quinquiesdecies|sexiesdecies))?/i.exec(numRaw);
    if (!artNumMatch) continue;
    const artLabel = artNumMatch[2] ? `${artNumMatch[1]}-${artNumMatch[2].toLowerCase()}` : artNumMatch[1];
    const artNumber = artNumMatch[2] ? null : parseInt(artNumMatch[1], 10);
    const header = `${spec.cite}, art. ${artLabel}${heading ? ` (${heading})` : ""}`;
    const paras = [...inner.matchAll(/<paragraph\b[^>]*>([\s\S]*?)<\/paragraph>/g)];
    if (paras.length === 0) {
      const text = strip(inner.replace(/<num\b[^>]*>[\s\S]*?<\/num>/, "").replace(/<heading\b[^>]*>[\s\S]*?<\/heading>/, ""));
      if (text.length < 15) continue;
      units.push({ chunk_key: `web:${key}:art${artLabel}`, citation_label: `${spec.cite}, art. ${artLabel}`, context_header: `[${header}]`, unit_type: "articolo", article_number: artNumber, article_reference: `Art. ${artLabel}`, paragraph: null, section_hierarchy: chapter || heading || null, text });
      continue;
    }
    for (const p of paras) {
      const pNum = strip((/<num\b[^>]*>([\s\S]*?)<\/num>/.exec(p[1]) || [])[1] || "").replace(/\.$/, "");
      const body = strip(p[1].replace(/<num\b[^>]*>[\s\S]*?<\/num>/, ""));
      if (body.length < 15) continue;
      const par = pNum || String(paras.indexOf(p) + 1);
      // I commi che modificano altre leggi possono superare i 10.000 caratteri: si spezzano
      // ai confini di frase, come per gli altri formati, perché l'embedding legge 8.000 caratteri.
      const pieces = splitLong(`${par}. ${body}`, 1800);
      pieces.forEach((piece, i) => {
        const suffix = pieces.length > 1 ? ` (parte ${i + 1}/${pieces.length})` : "";
        units.push({ chunk_key: `web:${key}:art${artLabel}:c${par.replace(/\s+/g, "")}${pieces.length > 1 ? `:p${i + 1}` : ""}`, citation_label: `${spec.cite}, art. ${artLabel}, comma ${par}${suffix}`, context_header: `[${header}. Comma ${par}${suffix ? `. Parte ${i + 1}/${pieces.length}` : ""}]`, unit_type: "paragrafo", article_number: artNumber, article_reference: `Art. ${artLabel}`, paragraph: par, section_hierarchy: chapter || heading || null, text: piece });
      });
    }
  }
  return units;
}

/** Markdown di italia-corpus: "### Art. N." per articolo, commi come paragrafi che iniziano con "N.". */
function nmdToUnits(md: string, spec: SourceSpec, key: string): Unit[] {
  const clean = (t: string) => cleanText(t)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\(\(|\)\)/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  const body = md.replace(/^---[\s\S]*?---\s*/, "");
  const units: Unit[] = [];
  let section: string | null = null;
  const blocks = body.split(/\n(?=#{2,3} )/);
  for (const block of blocks) {
    const firstLine = block.split("\n", 1)[0];
    // Alcuni atti hanno gli articoli al secondo livello ("## Art. 1."), altri al terzo sotto i capi.
    if (/^## /.test(firstLine) && !/^## Art\./.test(firstLine)) { section = clean(firstLine.replace(/^## /, "")).slice(0, 200); }
    const artHead = /^#{2,3} Art\.\s*([0-9]+(?:[-.][a-z]+(?:[-.][a-z0-9]+)?)?)\.?\s*(?:—\s*(.*))?$/i.exec(firstLine);
    if (!artHead) continue;
    const label = artHead[1].replace(/\.$/, "");
    const artNumber = /^\d+$/.test(label) ? parseInt(label, 10) : null;
    const tidy = (r: string) => r.replace(/^[\s(]+|[\s).]+$/g, "").trim();
    let rubrica = artHead[2] ? tidy(clean(artHead[2])) : "";
    const paras = block.split("\n").slice(1).join("\n").split(/\n\s*\n/).map((p) => clean(p)).filter(Boolean);
    if (!rubrica && paras.length && /^\(.*\)\.?$/.test(paras[0])) rubrica = tidy(paras.shift()!);
    const header = `${spec.cite}, art. ${label}${rubrica ? ` (${rubrica.slice(0, 160)})` : ""}`;
    // Raggruppa i paragrafi per comma: "1." da solo o all'inizio del paragrafo apre un comma.
    const commi: Array<{ n: string | null; text: string[] }> = [];
    for (const p of paras) {
      const m = /^(\d+(?:-[a-z]+)?)\.(?:\s+([\s\S]*))?$/.exec(p);
      if (m && (m[2] === undefined || m[2].length > 0 || true)) {
        commi.push({ n: m[1], text: m[2] ? [m[2]] : [] });
      } else if (commi.length) commi[commi.length - 1].text.push(p);
      else commi.push({ n: null, text: [p] });
    }
    const nonEmpty = commi.filter((c) => c.text.join(" ").length >= 15);
    if (nonEmpty.length === 0) continue;
    const onlyOne = nonEmpty.length === 1 && nonEmpty[0].n === null;
    for (const c of nonEmpty) {
      const text = (c.n ? `${c.n}. ` : "") + c.text.join("\n");
      const pieces: string[] = [];
      let cur = "";
      for (const line of text.split("\n")) {
        if (cur.length + line.length + 1 > 1800 && cur.length > 200) { pieces.push(cur); cur = ""; }
        cur += (cur ? "\n" : "") + line;
      }
      if (cur) pieces.push(cur);
      pieces.forEach((piece, i) => {
        const suffix = pieces.length > 1 ? ` (parte ${i + 1}/${pieces.length})` : "";
        const commaKey = c.n ? `:c${c.n}` : "";
        units.push({
          chunk_key: `web:${key}:art${label}${commaKey}${pieces.length > 1 ? `:p${i + 1}` : ""}`,
          citation_label: `${spec.cite}, art. ${label}${c.n && !onlyOne ? `, comma ${c.n}` : ""}${suffix}`,
          context_header: `[${header}${c.n ? `. Comma ${c.n}` : ""}${suffix ? `. Parte ${i + 1}/${pieces.length}` : ""}]`,
          unit_type: c.n ? "paragrafo" : "articolo",
          article_number: artNumber,
          article_reference: `Art. ${label}`,
          paragraph: c.n,
          section_hierarchy: section,
          text: piece,
        });
      });
    }
  }
  // Chiavi univoche anche se il testo ripete un numero di comma nello stesso articolo.
  const seen = new Map<string, number>();
  for (const u of units) {
    const n = (seen.get(u.chunk_key) || 0) + 1;
    seen.set(u.chunk_key, n);
    if (n > 1) u.chunk_key = `${u.chunk_key}:d${n}`;
  }
  return units;
}

interface Unit {
  chunk_key: string;
  citation_label: string;
  context_header: string;
  unit_type: string;
  article_number: number | null;
  article_reference: string | null;
  paragraph: string | null;
  section_hierarchy: string | null;
  text: string;
}

function blocksToUnits(blocks: Block[], spec: SourceSpec, key: string, partIdx: number, partLabel: string | undefined): Unit[] {
  const units: Unit[] = [];
  let n = 0;
  const MAX = 1800;
  for (const b of blocks) {
    // Spezza i blocchi lunghi ai confini di riga.
    const pieces: string[] = [];
    let cur = "";
    for (const line of b.text.split("\n")) {
      if (cur.length + line.length + 1 > MAX && cur.length > 200) { pieces.push(cur); cur = ""; }
      cur += (cur ? "\n" : "") + line;
    }
    if (cur.trim().length >= 40) pieces.push(cur);
    for (const text of pieces) {
      n++;
      const where = [partLabel, b.heading, b.page ? `p. ${b.page}` : null].filter(Boolean).join(", ");
      units.push({
        chunk_key: `web:${key}:part${partIdx}:${b.page ? `pg${b.page}:` : ""}s${n}`,
        citation_label: `${spec.cite}${where ? `, ${where}` : ""}`,
        context_header: `[${spec.cite}${partLabel ? `. ${partLabel}` : ""}${b.heading ? `. ${b.heading}` : ""}${b.page ? `. Pagina ${b.page}` : ""}]`,
        unit_type: "sezione",
        article_number: null,
        article_reference: b.heading,
        paragraph: null,
        section_hierarchy: [partLabel, b.heading].filter(Boolean).join(" > ") || null,
        text,
      });
    }
  }
  return units;
}

async function embedBatch(key: string, inputs: string[]): Promise<Array<number[] | null>> {
  const texts = inputs.map((t) => t.substring(0, 8000));
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await embedTexts(key, texts, "RETRIEVAL_DOCUMENT");
    } catch (e) {
      console.warn(`[embed] tentativo ${attempt + 1} fallito: ${e instanceof Error ? e.message : String(e)}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  return texts.map(() => null);
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST richiesto" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  let authorized = await isServiceRequest(req, configuredServiceKeys((name) => Deno.env.get(name)));
  if (!authorized) {
    const bearer = req.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
    const { data: { user } } = await admin.auth.getUser(bearer);
    if (user) {
      const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      authorized = !!roleRow;
    }
  }
  if (!authorized) return json({ error: "Accesso riservato agli amministratori" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "JSON non valido" }, 400); }
  const key = String(body?.source ?? "").toUpperCase();
  const spec = SOURCES[key];
  if (!spec) return json({ error: `Fonte non in catalogo: ${key}`, available: Object.keys(SOURCES) }, 400);
  const part = Math.max(0, Number(body.part ?? 0) | 0);
  const offset = Math.max(0, Number(body.offset ?? 0) | 0);
  const limit = Math.min(Math.max(1, Number(body.limit ?? 60) | 0), 200);
  const dryRun = body.dryRun === true;
  const reset = body.reset === true;

  try {
    const started = Date.now();
    let units: Unit[] = [];
    let partsTotal = spec.parts.length;
    let pdfPagesTotal: number | null = null;
    let nextPart: number | null = null;
    let nextOffset: number | null = null;

    if (typeof body.content === "string" && body.content.length > 0) {
      // Testo fornito dall'amministratore.
      const ct = String(body.contentType ?? "akn");
      partsTotal = 1;
      if (ct === "akn") units = aknToUnits(body.content, spec, key);
      else if (ct === "nmd") units = nmdToUnits(body.content, spec, key);
      else if (ct === "markdown") units = blocksToUnits(linesToBlocks(body.content.split("\n").map((l: string) => l.trim()).filter(Boolean), markdownHeading), spec, key, 0, undefined);
      else units = blocksToUnits(linesToBlocks(body.content.split("\n").map((l: string) => l.trim()).filter(Boolean), pdfHeading), spec, key, 0, undefined);
      const slice = units.slice(offset, offset + limit);
      nextOffset = offset + slice.length < units.length ? offset + slice.length : null;
      units = slice;
    } else {
      const p = spec.parts[part];
      if (!p) return json({ error: `Parte ${part} inesistente o fonte da caricare a mano (${spec.sourceUrl})` }, 400);
      if (p.kind === "pdf") {
        const from = offset + 1;
        const to = offset + Math.min(limit, 12);
        const { total, pages } = await fetchPdfPages(p.url!, from, to);
        pdfPagesTotal = total;
        const blocks: Block[] = [];
        for (const pg of pages) {
          for (const b of linesToBlocks(pg.text.split("\n"), pdfHeading)) blocks.push({ ...b, page: pg.n });
        }
        units = blocksToUnits(blocks, spec, key, part, p.label);
        if (to < total) nextOffset = to;
        else if (part + 1 < spec.parts.length) nextPart = part + 1;
      } else {
        const raw = await fetchText(p.url!);
        if (p.kind === "nmd") {
          const all = nmdToUnits(raw, spec, key);
          units = all.slice(offset, offset + limit);
          if (offset + units.length < all.length) nextOffset = offset + units.length;
          else if (part + 1 < spec.parts.length) nextPart = part + 1;
        } else {
        let lines: string[];
        let isHeading = markdownHeading;
        if (p.kind === "garante") {
          const a = raw.indexOf('<div class="testo pb-4">');
          const b = raw.indexOf("<!-- COLONNA DI DESTRA -->", a);
          lines = htmlToLines(a >= 0 ? raw.slice(a, b > a ? b : undefined) : raw);
          // I provvedimenti del Garante non hanno titoli HTML: si usano come titoli le righe
          // brevi numerate o in maiuscolo (es. "1. Premessa", "CONSIDERATO").
          isHeading = (l: string) => markdownHeading(l) ?? pdfHeading(l);
        } else if (p.kind === "html") {
          const m = /<main\b[\s\S]*?<\/main>/i.exec(raw) || /<body\b[\s\S]*<\/body>/i.exec(raw);
          lines = htmlToLines(m ? m[0] : raw);
        } else if (p.kind === "markdown") {
          lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
        } else {
          lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
          isHeading = () => null;
        }
        let blocks = linesToBlocks(lines, isHeading);
        if (p.kind === "text" && p.label) blocks = blocks.map((b) => ({ ...b, heading: p.label! }));
        const all = blocksToUnits(blocks, spec, key, part, p.label);
        units = all.slice(offset, offset + limit);
        if (offset + units.length < all.length) nextOffset = offset + units.length;
        else if (part + 1 < spec.parts.length) nextPart = part + 1;
        }
      }
    }

    if (dryRun) {
      return json({ success: true, dryRun: true, source: key, part, partsTotal, pdfPagesTotal, units: units.length, nextPart, nextOffset,
        sample: units.slice(0, 5).map((u) => ({ chunk_key: u.chunk_key, citation_label: u.citation_label, chars: u.text.length, preview: u.text.slice(0, 400) })) });
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return json({ error: "GEMINI_API_KEY mancante" }, 503);

    let documentId: string;
    const { data: existingDoc } = await admin.from("documents").select("id").eq("title", spec.title).maybeSingle();
    if (existingDoc) documentId = existingDoc.id;
    else {
      const { data: newDoc, error: docErr } = await admin.from("documents").insert({
        title: spec.title, source_url: spec.sourceUrl, jurisdiction: spec.jurisdiction === "INT" ? "EU" : spec.jurisdiction,
        sector: "All", language: spec.lang.toLowerCase(), version: spec.validFrom, is_public: true,
      }).select("id").single();
      if (docErr) throw docErr;
      documentId = newDoc.id;
    }
    if (reset && part === 0 && offset === 0) {
      const { error: e1 } = await admin.from("structured_chunks").delete().eq("document_id", documentId);
      if (e1) throw e1;
      const { error: e2 } = await admin.from("chunks").delete().eq("document_id", documentId);
      if (e2) throw e2;
    }

    const vectors: Array<number[] | null> = [];
    for (let i = 0; i < units.length; i += 20) {
      vectors.push(...await embedBatch(geminiKey, units.slice(i, i + 20).map((u) => `${u.context_header}\n${u.text}`)));
    }
    const base = part * 1_000_000 + offset * 1000;
    const structuredRows: Record<string, unknown>[] = [];
    const mirrorRows: Record<string, unknown>[] = [];
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const embedding = vectors[i] ? JSON.stringify(vectors[i]) : null;
      const embeddingModel = vectors[i] ? `${EMBEDDING_MODEL}:RETRIEVAL_DOCUMENT:768` : null;
      structuredRows.push({
        document_id: documentId, regulation: spec.regulation, article_reference: u.article_reference, article_number: u.article_number,
        paragraph: u.paragraph, letter: null, citation_label: u.citation_label, chunk_key: u.chunk_key,
        content_hash: `sha256:${await sha256(u.text)}`, context_header: u.context_header, unit_type: u.unit_type,
        celex: null, lang: spec.lang, valid_from: spec.validFrom, valid_to: null,
        source_format: typeof body.content === "string" ? String(body.contentType ?? "akn") : spec.parts[part]?.kind ?? "text",
        section_hierarchy: u.section_hierarchy, chunk_text: u.text, cross_references: [], is_obligation: false,
        embedding, embedding_model: embeddingModel,
      });
      mirrorRows.push({ document_id: documentId, content: `${u.context_header}\n${u.text}`, start_pos: base + i * 10, end_pos: base + i * 10 + 9, embedding, embedding_model: embeddingModel });
    }
    let inserted = 0;
    if (structuredRows.length > 0) {
      const { error: delErr } = await admin.from("structured_chunks").delete().in("chunk_key", structuredRows.map((r) => r.chunk_key as string));
      if (delErr) throw delErr;
      const { error: delMirrorErr } = await admin.from("chunks").delete().eq("document_id", documentId).in("start_pos", mirrorRows.map((r) => r.start_pos as number));
      if (delMirrorErr) throw delMirrorErr;
      for (let i = 0; i < structuredRows.length; i += 20) {
        const { error } = await admin.from("structured_chunks").insert(structuredRows.slice(i, i + 20));
        if (error) throw error;
        const { error: mirrorError } = await admin.from("chunks").insert(mirrorRows.slice(i, i + 20));
        if (mirrorError) throw mirrorError;
        inserted += Math.min(20, structuredRows.length - i);
      }
    }
    const done = nextOffset === null && nextPart === null;
    if (done) {
      const { error: reindexError } = await admin.rpc("rebuild_embedding_indexes");
      if (reindexError) console.warn("[web] ricostruzione indici fallita:", reindexError.message);
    }
    return json({ success: true, source: key, documentId, part, partsTotal, pdfPagesTotal, offset, inserted,
      embedded: vectors.filter(Boolean).length, nextPart, nextOffset, done, ms: Date.now() - started });
  } catch (e) {
    const message = e instanceof Error ? e.message
      : (e && typeof e === "object" && "message" in e) ? String((e as { message: unknown }).message)
      : JSON.stringify(e);
    console.error("[web] errore", message);
    return json({ error: message }, 500);
  }
});
