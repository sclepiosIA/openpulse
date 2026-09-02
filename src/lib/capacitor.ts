/**
 * Capacitor runtime helpers.
 * Centralise les checks isNativeApp / platform pour les hooks et bridges.
 */
import { Capacitor } from '@capacitor/core';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatform(): 'ios' | 'android' | 'web' {
  const p = Capacitor.getPlatform();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}
