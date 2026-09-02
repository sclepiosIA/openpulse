/**
 * Hook pour l'attribution multi-touch d'un établissement.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AttributionModel, AttributionResult, AttributionTouchpoint } from '@/types/scoring';

export function useProspectAttribution(
  etablissementId: string | undefined,
  model: AttributionModel = 'time_decay'
) {
  return useQuery({
    queryKey: ['prospect-attribution', etablissementId, model],
    enabled: !!etablissementId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AttributionResult> => {
      const { data, error } = await supabase.rpc('compute_attribution', {
        _etablissement_id: etablissementId!,
        _model: model,
      });
      if (error) throw error;
      return (data as unknown as AttributionResult) ?? {
        model,
        by_channel: {} as AttributionResult['by_channel'],
        by_user: {},
        first_touch: null,
        last_touch: null,
      };
    },
  });
}

export function useAttributionTouchpoints(etablissementId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ['attribution-touchpoints', etablissementId, limit],
    enabled: !!etablissementId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<AttributionTouchpoint[]> => {
      const { data, error } = await supabase
        .from('attribution_touchpoints')
        .select('*')
        .eq('etablissement_id', etablissementId!)
        .order('occurred_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as AttributionTouchpoint[]) ?? [];
    },
  });
}
