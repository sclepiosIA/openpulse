import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppBadge, __resetBadgeStateForTests } from '../shared/useAppBadge';

describe('useAppBadge extended', () => {
  beforeEach(() => {
    __resetBadgeStateForTests();
    // Clean up any previous mock
    if ('setAppBadge' in navigator) {
      delete (navigator as any).setAppBadge;
    }
    if ('clearAppBadge' in navigator) {
      delete (navigator as any).clearAppBadge;
    }
  });

  it('reports unsupported when API missing', () => {
    const { result } = renderHook(() => useAppBadge());
    expect(result.current.isSupported).toBe(false);
  });

  it('reports supported when API present', () => {
    (navigator as any).setAppBadge = vi.fn();
    const { result } = renderHook(() => useAppBadge());
    expect(result.current.isSupported).toBe(true);
  });

  it('setBadge calls navigator.setAppBadge', async () => {
    const mockSetBadge = vi.fn().mockResolvedValue(undefined);
    (navigator as any).setAppBadge = mockSetBadge;
    const { result } = renderHook(() => useAppBadge());
    await act(async () => {
      await result.current.setBadge(5);
    });
    expect(mockSetBadge).toHaveBeenCalledWith(5);
  });

  it('clearBadge calls navigator.clearAppBadge', async () => {
    const mockClearBadge = vi.fn().mockResolvedValue(undefined);
    (navigator as any).setAppBadge = vi.fn();
    (navigator as any).clearAppBadge = mockClearBadge;
    const { result } = renderHook(() => useAppBadge());
    await act(async () => {
      await result.current.clearBadge();
    });
    expect(mockClearBadge).toHaveBeenCalled();
  });

  it('setBadge does not throw when unsupported', async () => {
    const { result } = renderHook(() => useAppBadge());
    await expect(
      act(async () => { await result.current.setBadge(1); })
    ).resolves.not.toThrow();
  });

  it('clearBadge does not throw when unsupported', async () => {
    const { result } = renderHook(() => useAppBadge());
    await expect(
      act(async () => { await result.current.clearBadge(); })
    ).resolves.not.toThrow();
  });
});
