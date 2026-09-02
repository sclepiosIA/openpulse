import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fromExtended } from '@/lib/supabaseTyped';
import type { PulseAuditLogEntry, PulseMessageArchive } from '@/types/pulse';
import { debug } from '@/lib/debug';

export const pulseAuditLogKeys = {
  all: ['pulse-audit-log'] as const,
  list: (filters?: AuditLogFilters) => [...pulseAuditLogKeys.all, 'list', filters] as const,
  archives: (conversationId?: string) => [...pulseAuditLogKeys.all, 'archives', conversationId] as const,
};

export interface AuditLogFilters {
  conversationId?: string;
  actorId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: 'success' | 'failure' | 'pending';
  limit?: number;
}

async function fetchAuditLogs(filters: AuditLogFilters = {}): Promise<PulseAuditLogEntry[]> {
  let query = supabase
    .from('pulse_audit_log')
    .select(`
      *,
      actor:profiles!pulse_audit_log_actor_id_fkey(id, nom, prenom, email)
    `)
    .order('created_at', { ascending: false })
    .limit(filters.limit || 100);

  if (filters.conversationId) {
    query = query.eq('conversation_id', filters.conversationId);
  }
  if (filters.actorId) {
    query = query.eq('actor_id', filters.actorId);
  }
  if (filters.action) {
    query = query.eq('action', filters.action);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  const { data, error } = await query;

  if (error) {
    debug.error('Error fetching audit logs:', error);
    throw error;
  }

  return (data || []) as unknown as PulseAuditLogEntry[];
}

async function fetchMessageArchives(conversationId?: string): Promise<PulseMessageArchive[]> {
  // Query pulse_message_archive directly (singular, not plural)
  const baseQuery = fromExtended('pulse_message_archive')
    .select('id, conversation_id, original_message_id, content_snapshot, deleted_at, deleted_by, deletion_reason, restored, restored_at, restored_by')
    .eq('restored', false)
    .order('deleted_at', { ascending: false });

  const query = conversationId 
    ? baseQuery.eq('conversation_id', conversationId)
    : baseQuery;

  const { data, error } = await query;

  if (error) {
    // Table may not exist in all environments - silent in production
    if (import.meta.env.DEV) {
      debug.warn('pulse_message_archive not available:', error.message);
    }
    return [];
  }

  return (data || []) as unknown as PulseMessageArchive[];
}

export function usePulseAuditLog(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: pulseAuditLogKeys.list(filters),
    queryFn: () => fetchAuditLogs(filters),
    // Uses global staleTime from QueryClient (2 min)
  });
}

export function usePulseMessageArchives(conversationId?: string) {
  return useQuery({
    queryKey: pulseAuditLogKeys.archives(conversationId),
    queryFn: () => fetchMessageArchives(conversationId),
    // Uses global staleTime from QueryClient (2 min)

  });
}

export async function restoreArchivedMessage(archiveId: string): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    // Get archive data (singular table name)
    const { data: archive, error: fetchError } = await fromExtended('pulse_message_archive')
      .select('id, original_message_id, content_snapshot')
      .eq('id', archiveId)
      .maybeSingle();

    if (fetchError || !archive) {
      debug.error('Error fetching archive:', fetchError);
      return false;
    }

    const archiveData = archive as unknown as { 
      original_message_id: string;
      content_snapshot: {
        content: string;
        content_html: string | null;
        mentions: string[];
      };
    };

    const snapshot = archiveData.content_snapshot;

    // Restore the message
    const { error: restoreError } = await supabase
      .from('pulse_messages')
      .update({
        content: snapshot.content,
        content_html: snapshot.content_html,
        mentions: snapshot.mentions,
        deleted_at: null,
        deleted_by: null,
        deletion_reason: null,
      })
      .eq('id', archiveData.original_message_id);

    if (restoreError) {
      debug.error('Error restoring message:', restoreError);
      return false;
    }

    // Mark archive as restored (singular table name)
    await fromExtended('pulse_message_archive')
      .update({
        restored: true,
        restored_at: new Date().toISOString(),
        restored_by: session?.user?.id,
      })
      .eq('id', archiveId);

    return true;
  } catch (err) {
    debug.error('Error restoring message:', err);
    return false;
  }
}
