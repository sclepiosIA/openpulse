/**
 * Hooks pour le score comportemental d'un établissement + page globale Scoring.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeRealtimeChannel } from '@/lib/realtimeMonitor';
import type { BehavioralEvent, BehavioralScoreResult, ScoreSnapshot } from '@/types/scoring';

// Statuts considérés comme "phase commerciale" (labels exacts en base)
export const COMMERCIAL_STATUTS = [
  'Prospect','Contacté','Attente RDV','Reporté','RDV pris','Dans les RDV',
  'Attente post RDV','Etude émise','Négociation','Bloqué',
] as const;

export function useBehavioralScore(etablissementId: string | undefined) {
  return useQuery({
    queryKey: ['behavioral-score', etablissementId],
    enabled: !!etablissementId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<BehavioralScoreResult> => {
      const { data, error } = await supabase.rpc('compute_behavioral_score', {
        _etablissement_id: etablissementId!,
      });
      if (error) throw error;
      return (data as unknown as BehavioralScoreResult) ?? {
        behavioral_score: 0,
        engagement_velocity: 0,
        last_event_at: null,
        raw_score: 0,
      };
    },
  });
}

export function useBehavioralEvents(etablissementId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ['behavioral-events', etablissementId, limit],
    enabled: !!etablissementId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<BehavioralEvent[]> => {
      const { data, error } = await supabase
        .from('prospect_behavioral_events')
        .select('*')
        .eq('etablissement_id', etablissementId!)
        .order('occurred_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as BehavioralEvent[]) ?? [];
    },
  });
}

export function useScoreHistory(etablissementId: string | undefined, days = 90) {
  return useQuery({
    queryKey: ['score-history', etablissementId, days],
    enabled: !!etablissementId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ScoreSnapshot[]> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('prospect_score_history')
        .select('*')
        .eq('etablissement_id', etablissementId!)
        .gte('computed_at', since)
        .order('computed_at', { ascending: true });
      if (error) throw error;
      return (data as ScoreSnapshot[]) ?? [];
    },
  });
}

export interface ProspectScoringRow {
  id: string;
  nom: string;
  score_conversion: number | null;
  behavioral_score: number | null;
  engagement_velocity: number | null;
  last_engagement_at: string | null;
  statut: string | null;
  commercial_id: string | null;
  scoring_snoozed_until: string | null;
}

/**
 * Liste des prospects avec score + velocity pour la page globale.
 * FIX : filtre sur la colonne réelle `statut` (les colonnes statut_relation/statut_etablissement n'existent pas).
 */
export function useProspectsScoringList() {
  const qc = useQueryClient();

  // Realtime invalidation
  useEffect(() => {
    const handle = safeRealtimeChannel('scoring-list-realtime', (ch) =>
      ch.on('postgres_changes' as never, { event: '*', schema: 'public', table: 'etablissements' } as never, (() => {
        qc.invalidateQueries({ queryKey: ['prospects-scoring-list'] });
        qc.invalidateQueries({ queryKey: ['scoring-overview'] });
      }) as never)
    );
    return () => { handle.dispose(); };
  }, [qc]);

  return useQuery({
    queryKey: ['prospects-scoring-list'],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etablissements')
        .select('id, nom, score_conversion, behavioral_score, engagement_velocity, last_engagement_at, statut, commercial_id, scoring_snoozed_until')
        .in('statut', [...COMMERCIAL_STATUTS])
        .order('score_conversion', { ascending: false, nullsFirst: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ProspectScoringRow[];
    },
  });
}

// ============================================================================
// Page globale : overview + trends + recompute + ack
// ============================================================================

export interface ScoringOverviewKpis {
  total: number; hot: number; warm: number; working: number; cold: number;
  weighted_mrr_potential: number; avg_score: number;
}
export interface ScoringOverviewProspect {
  id: string; nom: string; score: number; behavioral_score: number;
  velocity: number; last_engagement_at: string | null; statut: string;
}
export interface ScoringOverview {
  computed_at: string;
  kpis: ScoringOverviewKpis;
  prev_kpis: Partial<ScoringOverviewKpis>;
  by_phase: Array<{ phase: string; count: number; avg_score: number }>;
  by_status: Array<{ statut: string; count: number }>;
  channels: Array<{ channel: string; touchpoints: number; total_weight: number }>;
  top_score: ScoringOverviewProspect[];
  hot_streaks: ScoringOverviewProspect[];
  to_relaunch: ScoringOverviewProspect[];
  dormant: ScoringOverviewProspect[];
  orphans: ScoringOverviewProspect[];
}

export function useScoringOverview() {
  return useQuery({
    queryKey: ['scoring-overview'],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<ScoringOverview> => {
      const { data, error } = await supabase.rpc('get_scoring_overview');
      if (error) throw error;
      return data as unknown as ScoringOverview;
    },
  });
}

export interface ScoringTrendPoint {
  day: string; total: number; hot: number; warm: number;
  working: number; cold: number; avg_score: number;
}

export function useScoringTrends(days = 90) {
  return useQuery({
    queryKey: ['scoring-trends', days],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ScoringTrendPoint[]> => {
      const { data, error } = await supabase.rpc('get_scoring_trends', { p_days: days });
      if (error) throw error;
      return (data as unknown as ScoringTrendPoint[]) ?? [];
    },
  });
}

export function useRecomputeAllScores() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('recompute_all_prospect_scores');
      if (error) throw error;
      return data as { processed: number; updated: number; at: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scoring-overview'] });
      qc.invalidateQueries({ queryKey: ['prospects-scoring-list'] });
      qc.invalidateQueries({ queryKey: ['scoring-trends'] });
    },
  });
}

export function useAcknowledgeProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, until, note }: { id: string; until: string; note?: string }) => {
      const { data, error } = await supabase.rpc('acknowledge_prospect', {
        p_etab: id, p_until: until, p_note: note ?? undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scoring-overview'] });
      qc.invalidateQueries({ queryKey: ['prospects-scoring-list'] });
    },
  });
}

/**
 * Hook simplifié pour récupérer les owners (commerciaux assignés à au moins un prospect).
 */
export function useScoringOwners() {
  return useQuery({
    queryKey: ['scoring-owners'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, prenom, nom, email, avatar_url')
        .order('prenom', { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; prenom: string | null; nom: string | null; email: string | null; avatar_url: string | null }>;
    },
  });
}
