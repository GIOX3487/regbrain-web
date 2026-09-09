import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGamification } from "@/hooks/useGamification";
import { Flame, TrendingUp } from "lucide-react";

export function StreakTracker() {
  const { streak, loading } = useGamification();

  if (loading || !streak) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          Streak di Attività
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Streak Corrente</p>
            <p className="text-3xl font-bold text-orange-500">
              {streak.current_streak} 🔥
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              giorni consecutivi
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Record Personale</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              {streak.longest_streak}
            </p>
            <p className="text-xs text-muted-foreground mt-1">giorni</p>
          </div>
        </div>

        {streak.current_streak >= 7 && (
          <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <p className="text-sm font-medium">
              🎉 Ottimo lavoro! Mantieni lo streak per sbloccare achievement!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
