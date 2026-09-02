import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';

// Mock the context
vi.mock('@/hooks/shared/useNavigationHistory', () => ({
  useNavigationHistory: () => ({
    history: ['/dashboard', '/emails'],
    goBack: vi.fn(),
    canGoBack: true,
  }),
}));

import { useNavigationHistory } from '../shared/useNavigationHistory';

describe('useNavigationHistory', () => {
  it('returns history array', () => {
    const { result } = renderHook(() => useNavigationHistory());
    expect(Array.isArray(result.current.history)).toBe(true);
  });

  it('returns goBack function', () => {
    const { result } = renderHook(() => useNavigationHistory());
    expect(typeof result.current.goBack).toBe('function');
  });

  it('returns canGoBack boolean', () => {
    const { result } = renderHook(() => useNavigationHistory());
    expect(typeof result.current.canGoBack).toBe('boolean');
  });
});
