import { supabase } from '@/integrations/supabase/client';

/**
 * Services d'exploration des workflow_runs — extraction pour découplage Supabase
 * (audit Fable 5 · action 180.1).
 */

export interface WorkflowRunsFilter {
  status?: string;
  workflowId?: string;
  limit?: number;
}

export const fetchWorkflowRuns = async <T = unknown>(filter: WorkflowRunsFilter = {}): Promise<T[]> => {
  let q = supabase
    .from('workflow_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(filter.limit ?? 200);
  if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status as any);
  if (filter.workflowId && filter.workflowId !== 'all') q = q.eq('workflow_id', filter.workflowId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as T[];
};
