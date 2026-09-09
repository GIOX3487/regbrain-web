import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

interface ChunkData {
  document_id: string;
  document_title: string;
  chunk_content: string;
  article_reference?: string;
  cited_for_article?: string;
  structural_context?: string;
  citation_number: number;
  explicitly_cited: boolean;
}

interface GroupedCitationsProps {
  chunks: ChunkData[];
  messages: any[];
  messageIndex: number;
}

interface GroupedDocument {
  document_id: string;
  document_title: string;
  references: {
    citation_number: number;
    article_reference?: string;
    cited_for_article?: string;
    structural_context?: string;
    chunk_content: string;
    explicitly_cited: boolean;
  }[];
  hasCitedReferences: boolean;
}

export const GroupedCitations = ({ chunks, messages, messageIndex }: GroupedCitationsProps) => {
  const navigate = useNavigate();
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});
  const [expandedRefs, setExpandedRefs] = useState<Record<string, boolean>>({});

  // Group chunks by document
  const groupedDocuments: GroupedDocument[] = [];
  const documentMap = new Map<string, GroupedDocument>();

  chunks.forEach((chunk) => {
    const docId = chunk.document_id;
    
    if (!documentMap.has(docId)) {
      documentMap.set(docId, {
        document_id: docId,
        document_title: chunk.document_title || 'Documento normativo',
        references: [],
        hasCitedReferences: false
      });
    }

    const doc = documentMap.get(docId)!;
    doc.references.push({
      citation_number: chunk.citation_number,
      article_reference: chunk.article_reference,
      cited_for_article: (chunk as any).cited_for_article,
      structural_context: (chunk as any).structural_context,
      chunk_content: chunk.chunk_content,
      explicitly_cited: chunk.explicitly_cited
    });

    if (chunk.explicitly_cited) {
      doc.hasCitedReferences = true;
    }
  });

  // Convert map to array and sort by cited documents first
  documentMap.forEach((doc) => groupedDocuments.push(doc));
  groupedDocuments.sort((a, b) => {
    if (a.hasCitedReferences && !b.hasCitedReferences) return -1;
    if (!a.hasCitedReferences && b.hasCitedReferences) return 1;
    return 0;
  });

  const toggleDoc = (docId: string) => {
    setExpandedDocs(prev => ({ ...prev, [docId]: !prev[docId] }));
  };

  const toggleRef = (refKey: string) => {
    setExpandedRefs(prev => ({ ...prev, [refKey]: !prev[refKey] }));
  };

  const navigateToDocument = (documentId: string, chunkContent?: string) => {
    sessionStorage.setItem('chatState', JSON.stringify({
      messages: messages,
      returnPath: window.location.pathname + window.location.search
    }));
    const highlight = chunkContent ? encodeURIComponent(chunkContent) : '';
    navigate(`/document-viewer?id=${documentId}${highlight ? `&highlight=${highlight}` : ''}`);
  };

  const citedCount = groupedDocuments.filter(d => d.hasCitedReferences).length;
  const totalRefs = chunks.length;

  return (
    <div className="mt-3 lg:mt-4 pt-3 lg:pt-4 border-t border-border">
      <p className="text-sm font-semibold mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        Sezioni normative consultate ({groupedDocuments.length} documenti, {totalRefs} sezioni)
      </p>
      
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {groupedDocuments.map((doc) => {
          const isExpanded = expandedDocs[doc.document_id];
          const citedRefs = doc.references.filter(r => r.explicitly_cited);
          const contextRefs = doc.references.filter(r => !r.explicitly_cited);

          return (
            <Collapsible 
              key={doc.document_id}
              open={isExpanded}
              onOpenChange={() => toggleDoc(doc.document_id)}
            >
              <Card className={`overflow-hidden transition-all border-l-4 ${
                doc.hasCitedReferences 
                  ? 'bg-primary/5 border-l-primary' 
                  : 'bg-muted/30 border-l-muted-foreground/30'
              }`}>
                <CollapsibleTrigger className="w-full">
                  <div className="p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-1 shrink-0">
                      {doc.references.slice(0, 3).map((ref, i) => (
                        <Badge 
                          key={i}
                          variant={ref.explicitly_cited ? "default" : "outline"} 
                          className={`text-xs ${!ref.explicitly_cited ? 'opacity-60' : ''}`}
                        >
                          [{ref.citation_number}]
                        </Badge>
                      ))}
                      {doc.references.length > 3 && (
                        <Badge variant="outline" className="text-xs opacity-60">
                          +{doc.references.length - 3}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium break-words ${
                          doc.hasCitedReferences ? 'text-primary' : 'text-muted-foreground'
                        }`}>
                          {doc.document_title}
                        </p>
                        {doc.hasCitedReferences && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            {citedRefs.length} citazioni
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {doc.references.length} sezioni consultate
                      </p>
                    </div>
                    
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
                    {/* Cited references first */}
                    {citedRefs.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          Sezioni citate nella risposta
                        </p>
                        {citedRefs.map((ref, refIdx) => {
                          const refKey = `${doc.document_id}-cited-${refIdx}`;
                          const isRefExpanded = expandedRefs[refKey];
                          
                          return (
                            <div 
                              key={refKey}
                              id={`citation-${messageIndex}-${ref.citation_number}`}
                              className="bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-800 transition-shadow"
                            >
                              <div 
                                className="p-2 flex items-center gap-2 cursor-pointer hover:bg-green-100/50 dark:hover:bg-green-900/30 transition-colors"
                                onClick={() => toggleRef(refKey)}
                              >
                                <Badge variant="default" className="text-xs shrink-0">
                                  [{ref.citation_number}]
                                </Badge>
                                <div className="text-xs font-medium text-foreground flex-1">
                                  {ref.article_reference ? (
                                    <p>{ref.article_reference}</p>
                                  ) : (
                                    <p className="text-orange-600 dark:text-orange-400">⚠ Riferimento generico</p>
                                  )}
                                  {ref.cited_for_article && ref.cited_for_article !== ref.article_reference && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5 font-normal">
                                      🎯 Citato per: {ref.cited_for_article}
                                    </p>
                                  )}
                                  {ref.structural_context && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5 font-normal">
                                      📂 {ref.structural_context}
                                    </p>
                                  )}
                                  <p className="text-[10px] text-muted-foreground mt-1 font-normal line-clamp-2">
                                    {ref.chunk_content.substring(0, 150)}...
                                  </p>
                                </div>
                                {isRefExpanded ? (
                                  <ChevronUp className="w-3 h-3 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                )}
                              </div>
                              
                              {isRefExpanded && (
                                <div className="px-2 pb-2 space-y-2">
                                  <div className="p-2 bg-background/80 rounded border border-border/50 max-h-[120px] overflow-y-auto">
                                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                                      {ref.chunk_content}
                                    </p>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs h-7 bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-950 dark:border-green-800"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigateToDocument(doc.document_id, ref.chunk_content);
                                    }}
                                  >
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    Vedi nel documento ufficiale
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Context references */}
                    {contextRefs.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-muted-foreground/50"></span>
                          Contesto aggiuntivo ({contextRefs.length})
                        </p>
                        {contextRefs.map((ref, refIdx) => {
                          const refKey = `${doc.document_id}-context-${refIdx}`;
                          const isRefExpanded = expandedRefs[refKey];
                          
                          return (
                            <div 
                              key={refKey}
                              id={`citation-${messageIndex}-${ref.citation_number}`}
                              className="bg-muted/30 rounded-md border border-border/50 transition-shadow"
                            >
                              <div 
                                className="p-2 flex items-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => toggleRef(refKey)}
                              >
                                <Badge variant="outline" className="text-xs shrink-0 opacity-60">
                                  [{ref.citation_number}]
                                </Badge>
                                <div className="text-xs text-muted-foreground flex-1">
                                  {ref.article_reference ? (
                                    <p>{ref.article_reference}</p>
                                  ) : (
                                    <p className="text-orange-500 dark:text-orange-400">⚠ Riferimento generico</p>
                                  )}
                                  {ref.structural_context && (
                                    <p className="text-[10px] mt-0.5">
                                      📂 {ref.structural_context}
                                    </p>
                                  )}
                                  <p className="text-[10px] mt-1 line-clamp-2">
                                    {ref.chunk_content.substring(0, 150)}...
                                  </p>
                                </div>
                                {isRefExpanded ? (
                                  <ChevronUp className="w-3 h-3 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                )}
                              </div>
                              
                              {isRefExpanded && (
                                <div className="px-2 pb-2 space-y-2">
                                  <div className="p-2 bg-background/50 rounded border border-border/30 max-h-[100px] overflow-y-auto">
                                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                      {ref.chunk_content}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-xs h-7"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigateToDocument(doc.document_id, ref.chunk_content);
                                    }}
                                  >
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    Vedi nel documento ufficiale
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Quick action to open full document */}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full text-xs mt-2"
                      onClick={() => navigateToDocument(doc.document_id)}
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      Apri documento completo
                    </Button>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-3 italic">
        💡 Clicca su un documento per espandere tutti i riferimenti. Le sezioni verdi sono state citate esplicitamente nella risposta.
      </p>
    </div>
  );
};
