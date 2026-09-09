import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useGamification } from "@/hooks/useGamification";
import { TrendingUp, FileText, Shield, Users, Target } from "lucide-react";

export function MaturityScore() {
  const { maturityScore, loading } = useGamification();

  if (loading || !maturityScore) {
    return null;
  }

  const categories = [
    {
      label: "Valutazioni",
      score: maturityScore.assessments_score,
      icon: Target,
      color: "text-blue-500",
    },
    {
      label: "Documentazione",
      score: maturityScore.documentation_score,
      icon: FileText,
      color: "text-green-500",
    },
    {
      label: "Proattività",
      score: maturityScore.proactivity_score,
      icon: Shield,
      color: "text-purple-500",
    },
    {
      label: "Team",
      score: maturityScore.team_score,
      icon: Users,
      color: "text-orange-500",
    },
  ];

  const nextLevelProgress =
    ((maturityScore.total_score % 100) / 100) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Maturità Compliance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-2">
            <span className="text-3xl font-bold text-primary">
              {maturityScore.level}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Livello di Maturità
          </p>
          <div className="mt-4">
            <Progress value={nextLevelProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {maturityScore.total_score % 100} / 100 punti al prossimo livello
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <div key={category.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${category.color}`} />
                    {category.label}
                  </span>
                  <span className="font-medium">{category.score}</span>
                </div>
                <Progress value={(category.score / 100) * 100} className="h-1" />
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm">
            <strong>Punteggio Totale:</strong> {maturityScore.total_score}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Completa valutazioni, carica documenti e lavora in team per aumentare la tua maturità!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
