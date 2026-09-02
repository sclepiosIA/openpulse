import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTheme } from '../shared/useTheme';

describe('useTheme extended', () => {
  it('returns theme as light', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('returns setTheme function', () => {
    const { result } = renderHook(() => useTheme());
    expect(typeof result.current.setTheme).toBe('function');
  });

  it('returns toggleTheme function', () => {
    const { result } = renderHook(() => useTheme());
    expect(typeof result.current.toggleTheme).toBe('function');
  });

  it('toggleTheme is no-op (stays light)', () => {
    const { result } = renderHook(() => useTheme());
    result.current.toggleTheme();
    expect(result.current.theme).toBe('light');
  });

  it('setTheme is no-op (stays light)', () => {
    const { result } = renderHook(() => useTheme());
    result.current.setTheme('dark');
    expect(result.current.theme).toBe('light');
  });

  it('applies light class to document', () => {
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('does not have dark class', () => {
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
