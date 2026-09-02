import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/config/mobile-tokens', () => ({
  mobileDesignTokens: {
    swipe: { threshold: 80, maxDistance: 200 },
  },
}));

import { useSwipeActions } from '../ui/useSwipeActions';

describe('useSwipeActions', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useSwipeActions());
    expect(result.current.translateX).toBe(0);
    expect(result.current.isSwiping).toBe(false);
    expect(result.current.hasLeftActions).toBe(false);
    expect(result.current.hasRightActions).toBe(false);
  });

  it('returns handlers', () => {
    const { result } = renderHook(() => useSwipeActions());
    expect(result.current.handlers).toHaveProperty('onTouchStart');
    expect(result.current.handlers).toHaveProperty('onTouchMove');
    expect(result.current.handlers).toHaveProperty('onTouchEnd');
  });

  it('reports hasLeftActions when provided', () => {
    const action = { id: 'a', label: 'Test', color: 'primary' as const, onAction: vi.fn() };
    const { result } = renderHook(() => useSwipeActions({ leftActions: [action] }));
    expect(result.current.hasLeftActions).toBe(true);
    expect(result.current.hasRightActions).toBe(false);
  });

  it('reports hasRightActions when provided', () => {
    const action = { id: 'b', label: 'Delete', color: 'destructive' as const, onAction: vi.fn() };
    const { result } = renderHook(() => useSwipeActions({ rightActions: [action] }));
    expect(result.current.hasRightActions).toBe(true);
  });

  it('reset resets translateX', () => {
    const { result } = renderHook(() => useSwipeActions());
    result.current.reset();
    expect(result.current.translateX).toBe(0);
    expect(result.current.isSwiping).toBe(false);
  });
});
