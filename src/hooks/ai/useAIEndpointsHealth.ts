import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EndpointHealth {
  model: string;
  status: 'ok' | 'error' | 'unconfigured';
  latency_ms: number | null;
  error?: string;
  endpoint_configured: boolean;
}

export interface HealthCheckResult {
  success: boolean;
  checked_at: string;
  endpoints: EndpointHealth[];
}

export function useAIEndpointsHealth(enabled = false) {
  return useQuery({
    queryKey: ['ai-endpoints-health'],
    queryFn: async (): Promise<HealthCheckResult> => {
      const { data, error } = await supabase.functions.invoke('ai-health-check');
      if (error) throw error;
      return data as HealthCheckResult;
    },
    enabled,
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
