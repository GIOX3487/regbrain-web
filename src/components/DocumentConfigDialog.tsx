import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ConfigDocumentType = "dpia" | "risk_analysis" | "ropa" | "lia";

export interface DocumentConfig {
  company_name: string;
  company_legal_form?: string;
  company_address: string;
  company_pec: string;
  company_email: string;
  company_phone?: string;
  company_vat?: string;
  legal_rep_name: string;
  legal_rep_role: string;
  dpo_name?: string;
  dpo_email?: string;
  dpo_phone?: string;
  reporter_name: string;
  reporter_role: string;
  company_sector?: string;
  company_jurisdiction?: string;
  num_employees?: number;
  document_specific: Record<string, any>;
}

interface DocumentConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: ConfigDocumentType | null;
  assessment: any;
  gaps: any[];
  onGenerate: (config: DocumentConfig) => Promise<void>;
}

const titles: Record<ConfigDocumentType, { title: string; description: string }> = {
  dpia: { title: "Configura DPIA", description: "Inserisci i dati del trattamento ad alto rischio da valutare." },
  risk_analysis: { title: "Configura Analisi Rischi Art. 24", description: "Completa i dati organizzativi e metodologici per l'analisi complessiva." },
  ropa: { title: "Configura RoPA", description: "Definisci titolare, trattamenti e impostazioni del registro Art. 30 GDPR." },
  lia: { title: "Configura LIA", description: "Descrivi il trattamento basato su legittimo interesse e le garanzie adottate." },
};

const emptyConfig: DocumentConfig = {
  company_name: "",
  company_address: "",
  company_pec: "",
  company_email: "",
  legal_rep_name: "",
  legal_rep_role: "Legale rappresentante",
  reporter_name: "",
  reporter_role: "Responsabile compliance",
  document_specific: {},
};

const multiOptions = {
  processing_categories: ["anagrafici", "contatto", "finanziari", "sanitari", "biometrici", "genetici", "giudiziari", "comportamentali"],
  data_subjects: ["clienti", "dipendenti", "fornitori", "minori", "pazienti", "utenti web"],
  existing_documentation: ["Privacy Policy", "Cookie Policy", "Registro trattamenti", "Procedure diritti", "Formazione personale"],
};

