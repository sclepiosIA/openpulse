/**
 * @deprecated Use useRealtimeEmail() from RealtimeEmailContext instead.
 * This hook now delegates to the singleton context to avoid duplicate Realtime channels.
 */

import { useRealtimeEmailCompat } from '@/contexts/RealtimeEmailContext';

export type { UnreadByAccount } from '@/contexts/RealtimeEmailContext';

export function useRealtimeEmailNotifications(onNewEmail?: () => void) {
  return useRealtimeEmailCompat(onNewEmail);
}
