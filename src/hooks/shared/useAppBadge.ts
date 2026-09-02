import { useCallback } from 'react';
import { debug } from '@/lib/debug';

/**
 * Hook pour gérer le badge de l'application PWA.
 *
 * Optimisation : déduplication via un état module-level pour éviter
 * les setBadge() consécutifs avec la même valeur (cf. logs `Set badge to:
 * 1 → 8 → 80` lors des invalidations en cascade au boot).
 *
 * Support :
 * - ✅ Chrome/Edge (desktop et Android)
 * - ✅ Safari iOS 16.4+ (PWA installée uniquement)
 * - ❌ Firefox
 */

let lastBadgeValue: number | null = null;

async function applyBadge(value: number) {
  // Normalise les valeurs négatives en 0 (clearBadge).
  const normalized = value > 0 ? value : 0;
  if (normalized === lastBadgeValue) return;
  lastBadgeValue = normalized;

  try {
    if (normalized > 0) {
      await navigator.setAppBadge(normalized);
      debug.log('[Badge] Set badge to:', normalized);
    } else {
      await navigator.clearAppBadge();
      debug.log('[Badge] Badge cleared (count was 0)');
    }
  } catch (error) {
    // Réinitialise pour permettre une nouvelle tentative au prochain appel.
    lastBadgeValue = null;
    debug.warn('[Badge] Error setting badge:', error);
  }
}

export function useAppBadge() {
  const isSupported = typeof navigator !== 'undefined' && 'setAppBadge' in navigator;

  const setBadge = useCallback(async (count: number) => {
    if (!isSupported) return;
    await applyBadge(count);
  }, [isSupported]);

  const clearBadge = useCallback(async () => {
    if (!isSupported) return;
    if (lastBadgeValue !== 0) debug.log('[Badge] Badge cleared');
    await applyBadge(0);
  }, [isSupported]);

  return { isSupported, setBadge, clearBadge };
}

/** @internal — utilisé uniquement par les tests pour réinitialiser le cache module-level. */
export function __resetBadgeStateForTests() {
  lastBadgeValue = null;
}
