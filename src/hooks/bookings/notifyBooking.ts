import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';

export async function notifyBooking(
  bookingId: string,
  action: 'confirmed' | 'rescheduled' | 'cancelled' | 'updated',
  extra?: { oldStartTime?: string; oldEndTime?: string; reason?: string }
) {
  try {
    await supabase.functions.invoke('booking-notify', {
      body: { bookingId, action, ...extra },
    });
  } catch (err) {
    debug.error('[booking-notify] invoke failed', err);
  }
}
