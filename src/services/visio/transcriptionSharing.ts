import { supabase } from '@/integrations/supabase/client';

/**
 * Services transcription visio — participants, session status, envoi email (audit Fable 5).
 */

export interface TranscriptionParticipantRow {
  id: string;
  displayName: string;
  email?: string;
}

export const fetchTranscriptionParticipants = async (
  sessionId: string,
): Promise<TranscriptionParticipantRow[]> => {
  const { data, error } = await supabase
    .from('visio_transcription_participants')
    .select('id, display_name, user_id, profile:profiles(email)')
    .eq('session_id', sessionId);
  if (error) throw error;
  return (data || []).map((p: any) => ({
    id: p.id,
    displayName: p.display_name || 'Participant',
    email: p.profile?.email || undefined,
  }));
};

export const fetchTranscriptionSessionStatus = async (
  sessionId: string,
): Promise<{ status: string | null; summary: string | null } | null> => {
  const { data, error } = await supabase
    .from('visio_transcription_sessions')
    .select('status, summary')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data ? { status: (data as any).status, summary: (data as any).summary } : null;
};

export const sendTranscriptionEmail = async (
  sessionId: string,
  emails: string[],
): Promise<void> => {
  const { error } = await supabase.functions.invoke('send-transcription-email', {
    body: { sessionId, emails },
  });
  if (error) throw error;
};
