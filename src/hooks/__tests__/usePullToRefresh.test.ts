import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn() },
}));

import { usePullToRefresh } from '../ui/usePullToRefresh';

describe('usePullToRefresh', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => usePullToRefresh({
      onRefresh: vi.fn().mockResolvedValue(undefined),
    }));
    expect(result.current.pullDistance).toBe(0);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.shouldRefresh).toBe(false);
  });

  it('returns touch handlers', () => {
    const { result } = renderHook(() => usePullToRefresh({
      onRefresh: vi.fn().mockResolvedValue(undefined),
    }));
    expect(result.current.handlers).toHaveProperty('onTouchStart');
    expect(result.current.handlers).toHaveProperty('onTouchMove');
    expect(result.current.handlers).toHaveProperty('onTouchEnd');
  });

  it('accepts custom threshold and maxPull', () => {
    const { result } = renderHook(() => usePullToRefresh({
      onRefresh: vi.fn().mockResolvedValue(undefined),
      threshold: 100,
      maxPull: 200,
    }));
    expect(result.current.pullDistance).toBe(0);
  });
});
