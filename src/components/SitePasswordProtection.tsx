import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Shield, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const passwordSchema = z.string()
  .min(1, "Inserisci la password")
  .max(200, "Password troppo lunga");

interface SitePasswordProtectionProps {
  children: React.ReactNode;
}

export const SitePasswordProtection = ({ children }: SitePasswordProtectionProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const { toast } = useToast();

  // SECURITY: Prevent dev tools inspection
  useEffect(() => {
    const detectDevTools = () => {
      const threshold = 160;
      if (window.outerWidth - window.innerWidth > threshold || 
          window.outerHeight - window.innerHeight > threshold) {
        // DevTools likely open - clear auth
        if (!isAuthenticated) {
          // Preserve browser diagnostics while the access screen is visible.
        }
      }
    };

    const interval = setInterval(detectDevTools, 1000);
    
    // Disable right-click on password screen
    const handleContextMenu = (e: MouseEvent) => {
      if (!isAuthenticated) {
        e.preventDefault();
      }
    };
    
    // Disable F12 and common dev tools shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isAuthenticated) {
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && e.key === 'I') ||
            (e.ctrlKey && e.shiftKey && e.key === 'J') ||
            (e.ctrlKey && e.key === 'U')) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(interval);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAuthenticated]);


  useEffect(() => {
    // SECURITY: Verify JWT token on mount
    const verifyToken = async () => {
      const token = sessionStorage.getItem("site_auth_token");
      
      if (!token) {
        setIsChecking(false);
        return;
      }

      try {
        // Call verify-token endpoint
        const url = new URL(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-site-password?action=verify-token`
        );
        
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
          }
        });

        const result = await response.json();

        if (result.valid) {
          setIsAuthenticated(true);
        } else {
          // Token invalid or expired - clear it
          sessionStorage.removeItem("site_auth_token");
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        sessionStorage.removeItem("site_auth_token");
      }
      
      setIsChecking(false);
    };

    verifyToken();
  }, []);

  useEffect(() => {
    // Check lockout status
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const timer = setInterval(() => {
        if (Date.now() >= lockoutUntil) {
          setLockoutUntil(null);
          setFailedAttempts(0);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if locked out
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remainingSeconds = Math.ceil((lockoutUntil - Date.now()) / 1000);
      toast({
        title: "Troppi tentativi",
        description: `Attendi ${Math.ceil(remainingSeconds / 60)} minuti prima di riprovare`,
        variant: "destructive"
      });
      return;
    }

    // Validate password
    try {
      passwordSchema.parse(password);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Errore",
          description: error.errors[0].message,
          variant: "destructive"
        });
        return;
      }
    }

    setIsLoading(true);

    // SECURITY: Create a copy and immediately clear the original
    const passwordCopy = password.trim();
    setPassword(""); // Clear immediately from state
    
    try {
      // SECURITY: Send password only once, never log it
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-site-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, 
          },
          body: JSON.stringify({ password: passwordCopy }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(`Password verification failed (${response.status})`);

      if (data.valid && data.token) {
        // Success - store JWT token
        sessionStorage.setItem("site_auth_token", data.token);
        
        setIsAuthenticated(true);
        setFailedAttempts(0);
        
        toast({
          title: "Accesso consentito",
          description: "Benvenuto in RegBrain"
        });
      } else {
        // Failed attempt
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);
        
        if (newFailedAttempts >= 3) {
          // Lock out for 15 minutes
          const lockout = Date.now() + (15 * 60 * 1000);
          setLockoutUntil(lockout);
          toast({
            title: "Troppi tentativi falliti",
            description: "Account bloccato per 15 minuti",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Accesso negato",
            description: `Password non corretta (${3 - newFailedAttempts} tentativi rimanenti)`,
            variant: "destructive"
          });
        }
      }
    } catch (error: any) {
      // Log only the error category and HTTP status, never request bodies or credentials.
      console.warn("Site access request failed", JSON.stringify({
        name: error?.name,
        status: error?.context?.status,
        cause: error?.context instanceof Error ? error.context.message : undefined,
        message: error?.message,
      }));
      toast({
        title: "Errore",
        description: "Impossibile verificare la password. Riprova.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // CRITICAL: Block all rendering until authentication is checked
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <div className="animate-pulse text-muted-foreground">Verifica accesso...</div>
      </div>
    );
  }

  // CRITICAL: Only show content if authenticated
  if (!isAuthenticated) {
    const remainingTime = lockoutUntil ? Math.ceil((lockoutUntil - Date.now()) / 60000) : 0;
    const isLockedOut = remainingTime > 0;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-8 h-8 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold">RegBrain</h1>
              <p className="text-muted-foreground mt-2">
                Accesso riservato - Inserisci la password
              </p>
              {isLockedOut && (
                <p className="text-destructive text-sm mt-2">
                  Account bloccato per {remainingTime} minuti
                </p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password di accesso"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={isLoading || isLockedOut}
                  autoFocus={!isLockedOut}
                  maxLength={200}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {failedAttempts > 0 && failedAttempts < 3 && (
                <p className="text-xs text-destructive">
                  {3 - failedAttempts} {failedAttempts === 2 ? 'tentativo rimanente' : 'tentativi rimanenti'}
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || isLockedOut}
            >
              {isLoading ? "Verifica in corso..." : isLockedOut ? `Bloccato (${remainingTime}min)` : "Accedi"}
            </Button>
          </form>

          <div className="text-center text-xs text-muted-foreground">
            <p>🔒 Accesso protetto con sistema anti-bruteforce</p>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
