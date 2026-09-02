import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mediaState = vi.hoisted(() => ({
  reducedMotion: false,
  mobile: false,
}));

vi.mock('../shared/useMediaQuery', () => ({
  useMediaQuery: (query: string) => {
    if (query.includes('prefers-reduced-motion')) return mediaState.reducedMotion;
    if (query.includes('max-width')) return mediaState.mobile;
    return false;
  },
}));

import { useShouldAnimate, useShouldAnimateLight } from '../ui/useShouldAnimate';

const setVisibility = (visibilityState: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  });
};

describe('useShouldAnimate extended', () => {
  beforeEach(() => {
    mediaState.reducedMotion = false;
    mediaState.mobile = false;
    setVisibility('visible');
  });

  it('désactive les animations si reduced motion est activé', () => {
    mediaState.reducedMotion = true;

    const { result } = renderHook(() => useShouldAnimate());

    expect(result.current).toBe(false);
  });

  it('désactive la variante complète sur mobile', () => {
    mediaState.mobile = true;

    const { result } = renderHook(() => useShouldAnimate());

    expect(result.current).toBe(false);
  });

  it('garde la variante light active sur mobile quand l’onglet est visible', () => {
    mediaState.mobile = true;

    const { result } = renderHook(() => useShouldAnimateLight());

    expect(result.current).toBe(true);
  });

  it('met les deux variantes en pause quand le document devient masqué', async () => {
    const full = renderHook(() => useShouldAnimate());
    const light = renderHook(() => useShouldAnimateLight());

    act(() => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(full.result.current).toBe(false));
    expect(light.result.current).toBe(false);
  });
});