import type { Node, Edge } from '@xyflow/react';
import { supabase } from '@/integrations/supabase/client';

export interface GeneratedWorkflowGraph {
  nodes: Node[];
  edges: Edge[];
}

export async function generateWorkflowFromPrompt(prompt: string): Promise<GeneratedWorkflowGraph> {
  const { data, error } = await supabase.functions.invoke('generate-workflow-from-prompt', {
    body: { prompt },
  });
  if (error) throw error;
  if (!data?.success || !data?.graph) throw new Error('Réponse IA invalide');
  return {
    nodes: data.graph.nodes as Node[],
    edges: data.graph.edges as Edge[],
  };
}
