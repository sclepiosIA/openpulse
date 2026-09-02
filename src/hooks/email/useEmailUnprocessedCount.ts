/**
 * @deprecated Use useEmailCounts() instead for both unread and unprocessed counts in a single query.
 */
import { useEmailCounts } from './useEmailCounts';

export function useEmailUnprocessedCount(): number {
  const { unprocessedCount } = useEmailCounts();
  return unprocessedCount;
}
