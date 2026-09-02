import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vibrate, vibrateSuccess, vibrateError, vibrateSelection, vibrateLongPress, cancelVibrate } from '../haptics';

describe('haptics', () => {
  beforeEach(() => {
    // Mock navigator.vibrate
    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn().mockReturnValue(true),
      writable: true,
      configurable: true,
    });
  });

  it('vibrate calls navigator.vibrate', () => {
    vibrate(50);
    expect(navigator.vibrate).toHaveBeenCalledWith(50);
  });

  it('vibrate with pattern', () => {
    vibrate([100, 50, 100]);
    expect(navigator.vibrate).toHaveBeenCalledWith([100, 50, 100]);
  });

  it('vibrateSuccess calls with 50ms', () => {
    vibrateSuccess();
    expect(navigator.vibrate).toHaveBeenCalledWith(50);
  });

  it('vibrateError calls with pattern', () => {
    vibrateError();
    expect(navigator.vibrate).toHaveBeenCalledWith([100, 50, 100]);
  });

  it('vibrateSelection calls with 30ms', () => {
    vibrateSelection();
    expect(navigator.vibrate).toHaveBeenCalledWith(30);
  });

  it('vibrateLongPress calls with pattern', () => {
    vibrateLongPress();
    expect(navigator.vibrate).toHaveBeenCalledWith([50, 100, 50]);
  });

  it('cancelVibrate calls with 0', () => {
    cancelVibrate();
    expect(navigator.vibrate).toHaveBeenCalledWith(0);
  });
});
