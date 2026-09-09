import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, Mail, CheckCircle, Clock, Award } from "lucide-react";

interface TeamMember {
  id: string;
  member_email: string;
  role: string;
  status: string;
  invited_at: string;
  joined_at: string | null;
}

interface TeamBenefits {
  team_size: number;
  discount_percentage: number;
  has_collaboration_features: boolean;
  has_priority_support: boolean;
  has_advanced_analytics: boolean;
}

export function TeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [benefits, setBenefits] = useState<TeamBenefits | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("DPO");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadTeamData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [membersRes, benefitsRes] = await Promise.all([
        supabase
          .from("team_members")
          .select("*")
          .eq("team_owner_id", user.id)
          .order("invited_at", { ascending: false }),
        supabase
          .from("team_benefits")
          .select("*")
          .eq("user_id", user.id)
          .single(),
      ]);

      if (membersRes.data) setMembers(membersRes.data);
      if (benefitsRes.data) setBenefits(benefitsRes.data);
    } catch (error) {
      console.error("Error loading team data:", error);
    }
  };

  const inviteMember = async () => {
    if (!email || !role) {
      toast({
        title: "Errore",
        description: "Inserisci email e ruolo",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("team_members").insert({
        team_owner_id: user.id,
        member_email: email,
        role,
      });

      if (error) throw error;

      await supabase.rpc("update_team_benefits", { p_user_id: user.id });

      toast({
        title: "Invito inviato!",
        description: `Invito inviato a ${email}`,
      });

      setEmail("");
      setRole("DPO");
      await loadTeamData();
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
    loadTeamData();
  }, []);

  const getBenefitsBadge = () => {
    if (!benefits) return null;
    
    if (benefits.team_size >= 10) return { label: "Enterprise", variant: "default" as const };
    if (benefits.team_size >= 5) return { label: "Professional", variant: "secondary" as const };
    if (benefits.team_size >= 3) return { label: "Team", variant: "outline" as const };
    return { label: "Starter", variant: "outline" as const };
  };

  const badge = getBenefitsBadge();

  return (
    <div className="space-y-6">
      {benefits && (
        <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Vantaggi Team
              {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-background/50 rounded-lg">
                <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{benefits.team_size}</p>
                <p className="text-xs text-muted-foreground">Membri</p>
              </div>
              <div className="text-center p-3 bg-background/50 rounded-lg">
                <p className="text-2xl font-bold text-green-500">
                  {benefits.discount_percentage}%
                </p>
                <p className="text-xs text-muted-foreground">Sconto</p>
              </div>
              <div className="text-center p-3 bg-background/50 rounded-lg">
                <CheckCircle
                  className={`h-6 w-6 mx-auto mb-2 ${
                    benefits.has_collaboration_features ? "text-green-500" : "text-gray-400"
                  }`}
                />
                <p className="text-xs text-muted-foreground">Collaborazione</p>
              </div>
              <div className="text-center p-3 bg-background/50 rounded-lg">
                <CheckCircle
                  className={`h-6 w-6 mx-auto mb-2 ${
                    benefits.has_priority_support ? "text-green-500" : "text-gray-400"
                  }`}
                />
                <p className="text-xs text-muted-foreground">Supporto Priority</p>
              </div>
            </div>

            <div className="p-3 bg-background/80 rounded-lg border">
              <p className="text-sm font-medium mb-2">🎯 Sblocca più vantaggi:</p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>✓ 3+ membri: 10% sconto + Analytics avanzate</li>
                <li>✓ 5+ membri: 20% sconto + Supporto prioritario</li>
                <li>✓ 10+ membri: 30% sconto + Tutti i vantaggi Enterprise</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invita Membri del Team
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="collega@azienda.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="role">Ruolo</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DPO">DPO</SelectItem>
                  <SelectItem value="CISO">CISO</SelectItem>
                  <SelectItem value="Legal">Legal</SelectItem>
                  <SelectItem value="Compliance Officer">Compliance Officer</SelectItem>
                  <SelectItem value="Auditor">Auditor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={inviteMember} disabled={loading} className="w-full md:w-auto">
            <Mail className="h-4 w-4 mr-2" />
            Invia Invito
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nessun membro nel team. Invita i tuoi colleghi per collaborare!
            </p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{member.member_email}</p>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                    </div>
                  </div>
                  <Badge
                    variant={member.status === "active" ? "default" : "secondary"}
                  >
                    {member.status === "active" ? (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    ) : (
                      <Clock className="h-3 w-3 mr-1" />
                    )}
                    {member.status === "active" ? "Attivo" : "In attesa"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
