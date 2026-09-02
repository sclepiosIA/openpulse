import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { useJarvisOptimisticUI } from '../jarvis/useJarvisOptimisticUI';

describe('useJarvisOptimisticUI', () => {
  it('starts with empty actions', () => {
    const { result } = renderHook(() => useJarvisOptimisticUI());
    expect(result.current.optimisticActions).toHaveLength(0);
  });

  it('startOptimisticAction adds action with optimistic status', () => {
    const { result } = renderHook(() => useJarvisOptimisticUI());
    act(() => { result.current.startOptimisticAction('a1', 'tool1', 'Test action'); });
    expect(result.current.optimisticActions).toHaveLength(1);
    expect(result.current.optimisticActions[0].status).toBe('optimistic');
    expect(result.current.optimisticActions[0].toolName).toBe('tool1');
  });

  it('confirmAction sets status to confirmed', () => {
    const { result } = renderHook(() => useJarvisOptimisticUI());
    act(() => { result.current.startOptimisticAction('a1', 'tool1', 'Test'); });
    act(() => { result.current.confirmAction('a1'); });
    expect(result.current.optimisticActions[0].status).toBe('confirmed');
    expect(result.current.optimisticActions[0].confirmedAt).toBeDefined();
  });

  it('failAction sets status to failed with error', () => {
    const { result } = renderHook(() => useJarvisOptimisticUI());
    act(() => { result.current.startOptimisticAction('a1', 'tool1', 'Test'); });
    act(() => { result.current.failAction('a1', 'Network error'); });
    expect(result.current.optimisticActions[0].status).toBe('failed');
    expect(result.current.optimisticActions[0].errorMessage).toBe('Network error');
  });

  it('rollbackAction sets status to rolled_back', () => {
    const { result } = renderHook(() => useJarvisOptimisticUI());
    act(() => { result.current.startOptimisticAction('a1', 'tool1', 'Test'); });
    act(() => { result.current.rollbackAction('a1'); });
    expect(result.current.optimisticActions[0].status).toBe('rolled_back');
  });

  it('clearCompletedActions removes non-pending', () => {
    const { result } = renderHook(() => useJarvisOptimisticUI());
    act(() => { result.current.startOptimisticAction('a1', 'tool1', 'Keep'); });
    act(() => { result.current.startOptimisticAction('a2', 'tool2', 'Remove'); });
    act(() => { result.current.confirmAction('a2'); });
    act(() => { result.current.clearCompletedActions(); });
    expect(result.current.optimisticActions).toHaveLength(1);
    expect(result.current.optimisticActions[0].id).toBe('a1');
  });

  it('getActionStatus returns correct status', () => {
    const { result } = renderHook(() => useJarvisOptimisticUI());
    act(() => { result.current.startOptimisticAction('a1', 'tool1', 'Test'); });
    expect(result.current.getActionStatus('a1')).toBe('optimistic');
    expect(result.current.getActionStatus('unknown')).toBeUndefined();
  });

  it('isActionPending returns true for optimistic', () => {
    const { result } = renderHook(() => useJarvisOptimisticUI());
    act(() => { result.current.startOptimisticAction('a1', 'tool1', 'Test'); });
    expect(result.current.isActionPending('a1')).toBe(true);
    act(() => { result.current.confirmAction('a1'); });
    expect(result.current.isActionPending('a1')).toBe(false);
  });
});
