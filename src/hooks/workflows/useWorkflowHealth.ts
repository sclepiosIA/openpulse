import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { monitoring } from '@/lib/monitoring';

export interface WorkflowHealth {
  window_days: number;
  total_runs: number;
  success: number;
  failed: number;
  paused: number;
  success_rate: number;
  avg_duration_ms: number;
  pending_scheduled: number;
  top_failing: Array<{ id: string; nom: string; failed: number; total: number }>;
  per_day: Array<{ day: string; success: number; failed: number }>;
}

const EMPTY_HEALTH: WorkflowHealth = {
  window_days: 7,
  total_runs: 0,
  success: 0,
  failed: 0,
  paused: 0,
  success_rate: 0,
  avg_duration_ms: 0,
  pending_scheduled: 0,
  top_failing: [],
  per_day: [],
};

export function useWorkflowHealth(days = 7) {
  return useQuery({
    queryKey: ['workflow_health', days],
    queryFn: async (): Promise<WorkflowHealth> => {
      const { data, error } = await supabase.rpc('get_workflow_health', { p_days: days });
      if (error) {
        // Dégradation gracieuse : on logue mais on renvoie un état vide pour ne pas
        // afficher « Erreur de chargement » bloquant (audit 2026-06-20 prompt 9).
        monitoring.captureException(error instanceof Error ? error : new Error(String(error)), {
          hook: 'useWorkflowHealth',
          rpc: 'get_workflow_health',
          p_days: days,
          code: (error as { code?: string })?.code ?? 'unknown',
        });
        return { ...EMPTY_HEALTH, window_days: days };
      }
      return data as unknown as WorkflowHealth;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

