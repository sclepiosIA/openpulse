/**
 * @deprecated Use useEmailCounts() instead for both unread and unprocessed counts in a single query.
 */
import { useEmailCounts } from './useEmailCounts';

export function useEmailUnreadCount(): number {
  const { unreadCount } = useEmailCounts();
  return unreadCount;
}
