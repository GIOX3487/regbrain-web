import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGamification } from "@/hooks/useGamification";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export function AchievementsList() {
  const { achievements, loading, ACHIEVEMENT_CONFIG } = useGamification();

  if (loading) {
    return <div>Caricamento achievements...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🏆 I Tuoi Achievement
        </CardTitle>
      </CardHeader>
      <CardContent>
        {achievements.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Completa azioni sulla piattaforma per sbloccare achievements!
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {achievements.map((achievement) => {
              const config = ACHIEVEMENT_CONFIG[achievement.achievement_type as keyof typeof ACHIEVEMENT_CONFIG];
              return (
                <div
                  key={achievement.id}
                  className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                >
                  <div className="text-4xl">{config?.icon}</div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{config?.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {config?.description}
                    </p>
                    <Badge variant="secondary" className="mt-2">
                      {format(new Date(achievement.earned_at), "dd MMM yyyy", {
                        locale: it,
                      })}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
