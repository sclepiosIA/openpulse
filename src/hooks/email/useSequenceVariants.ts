import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SequenceVariant {
  id: string;
  sequence_id: string;
  step_index: number;
  variant_label: string;
  weight: number;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  is_winner: boolean;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface VariantStats {
  variant_id: string;
  sends_count: number;
  opens_count: number;
  clicks_count: number;
  replies_count: number;
  bounces_count: number;
  unsubscribes_count: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  last_recomputed_at: string;
}

export interface VariantWithStats extends SequenceVariant {
  stats: VariantStats | null;
}

/** Liste les variantes d'une séquence (toutes étapes confondues), avec leurs stats. */
export function useSequenceVariants(sequenceId: string | undefined) {
  return useQuery({
    queryKey: ['sequence-variants', sequenceId],
    enabled: !!sequenceId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<VariantWithStats[]> => {
      const { data: variants, error } = await supabase
        .from('email_sequence_variants')
        .select('*')
        .eq('sequence_id', sequenceId!)
        .order('step_index', { ascending: true })
        .order('variant_label', { ascending: true });
      if (error) throw error;

      const variantRows = (variants ?? []) as SequenceVariant[];
      const ids = variantRows.map((v) => v.id);
      let statsMap = new Map<string, VariantStats>();
      if (ids.length > 0) {
        const { data: stats } = await supabase
          .from('email_sequence_variant_stats')
          .select('*')
          .in('variant_id', ids);
        statsMap = new Map(((stats ?? []) as VariantStats[]).map((s) => [s.variant_id, s]));
      }

      return variantRows.map((v) => ({
        ...v,
        stats: statsMap.get(v.id) ?? null,
      }));

    },
  });
}

export function useUpsertVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Partial<SequenceVariant> & { sequence_id: string; step_index: number; variant_label: string },
    ) => {
      const { data, error } = await supabase
        .from('email_sequence_variants')
        .upsert([payload] as never, { onConflict: 'sequence_id,step_index,variant_label' })
        .select()
        .single();
      if (error) throw error;
      return data as SequenceVariant;
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ['sequence-variants', v.sequence_id] });
      toast.success('Variante enregistrée');
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });
}

export function useDeleteVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sequence_id }: { id: string; sequence_id: string }) => {
      const { error } = await supabase.from('email_sequence_variants').delete().eq('id', id);
      if (error) throw error;
      return { id, sequence_id };
    },
    onSuccess: ({ sequence_id }) => {
      qc.invalidateQueries({ queryKey: ['sequence-variants', sequence_id] });
      toast.success('Variante supprimée');
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });
}

/** Désigne automatiquement les gagnants quand le seuil statistique est atteint. */
export function useDesignateWinners() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sequence_id,
      min_sends = 50,
      min_diff = 0.05,
    }: {
      sequence_id?: string;
      min_sends?: number;
      min_diff?: number;
    }) => {
      const { data, error } = await supabase.rpc('designate_sequence_winners', {
        _sequence_id: sequence_id ?? undefined,
        _min_sends: min_sends,
        _min_diff: min_diff,
      });
      if (error) throw error;
      return (data ?? []) as Array<{ sequence_id: string; step_index: number; winner_variant_id: string }>;
    },
    onSuccess: (winners, vars) => {
      const n = winners?.length ?? 0;
      toast.success(
        n > 0 ? `${n} gagnant${n > 1 ? 's' : ''} désigné${n > 1 ? 's' : ''}` : 'Aucun gagnant désignable (seuils non atteints)',
      );
      if (vars.sequence_id) {
        qc.invalidateQueries({ queryKey: ['sequence-variants', vars.sequence_id] });
      } else {
        qc.invalidateQueries({ queryKey: ['sequence-variants'] });
      }
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });
}
