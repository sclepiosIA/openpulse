import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  vibrate,
  vibrateSuccess,
  vibrateError,
  vibrateSelection,
  vibrateLongPress,
  cancelVibrate,
} from '../haptics';

describe('haptics extended2', () => {
  const mockVibrate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'vibrate', {
      value: mockVibrate,
      writable: true,
      configurable: true,
    });
  });

  describe('vibrate', () => {
    it('calls navigator.vibrate with number', () => {
      vibrate(50);
      expect(mockVibrate).toHaveBeenCalledWith(50);
    });
    it('calls navigator.vibrate with pattern', () => {
      vibrate([100, 50, 100]);
      expect(mockVibrate).toHaveBeenCalledWith([100, 50, 100]);
    });
    it('does not throw without vibrate API', () => {
      delete (navigator as any).vibrate;
      // The 'in' check prevents calling, so it should not throw
      expect(() => vibrate(50)).not.toThrow();
    });
  });

  describe('vibrateSuccess', () => {
    it('short vibration (50ms)', () => {
      vibrateSuccess();
      expect(mockVibrate).toHaveBeenCalledWith(50);
    });
  });

  describe('vibrateError', () => {
    it('pattern vibration', () => {
      vibrateError();
      expect(mockVibrate).toHaveBeenCalledWith([100, 50, 100]);
    });
  });

  describe('vibrateSelection', () => {
    it('very short vibration (30ms)', () => {
      vibrateSelection();
      expect(mockVibrate).toHaveBeenCalledWith(30);
    });
  });

  describe('vibrateLongPress', () => {
    it('pattern vibration', () => {
      vibrateLongPress();
      expect(mockVibrate).toHaveBeenCalledWith([50, 100, 50]);
    });
  });

  describe('cancelVibrate', () => {
    it('calls vibrate(0)', () => {
      cancelVibrate();
      expect(mockVibrate).toHaveBeenCalledWith(0);
    });
    it('does not throw without API', () => {
      delete (navigator as any).vibrate;
      expect(() => cancelVibrate()).not.toThrow();
    });
  });
});
