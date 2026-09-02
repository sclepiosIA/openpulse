import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useEmailAnalytics() {
  const analyticsQuery = useQuery({
    queryKey: ['email-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_email_analytics' as never,
        { p_days: 30 } as never
      );
      if (error) throw error;
      const result = data as Record<string, any>;
      return result;
    },
    staleTime: 5 * 60 * 1000,
  });

  const raw = analyticsQuery.data;

  return {
    volumeData: raw?.volume || [],
    commercialData: raw?.commercial ? {
      totalEtablissements: raw.commercial.totalEtablissements || 0,
      conversionRate: raw.commercial.suggestions?.total > 0
        ? ((raw.commercial.suggestions.accepted / raw.commercial.suggestions.total) * 100).toFixed(1)
        : '0',
      suggestions: {
        accepted: raw.commercial.suggestions?.accepted || 0,
        rejected: raw.commercial.suggestions?.rejected || 0,
        pending: raw.commercial.suggestions?.pending || 0,
        total: raw.commercial.suggestions?.total || 0,
      },
      avgConfidence: raw.commercial.suggestions?.avg_confidence
        ? (raw.commercial.suggestions.avg_confidence * 100).toFixed(1)
        : '0',
    } : undefined,
    aiQualityData: raw?.aiQuality ? {
      avgProcessingTime: String(raw.aiQuality.avgProcessingTime || '0'),
      totalTokens: raw.aiQuality.totalTokens || 0,
      estimatedCost: String(raw.aiQuality.estimatedCost || '0.00'),
      successRate: String(raw.aiQuality.successRate || '100'),
      recentLogs: raw.aiQuality.recentLogs || [],
    } : undefined,
    threadsData: raw?.threads || [],
    isLoading: analyticsQuery.isLoading,
    isError: analyticsQuery.isError,
    refetch: analyticsQuery.refetch,
  };
}
