import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/lib/safeStorage', () => ({
  safeStorage: {
    getItem: vi.fn().mockReturnValue('light'),
    setItem: vi.fn(),
  },
}));

describe('useTheme', () => {
  it('always returns light theme', async () => {
    const { useTheme } = await import('../shared/useTheme');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('toggleTheme is a no-op', async () => {
    const { useTheme } = await import('../shared/useTheme');
    const { result } = renderHook(() => useTheme());
    // Should not throw
    expect(() => result.current.toggleTheme()).not.toThrow();
    expect(result.current.theme).toBe('light');
  });

  it('setTheme is a no-op', async () => {
    const { useTheme } = await import('../shared/useTheme');
    const { result } = renderHook(() => useTheme());
    expect(() => result.current.setTheme('dark')).not.toThrow();
    expect(result.current.theme).toBe('light');
  });
});
