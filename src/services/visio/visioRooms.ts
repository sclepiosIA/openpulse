import { supabase } from '@/integrations/supabase/client';
import type { VisioRoom } from '@/types/visio';

/**
 * Service visio — récupération d'une salle via edge function `webrtc-signaling`.
 * Extraction pour découplage Supabase (audit Fable 5 · action 180.1).
 */
export const fetchVisioRoom = async (roomCode: string): Promise<VisioRoom> => {
  const { data, error } = await supabase.functions.invoke('webrtc-signaling', {
    body: { action: 'get-room', roomCode },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Salle introuvable');
  return data.room as VisioRoom;
};
