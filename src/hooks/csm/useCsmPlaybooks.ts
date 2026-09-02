import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PlaybookStepType =
  | 'create_task'
  | 'send_email'
  | 'create_alert'
  | 'wait_days'
  | 'assign_csm'
  | 'update_health_note';

export interface CsmPlaybook {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  trigger_config: Record<string, unknown>;
  cooldown_days: number;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface CsmPlaybookStep {
  id: string;
  playbook_id: string;
  step_order: number;
  step_type: PlaybookStepType;
  config: Record<string, unknown>;
  delay_days: number;
}

export interface CsmPlaybookExecution {
  id: string;
  playbook_id: string;
  etablissement_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  current_step_order: number;
  next_action_at: string | null;
  started_at: string;
  completed_at: string | null;
  trigger_context: Record<string, unknown>;
  last_error: string | null;
}

export interface PlaybookDashboard {
  total_playbooks: number;
  active_playbooks: number;
  pending_executions: number;
  completed_30d: number;
  failed_30d: number;
  next_actions: Array<{
    id: string;
    playbook_id: string;
    etablissement_id: string;
    current_step_order: number;
    next_action_at: string;
    status: string;
    playbook_name: string;
  }>;
}

export function useCsmPlaybooks() {
  return useQuery({
    queryKey: ['csm-playbooks'],
    staleTime: 30_000,
    queryFn: async (): Promise<CsmPlaybook[]> => {
      const { data, error } = await supabase
        .from('csm_playbooks')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CsmPlaybook[];
    },
  });
}

export function useCsmPlaybookSteps(playbookId: string | undefined) {
  return useQuery({
    queryKey: ['csm-playbook-steps', playbookId],
    enabled: !!playbookId,
    staleTime: 30_000,
    queryFn: async (): Promise<CsmPlaybookStep[]> => {
      const { data, error } = await supabase
        .from('csm_playbook_steps')
        .select('*')
        .eq('playbook_id', playbookId!)
        .order('step_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CsmPlaybookStep[];
    },
  });
}

export function useCsmPlaybookExecutions(playbookId?: string) {
  return useQuery({
    queryKey: ['csm-playbook-executions', playbookId ?? 'all'],
    staleTime: 15_000,
    queryFn: async (): Promise<CsmPlaybookExecution[]> => {
      let q = supabase
        .from('csm_playbook_executions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(100);
      if (playbookId) q = q.eq('playbook_id', playbookId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CsmPlaybookExecution[];
    },
  });
}

export function useCsmPlaybookExecutionsByEtablissement(etablissementId: string | undefined) {
  return useQuery({
    queryKey: ['csm-playbook-executions-etab', etablissementId],
    enabled: !!etablissementId,
    staleTime: 15_000,
    queryFn: async (): Promise<CsmPlaybookExecution[]> => {
      const { data, error } = await supabase
        .from('csm_playbook_executions')
        .select('*')
        .eq('etablissement_id', etablissementId!)
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as CsmPlaybookExecution[];
    },
  });
}

export function useCsmPlaybookDashboard() {
  return useQuery({
    queryKey: ['csm-playbook-dashboard'],
    staleTime: 30_000,
    queryFn: async (): Promise<PlaybookDashboard> => {
      const { data, error } = await supabase.rpc('get_csm_playbook_dashboard');
      if (error) throw error;
      return data as unknown as PlaybookDashboard;
    },
  });
}

export function useUpsertPlaybook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CsmPlaybook> & { name: string }) => {
      const { data, error } = await supabase
        .from('csm_playbooks')
        .upsert([payload] as never)
        .select()
        .single(); // safe: guaranteed-row
      if (error) throw error;
      return data as CsmPlaybook;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['csm-playbooks'] });
      qc.invalidateQueries({ queryKey: ['csm-playbook-dashboard'] });
      toast.success('Playbook enregistré');
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });
}

export function useDeletePlaybook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('csm_playbooks').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['csm-playbooks'] });
      qc.invalidateQueries({ queryKey: ['csm-playbook-dashboard'] });
      toast.success('Playbook supprimé');
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });
}

export function useUpsertPlaybookStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Partial<CsmPlaybookStep> & {
        playbook_id: string;
        step_order: number;
        step_type: PlaybookStepType;
      },
    ) => {
      const { data, error } = await supabase
        .from('csm_playbook_steps')
        .upsert([payload] as never, { onConflict: 'playbook_id,step_order' })
        .select()
        .single(); // safe: guaranteed-row
      if (error) throw error;
      return data as CsmPlaybookStep;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['csm-playbook-steps', s.playbook_id] });
      toast.success('Étape enregistrée');
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });
}

export function useDeletePlaybookStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, playbook_id }: { id: string; playbook_id: string }) => {
      const { error } = await supabase.from('csm_playbook_steps').delete().eq('id', id);
      if (error) throw error;
      return { id, playbook_id };
    },
    onSuccess: ({ playbook_id }) => {
      qc.invalidateQueries({ queryKey: ['csm-playbook-steps', playbook_id] });
      toast.success('Étape supprimée');
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });
}

/** Force la ré-évaluation des playbooks pour un établissement (utile en debug ou bouton manuel). */
export function useEvaluatePlaybooksForEtablissement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (etablissementId: string): Promise<number> => {
      const { data, error } = await supabase.rpc(
        'evaluate_csm_playbooks_for_etablissement',
        { _etablissement_id: etablissementId },
      );
      if (error) throw error;
      return (data ?? 0) as number;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['csm-playbook-executions'] });
      qc.invalidateQueries({ queryKey: ['csm-playbook-dashboard'] });
      toast.success(
        count > 0 ? `${count} playbook${count > 1 ? 's' : ''} déclenché${count > 1 ? 's' : ''}` : 'Aucun playbook éligible',
      );
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });
}

/** Déclenche manuellement le worker (admin uniquement). */
export function useRunPlaybookEngine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('csm-playbook-engine', {
        body: {},
      });
      if (error) throw error;
      return data as { picked: number; advanced: number; completed: number; failed: number };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['csm-playbook-executions'] });
      qc.invalidateQueries({ queryKey: ['csm-playbook-dashboard'] });
      toast.success(
        `Worker exécuté : ${r.picked} traités · ${r.advanced} avancés · ${r.completed} terminés · ${r.failed} échoués`,
      );
    },
    onError: (e: Error) => toast.error(`Erreur worker : ${e.message}`),
  });
}
