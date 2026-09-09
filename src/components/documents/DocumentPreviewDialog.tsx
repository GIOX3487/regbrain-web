import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Eye,
  FileText,
  Shield,
} from "lucide-react";
import { exportDocumentToPDF } from "@/lib/document-pdf-export";

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: any;
}

// ── Template definitions for mandatory sections ──

const DPIA_TEMPLATE_SECTIONS = [
  { key: "section_1_introduzione", label: "1. Introduzione", required: true },
  { key: "section_2_informazioni_essenziali", label: "2. Informazioni Essenziali", required: true },
  { key: "section_3_pre_assessment", label: "3. Pre-Assessment e Stima del Rischio", required: true },
  { key: "section_4_informazioni_trattamento", label: "4. Informazioni sul Trattamento", required: true },
  { key: "section_5_proporzionalita", label: "5. Proporzionalità", required: true },
  { key: "section_6_diritti_principi", label: "6. Diritti e Principi Fondamentali", required: true },
  { key: "section_7_valutazione_rischio", label: "7. Valutazione del Rischio", required: true },
  { key: "section_8_coinvolgimento_parti", label: "8. Coinvolgimento Parti Interessate", required: true },
  { key: "section_9_note_conclusioni", label: "9. Note e Conclusioni", required: true },
];

const ROPA_TEMPLATE_SECTIONS = [
  { key: "intestazione", label: "Intestazione (Azienda, P.IVA, Data)", required: true },
  { key: "attivita_trattamento", label: "Attività di Trattamento (min. 6)", required: true },
];

function getSectionStatus(content: any, key: string, docType: string): "complete" | "partial" | "missing" {
  if (!(key in content)) return "missing";
  const value = content[key];
  if (value === null || value === undefined) return "missing";
  if (typeof value === "string" && value.trim().length < 20) return "partial";
  if (typeof value === "object" && !Array.isArray(value)) {
    const vals = Object.values(value);
    if (vals.length === 0) return "missing";
    const filled = vals.filter((v) => v !== null && v !== undefined && String(v).trim().length > 0);
    if (filled.length === 0) return "missing";
    if (filled.length < vals.length) return "partial";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "missing";
    if (docType === "ropa" && key === "attivita_trattamento" && value.length < 6) return "partial";
  }
  return "complete";
}

const statusIcon = {
  complete: <CheckCircle2 className="h-4 w-4 text-green-500" />, 
  partial: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  missing: <XCircle className="h-4 w-4 text-red-500" />,
};

const statusLabel = {
  complete: "Completa",
  partial: "Parziale",
  missing: "Mancante",
};

// ── Render helpers ──

