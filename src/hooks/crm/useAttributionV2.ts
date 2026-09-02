import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AttributionModel = 'linear' | 'time-decay' | 'u-shape';

export interface AttributionV2Channel {
  channel: string;
  touchpoints: number;
  etablissements: number;
  signed: number;
  conversion_rate: number;
  attributed_value: number;
  attributed_touches: number;
  value_per_touch: number;
}

export interface AttributionV2 {
  model: AttributionModel;
  range: { start: string; end: string };
  computed_at: string;
  channels: AttributionV2Channel[];
  totals: {
    touchpoints: number;
    etablissements: number;
    signed: number;
    attributed_value: number;
  };
}

export function useAttributionV2(model: AttributionModel = 'time-decay', start?: string, end?: string) {
  return useQuery({
    queryKey: ['attribution-v2', model, start ?? null, end ?? null],
    queryFn: async (): Promise<AttributionV2> => {
      const { data, error } = await supabase.rpc('compute_attribution_v2', {
        p_model: model,
        p_start: start ?? undefined,
        p_end: end ?? undefined,
      });
      if (error) throw error;
      return data as unknown as AttributionV2;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
