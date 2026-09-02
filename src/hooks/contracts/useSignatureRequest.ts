import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SignatureRequest } from '@/types/signature';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

export function useSignatureRequest(contratId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['signature-request', contratId],
    enabled: !!contratId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('signature_requests')
        .select('*')
        .eq('contrat_id', contratId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as SignatureRequest | null) ?? null;
    },
    staleTime: 30_000,
  });

  // Realtime: refetch on any change
  useEffect(() => {
    if (!contratId) return;
    const channel = supabase
      .channel(`signature_request_${contratId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'signature_requests',
        filter: `contrat_id=eq.${contratId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['signature-request', contratId] });
        queryClient.invalidateQueries({ queryKey: ['contrat', contratId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [contratId, queryClient]);

  return query;
}

export function useSendSignature() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (params: {
      contratId: string;
      signers: { name: string; email: string; role?: string }[];
      message?: string;
      expireDays?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('signature-send', {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['signature-request', vars.contratId] });
      queryClient.invalidateQueries({ queryKey: ['contrat', vars.contratId] });
      toast({ title: 'Demande de signature envoyée' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(e), variant: 'destructive' });
    },
  });
}

export function useRemindSignature() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (params: { requestId: string; signerEmail?: string }) => {
      const { data, error } = await supabase.functions.invoke('signature-remind', { body: params });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signature-request'] });
      toast({ title: 'Relance envoyée' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(e), variant: 'destructive' });
    },
  });
}

export function useCancelSignature() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (params: { requestId: string; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke('signature-cancel', { body: params });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signature-request'] });
      toast({ title: 'Demande annulée' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(e), variant: 'destructive' });
    },
  });
}
