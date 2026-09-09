import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TranslationContent {
  assessmentTitle?: string;
  assessmentDescription?: string;
  gaps?: Array<{
    id: string;
    description?: string;
    requirement?: string;
    currentState?: string;
    recommendedActions?: string[];
  }>;
  actionPlans?: Array<{
    id: string;
    title?: string;
    description?: string;
  }>;
  benchmark?: {
    competitive_insights?: Array<any>;
    quick_wins?: Array<any>;
    areas_ahead_of_market?: Array<any>;
    areas_behind_of_market?: Array<any>;
  };
}

export const useContentTranslation = (
  selectedLanguage: string,
  assessment: any,
  gaps: any[],
  actionPlans: any[],
  benchmark?: any
) => {
  const [translatedContent, setTranslatedContent] = useState<TranslationContent>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log('Translation effect triggered:', { selectedLanguage, hasAssessment: !!assessment });
    if (selectedLanguage !== 'it' && assessment) {
      console.log('Starting translation to:', selectedLanguage);
      translateContent();
    } else {
      console.log('Clearing translated content');
      setTranslatedContent({});
    }
  }, [selectedLanguage, assessment, gaps, actionPlans, benchmark]);

  const translateContent = async () => {
    if (isTranslating) return;
    
    console.log('translateContent called');
    setIsTranslating(true);
    try {
      const contentToTranslate = {
        assessmentTitle: assessment?.title,
        assessmentDescription: assessment?.description,
        gaps: gaps.map(gap => ({
          id: gap.id,
          description: gap.gap_description,
          requirement: gap.requirement_description,
          currentState: gap.current_state,
          recommendedActions: gap.recommended_actions
        })),
        actionPlans: actionPlans.map(plan => ({
          id: plan.id,
          title: plan.title,
          description: plan.description
        })),
        benchmark: benchmark ? {
          competitive_insights: benchmark.competitive_insights,
          quick_wins: benchmark.quick_wins,
          areas_ahead_of_market: benchmark.areas_ahead_of_market,
          areas_behind_market: benchmark.areas_behind_market
        } : undefined
      };

      console.log('Calling translate-content function with:', { targetLanguage: selectedLanguage });

      const { data, error } = await supabase.functions.invoke('translate-content', {
        body: {
          content: JSON.stringify(contentToTranslate),
          targetLanguage: selectedLanguage
        }
      });

      console.log('Translation response:', { data, error });

      if (error) {
        console.error('Translation function error:', error);
        throw error;
      }

      if (data?.translatedText) {
        console.log('Received translated text, parsing...');
        try {
          const parsed = JSON.parse(data.translatedText);
          console.log('Parsed translated content:', parsed);
          setTranslatedContent(parsed);
          toast({
            title: "Translation Complete",
            description: "Content has been translated successfully.",
          });
        } catch (e) {
          console.error('Error parsing translated content:', e, 'Raw text:', data.translatedText);
        }
      }
    } catch (error) {
      console.error('Translation error:', error);
      toast({
        title: "Translation Error",
        description: "Could not translate content. Showing original text.",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const getTranslatedText = (field: string, id?: string): string | string[] | null => {
    if (selectedLanguage === 'it' || !translatedContent || Object.keys(translatedContent).length === 0) {
      return null;
    }

    if (field === 'assessmentTitle') {
      return translatedContent.assessmentTitle || null;
    }

    if (field === 'assessmentDescription') {
      return translatedContent.assessmentDescription || null;
    }

    if (field.startsWith('gap_') && id) {
      const gap = translatedContent.gaps?.find((g: any) => g.id === id);
      if (gap) {
        if (field === 'gap_description') return gap.description || null;
        if (field === 'gap_requirement') return gap.requirement || null;
        if (field === 'gap_currentState') return gap.currentState || null;
        if (field === 'gap_recommendedActions') return gap.recommendedActions || null;
      }
    }

    if (field.startsWith('action_') && id) {
      const action = translatedContent.actionPlans?.find((a: any) => a.id === id);
      if (action) {
        if (field === 'action_title') return action.title || null;
        if (field === 'action_description') return action.description || null;
      }
    }

    if (field === 'benchmark_competitive_insights') {
      return translatedContent.benchmark?.competitive_insights || null;
    }

    if (field === 'benchmark_quick_wins') {
      return translatedContent.benchmark?.quick_wins || null;
    }

    if (field === 'benchmark_areas_ahead') {
      return translatedContent.benchmark?.areas_ahead_of_market || null;
    }

    if (field === 'benchmark_areas_behind') {
      return translatedContent.benchmark?.areas_behind_of_market || null;
    }

    return null;
  };

  return { translatedContent, isTranslating, getTranslatedText };
};
