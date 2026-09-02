import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type WorkflowUpdate = Database['public']['Tables']['workflows']['Update'];

export interface WorkflowVersion {
  id: string;
  workflow_id: string;
  version_number: number;
  graph: { nodes: unknown[]; edges: unknown[] };
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  nom: string;
  description: string | null;
  comment: string | null;
  created_at: string;
  created_by: string | null;
}

export function useWorkflowVersions(workflow_id: string | undefined) {
  return useQuery({
    queryKey: ['workflow_versions', workflow_id],
    enabled: !!workflow_id,
    queryFn: async (): Promise<WorkflowVersion[]> => {
      const { data, error } = await supabase
        .from('workflow_versions')
        .select('*')
        .eq('workflow_id', workflow_id!)
        .order('version_number', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as WorkflowVersion[];
    },
    staleTime: 30_000,
  });
}

export function useRestoreWorkflowVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (version: WorkflowVersion) => {
      const { error } = await supabase
        .from('workflows')
        .update({
          graph: version.graph as unknown as WorkflowUpdate['graph'],
          trigger_type: version.trigger_type as WorkflowUpdate['trigger_type'],
          trigger_config: version.trigger_config as unknown as WorkflowUpdate['trigger_config'],
          nom: version.nom,
          description: version.description,
        })
        .eq('id', version.workflow_id);
      if (error) throw error;
      return version;
    },
    onSuccess: (v) => {
      toast.success(`Version v${v.version_number} restaurée`);
      qc.invalidateQueries({ queryKey: ['workflow', v.workflow_id] });
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflow_versions', v.workflow_id] });
    },
    onError: (e: Error) => toast.error(`Restauration échouée : ${e.message}`),
  });
}
