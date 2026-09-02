import { supabase } from '@/integrations/supabase/client';

export interface MarqueMeetRoom {
  link: string;
  [key: string]: unknown;
}

export async function createMarqueMeetRoom(name: string): Promise<MarqueMeetRoom> {
  const { data, error } = await supabase.functions.invoke('webrtc-signaling', {
    body: { action: 'create-room', name },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error ?? 'Échec création salle');
  return data.room as MarqueMeetRoom;
}
