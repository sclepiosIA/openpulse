import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportSourceKey, ReportDataResponse, DashboardFilters } from '@/types/report';

interface UseReportDataParams {
  source?: ReportSourceKey;
  filters?: DashboardFilters;
  enabled?: boolean;
}

export function useReportData({ source, filters, enabled = true }: UseReportDataParams) {
  return useQuery({
    queryKey: ['report_data', source, filters],
    queryFn: async (): Promise<ReportDataResponse> => {
      if (!source) throw new Error('source manquant');
      const { data, error } = await supabase.rpc('get_report_data', {
        source_key: source,
        params: JSON.parse(JSON.stringify(filters || {})),
      });
      if (error) throw error;
      return data as unknown as ReportDataResponse;
    },
    enabled: !!source && enabled,
    staleTime: 60_000,
    retry: 1,
  });
}
