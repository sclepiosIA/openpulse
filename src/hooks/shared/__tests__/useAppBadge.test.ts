import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppBadge, __resetBadgeStateForTests } from '../useAppBadge';
import { debug } from '@/lib/debug';

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), warn: vi.fn() },
}));

describe('useAppBadge', () => {
  const setAppBadge = vi.fn(() => Promise.resolve());
  const clearAppBadge = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.clearAllMocks();
    __resetBadgeStateForTests();
    Object.defineProperty(navigator, 'setAppBadge', {
      configurable: true,
      value: setAppBadge,
    });
    Object.defineProperty(navigator, 'clearAppBadge', {
      configurable: true,
      value: clearAppBadge,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'setAppBadge');
    Reflect.deleteProperty(navigator, 'clearAppBadge');
  });

  it('détecte le support de l’API badge', () => {
    const { result } = renderHook(() => useAppBadge());

    expect(result.current.isSupported).toBe(true);
  });

  it('appelle setAppBadge pour un compteur positif', async () => {
    const { result } = renderHook(() => useAppBadge());

    await act(async () => {
      await result.current.setBadge(7);
    });

    expect(setAppBadge).toHaveBeenCalledWith(7);
    expect(clearAppBadge).not.toHaveBeenCalled();
    expect(debug.log).toHaveBeenCalledWith('[Badge] Set badge to:', 7);
  });

  it('appelle clearAppBadge pour un compteur nul ou négatif', async () => {
    const { result } = renderHook(() => useAppBadge());

    await act(async () => {
      await result.current.setBadge(0);
    });
    expect(clearAppBadge).toHaveBeenCalledTimes(1);

    __resetBadgeStateForTests();
    await act(async () => {
      await result.current.setBadge(-1);
    });
    expect(clearAppBadge).toHaveBeenCalledTimes(2);
  });

  it('clearBadge nettoie explicitement le badge', async () => {
    const { result } = renderHook(() => useAppBadge());

    await act(async () => {
      await result.current.clearBadge();
    });

    expect(clearAppBadge).toHaveBeenCalledTimes(1);
    expect(debug.log).toHaveBeenCalledWith('[Badge] Badge cleared');
  });

  it('ne fait rien si l’API badge n’est pas supportée', async () => {
    Reflect.deleteProperty(navigator, 'setAppBadge');
    Reflect.deleteProperty(navigator, 'clearAppBadge');
    const { result } = renderHook(() => useAppBadge());

    await act(async () => {
      await result.current.setBadge(3);
      await result.current.clearBadge();
    });

    expect(result.current.isSupported).toBe(false);
    expect(setAppBadge).not.toHaveBeenCalled();
    expect(clearAppBadge).not.toHaveBeenCalled();
  });

  it('capture les erreurs API dans debug.warn', async () => {
    setAppBadge.mockRejectedValueOnce(new Error('badge failed'));
    const { result } = renderHook(() => useAppBadge());

    await act(async () => {
      await result.current.setBadge(1);
    });

    expect(debug.warn).toHaveBeenCalledWith('[Badge] Error setting badge:', expect.any(Error));
  });
});