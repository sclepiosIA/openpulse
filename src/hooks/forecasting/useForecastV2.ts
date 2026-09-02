import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ForecastV2Factor {
  label: string;
  points: number;
}

export interface ForecastV2Deal {
  id: string;
  nom: string;
  statut: string;
  probability_v1: number;
  probability_v2: number;
  delta: number;
  deal_value: number;
  weighted_v1: number;
  weighted_v2: number;
  closing_date: string;
  factors: ForecastV2Factor[];
}

export interface ForecastV2Kpis {
  pipeline_raw: number;
  pipeline_weighted_v1: number;
  pipeline_weighted_v2: number;
  current_quarter_v2: number;
  won_total: number;
}

export interface ForecastV2 {
  range: { start: string; end: string };
  kpis: ForecastV2Kpis;
  top_deals: ForecastV2Deal[];
  model_version: string;
  computed_at: string;
}

export function useForecastV2(start?: string, end?: string) {
  return useQuery({
    queryKey: ['sales-forecast-v2', start ?? null, end ?? null],
    queryFn: async (): Promise<ForecastV2> => {
      const { data, error } = await supabase.rpc('get_sales_forecast_v2', {
        p_start: start ?? undefined,
        p_end: end ?? undefined,
      });
      if (error) throw error;
      return data as unknown as ForecastV2;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
