import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AlertConfig {
  id: string;
  workflow_id: string | null;
  failure_rate_threshold: number;
  min_runs: number;
  window_minutes: number;
  scheduled_backlog_threshold: number;
  notify_user_ids: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useWorkflowAlertConfigs() {
  return useQuery({
    queryKey: ['workflow_alert_config'],
    queryFn: async (): Promise<AlertConfig[]> => {
      const { data, error } = await supabase
        .from('workflow_alert_config')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AlertConfig[];
    },
    staleTime: 30_000,
  });
}

export function useUpsertAlertConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: Partial<AlertConfig> & { id?: string }) => {
      if (cfg.id) {
        const { id, ...rest } = cfg;
        const { error } = await supabase.from('workflow_alert_config').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('workflow_alert_config').insert(cfg as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Configuration enregistrée');
      qc.invalidateQueries({ queryKey: ['workflow_alert_config'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });
}

export function useDeleteAlertConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workflow_alert_config').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configuration supprimée');
      qc.invalidateQueries({ queryKey: ['workflow_alert_config'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });
}
