import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { WorkflowRun } from '@/types/workflow';

const RUNS_KEY = ['workflow_runs'] as const;

export function useWorkflowRuns(workflow_id?: string, limit = 50) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...RUNS_KEY, workflow_id ?? 'all'],
    queryFn: async (): Promise<WorkflowRun[]> => {
      let q = supabase
        .from('workflow_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);
      if (workflow_id) q = q.eq('workflow_id', workflow_id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as WorkflowRun[];
    },
    staleTime: 10_000,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`workflow_runs_${workflow_id ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_runs',
          ...(workflow_id ? { filter: `workflow_id=eq.${workflow_id}` } : {}),
        },
        () => {
          queryClient.invalidateQueries({ queryKey: [...RUNS_KEY, workflow_id ?? 'all'] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workflow_id, queryClient]);

  return query;
}
