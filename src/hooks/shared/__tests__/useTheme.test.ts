import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '../useTheme';
import { safeStorage } from '@/lib/safeStorage';

vi.mock('@/lib/safeStorage', () => ({
  safeStorage: {
    setItem: vi.fn(),
  },
}));

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.className = 'dark legacy-class';
  });

  it('force le thème light et retire dark', async () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
    await waitFor(() => expect(document.documentElement.classList.contains('light')).toBe(true));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(safeStorage.setItem).toHaveBeenCalledWith('theme', 'light');
  });

  it('conserve des méthodes noop pour compatibilité', async () => {
    const { result } = renderHook(() => useTheme());

    result.current.setTheme('dark');
    result.current.toggleTheme();

    await waitFor(() => expect(document.documentElement.classList.contains('light')).toBe(true));
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});