function renderValue(value: any, depth = 0): JSX.Element {
  if (value === null || value === undefined) return <span className="text-muted-foreground italic">—</span>;

  if (typeof value === "string") {
    return <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{value}</p>;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="text-sm font-medium">{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="border-l-2 border-primary/20 pl-3">
            {typeof item === "string" ? (
              <p className="text-sm">{item}</p>
            ) : typeof item === "object" ? (
              <div className="space-y-1">
                {Object.entries(item).map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {k.replace(/_/g, " ")}
                    </span>
                    {renderValue(v, depth + 1)}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-sm">{String(item)}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return (
      <div className="space-y-3">
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {k.replace(/_/g, " ")}
            </h5>
            {renderValue(v, depth + 1)}
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-sm">{String(value)}</span>;
}

export default function DocumentPreviewDialog({ open, onOpenChange, document: doc }: DocumentPreviewDialogProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "validation">("validation");

  if (!doc) return null;

  const content = doc.content || {};
  const docType = doc.document_type;
  const sections = docType === "dpia" ? DPIA_TEMPLATE_SECTIONS : docType === "ropa" ? ROPA_TEMPLATE_SECTIONS : [];

  const sectionStatuses = sections.map((s) => ({
    ...s,
    status: getSectionStatus(content, s.key, docType),
  }));

  const completeCount = sectionStatuses.filter((s) => s.status === "complete").length;
  const totalCount = sectionStatuses.length;
  const completionPct = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0;

  const handleExportPDF = () => {
    exportDocumentToPDF(doc);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {doc.title || "Anteprima Documento"}
          </DialogTitle>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex gap-2 border-b pb-2">
          <Button
            variant={activeTab === "validation" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("validation")}
          >
            <AlertTriangle className="h-4 w-4 mr-1" />
            Validazione Template
          </Button>
          <Button
            variant={activeTab === "preview" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("preview")}
          >
            <Eye className="h-4 w-4 mr-1" />
            Anteprima Completa
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-1" />
            Esporta PDF
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {activeTab === "validation" && (
            <div className="space-y-4 p-1">
              {/* Overall score */}
              <Card className={completionPct === 100 ? "border-green-500/50 bg-green-500/5" : "border-yellow-500/50 bg-yellow-500/5"}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Conformità al Template</span>
                    <Badge variant={completionPct === 100 ? "default" : "destructive"}>
                      {completionPct}%
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="w-full bg-muted rounded-full h-2 mb-3">
                    <div
                      className={`h-2 rounded-full transition-all ${completionPct === 100 ? "bg-green-500" : completionPct >= 70 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {completeCount}/{totalCount} sezioni complete
                    {completionPct < 100 && " — Le sezioni evidenziate in rosso/giallo richiedono attenzione"}
                  </p>
                </CardContent>
              </Card>

              {/* Per-section validation */}
              <div className="space-y-2">
                {sectionStatuses.map((section) => (
                  <Card
                    key={section.key}
                    className={
                      section.status === "complete"
                        ? "border-green-500/30"
                        : section.status === "partial"
                        ? "border-yellow-500/50 bg-yellow-500/5"
                        : "border-red-500/50 bg-red-500/5"
                    }
                  >
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                      {statusIcon[section.status]}
                      <span className="font-medium flex-1">{section.label}</span>
                      <Badge
                        variant={section.status === "complete" ? "outline" : "destructive"}
                        className="text-xs"
                      >
                        {statusLabel[section.status]}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* RoPA specific: activity count */}
              {docType === "ropa" && Array.isArray(content.attivita_trattamento) && (
                <Card className="border-primary/30">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm">
                        Attività di trattamento generate: <strong>{content.attivita_trattamento.length}</strong> / minimo 6
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === "preview" && (
            <div className="space-y-6 p-1">
              {/* Title */}
              <div>
                <h2 className="text-xl font-bold">{content.title || doc.title}</h2>
                <Separator className="mt-2" />
              </div>

              {/* Render all sections */}
              {docType === "dpia" &&
                DPIA_TEMPLATE_SECTIONS.map((sec) => {
                  const val = content[sec.key];
                  const status = getSectionStatus(content, sec.key, docType);
                  return (
                    <Card key={sec.key} className={status === "missing" ? "border-red-500/50 bg-red-500/5" : ""}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          {statusIcon[status]}
                          {sec.label}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {status === "missing" ? (
                          <p className="text-sm text-red-500 italic">Sezione non generata</p>
                        ) : (
                          renderValue(val)
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

              {docType === "ropa" && (
                <>
                  {content.intestazione && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Intestazione</CardTitle>
                      </CardHeader>
                      <CardContent>{renderValue(content.intestazione)}</CardContent>
                    </Card>
                  )}
                  {Array.isArray(content.attivita_trattamento) &&
                    content.attivita_trattamento.map((att: any, i: number) => (
                      <Card key={i}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Badge variant="outline">{att.codice || `${i + 1}`}</Badge>
                            {att.denominazione || `Attività ${i + 1}`}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>{renderValue(att)}</CardContent>
                      </Card>
                    ))}
                </>
              )}

              {/* Fallback for other types */}
              {docType !== "dpia" && docType !== "ropa" && renderValue(content)}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
