import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useWorkflowReplay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (run_id: string) => {
      const { data, error } = await supabase.rpc('replay_workflow_run', { p_run_id: run_id });
      if (error) throw error;
      const meta = data as Record<string, unknown> | null;
      if (meta?.error) throw new Error(String(meta.error));
      const { data: invoked, error: invErr } = await supabase.functions.invoke('workflow-engine', {
        body: {
          workflow_id: meta?.workflow_id,
          trigger_payload: { ...((meta?.trigger_payload as Record<string, unknown>) || {}), _replayed_from: run_id },
          manual: true,
        },
      });
      if (invErr) throw invErr;
      return invoked;
    },
    onSuccess: () => {
      toast.success('Run rejoué — voir l\'historique');
      qc.invalidateQueries({ queryKey: ['workflow_runs'] });
    },
    onError: (e: Error) => toast.error(`Replay échoué : ${e.message}`),
  });
}
