import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NewsCard } from "@/components/NewsCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Newspaper } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export const NewsSection = () => {
  const { data: news, isLoading } = useQuery({
    queryKey: ['latest-news'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_updates')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <section className="py-20 px-6 bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-12">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Newspaper className="h-8 w-8 text-primary" />
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Aggiornamenti Normativi
              </h2>
            </div>
            <p className="text-muted-foreground text-lg">
              Resta aggiornato sulle ultime novità in materia di compliance
            </p>
          </div>
          
          <Button asChild variant="outline" className="hidden md:flex">
            <Link to="/aggiornamenti">
              Vedi tutti
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[280px] rounded-lg" />
            ))}
          </div>
        ) : news && news.length > 0 ? (
          <>
            <div className="grid md:grid-cols-3 gap-6">
              {news.map((item) => (
                <NewsCard
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  summary={item.summary}
                  source={item.source}
                  sourceUrl={item.source_url || undefined}
                  publishedAt={item.published_at}
                  regulationType={item.regulation_type}
                  impactLevel={item.impact_level as 'low' | 'medium' | 'high' || 'medium'}
                />
              ))}
            </div>

            <div className="mt-8 text-center md:hidden">
              <Button asChild variant="outline">
                <Link to="/aggiornamenti">
                  Vedi tutti gli aggiornamenti
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
            <Newspaper className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Nessun aggiornamento disponibile al momento
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
