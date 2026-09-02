import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DryRunResult {
  run_id: string;
  status: 'success' | 'failed' | 'running';
  steps: number;
  steps_log: Array<{
    node_id: string;
    node_type: string;
    status: 'success' | 'failed' | 'simulated' | 'scheduled' | 'skipped';
    started_at?: string;
    finished_at?: string;
    output?: Record<string, unknown>;
    error?: string;
  }>;
  is_dry_run: boolean;
}

export function useWorkflowDryRun() {
  return useMutation<DryRunResult, Error, { workflow_id: string; trigger_payload: Record<string, unknown> }>({
    mutationFn: async ({ workflow_id, trigger_payload }) => {
      const { data, error } = await supabase.functions.invoke('workflow-engine', {
        body: { workflow_id, trigger_payload, dry_run: true, manual: true },
      });
      if (error) throw error;
      const dataObj = data as { error?: string } | null;
      if (dataObj?.error) throw new Error(dataObj.error);
      return data as DryRunResult;
    },
    onError: (err) => {
      toast.error(`Échec du test : ${err.message}`);
    },
  });
}
