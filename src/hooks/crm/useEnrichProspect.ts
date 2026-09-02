import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EnrichmentLog {
  id: string;
  etablissement_id: string;
  source: string;
  trigger: string;
  success: boolean;
  data_returned: Record<string, unknown>;
  fields_updated: string[];
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

/** Liste l'historique d'enrichissement d'un prospect. */
export function useEnrichmentHistory(etablissementId: string | undefined) {
  return useQuery({
    queryKey: ['enrichment-log', etablissementId],
    enabled: !!etablissementId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<EnrichmentLog[]> => {
      const { data, error } = await supabase
        .from('prospect_enrichment_log')
        .select('*')
        .eq('etablissement_id', etablissementId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as EnrichmentLog[];
    },
  });
}

/** Enrichit un prospect via l'edge function (bouton manuel ou re-enrichissement). */
export function useEnrichProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (etablissement_id: string) => {
      const { data, error } = await supabase.functions.invoke('enrich-prospect', {
        body: { etablissement_id, trigger: 'manual_button' },
      });
      if (error) throw error;
      return data as { ok: boolean; fields_updated: string[]; error?: string };
    },
    onSuccess: (data, etablissement_id) => {
      if (data?.ok) {
        const n = data.fields_updated?.length ?? 0;
        toast.success(
          n > 0
            ? `Prospect enrichi : ${n} champ${n > 1 ? 's' : ''} mis à jour`
            : 'Prospect enrichi (aucun nouveau champ à compléter)',
        );
      } else {
        toast.warning(data?.error ?? 'Aucune donnée trouvée');
      }
      qc.invalidateQueries({ queryKey: ['etablissement', etablissement_id] });
      qc.invalidateQueries({ queryKey: ['etablissements'] });
      qc.invalidateQueries({ queryKey: ['enrichment-log', etablissement_id] });
    },
    onError: (e: Error) => {
      toast.error(`Échec enrichissement : ${e.message}`);
    },
  });
}
