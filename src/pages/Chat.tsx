import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Send, Menu, LogOut, FileText, History, Settings, Paperclip, X, Upload, Shield, Lightbulb, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MobileNav } from "@/components/MobileNav";
import { GroupedCitations } from "@/components/chat/GroupedCitations";
import { renderWithClickableCitations } from "@/components/chat/ClickableCitations";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import React from 'react';
import { extractDocumentText } from "@/lib/client-document-extract";

// Walk markdown children and replace plain-text [N] markers with clickable citation buttons.
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

// Post-process RAG response to ensure proper markdown formatting
function formatRAGResponse(text: string): string {
  let formatted = text;
  
  // Ensure line breaks before numbered section titles like "1. Regola Generale", "2. Applicazione..."
  formatted = formatted.replace(/([^\n])\s*(\*\*\d+\.\s)/g, '$1\n\n$2');
  
  // Ensure line break after bold section titles (title followed by text on same line)
  formatted = formatted.replace(/(\*\*\d+\.\s[^*]+\*\*)\s*(?!\n)/g, '$1\n\n');
  
  // Ensure line breaks before bold titles without numbers too
  formatted = formatted.replace(/([^\n])\s*(\*\*(?:Regola Generale|Applicazione|Domande per te)[^*]*\*\*)/gi, '$1\n\n$2');
  
  // Ensure numbered list items (1. 2. 3.) inside "Domande per te" are on separate lines
  formatted = formatted.replace(/([.?!])\s+(\d+\.\s)/g, '$1\n\n$2');
  
  // Ensure bullet points are on separate lines
  formatted = formatted.replace(/([.?!])\s+([-•*]\s)/g, '$1\n\n$2');
  
  // Collapse triple+ newlines to double
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  return formatted.trim();
}

