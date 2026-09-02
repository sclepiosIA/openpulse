import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const setItem = vi.fn();
const getItem = vi.fn();
const removeItem = vi.fn();

vi.mock('@/lib/safeStorage', () => ({
  safeStorage: {
    setItem: (...args: unknown[]) => setItem(...args),
    getItem: (...args: unknown[]) => getItem(...args),
    removeItem: (...args: unknown[]) => removeItem(...args),
  },
}));

import { useActiveEditingGuard } from '../ui/useActiveEditingGuard';

describe('useActiveEditingGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getItem.mockReturnValue('0');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts without throwing', () => {
    expect(() => {
      const { unmount } = renderHook(() => useActiveEditingGuard());
      unmount();
    }).not.toThrow();
  });

  it('registers an input listener that marks the editing flag', () => {
    renderHook(() => useActiveEditingGuard());
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // safeStorage.setItem should be called for both LAST_INPUT_KEY and EDITING_FLAG
    expect(setItem).toHaveBeenCalled();
    const calls = setItem.mock.calls.map((c) => c[0]);
    expect(calls).toContain('app-editing-active');
    expect(calls).toContain('app-last-input-at');
    document.body.removeChild(input);
  });

  it('ignores non-editable element events', () => {
    renderHook(() => useActiveEditingGuard());
    const div = document.createElement('div');
    document.body.appendChild(div);
    div.dispatchEvent(new Event('input', { bubbles: true }));
    expect(setItem).not.toHaveBeenCalled();
    document.body.removeChild(div);
  });

  it('cleans up listeners and clears editing flag on unmount', () => {
    const { unmount } = renderHook(() => useActiveEditingGuard());
    unmount();
    expect(removeItem).toHaveBeenCalledWith('app-editing-active');
  });

  it('clears stale flag on the interval tick', () => {
    vi.useFakeTimers();
    getItem.mockReturnValue('0'); // very old timestamp
    renderHook(() => useActiveEditingGuard());
    vi.advanceTimersByTime(30_000);
    expect(removeItem).toHaveBeenCalledWith('app-editing-active');
  });
});
