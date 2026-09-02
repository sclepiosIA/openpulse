import { useCallback, useRef } from 'react';
import { debug } from '@/lib/debug';
import { safeStorage } from '@/lib/safeStorage';

export function useEmailRefresh(fetchThreads: (reset: boolean | 'incremental') => Promise<void>) {
  const lastRefreshRef = useRef(Date.now());
  const THROTTLE_MS = 10000; // 10 secondes minimum entre refreshes auto (manuel ignore le throttle)

  const triggerRefresh = useCallback(async (source: string) => {
    // Block auto-refreshes while user is composing an email
    if (source !== 'manual' && safeStorage.getItem('email-compose-dirty') === '1') {
      debug.log(`✋ Blocking refresh from ${source} (composition in progress)`);
      return;
    }

    const now = Date.now();
    const isManual = source === 'manual' || source === 'manual-full';
    if (!isManual && now - lastRefreshRef.current < THROTTLE_MS) {
      debug.log(`⏭️ Skipping refresh from ${source} (throttled)`);
      return;
    }

    debug.log(`🔄 Triggering ${isManual ? 'full' : 'incremental'} refresh from ${source}`);
    lastRefreshRef.current = now;
    await fetchThreads(source === 'manual-full' ? true : 'incremental');
  }, [fetchThreads]);

  return { triggerRefresh };
}
