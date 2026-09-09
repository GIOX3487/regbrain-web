import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleRedirectAfterLogin();
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === 'SIGNED_IN') {
        handleRedirectAfterLogin();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleRedirectAfterLogin = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if this is a demo account that needs fresh onboarding
      const forceDemoOnboarding = sessionStorage.getItem('force_demo_onboarding');
      if (forceDemoOnboarding === 'true') {
        // Delete any existing profile for demo account to force fresh configuration
        await supabase
          .from('profiles')
          .delete()
          .eq('id', user.id);
        
        // IMPORTANTE: NON rimuovere il flag qui - lo rimuoverà l'Onboarding dopo aver salvato il profilo
        // Questo assicura che l'utente debba sempre completare l'onboarding
        navigate('/onboarding');
        return;
      }

      // Check if we need to return to a specific page
      const returnPath = sessionStorage.getItem('auth_redirect');

      // Check if profile exists
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      // If no profile, go to onboarding
      if (!profile || error) {
        navigate('/onboarding');
        return;
      }

      // If profile exists and we have a specific return path, use it
      if (returnPath) {
        sessionStorage.removeItem('auth_redirect');
        navigate(returnPath);
      } else {
        // Default to chat
        navigate('/chat');
      }
    } catch (error) {
      console.error('Error in handleRedirectAfterLogin:', error);
      navigate('/onboarding');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Errore di accesso",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'accesso",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/onboarding`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        toast({
          title: "Errore di registrazione",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Registrazione completata",
          description: "Controlla la tua email per confermare l'account",
        });
      }
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la registrazione",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role: 'dpo' | 'ciso') => {
    setLoading(true);
    const demoCredentials = {
      dpo: { 
        email: 'dpo@demo.regbrain.com',
        password: 'demo123456',
      },
      ciso: { 
        email: 'ciso@demo.regbrain.com',
        password: 'demo123456',
      }
    };

    const { email, password } = demoCredentials[role];

    try {
      // SEMPRE forzare l'onboarding per gli account demo
      sessionStorage.setItem('force_demo_onboarding', 'true');
      
      // Prova il login
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Se l'utente non esiste, crealo
      if (signInError?.message.includes('Invalid login credentials')) {
        console.log('Creating demo account:', email);
        
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`
          }
        });

        if (signUpError) {
          throw new Error(signUpError.message);
        }

        // Fai il login dopo la registrazione
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) {
          throw new Error(loginError.message);
        }

        toast({
          title: "Account demo creato",
          description: `Configura il tuo profilo ${role.toUpperCase()}`,
        });
      } else if (signInError) {
        throw new Error(signInError.message);
      } else {
        toast({
          title: "Login effettuato",
          description: `Configura il tuo profilo ${role.toUpperCase()}`,
        });
      }

    } catch (error: any) {
      console.error('Demo login error:', error);
      // In caso di errore, rimuovi il flag
      sessionStorage.removeItem('force_demo_onboarding');
      toast({
        title: "Errore demo",
        description: error.message || "Impossibile accedere all'account demo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 px-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Shield className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">RegBrain</h1>
          <p className="text-muted-foreground">Accedi alla piattaforma regtech</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Autenticazione</CardTitle>
            <CardDescription>
              Accedi o registrati per iniziare
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Accedi</TabsTrigger>
                <TabsTrigger value="signup">Registrati</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="nome@esempio.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Caricamento..." : "Accedi"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="nome@esempio.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimo 6 caratteri
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Caricamento..." : "Registrati"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">O usa account demo</span>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => handleDemoLogin('dpo')}
              disabled={loading}
              className="w-full"
            >
              Prova Demo
            </Button>
          </CardFooter>
        </Card>

        <div className="text-center">
          <Button variant="link" onClick={() => navigate('/')}>
            ← Torna alla home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
