import { useState, useEffect, useRef } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Send, Mic, MicOff, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { renderWithClickableCitations } from "@/components/chat/ClickableCitations";

function transformChildrenWithCitations(children: React.ReactNode, messageIndex: number): React.ReactNode {
  return React.Children.map(children, (child, i) => {
    if (typeof child === 'string') {
      return <React.Fragment key={i}>{renderWithClickableCitations(child, messageIndex)}</React.Fragment>;
    }
    if (React.isValidElement(child) && (child.props as any)?.children !== undefined) {
      return React.cloneElement(
        child,
        { key: i },
        transformChildrenWithCitations((child.props as any).children, messageIndex)
      );
    }
    return child;
  });
}

interface Citation {
  index: number;
  documentTitle: string;
  documentId: string;
  content: string;
  version: string;
}

interface ChatMessage {
  role: string;
  content: string;
  citations?: Citation[];
}

const CitationPanel = ({ citations, messageIndex }: { citations: Citation[]; messageIndex: number }) => {
  const [expanded, setExpanded] = useState(true);
  const [expandedCitation, setExpandedCitation] = useState<number | null>(null);

  if (!citations || citations.length === 0) return null;

  // Group by document
  const byDoc = new Map<string, Citation[]>();
  citations.forEach(c => {
    const key = c.documentTitle;
    if (!byDoc.has(key)) byDoc.set(key, []);
    byDoc.get(key)!.push(c);
  });

  return (
    <div className="mt-2 border-t border-border/50 pt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <BookOpen className="w-3 h-3" />
        <span>{citations.length} fonti normative</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {Array.from(byDoc.entries()).map(([docTitle, cites]) => (
            <div key={docTitle} className="text-xs">
              <p className="font-semibold text-foreground/80 mb-1">📄 {docTitle}</p>
              {cites.map(c => (
                <div
                  key={c.index}
                  id={`citation-${messageIndex}-${c.index}`}
                  className="ml-3 mb-1.5 rounded transition-shadow"
                >
                  <button
                    onClick={() => setExpandedCitation(expandedCitation === c.index ? null : c.index)}
                    className="text-primary/80 hover:text-primary cursor-pointer text-left"
                  >
                    [{c.index}] {c.content.substring(0, 80)}...
                  </button>
                  {expandedCitation === c.index && (
                    <div className="mt-1 p-2 bg-muted/50 rounded text-muted-foreground whitespace-pre-wrap text-[11px] max-h-40 overflow-y-auto">
                      {c.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AICopilot = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate('/auth');
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'it-IT';

      recognitionRef.current.onresult = (event: any) => {
        setMessage(event.results[0][0].transcript);
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => {
        setIsListening(false);
        toast({ title: "Errore riconoscimento vocale", description: "Impossibile riconoscere l'audio.", variant: "destructive" });
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, [toast]);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      toast({ title: "Non supportato", description: "Il riconoscimento vocale non è supportato dal tuo browser", variant: "destructive" });
      return;
    }
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); }
    else { recognitionRef.current.start(); setIsListening(true); }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    setLoading(true);
    const userMessage = message;
    setMessage("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const { data, error } = await supabase.functions.invoke('ai-compliance-copilot', {
        body: {
          question: userMessage,
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content }))
        }
      });

      if (error) throw error;

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        citations: data.citations || []
      }]);
    } catch (error: any) {
      console.error('Copilot error:', error);
      toast({ title: "Errore", description: error.message || "Impossibile ottenere una risposta", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    "Sono conforme al GDPR per il marketing email?",
    "Cosa devo fare prima di un audit NIS2?",
    "Come classifico il mio sistema AI secondo l'AI Act?",
    "Quali misure tecniche per DORA in ambito finance?",
    "Quando è obbligatoria una DPIA?"
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/compliance')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">AI compliance copilot</h1>
              <p className="text-sm text-muted-foreground">Chat RAG-based con citazioni normative verificate</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 px-4">
              <h2 className="text-3xl font-bold mb-4">👋 Ciao! Come posso aiutarti?</h2>
              <p className="text-muted-foreground mb-2">
                Sono il tuo assistente compliance basato su <strong>RAG</strong>. Ogni risposta è ancorata ai testi normativi ufficiali con citazioni verificabili.
              </p>
              <p className="text-xs text-muted-foreground mb-8">
                📄 Le risposte includono riferimenti precisi ad articoli e fonti — nessuna informazione inventata.
              </p>

              <div className="grid gap-2 max-w-2xl mx-auto">
                <p className="text-sm text-muted-foreground mb-2">💡 Domande frequenti:</p>
                {quickPrompts.map((prompt, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    className="text-left justify-start text-sm p-4 h-auto whitespace-normal"
                    onClick={() => setMessage(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg, idx) => (
                <div key={idx} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
                  <Card className={`inline-block max-w-[85%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
                    <div className="p-4">
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              skipHtml={true}
                              disallowedElements={['script', 'iframe', 'object', 'embed']}
                              unwrapDisallowed={true}
                              components={{
                                p: ({node, children, ...props}) => (
                                  <p {...props}>{transformChildrenWithCitations(children, idx)}</p>
                                ),
                                li: ({node, children, ...props}) => (
                                  <li {...props}>{transformChildrenWithCitations(children, idx)}</li>
                                ),
                                a: ({node, href, ...props}) => {
                                  const sanitizedHref = href?.startsWith('http') || href?.startsWith('https') ? href : '#';
                                  return <a href={sanitizedHref} target="_blank" rel="noopener noreferrer" {...props} />;
                                },
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                          {msg.citations && msg.citations.length > 0 && (
                            <CitationPanel citations={msg.citations} messageIndex={idx} />
                          )}
                        </>
                      )}
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t pt-4 bg-background">
          <div className="flex gap-2">
            <Textarea
              placeholder="Scrivi la tua domanda o usa il microfono..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
              }}
              className="min-h-[60px] resize-none"
              disabled={loading}
            />
            <div className="flex flex-col gap-2">
              <Button variant={isListening ? "destructive" : "outline"} size="icon" onClick={toggleVoiceInput} disabled={loading}>
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button size="icon" onClick={handleSendMessage} disabled={loading || !message.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            📄 Risposte basate su RAG con citazioni normative — verifica sempre con un professionista per decisioni importanti
          </p>
        </div>
      </div>
    </div>
  );
};

export default AICopilot;
