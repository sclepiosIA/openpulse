import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeRealtimeChannel } from '@/lib/realtimeMonitor';
import type { SignatureEvent } from '@/types/signature';

export function useSignatureEvents(requestId: string | undefined | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['signature-events', requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('signature_events')
        .select('*')
        .eq('request_id', requestId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SignatureEvent[];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!requestId) return;
    const handle = safeRealtimeChannel(`signature_events_${requestId}`, (channel) =>
      channel.on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'signature_events',
        filter: `request_id=eq.${requestId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['signature-events', requestId] });
      }),
    );
    return () => handle.dispose();
  }, [requestId, queryClient]);

  return query;
}
