import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LogOut, Download, Trash2, MessageSquare, Shield, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MobileNav } from "@/components/MobileNav";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface QueryLog {
  id: string;
  user_id: string;
  created_at: string;
  question: string;
  answer: string;
  model: string;
  risk_level: string | null;
  latency_ms: number | null;
  citations: any;
}

const Audit = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [queries, setQueries] = useState<QueryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuthAndLoad();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
      if (session) loadQueries();
      else setQueries([]);
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkAuthAndLoad = async () => {
    setChecking(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Salva dove l'utente voleva andare
      sessionStorage.setItem('auth_redirect', '/audit');
      toast({
        title: "Accesso richiesto",
        description: "Effettua l'accesso per visualizzare l'audit trail",
      });
      navigate('/auth');
      return;
    }
    
    setIsAuthenticated(true);
    setChecking(false);
    await loadQueries();
  };

  const loadQueries = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user found');
        setQueries([]);
        setLoading(false);
        return;
      }

      console.log('Loading queries for user:', user.id);

      const { data, error } = await supabase
        .from('query_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log(`Loaded ${data?.length || 0} queries for current user`);
      
      // Double check that all queries belong to the current user (extra security)
      const userQueries = (data || []).filter(q => q.user_id === user.id);
      
      if (userQueries.length !== (data?.length || 0)) {
        console.error('WARNING: Some queries did not belong to current user! RLS policy may be failing.');
      }
      
      setQueries(userQueries);
    } catch (error: any) {
      console.error('Error loading queries:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare l'audit log",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (queries.length === 0) {
      toast({
        title: "Nessun dato",
        description: "Non ci sono dati da esportare",
        variant: "destructive"
      });
      return;
    }

    const headers = ['Data', 'Domanda', 'Risposta', 'Modello', 'Latenza (ms)', 'Citazioni'];
    const csvContent = [
      headers.join(','),
      ...queries.map(q => [
        format(new Date(q.created_at), 'dd/MM/yyyy HH:mm'),
        `"${q.question.replace(/"/g, '""')}"`,
        `"${q.answer.replace(/"/g, '""')}"`,
        q.model,
        q.latency_ms || '',
        (q.citations?.length || 0)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_log_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    
    toast({
      title: "Esportato",
      description: `${queries.length} record esportati con successo`
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const deleteQuery = async (queryId: string) => {
    try {
      const { error } = await supabase
        .from('query_log')
        .delete()
        .eq('id', queryId);

      if (error) throw error;

      await loadQueries();
      toast({
        title: "Eliminato",
        description: "Query eliminata con successo"
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la query",
        variant: "destructive"
      });
    }
  };

  const getRiskBadge = (risk: string | null) => {
    if (!risk) return null;
    
    const colors = {
      high: 'destructive',
      medium: 'default',
      low: 'secondary'
    };
    
    return <Badge variant={colors[risk as keyof typeof colors] as any}>{risk.toUpperCase()}</Badge>;
  };

  const continueConversation = (query: QueryLog) => {
    // Save context to continue conversation with citations
    const conversationContext = {
      previousMessages: [
        { role: 'user', content: query.question },
        { 
          role: 'assistant', 
          content: query.answer,
          citations: query.citations || []
        }
      ],
      queryId: query.id
    };
    
    localStorage.setItem('continueConversation', JSON.stringify(conversationContext));
    navigate('/chat?continue=true');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Already redirecting to /auth
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6 pb-20 lg:pb-6">
      <MobileNav />
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="w-full lg:w-auto">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/chat')}
              className="mb-3 sm:mb-4"
              size="sm"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Torna alla Chat</span>
              <span className="sm:hidden">Chat</span>
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
              <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-primary shrink-0" />
              <span className="hidden sm:inline">Audit Trail Conversazioni</span>
              <span className="sm:inline lg:hidden">Audit Trail</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Traccia delle tue interazioni con RegBrain AI
            </p>
          </div>
          <div className="flex gap-2 w-full lg:w-auto">
            <Button onClick={exportToCSV} variant="outline" size="sm" className="flex-1 lg:flex-none min-h-[44px]">
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Esporta CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Button onClick={handleSignOut} variant="ghost" size="sm" className="flex-1 lg:flex-none min-h-[44px]">
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Esci</span>
              <span className="sm:hidden">Esci</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Query Log</CardTitle>
            <CardDescription>
              {queries.length} conversazioni registrate
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : queries.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nessuna conversazione ancora. Inizia a chattare con RegBrain!
                </p>
                <Button onClick={() => navigate('/chat')} className="mt-4">
                  Vai alla Chat
                </Button>
              </div>
            ) : (
               <div className="overflow-x-auto -mx-4 sm:mx-0">
                 <div className="inline-block min-w-full align-middle">
                   <div className="overflow-hidden">
                     <Table>
                       <TableHeader>
                         <TableRow>
                           <TableHead className="whitespace-nowrap">Data</TableHead>
                           <TableHead className="min-w-[200px]">Domanda</TableHead>
                           <TableHead className="hidden lg:table-cell min-w-[250px]">Risposta</TableHead>
                           <TableHead className="hidden md:table-cell">Modello</TableHead>
                           <TableHead className="hidden md:table-cell">Rischio</TableHead>
                           <TableHead className="hidden lg:table-cell">Latenza</TableHead>
                           <TableHead className="hidden lg:table-cell">Citazioni</TableHead>
                           <TableHead className="text-right whitespace-nowrap">Azioni</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {queries.map((query) => (
                           <TableRow 
                             key={query.id}
                             className="cursor-pointer hover:bg-muted/50 transition-colors"
                             onClick={() => continueConversation(query)}
                           >
                             <TableCell className="whitespace-nowrap text-xs sm:text-sm">
                               {format(new Date(query.created_at), 'dd/MM/yy HH:mm')}
                             </TableCell>
                             <TableCell className="max-w-[200px] truncate text-xs sm:text-sm">
                               {query.question}
                             </TableCell>
                             <TableCell className="hidden lg:table-cell max-w-[250px] truncate text-xs sm:text-sm">
                               {query.answer}
                             </TableCell>
                             <TableCell className="hidden md:table-cell">
                               <Badge variant="outline" className="text-xs">{query.model}</Badge>
                             </TableCell>
                             <TableCell className="hidden md:table-cell">{getRiskBadge(query.risk_level)}</TableCell>
                             <TableCell className="hidden lg:table-cell text-xs sm:text-sm">
                               {query.latency_ms ? `${query.latency_ms}ms` : '-'}
                             </TableCell>
                             <TableCell className="hidden lg:table-cell text-xs sm:text-sm">
                               {query.citations?.length || 0}
                             </TableCell>
                             <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                               <div className="flex gap-1 justify-end">
                                 <Button 
                                   variant="ghost" 
                                   size="sm"
                                   onClick={() => continueConversation(query)}
                                   title="Continua conversazione"
                                   className="h-8 w-8 p-0"
                                 >
                                   <MessageSquare className="w-4 h-4" />
                                 </Button>
                                 <AlertDialog>
                                   <AlertDialogTrigger asChild>
                                     <Button variant="ghost" size="sm" title="Elimina" className="h-8 w-8 p-0">
                                       <Trash2 className="w-4 h-4" />
                                     </Button>
                                   </AlertDialogTrigger>
                                   <AlertDialogContent>
                                     <AlertDialogHeader>
                                       <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                                       <AlertDialogDescription>
                                         Sei sicuro di voler eliminare questa conversazione dall'audit log?
                                         Questa azione non è reversibile.
                                       </AlertDialogDescription>
                                     </AlertDialogHeader>
                                     <AlertDialogFooter>
                                       <AlertDialogCancel>Annulla</AlertDialogCancel>
                                       <AlertDialogAction onClick={() => deleteQuery(query.id)}>
                                         Elimina
                                       </AlertDialogAction>
                                     </AlertDialogFooter>
                                   </AlertDialogContent>
                                 </AlertDialog>
                               </div>
                             </TableCell>
                           </TableRow>
                         ))}
                       </TableBody>
                     </Table>
                   </div>
                 </div>
               </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Audit;
