import { describe, it, expect, beforeEach } from 'vitest';
import {
  isPulseSoundEnabled,
  setPulseSoundEnabled,
  isPulseDesktopEnabled,
  setPulseDesktopEnabled,
} from '../pulsePreferences';

describe('pulsePreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('sound preference', () => {
    it('defaults to enabled when nothing stored', () => {
      expect(isPulseSoundEnabled()).toBe(true);
    });

    it('reflects the value persisted in localStorage', () => {
      setPulseSoundEnabled(false);
      expect(isPulseSoundEnabled()).toBe(false);
      expect(localStorage.getItem('pulse.notifications.sound')).toBe('0');
    });

    it('can be re-enabled', () => {
      setPulseSoundEnabled(false);
      setPulseSoundEnabled(true);
      expect(isPulseSoundEnabled()).toBe(true);
      expect(localStorage.getItem('pulse.notifications.sound')).toBe('1');
    });
  });

  describe('desktop notifications preference', () => {
    it('defaults to enabled when nothing stored', () => {
      expect(isPulseDesktopEnabled()).toBe(true);
    });

    it('reflects the value persisted in localStorage', () => {
      setPulseDesktopEnabled(false);
      expect(isPulseDesktopEnabled()).toBe(false);
      expect(localStorage.getItem('pulse.notifications.desktop')).toBe('0');
    });

    it('can be re-enabled', () => {
      setPulseDesktopEnabled(false);
      setPulseDesktopEnabled(true);
      expect(isPulseDesktopEnabled()).toBe(true);
    });
  });

  describe('isolation between preferences', () => {
    it('does not couple sound and desktop flags', () => {
      setPulseSoundEnabled(false);
      expect(isPulseDesktopEnabled()).toBe(true);
      setPulseDesktopEnabled(false);
      expect(isPulseSoundEnabled()).toBe(false);
    });
  });
});