export function DocumentConfigDialog({ open, onOpenChange, documentType, assessment, gaps, onGenerate }: DocumentConfigDialogProps) {
  const [formData, setFormData] = useState<DocumentConfig>(emptyConfig);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && assessment) {
      setFormData({
        ...emptyConfig,
        company_sector: assessment.scope_sector || "",
        company_jurisdiction: assessment.scope_jurisdiction || "",
        num_employees: assessment.num_employees || undefined,
        document_specific: {
          company_sector: assessment.scope_sector || "",
          company_jurisdiction: assessment.scope_jurisdiction || "",
          related_gaps_count: gaps?.length || 0,
        },
      });
      setErrors({});
      setLoading(false);
    }
  }, [open, assessment, gaps?.length]);

  const meta = documentType ? titles[documentType] : null;
  const specific = formData.document_specific || {};

  const setCommon = (key: keyof DocumentConfig, value: any) => setFormData((prev) => ({ ...prev, [key]: value }));
  const setSpecific = (key: string, value: any) => setFormData((prev) => ({ ...prev, document_specific: { ...prev.document_specific, [key]: value } }));
  const toggleMulti = (key: keyof typeof multiOptions, value: string) => {
    const current = Array.isArray(specific[key]) ? specific[key] : [];
    setSpecific(key, current.includes(value) ? current.filter((item: string) => item !== value) : [...current, value]);
  };

  const requiredFields = useMemo(() => {
    const common = ["company_name", "company_address", "company_pec", "company_email", "legal_rep_name", "legal_rep_role", "reporter_name", "reporter_role"];
    if (documentType === "dpia") return { common, specific: ["processing_name", "processing_purpose", "legal_basis", "retention_period", "data_volume"] };
    if (documentType === "risk_analysis") return { common: ["company_name", "legal_rep_name", "legal_rep_role", "reporter_name", "reporter_role"], specific: ["company_size", "it_infrastructure", "methodology", "review_frequency", "risk_acceptance_threshold"] };
    if (documentType === "ropa") return { common: ["company_name", "company_address", "legal_rep_name", "reporter_name", "reporter_role"], specific: [] };
    if (documentType === "lia") return { common, specific: ["processing_name", "processing_purpose", "legitimate_interest_description", "potential_negative_impact", "expected_outcome"] };
    return { common: [], specific: [] };
  }, [documentType]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    requiredFields.common.forEach((field) => {
      if (!String((formData as any)[field] || "").trim()) nextErrors[field] = "Campo obbligatorio";
    });
    requiredFields.specific.forEach((field) => {
      if (!String(specific[field] || "").trim()) nextErrors[field] = "Campo obbligatorio";
    });
    if (specific.third_country_transfer && !String(specific.third_country_safeguards || "").trim()) nextErrors.third_country_safeguards = "Campo obbligatorio";
    if (specific.subjects_consulted && !String(specific.consultation_method || "").trim()) nextErrors.consultation_method = "Campo obbligatorio";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await onGenerate(formData);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  if (!documentType || !meta) return null;

  const fieldError = (key: string) => errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null;
  const input = (key: keyof DocumentConfig, label: string, placeholder = "", type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={String(key)}>{label}</Label>
      <Input id={String(key)} type={type} value={String(formData[key] || "")} placeholder={placeholder} onChange={(e) => setCommon(key, e.target.value)} />
      {fieldError(String(key))}
    </div>
  );
  const specificInput = (key: string, label: string, placeholder = "", type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} type={type} value={String(specific[key] || "")} placeholder={placeholder} onChange={(e) => setSpecific(key, type === "number" ? Number(e.target.value) : e.target.value)} />
      {fieldError(key)}
    </div>
  );
  const specificTextarea = (key: string, label: string, placeholder = "") => (
    <div className="space-y-2 md:col-span-2">
      <Label htmlFor={key}>{label}</Label>
      <Textarea id={key} value={String(specific[key] || "")} placeholder={placeholder} onChange={(e) => setSpecific(key, e.target.value)} />
      {fieldError(key)}
    </div>
  );
  const specificSelect = (key: string, label: string, options: string[]) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={String(specific[key] || "")} onValueChange={(value) => setSpecific(key, value)}>
        <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
      </Select>
      {fieldError(key)}
    </div>
  );
  const checkbox = (key: string, label: string) => (
    <div className="flex items-center gap-2 rounded-md border border-border p-3">
      <Checkbox id={key} checked={!!specific[key]} onCheckedChange={(checked) => setSpecific(key, checked === true)} />
      <Label htmlFor={key} className="leading-snug">{label}</Label>
    </div>
  );
  const multiSelect = (key: keyof typeof multiOptions, label: string) => (
    <div className="space-y-2 md:col-span-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {multiOptions[key].map((option) => (
          <div key={option} className="flex items-center gap-2 rounded-md border border-border p-3">
            <Checkbox id={`${key}-${option}`} checked={(specific[key] || []).includes(option)} onCheckedChange={() => toggleMulti(key, option)} />
            <Label htmlFor={`${key}-${option}`}>{option}</Label>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Dati comuni</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {input("company_name", "Ragione sociale", "Acme S.r.l.")}
              {input("company_legal_form", "Forma giuridica", "S.r.l.")}
              {input("company_address", "Indirizzo sede legale")}
              {input("company_pec", "PEC")}
              {input("company_email", "Email")}
              {input("company_phone", "Telefono")}
              {input("company_vat", "P.IVA")}
              {input("legal_rep_name", "Legale rappresentante")}
              {input("legal_rep_role", "Ruolo legale rappresentante")}
              {input("reporter_name", "Redattore")}
              {input("reporter_role", "Ruolo redattore")}
              {input("dpo_name", "DPO")}
              {input("dpo_email", "Email DPO")}
              {input("dpo_phone", "Telefono DPO")}
            </div>
          </section>

          {documentType === "dpia" && <section className="space-y-3"><h3 className="text-sm font-semibold">Trattamento da valutare</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {specificInput("processing_name", "Nome del trattamento", "Profilazione clienti CRM")}
            {specificSelect("legal_basis", "Base giuridica", ["Consenso (Art. 6.1.a)", "Contratto (Art. 6.1.b)", "Obbligo legale (Art. 6.1.c)", "Interesse vitale (Art. 6.1.d)", "Interesse pubblico (Art. 6.1.e)", "Legittimo interesse (Art. 6.1.f)"])}
            {specificTextarea("processing_purpose", "Finalità del trattamento")}
            {multiSelect("processing_categories", "Categorie di dati")}
            {multiSelect("data_subjects", "Categorie interessati")}
            {specificInput("retention_period", "Periodo di conservazione", "10 anni dalla cessazione del rapporto")}
            {specificSelect("data_volume", "Volume dati", ["<1.000", "1.000-10.000", "10.000-100.000", "100.000-1M", ">1M"])}
            {checkbox("automated_decisions", "Sono presenti decisioni automatizzate?")}
            {checkbox("third_country_transfer", "Vi sono trasferimenti extra-UE?")}
            {specific.third_country_transfer && specificInput("third_country_safeguards", "Garanzie adottate", "SCC, BCR, decisione di adeguatezza")}
            {specificTextarea("processors_list", "Responsabili esterni del trattamento")}
            {specificTextarea("it_systems", "Sistemi IT coinvolti")}
            {checkbox("subjects_consulted", "Gli interessati sono stati consultati?")}
            {specific.subjects_consulted && specificInput("consultation_method", "Modalità di consultazione")}
          </div></section>}

          {documentType === "risk_analysis" && <section className="space-y-3"><h3 className="text-sm font-semibold">Organizzazione e metodologia</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {specificInput("company_sector", "Settore")}
            {specificInput("company_jurisdiction", "Giurisdizione")}
            {specificSelect("company_size", "Dimensione aziendale", ["Micro <10 dip.", "Piccola 10-49", "Media 50-249", "Grande 250+"])}
            {specificInput("num_employees", "Numero dipendenti", "", "number")}
            {specificInput("num_processings", "Numero approssimativo trattamenti", "", "number")}
            {specificSelect("it_infrastructure", "Infrastruttura IT", ["On-premise", "Cloud pubblico", "Cloud ibrido", "Multi-cloud", "SaaS"])}
            {specificSelect("methodology", "Metodologia", ["ISO 31000", "ENISA", "NIST RMF", "Custom"])}
            {specificSelect("review_frequency", "Frequenza revisione", ["Trimestrale", "Semestrale", "Annuale"])}
            {specificInput("security_manager", "Responsabile sicurezza")}
            {specificInput("ciso_name", "CISO")}
            {checkbox("has_iso_27001", "Possedete certificazione ISO 27001?")}
            {checkbox("has_data_breach_procedure", "Procedura data breach presente")}
            {checkbox("has_incident_response_plan", "Incident response plan presente")}
            {checkbox("has_business_continuity_plan", "Business continuity plan presente")}
            {checkbox("has_supplier_dpa", "DPA con tutti i responsabili esterni")}
            {multiSelect("existing_documentation", "Documentazione esistente")}
            {specificSelect("risk_acceptance_threshold", "Soglia rischio accettabile", ["Solo Basso", "Basso e Medio", "Fino ad Alto con piano", "Custom"])}
          </div></section>}

          {documentType === "ropa" && <section className="space-y-3"><h3 className="text-sm font-semibold">Trattamenti e output</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {specificTextarea("processings_to_include", "Trattamenti principali", "Uno per riga. Se vuoto, sarà generato un RoPA tipico per settore.")}
            {checkbox("include_hr_processings", "Includere trattamenti HR")}
            {checkbox("include_marketing_processings", "Includere trattamenti marketing")}
            {checkbox("include_customer_processings", "Includere trattamenti clienti")}
            {checkbox("include_supplier_processings", "Includere trattamenti fornitori")}
            {checkbox("include_processor_section", "Includere sezione responsabili Art. 30 par. 2")}
            {checkbox("group_by_purpose", "Raggruppare per finalità")}
          </div></section>}

          {documentType === "lia" && <section className="space-y-3"><h3 className="text-sm font-semibold">Legittimo interesse</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {specificInput("processing_name", "Nome del trattamento")}
            {specificTextarea("processing_purpose", "Finalità del trattamento")}
            {specificTextarea("legitimate_interest_description", "Legittimo interesse perseguito")}
            {specificTextarea("alternative_options_considered", "Alternative meno invasive considerate")}
            {specificTextarea("why_alternatives_rejected", "Motivo dello scarto delle alternative")}
            {specificTextarea("data_subjects_expectations", "Aspettative degli interessati")}
            {specificSelect("potential_negative_impact", "Impatto negativo potenziale", ["Nessuno", "Minimo", "Moderato", "Significativo"])}
            {specificTextarea("safeguards_in_place", "Garanzie in atto")}
            {checkbox("includes_minors", "Riguarda minori?")}
            {checkbox("includes_special_categories", "Riguarda categorie particolari?")}
            {specificTextarea("opt_out_mechanism", "Meccanismo di opposizione")}
            {specificSelect("expected_outcome", "Esito atteso", ["Da determinare con LIA", "Probabilmente legittimo", "Borderline - servono mitigazioni"])}
          </div></section>}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? "Generazione..." : "Genera Documento"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
