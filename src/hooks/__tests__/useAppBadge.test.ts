import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), warn: vi.fn() },
}));

describe('useAppBadge', () => {
  let originalSetAppBadge: any;
  let originalClearAppBadge: any;

  beforeEach(async () => {
    const { __resetBadgeStateForTests } = await import('../shared/useAppBadge');
    __resetBadgeStateForTests();
    originalSetAppBadge = (navigator as any).setAppBadge;
    originalClearAppBadge = (navigator as any).clearAppBadge;
    (navigator as any).setAppBadge = vi.fn().mockResolvedValue(undefined);
    (navigator as any).clearAppBadge = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalSetAppBadge) {
      (navigator as any).setAppBadge = originalSetAppBadge;
    } else {
      delete (navigator as any).setAppBadge;
    }
    if (originalClearAppBadge) {
      (navigator as any).clearAppBadge = originalClearAppBadge;
    } else {
      delete (navigator as any).clearAppBadge;
    }
  });

  it('reports isSupported when API available', async () => {
    const { useAppBadge } = await import('../shared/useAppBadge');
    const { result } = renderHook(() => useAppBadge());
    expect(result.current.isSupported).toBe(true);
  });

  it('setBadge calls navigator.setAppBadge for count > 0', async () => {
    const { useAppBadge } = await import('../shared/useAppBadge');
    const { result } = renderHook(() => useAppBadge());
    await act(async () => { await result.current.setBadge(5); });
    expect((navigator as any).setAppBadge).toHaveBeenCalledWith(5);
  });

  it('setBadge calls clearAppBadge for count = 0', async () => {
    const { useAppBadge } = await import('../shared/useAppBadge');
    const { result } = renderHook(() => useAppBadge());
    await act(async () => { await result.current.setBadge(0); });
    expect((navigator as any).clearAppBadge).toHaveBeenCalled();
  });

  it('clearBadge calls navigator.clearAppBadge', async () => {
    const { useAppBadge } = await import('../shared/useAppBadge');
    const { result } = renderHook(() => useAppBadge());
    await act(async () => { await result.current.clearBadge(); });
    expect((navigator as any).clearAppBadge).toHaveBeenCalled();
  });
});
