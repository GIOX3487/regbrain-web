import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Achievement {
  id: string;
  achievement_type: string;
  earned_at: string;
  metadata: any;
}

export interface Streak {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
}

export interface MaturityScore {
  total_score: number;
  level: number;
  assessments_score: number;
  documentation_score: number;
  proactivity_score: number;
  team_score: number;
}

const ACHIEVEMENT_CONFIG = {
  first_assessment: {
    title: "Prima Valutazione",
    description: "Hai completato la tua prima valutazione di compliance",
    icon: "🎯",
  },
  perfect_compliance: {
    title: "Compliance Perfetta",
    description: "Hai raggiunto il 100% di compliance in una valutazione",
    icon: "⭐",
  },
  documents_uploaded_10: {
    title: "Documentatore",
    description: "Hai caricato 10 documenti",
    icon: "📚",
  },
  documents_uploaded_50: {
    title: "Archivista",
    description: "Hai caricato 50 documenti",
    icon: "📖",
  },
  documents_uploaded_100: {
    title: "Bibliotecario Master",
    description: "Hai caricato 100 documenti",
    icon: "🏛️",
  },
  gap_resolved_10: {
    title: "Risolutore",
    description: "Hai risolto 10 gap di compliance",
    icon: "✅",
  },
  gap_resolved_50: {
    title: "Expert Resolver",
    description: "Hai risolto 50 gap di compliance",
    icon: "🎖️",
  },
  week_streak: {
    title: "Una Settimana Costante",
    description: "7 giorni consecutivi di attività",
    icon: "🔥",
  },
  month_streak: {
    title: "Un Mese di Dedizione",
    description: "30 giorni consecutivi di attività",
    icon: "💎",
  },
  team_builder: {
    title: "Team Builder",
    description: "Hai invitato il tuo primo membro del team",
    icon: "👥",
  },
  compliance_expert: {
    title: "Compliance Expert",
    description: "Hai raggiunto il livello 10 di maturità",
    icon: "🏆",
  },
};

export function useGamification() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [maturityScore, setMaturityScore] = useState<MaturityScore | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadGamificationData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [achievementsRes, streakRes, maturityRes] = await Promise.all([
        supabase
          .from("user_achievements")
          .select("*")
          .eq("user_id", user.id)
          .order("earned_at", { ascending: false }),
        supabase
          .from("user_streaks")
          .select("*")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("compliance_maturity_scores")
          .select("*")
          .eq("user_id", user.id)
          .single(),
      ]);

      if (achievementsRes.data) setAchievements(achievementsRes.data);
      if (streakRes.data) setStreak(streakRes.data);
      if (maturityRes.data) setMaturityScore(maturityRes.data);
    } catch (error) {
      console.error("Error loading gamification data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStreak = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.rpc("update_user_streak", { p_user_id: user.id });
      await loadGamificationData();
    } catch (error) {
      console.error("Error updating streak:", error);
    }
  };

  const checkAchievement = async (type: string, metadata = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const existing = achievements.find((a) => a.achievement_type === type);
      if (existing) return;

      const { error } = await supabase
        .from("user_achievements")
        .insert([{
          user_id: user.id,
          achievement_type: type as any,
          metadata,
        }]);

      if (!error) {
        const config = ACHIEVEMENT_CONFIG[type as keyof typeof ACHIEVEMENT_CONFIG];
        toast({
          title: `🎉 Achievement Sbloccato: ${config?.icon} ${config?.title}`,
          description: config?.description,
          duration: 5000,
        });
        await loadGamificationData();
      }
    } catch (error) {
      console.error("Error checking achievement:", error);
    }
  };

  const updateMaturityScore = async (updates: Partial<MaturityScore>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const current = maturityScore || {
        total_score: 0,
        assessments_score: 0,
        documentation_score: 0,
        proactivity_score: 0,
        team_score: 0,
        level: 1,
      };

      const newScore = {
        ...current,
        ...updates,
      };

      newScore.total_score =
        newScore.assessments_score +
        newScore.documentation_score +
        newScore.proactivity_score +
        newScore.team_score;

      newScore.level = Math.floor(newScore.total_score / 100) + 1;

      // Check if record exists
      const { data: existing } = await supabase
        .from("compliance_maturity_scores")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (existing) {
        const { error: updateError } = await supabase
          .from("compliance_maturity_scores")
          .update({
            total_score: newScore.total_score,
            assessments_score: newScore.assessments_score,
            documentation_score: newScore.documentation_score,
            proactivity_score: newScore.proactivity_score,
            team_score: newScore.team_score,
            level: newScore.level,
          })
          .eq("user_id", user.id);
        
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("compliance_maturity_scores")
          .insert({
            user_id: user.id,
            total_score: newScore.total_score,
            assessments_score: newScore.assessments_score,
            documentation_score: newScore.documentation_score,
            proactivity_score: newScore.proactivity_score,
            team_score: newScore.team_score,
            level: newScore.level,
          });
        
        if (insertError) throw insertError;
      }

      await loadGamificationData();
    } catch (error) {
      console.error("Error updating maturity score:", error);
    }
  };

  useEffect(() => {
    loadGamificationData();
    updateStreak();
  }, []);

  return {
    achievements,
    streak,
    maturityScore,
    loading,
    updateStreak,
    checkAchievement,
    updateMaturityScore,
    ACHIEVEMENT_CONFIG,
  };
}
