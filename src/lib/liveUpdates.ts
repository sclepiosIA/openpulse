/**
 * Capgo Capacitor Live Updates (OTA).
 *
 * Permet de pousser des mises à jour JS/CSS/HTML sans passer par la review
 * App Store / Play Store. Compatible Apple guideline 4.5.5.
 */
import { isNativeApp } from '@/lib/capacitor';

export async function initLiveUpdates(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.notifyAppReady();
     
    console.info('[LiveUpdates] notifyAppReady OK');
  } catch (e) {
     
    console.warn('[LiveUpdates] init failed', e);
  }
}
