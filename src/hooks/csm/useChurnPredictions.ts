import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeRealtimeChannel } from '@/lib/realtimeMonitor';
import { toast } from 'sonner';

export type ChurnRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ChurnPrediction {
  id: string;
  etablissement_id: string;
  score: number;
  risk_level: ChurnRiskLevel;
  factors: Record<string, number>;
  recommendations: string[];
  predicted_at: string;
  model_version: string;
  acknowledged_until: string | null;
  acknowledged_by: string | null;
  acknowledged_note: string | null;
  etablissement?: {
    id: string;
    nom: string;
    statut: string;
    csm_id?: string | null;
    type_offre?: string | null;
  };
}

export function useChurnPredictions() {
  const qc = useQueryClient();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const scheduleInvalidate = () => {
      // Skip when tab hidden — refetch will happen naturally on focus via staleTime
      if (document.visibilityState !== 'visible') return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['churn-predictions'] });
        qc.invalidateQueries({ queryKey: ['churn-overview'] });
      }, 4000); // batch realtime bursts into a single refetch
    };

    const isSignificant = (payload: { old?: Record<string, unknown>; new?: Record<string, unknown> }): boolean => {
      const o = payload?.old || {};
      const n = payload?.new || {};
      // Only react to user-visible churn changes
      return (
        o.score !== n.score ||
        o.risk_level !== n.risk_level ||
        o.acknowledged_until !== n.acknowledged_until
      );
    };

    const handle = safeRealtimeChannel('churn-predictions-realtime', (ch) =>
      ch
        .on('postgres_changes' as never, { event: 'INSERT', schema: 'public', table: 'churn_predictions' } as never, scheduleInvalidate as never)
        .on('postgres_changes' as never, { event: 'DELETE', schema: 'public', table: 'churn_predictions' } as never, scheduleInvalidate as never)
        .on('postgres_changes' as never, { event: 'UPDATE', schema: 'public', table: 'churn_predictions' } as never, ((payload: { old?: Record<string, unknown>; new?: Record<string, unknown> }) => {
          if (isSignificant(payload)) scheduleInvalidate();
        }) as never)
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      handle.dispose();
    };
  }, [qc]);

  return useQuery({
    queryKey: ['churn-predictions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('churn_predictions')
        .select(`
          *,
          etablissement:etablissements!churn_predictions_etablissement_id_fkey(id, nom, statut, csm_id, type_offre)
        `)
        .order('score', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as ChurnPrediction[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecomputeChurn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('compute_churn_predictions');
      if (error) throw error;
      return data?.[0] as { processed: number; high_risk: number; critical_risk: number } | undefined;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['churn-predictions'] });
      qc.invalidateQueries({ queryKey: ['churn-overview'] });
      qc.invalidateQueries({ queryKey: ['churn-trends'] });
      toast.success(
        `Calcul terminé : ${result?.processed ?? 0} comptes analysés (${result?.critical_risk ?? 0} critiques, ${result?.high_risk ?? 0} à risque élevé)`
      );
    },
    onError: (err: Error) => {
      toast.error(`Erreur : ${err.message}`);
    },
  });
}

// ============================================================================
// Overview / trends / history / acknowledge
// ============================================================================

export interface ChurnOverviewKpis {
  total: number; critical: number; high: number; medium: number; low: number; avg_score: number;
}

export interface ChurnMovement {
  etablissement_id: string; nom: string; score: number; risk_level: ChurnRiskLevel;
  prev_score: number; delta: number;
}

export interface ChurnOverview {
  computed_at: string;
  kpis: ChurnOverviewKpis;
  prev_kpis: Partial<ChurnOverviewKpis>;
  mrr_at_risk: number;
  factors_breakdown: {
    many_tickets: number; no_emails: number; many_unpaid: number; no_interaction: number;
  };
  worsened: ChurnMovement[];
  improved: ChurnMovement[];
  snoozed_count: number;
}

export function useChurnOverview() {
  return useQuery({
    queryKey: ['churn-overview'],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<ChurnOverview> => {
      const { data, error } = await supabase.rpc('get_churn_overview');
      if (error) throw error;
      return data as unknown as ChurnOverview;
    },
  });
}

export interface ChurnTrendPoint {
  day: string; total: number; critical: number; high: number; medium: number; low: number; avg_score: number;
}

export function useChurnTrends(days = 90) {
  return useQuery({
    queryKey: ['churn-trends', days],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ChurnTrendPoint[]> => {
      const { data, error } = await supabase.rpc('get_churn_trends', { p_days: days });
      if (error) throw error;
      return (data as unknown as ChurnTrendPoint[]) ?? [];
    },
  });
}

export interface ChurnHistoryPoint { day: string; score: number; risk_level: ChurnRiskLevel }

export function useChurnHistory(etabId: string | undefined, days = 90) {
  return useQuery({
    queryKey: ['churn-history', etabId, days],
    enabled: !!etabId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ChurnHistoryPoint[]> => {
      const { data, error } = await supabase.rpc('get_etablissement_churn_history', {
        p_etab: etabId!, p_days: days,
      });
      if (error) throw error;
      return (data as unknown as ChurnHistoryPoint[]) ?? [];
    },
  });
}

export function useAcknowledgeChurn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ etabId, until, note }: { etabId: string; until: string; note?: string }) => {
      const { data, error } = await supabase.rpc('acknowledge_churn', {
        p_etab: etabId, p_until: until, p_note: note ?? undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['churn-predictions'] });
      qc.invalidateQueries({ queryKey: ['churn-overview'] });
      toast.success('Compte marqué comme traité');
    },
    onError: (err: Error) => toast.error(`Erreur : ${err.message}`),
  });
}

export function useGenerateRetentionEmail() {
  return useMutation({
    mutationFn: async (etabId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-retention-email', {
        body: { etablissement_id: etabId },
      });
      if (error) throw error;
      return data as { subject: string; body: string };
    },
    onError: (err: Error) => toast.error(`Erreur IA : ${err.message}`),
  });
}
