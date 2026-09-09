import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AchievementsList } from "@/components/gamification/AchievementsList";
import { StreakTracker } from "@/components/gamification/StreakTracker";
import { MaturityScore } from "@/components/gamification/MaturityScore";
import { TeamManagement } from "@/components/team/TeamManagement";
import { Trophy, Flame, TrendingUp, Users } from "lucide-react";

export default function Gamification() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Progressi & Team</h1>
        <p className="text-muted-foreground">
          Monitora i tuoi progressi, sblocca achievements e collabora con il tuo team
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <StreakTracker />
        <MaturityScore />
      </div>

      <Tabs defaultValue="achievements" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto">
          <TabsTrigger value="achievements" className="gap-2">
            <Trophy className="h-4 w-4" />
            Achievements
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="achievements">
          <AchievementsList />
        </TabsContent>

        <TabsContent value="team">
          <TeamManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
