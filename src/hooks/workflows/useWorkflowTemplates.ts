import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { WorkflowTriggerType, WorkflowGraph } from '@/types/workflow';
import { useCreateWorkflow } from './useWorkflows';

export interface WorkflowTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  icon: string;
  graph: WorkflowGraph;
  trigger_type: WorkflowTriggerType;
  is_published: boolean;
  created_at: string;
}

export const TEMPLATE_CATEGORIES: Record<string, { label: string; color: string }> = {
  vente: { label: '💼 Vente', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  support: { label: '🛟 Support', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30' },
  onboarding: { label: '🚀 Onboarding', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' },
  communication: { label: '📨 Communication', color: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30' },
  analytics: { label: '📊 Analytics', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  ia: { label: '🤖 IA', color: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30' },
};

export function useWorkflowTemplates() {
  return useQuery({
    queryKey: ['workflow_templates'],
    queryFn: async (): Promise<WorkflowTemplate[]> => {
      const { data, error } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('is_published', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as WorkflowTemplate[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useInstantiateTemplate() {
  const create = useCreateWorkflow();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (template: WorkflowTemplate) => {
      const res = await create.mutateAsync({
        nom: template.name,
        trigger_type: template.trigger_type,
        graph: template.graph,
        description: template.description ?? undefined,
      } as Parameters<typeof create.mutateAsync>[0]);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}