const Chat = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tipsDialogOpen, setTipsDialogOpen] = useState(false);

  useEffect(() => {
    const initializeChat = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Save that we're trying to access chat before redirecting
        const pendingAnalysis = localStorage.getItem('pendingAnalysis');
        if (pendingAnalysis) {
          localStorage.setItem('returnToAnalysis', 'true');
        }
        navigate('/auth');
        return;
      }

      // Load profile first
      await loadProfile();

      // Check for restoring messages after viewing document
      const restoreMessages = sessionStorage.getItem('restoreMessages');
      if (restoreMessages) {
        const messages = JSON.parse(restoreMessages);
        setMessages(messages);
        sessionStorage.removeItem('restoreMessages');
        
        toast({
          title: "Conversazione ripristinata",
          description: "Sei tornato alla tua chat"
        });
      }

      // Check for continuing a conversation from audit trail
      const continueParam = searchParams.get('continue');
      if (continueParam === 'true') {
        const conversationContext = localStorage.getItem('continueConversation');
        if (conversationContext) {
          const context = JSON.parse(conversationContext);
          setMessages(context.previousMessages);
          localStorage.removeItem('continueConversation');
          // Remove query param
          searchParams.delete('continue');
          navigate(`/chat`, { replace: true });
          
          toast({
            title: "Conversazione ripresa",
            description: "Puoi continuare da dove ti eri interrotto"
          });
        }
      }

      // Check for pending analysis from localStorage
      const pendingAnalysis = localStorage.getItem('pendingAnalysis');
      const returnToAnalysis = localStorage.getItem('returnToAnalysis');
      
      if (pendingAnalysis && (returnToAnalysis || searchParams.get('analysis') === 'pending')) {
        console.log('Loading pending analysis:', pendingAnalysis);
        setMessage(pendingAnalysis);
        // Clean up
        localStorage.removeItem('pendingAnalysis');
        localStorage.removeItem('returnToAnalysis');
        // Remove query param
        if (searchParams.get('analysis')) {
          searchParams.delete('analysis');
          navigate(`/chat`, { replace: true });
        }
      }
    };

    initializeChat();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) {
        navigate('/auth');
      } else if (event === 'SIGNED_IN') {
        // Check again after sign in
        const pendingAnalysis = localStorage.getItem('pendingAnalysis');
        if (pendingAnalysis) {
          console.log('Loading analysis after login:', pendingAnalysis);
          setMessage(pendingAnalysis);
          localStorage.removeItem('pendingAnalysis');
          localStorage.removeItem('returnToAnalysis');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, searchParams]);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
        throw error;
      }
      
      if (!data) {
        navigate('/onboarding');
        return;
      }
      
      setProfile(data);

      // Check if user has admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      setIsAdmin(!!roleData);
    } catch (error: any) {
      console.error('Error in loadProfile:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare il profilo",
        variant: "destructive"
      });
    }
  };

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold">RegBrain</h1>
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Contesto Utente</h3>
        {profile && (
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Giurisdizione</p>
              <Badge variant="outline">{profile.jurisdiction}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Settore</p>
              <Badge variant="outline">{profile.sector}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ruolo</p>
              <Badge variant="outline">{profile.compliance_role}</Badge>
            </div>
          </div>
        )}
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start"
          onClick={() => {
            // Preserva il messaggio corrente nell'input quando si modifica il profilo
            if (message && message.trim()) {
              localStorage.setItem('pendingAnalysis', message);
              sessionStorage.setItem('auth_redirect', '/chat?analysis=pending');
            }
            navigate('/onboarding');
            setSidebarOpen(false);
          }}
        >
          <Settings className="w-4 h-4 mr-2" />
          Modifica Profilo
        </Button>
      </Card>

      <nav className="space-y-2">
        <Button variant="ghost" className="w-full justify-start" onClick={() => { navigate('/chat'); setSidebarOpen(false); }}>
          <Send className="w-4 h-4 mr-2" />
          Chat
        </Button>
        <Button variant="default" className="w-full justify-start bg-gradient-to-r from-blue-600 to-purple-600" onClick={() => { navigate('/compliance'); setSidebarOpen(false); }}>
          <Shield className="w-4 h-4 mr-2" />
          Compliance Hub
        </Button>
        <Button variant="ghost" className="w-full justify-start" onClick={() => { navigate('/audit'); setSidebarOpen(false); }}>
          <History className="w-4 h-4 mr-2" />
          Audit Log
        </Button>
        {isAdmin && (
          <>
            <Button variant="ghost" className="w-full justify-start text-amber-600" onClick={() => { navigate('/admin/load-documents'); setSidebarOpen(false); }}>
              <Upload className="w-4 h-4 mr-2" />
              Carica Normative (Admin)
            </Button>
            <Button variant="ghost" className="w-full justify-start text-amber-600" onClick={() => { navigate('/admin/verify-knowledge-base'); setSidebarOpen(false); }}>
              <Database className="w-4 h-4 mr-2" />
              Verifica Knowledge Base
            </Button>
          </>
        )}
        <Button variant="ghost" className="w-full justify-start" onClick={() => { 
          navigate('/aggiornamenti', { state: { fromChat: true } }); 
          sessionStorage.setItem('chatReturn', 'true');
          setSidebarOpen(false); 
        }}>
          <FileText className="w-4 h-4 mr-2" />
          Aggiornamenti
        </Button>
      </nav>

      <Card className="p-4 bg-primary/5 border-primary/20">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10"
          onClick={() => {
            setTipsDialogOpen(true);
            setSidebarOpen(false);
          }}
        >
          <Lightbulb className="w-4 h-4 mr-2" />
          Linee Guida RAG
        </Button>
      </Card>

      <div className="pt-6 mt-auto">
        <Button variant="ghost" className="w-full justify-start text-destructive" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Esci
        </Button>
      </div>
    </>
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const [messages, setMessages] = useState<Array<{ role: string; content: string; citations?: any[]; allContextChunks?: any[]; confidence?: { level: string; score: number; explanation: string } }>>([]);

  const handleSendMessage = async () => {
    if (!message.trim() && attachedFiles.length === 0) return;
    
    setLoading(true);
    const userMessage = message;
    const files = attachedFiles;
    setMessage("");
    setAttachedFiles([]);

    // Add user message to chat
    const fileNames = files.length > 0 ? `\n\n📎 File allegati: ${files.map(f => f.name).join(', ')}` : '';
    setMessages(prev => [...prev, { role: 'user', content: userMessage + fileNames }]);

    try {
      // Images stay base64 (vision); documents are extracted to text in-browser
      const fileDataPromises = files.map(async (file) => {
        if (file.type?.startsWith('image/')) {
          const data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          return { name: file.name, type: file.type, data };
        }

        let text = '';
        try {
          text = await extractDocumentText(file);
        } catch (err) {
          console.error('Estrazione testo fallita:', file.name, err);
        }

        if (!text || text.length < 20) {
          toast({
            title: "Documento non leggibile",
            description: `Non è stato possibile estrarre il testo da ${file.name}. Prova con un PDF non scansionato o un file Word.`,
            variant: "destructive",
          });
        }

        return { name: file.name, type: file.type, text };
      });

      const filesData = await Promise.all(fileDataPromises);

      // Build conversation history from last 4 messages (2 user + 2 assistant pairs)
      const recentMessages = messages.slice(-4).map(m => ({
        role: m.role,
        content: m.content.substring(0, 2000), // Truncate to avoid huge payloads
      }));

      const { data, error } = await supabase.functions.invoke('rag-query', {
        body: {
          question: userMessage,
          userProfile: profile,
          files: filesData,
          conversationHistory: recentMessages.length > 0 ? recentMessages : undefined,
        }
      });

      if (error) {
        const details = error.context instanceof Response ? await error.context.clone().json().catch(() => null) : null;
        throw new Error(details?.error || error.message);
      }

      console.log('RAG Response:', { 
        hasAnswer: !!data.answer, 
        citationsCount: data.citations?.length || 0,
        allContextCount: data.allContextChunks?.length || 0,
        citations: data.citations 
      });

      // Add assistant response with both explicit citations and all context chunks
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        citations: data.citations || [],
        allContextChunks: data.allContextChunks || [],
        confidence: data.confidence || undefined
      }]);

    } catch (error: any) {
      console.error('RAG error:', error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile ottenere una risposta",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      const isDoc = file.type.includes('word') || file.type.includes('document');
      const nameLower = file.name.toLowerCase();
      const isByName = /\.(pdf|docx?|txt|md|csv|xlsx?|json)$/.test(nameLower);
      const isValid = isImage || isPdf || isDoc || isByName;
      
      if (!isValid) {
        toast({
          title: "Formato non supportato",
          description: `Il file ${file.name} non è supportato. Usa immagini, PDF o documenti Word.`,
          variant: "destructive"
        });
      }
      
      return isValid;
    });
    
    setAttachedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const quickPrompts = [
    "Quali sono i requisiti specifici del GDPR per la nomina del DPO secondo l'articolo 37? La mia organizzazione deve nominarne uno?",
    "Entro quale data gli Stati membri devono recepire la Direttiva NIS2 e quali settori sono considerati 'essenziali' secondo l'Allegato I?",
    "Come vengono classificati i sistemi di intelligenza artificiale secondo l'AI Act? Quali rientrano nella categoria ad alto rischio?",
    "Quali registri delle attività di trattamento devo mantenere come Titolare del trattamento ai sensi dell'articolo 30 GDPR?",
    "Quali sono gli obblighi specifici per le entità finanziarie sotto il DORA in materia di gestione del rischio ICT?"
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden pb-16 lg:pb-0">
      <MobileNav />
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card/98 backdrop-blur-md border-b p-4 flex items-center justify-between safe-area-top shadow-sm">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="min-w-[48px] min-h-[48px] active:scale-95 transition-transform">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-[380px] p-6 mobile-scroll">
            <SidebarContent />
          </SheetContent>
        </Sheet>
        
        <h1 className="text-xl font-bold">RegBrain</h1>
        
        <Dialog open={tipsDialogOpen} onOpenChange={setTipsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="min-w-[48px] min-h-[48px] active:scale-95 transition-transform">
              <Lightbulb className="w-5 h-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto mobile-scroll mx-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Lightbulb className="w-5 h-5 text-primary" />
                Come utilizzare al meglio il RAG
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold mb-2 text-primary">Documenti aziendali da caricare:</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• <strong>Policy aziendali:</strong> Privacy Policy, Information Security Policy, Data Retention Policy</li>
                  <li>• <strong>Procedure operative:</strong> Gestione accessi, backup, incident response, DPIA</li>
                  <li>• <strong>Registri e documenti:</strong> Registro trattamenti (Art. 30 GDPR), elenco fornitori, contratti DPA</li>
                  <li>• <strong>Documentazione tecnica:</strong> Architetture di rete, misure di sicurezza implementate, audit log</li>
                  <li>• <strong>Formati supportati:</strong> PDF, Word (.docx), immagini (per diagrammi/schemi)</li>
                </ul>
              </div>
              
              <div className="pt-3 border-t">
                <h3 className="font-semibold mb-2 text-primary">Genera documenti di conformità</h3>
                <p className="text-muted-foreground mb-3">
                  Utilizza il Document Generator per creare automaticamente documenti chiave come <strong>DPIA</strong>, <strong>RoPA</strong> e <strong>LIA</strong>.
                </p>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => {
                    setTipsDialogOpen(false);
                    navigate('/compliance/documents');
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Vai al Document Generator
                </Button>
              </div>
              
              <div className="pt-3 border-t">
                <h3 className="font-semibold mb-2 text-primary">Consigli per domande efficaci</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Sii specifico: indica articoli, normative o contesti precisi</li>
                  <li>• Allega documenti aziendali per analisi personalizzate</li>
                  <li>• Chiedi esempi pratici e casi d'uso concreti</li>
                  <li>• Verifica sempre le fonti citate nelle risposte</li>
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-80 border-r bg-card p-6 space-y-6 overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col pt-16 lg:pt-0">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 mobile-scroll">
          <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4 w-full">
            {messages.length === 0 ? (
              <div className="text-center py-8 lg:py-12 px-4">
                <h2 className="text-2xl lg:text-3xl font-bold mb-4">Come posso aiutarti oggi?</h2>
                <p className="text-muted-foreground mb-6 lg:mb-8 text-sm lg:text-base">
                  Fai domande su normative di cybersecurity e privacy
                </p>
                
                <div className="grid gap-2">
                  <p className="text-sm text-muted-foreground mb-2">Suggerimenti rapidi:</p>
                  {quickPrompts.map((prompt, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      className="text-left justify-start text-xs lg:text-sm p-3 lg:p-4 h-auto whitespace-normal"
                      onClick={() => setMessage(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 lg:space-y-6">
                {messages.map((msg, idx) => (
                  <div key={idx} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
                    <Card className={`inline-block max-w-[85%] lg:max-w-none ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
                      <div className="p-3 lg:p-4">
                        {msg.role === 'user' ? (
                          <p className="whitespace-pre-wrap text-sm lg:text-base">{msg.content}</p>
                        ) : (
                          <div className="prose prose-sm lg:prose-base dark:prose-invert max-w-none">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              skipHtml={true}
                              disallowedElements={['script', 'iframe', 'object', 'embed']}
                              unwrapDisallowed={true}
                              components={{
                                h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-5 mb-3" {...props} />,
                                h2: ({node, ...props}) => <h2 className="text-lg font-semibold mt-4 mb-2" {...props} />,
                                h3: ({node, ...props}) => <h3 className="text-base font-semibold mt-3 mb-2" {...props} />,
                                p: ({node, children, ...props}) => (
                                  <p className="mb-3 leading-relaxed" {...props}>
                                    {transformChildrenWithCitations(children, idx)}
                                  </p>
                                ),
                                ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-3 space-y-1.5" {...props} />,
                                ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-3 space-y-1.5" {...props} />,
                                li: ({node, children, ...props}) => (
                                  <li className="mb-1 leading-relaxed" {...props}>
                                    {transformChildrenWithCitations(children, idx)}
                                  </li>
                                ),
                                strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                                em: ({node, ...props}) => <em className="italic" {...props} />,
                                code: ({node, ...props}) => <code className="bg-muted px-1 rounded text-sm" {...props} />,
                                a: ({node, href, ...props}) => {
                                  const sanitizedHref = href?.startsWith('http') || href?.startsWith('https') 
                                    ? href 
                                    : '#';
                                  return (
                                    <a 
                                      href={sanitizedHref} 
                                      className="text-primary hover:underline" 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      {...props} 
                                    />
                                  );
                                },
                              }}
                            >
                              {formatRAGResponse(msg.content)}
                            </ReactMarkdown>
                          </div>
                        )}
                        {/* Show grouped citations by document */}
                        {msg.allContextChunks && msg.allContextChunks.length > 0 ? (
                          <GroupedCitations 
                            chunks={msg.allContextChunks}
                            messages={messages}
                            messageIndex={idx}
                          />
                        ) : msg.citations && msg.citations.length > 0 ? (
                          // Fallback to old citations if allContextChunks not available
                          <GroupedCitations 
                            chunks={msg.citations.map((c: any, i: number) => ({
                              ...c,
                              citation_number: c.citation_number || i + 1,
                              explicitly_cited: true
                            }))}
                            messages={messages}
                            messageIndex={idx}
                          />
                        ) : null}
                      </div>
                    </Card>
                  </div>
                ))}
                
                {/* Loading indicator when processing */}
                {loading && (
                  <div className="text-left">
                    <Card className="inline-block max-w-[85%] lg:max-w-none bg-card">
                      <div className="p-3 lg:p-4">
                        <div className="flex items-center gap-3">
                          <div className="animate-pulse">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          </div>
                          <div className="animate-pulse">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          </div>
                          <div className="animate-pulse">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <p className="text-sm text-muted-foreground">Sto analizzando i documenti normativi...</p>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t p-3 sm:p-4 lg:p-6 bg-card safe-area-bottom">
          <div className="max-w-3xl mx-auto w-full">
            {/* Attached files preview */}
            {attachedFiles.length > 0 && (
              <div className="mb-2 lg:mb-3 flex flex-wrap gap-2 animate-fade-in">
                {attachedFiles.map((file, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-2 px-2 lg:px-3 py-1 lg:py-1.5 animate-scale-in">
                    <FileText className="w-3 h-3" />
                    <span className="text-xs max-w-[100px] lg:max-w-[150px] truncate">{file.name}</span>
                    <button
                      onClick={() => removeFile(idx)}
                      className="hover:text-destructive min-w-[24px] min-h-[24px] flex items-center justify-center active:scale-95 transition-transform"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="h-12 w-12 lg:h-[60px] lg:w-[60px] shrink-0 active:scale-95 transition-transform touch-manipulation"
              >
                <Paperclip className="w-5 h-5" />
              </Button>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Scrivi la tua domanda o carica file/immagini per l'analisi di conformità..."
                className="min-h-[48px] lg:min-h-[60px] text-base resize-none touch-manipulation"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={loading || (!message.trim() && attachedFiles.length === 0)}
                size="icon"
                className="h-12 w-12 lg:h-[60px] lg:w-[60px] shrink-0 active:scale-95 transition-all disabled:opacity-50 touch-manipulation"
              >
                {loading ? (
                  <div className="animate-spin">⏳</div>
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Chat;
