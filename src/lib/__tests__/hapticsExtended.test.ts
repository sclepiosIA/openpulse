import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vibrate, vibrateSuccess, vibrateError, vibrateSelection, vibrateLongPress, cancelVibrate } from '../haptics';

describe('haptics', () => {
  const mockVibrate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  describe('vibrateSuccess', () => {
    it('vibrates 50ms', () => {
      vibrateSuccess();
      expect(mockVibrate).toHaveBeenCalledWith(50);
    });
  });

  describe('vibrateError', () => {
    it('vibrates pattern', () => {
      vibrateError();
      expect(mockVibrate).toHaveBeenCalledWith([100, 50, 100]);
    });
  });

  describe('vibrateSelection', () => {
    it('vibrates 30ms', () => {
      vibrateSelection();
      expect(mockVibrate).toHaveBeenCalledWith(30);
    });
  });

  describe('vibrateLongPress', () => {
    it('vibrates pattern', () => {
      vibrateLongPress();
      expect(mockVibrate).toHaveBeenCalledWith([50, 100, 50]);
    });
  });

  describe('cancelVibrate', () => {
    it('calls vibrate(0)', () => {
      cancelVibrate();
      expect(mockVibrate).toHaveBeenCalledWith(0);
    });
  });
});
