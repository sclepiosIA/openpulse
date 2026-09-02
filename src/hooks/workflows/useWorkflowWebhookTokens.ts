import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from "@/components/AuthProvider";

export interface WebhookToken {
  id: string;
  workflow_id: string;
  token: string;
  label: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  last_used_at: string | null;
  total_calls: number;
}

function genToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function useWorkflowWebhookTokens(workflow_id?: string) {
  return useQuery({
    queryKey: ['workflow_webhook_tokens', workflow_id ?? 'all'],
    queryFn: async (): Promise<WebhookToken[]> => {
      let q = supabase.from('workflow_webhook_tokens').select('*').order('created_at', { ascending: false });
      if (workflow_id) q = q.eq('workflow_id', workflow_id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as WebhookToken[];
    },
    staleTime: 30_000,
  });
}

export function useCreateWebhookToken() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ workflow_id, label }: { workflow_id: string; label?: string }) => {
      const { data, error } = await supabase
        .from('workflow_webhook_tokens')
        .insert({ workflow_id, label: label ?? null, token: genToken(), created_by: user?.id })
        .select('*')
        // safe: guaranteed-row
        .single();
      if (error) throw error;
      return data as unknown as WebhookToken;
    },
    onSuccess: () => {
      toast.success('Token webhook généré');
      qc.invalidateQueries({ queryKey: ['workflow_webhook_tokens'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });
}

export function useToggleWebhookToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('workflow_webhook_tokens').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow_webhook_tokens'] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });
}

export function useDeleteWebhookToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workflow_webhook_tokens').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Token supprimé');
      qc.invalidateQueries({ queryKey: ['workflow_webhook_tokens'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });
}
