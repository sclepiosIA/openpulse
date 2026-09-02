import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../shared/useMediaQuery', () => ({
  useMediaQuery: vi.fn().mockReturnValue(false),
}));

describe('useShouldAnimate', () => {
  it('returns true when no restrictions', async () => {
    const { useShouldAnimate } = await import('../ui/useShouldAnimate');
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(true);
  });

  it('useShouldAnimateLight returns true when no restrictions', async () => {
    const { useShouldAnimateLight } = await import('../ui/useShouldAnimate');
    const { result } = renderHook(() => useShouldAnimateLight());
    expect(result.current).toBe(true);
  });
});
