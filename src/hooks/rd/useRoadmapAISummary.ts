import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LatestRoadmapSummary {
  dpi: string | null;
  generated_at: string | null;
  source_count: number | null;
  model: string | null;
}

export function useLatestRoadmapSummary() {
  return useQuery<LatestRoadmapSummary | null>({
    queryKey: ["roadmap_ai_summaries", "latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roadmap_ai_summaries")
        .select("dpi, generated_at, source_count, model")
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
}
