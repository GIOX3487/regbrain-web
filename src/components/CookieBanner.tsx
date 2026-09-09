import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X, Settings, Check } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

const COOKIE_CONSENT_KEY = "cookie_consent";
const COOKIE_PREFERENCES_KEY = "cookie_preferences";

const CookieBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Delay showing banner for better UX
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    } else {
      // Load saved preferences
      const savedPrefs = localStorage.getItem(COOKIE_PREFERENCES_KEY);
      if (savedPrefs) {
        try {
          setPreferences(JSON.parse(savedPrefs));
        } catch (e) {
          console.error("Error parsing cookie preferences:", e);
        }
      }
    }
  }, []);

  const savePreferences = (prefs: CookiePreferences, consentType: string) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, consentType);
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(prefs));
    setPreferences(prefs);
    setShowBanner(false);
    setShowSettings(false);
  };

  const acceptAll = () => {
    savePreferences(
      { necessary: true, analytics: true, marketing: true },
      "all"
    );
  };

  const acceptNecessary = () => {
    savePreferences(
      { necessary: true, analytics: false, marketing: false },
      "necessary"
    );
  };

  const saveCustomPreferences = () => {
    savePreferences(preferences, "custom");
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Main Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 animate-in slide-in-from-bottom-10 duration-500">
        <div className="mx-auto max-w-4xl">
          <div className="bg-card border border-border rounded-xl shadow-2xl p-6 relative">
            {/* Close button */}
            <button
              onClick={acceptNecessary}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Chiudi"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Icon and Text */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Cookie className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">Utilizziamo i Cookie</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Utilizziamo cookie tecnici necessari per il funzionamento del sito e cookie analitici 
                  per migliorare la tua esperienza. Puoi scegliere quali cookie accettare.{" "}
                  <Link to="/cookie-policy" className="text-primary hover:underline">
                    Leggi la Cookie Policy
                  </Link>
                </p>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(true)}
                  className="gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Personalizza
                </Button>
                <Button
                  variant="outline"
                  onClick={acceptNecessary}
                >
                  Solo necessari
                </Button>
                <Button
                  onClick={acceptAll}
                  className="gap-2"
                >
                  <Check className="h-4 w-4" />
                  Accetta tutti
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Impostazioni Cookie
            </DialogTitle>
            <DialogDescription>
              Scegli quali categorie di cookie desideri accettare. I cookie necessari 
              non possono essere disattivati.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Necessary Cookies */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Cookie Necessari</Label>
                  <p className="text-sm text-muted-foreground">
                    Essenziali per il funzionamento del sito (autenticazione, sicurezza)
                  </p>
                </div>
                <Switch
                  checked={preferences.necessary}
                  disabled
                  aria-label="Cookie necessari (sempre attivi)"
                />
              </div>
              <p className="text-xs text-muted-foreground italic">
                Sempre attivi - Non possono essere disabilitati
              </p>
            </div>

            <Separator />

            {/* Analytics Cookies */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Cookie Analitici</Label>
                <p className="text-sm text-muted-foreground">
                  Ci aiutano a capire come utilizzi il sito per migliorarlo
                </p>
              </div>
              <Switch
                checked={preferences.analytics}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, analytics: checked })
                }
                aria-label="Cookie analitici"
              />
            </div>

            <Separator />

            {/* Marketing Cookies */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Cookie di Marketing</Label>
                <p className="text-sm text-muted-foreground">
                  Attualmente non utilizzati
                </p>
              </div>
              <Switch
                checked={preferences.marketing}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, marketing: checked })
                }
                disabled
                aria-label="Cookie di marketing (non utilizzati)"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowSettings(false)}
              className="flex-1"
            >
              Annulla
            </Button>
            <Button
              onClick={saveCustomPreferences}
              className="flex-1"
            >
              Salva preferenze
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground mt-2">
            Puoi modificare le preferenze in qualsiasi momento dalle impostazioni.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CookieBanner;
