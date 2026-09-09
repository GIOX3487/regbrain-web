import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Bell, Save } from "lucide-react";

interface Preferences {
  new_regulations: boolean;
  compliance_deadlines: boolean;
  team_activity: boolean;
  weekly_insights: boolean;
  achievement_unlocked: boolean;
  email_frequency: string;
}

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preferences>({
    new_regulations: true,
    compliance_deadlines: true,
    team_activity: true,
    weekly_insights: true,
    achievement_unlocked: true,
    email_frequency: "daily",
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setPreferences({
          new_regulations: data.new_regulations,
          compliance_deadlines: data.compliance_deadlines,
          team_activity: data.team_activity,
          weekly_insights: data.weekly_insights,
          achievement_unlocked: data.achievement_unlocked,
          email_frequency: data.email_frequency,
        });
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    }
  };

  const savePreferences = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user.id,
          ...preferences,
        });

      if (error) throw error;

      toast({
        title: "Preferenze salvate",
        description: "Le tue preferenze di notifica sono state aggiornate",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  const updatePreference = (key: keyof Preferences, value: boolean | string) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Preferenze Notifiche
        </CardTitle>
        <CardDescription>
          Personalizza come e quando ricevere le notifiche
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="new_regulations" className="flex-1">
              <div className="font-medium">Nuove Normative</div>
              <div className="text-sm text-muted-foreground">
                Ricevi alert per nuove normative nel tuo settore
              </div>
            </Label>
            <Switch
              id="new_regulations"
              checked={preferences.new_regulations}
              onCheckedChange={(checked) =>
                updatePreference("new_regulations", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="compliance_deadlines" className="flex-1">
              <div className="font-medium">Scadenze Compliance</div>
              <div className="text-sm text-muted-foreground">
                Promemoria per scadenze e deadline importanti
              </div>
            </Label>
            <Switch
              id="compliance_deadlines"
              checked={preferences.compliance_deadlines}
              onCheckedChange={(checked) =>
                updatePreference("compliance_deadlines", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="team_activity" className="flex-1">
              <div className="font-medium">Attività Team</div>
              <div className="text-sm text-muted-foreground">
                Notifiche per azioni e commenti del team
              </div>
            </Label>
            <Switch
              id="team_activity"
              checked={preferences.team_activity}
              onCheckedChange={(checked) =>
                updatePreference("team_activity", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="weekly_insights" className="flex-1">
              <div className="font-medium">Newsletter Settimanale</div>
              <div className="text-sm text-muted-foreground">
                Insights e statistiche personalizzate ogni settimana
              </div>
            </Label>
            <Switch
              id="weekly_insights"
              checked={preferences.weekly_insights}
              onCheckedChange={(checked) =>
                updatePreference("weekly_insights", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="achievement_unlocked" className="flex-1">
              <div className="font-medium">Achievement Sbloccati</div>
              <div className="text-sm text-muted-foreground">
                Celebra i tuoi traguardi con notifiche di achievement
              </div>
            </Label>
            <Switch
              id="achievement_unlocked"
              checked={preferences.achievement_unlocked}
              onCheckedChange={(checked) =>
                updatePreference("achievement_unlocked", checked)
              }
            />
          </div>
        </div>

        <div className="pt-4 border-t">
          <Label htmlFor="email_frequency" className="mb-2 block">
            Frequenza Email
          </Label>
          <Select
            value={preferences.email_frequency}
            onValueChange={(value) => updatePreference("email_frequency", value)}
          >
            <SelectTrigger id="email_frequency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="realtime">Tempo reale</SelectItem>
              <SelectItem value="daily">Giornaliera</SelectItem>
              <SelectItem value="weekly">Settimanale</SelectItem>
              <SelectItem value="never">Mai (solo in-app)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={savePreferences} disabled={loading} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Salva Preferenze
        </Button>
      </CardContent>
    </Card>
  );
}
