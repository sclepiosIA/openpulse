import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { suggestions: [], insights: [] }, error: null }),
    },
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}));

import { useJarvisCollectiveLearning } from '../jarvis/useJarvisCollectiveLearning';
import { supabase } from '@/integrations/supabase/client';

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useJarvisCollectiveLearning', () => {
  it('returns suggestions array', () => {
    const { result } = renderHook(() => useJarvisCollectiveLearning(), { wrapper: createWrapper() });
    expect(Array.isArray(result.current.suggestions)).toBe(true);
  });

  it('returns insights array', () => {
    const { result } = renderHook(() => useJarvisCollectiveLearning(), { wrapper: createWrapper() });
    expect(Array.isArray(result.current.insights)).toBe(true);
  });

  it('returns recordAction function', () => {
    const { result } = renderHook(() => useJarvisCollectiveLearning(), { wrapper: createWrapper() });
    expect(typeof result.current.recordAction).toBe('function');
  });

  it('returns getSuggestionsByType function', () => {
    const { result } = renderHook(() => useJarvisCollectiveLearning(), { wrapper: createWrapper() });
    expect(result.current.getSuggestionsByType('test')).toEqual([]);
  });

  it('returns hasSuggestions false when empty', () => {
    const { result } = renderHook(() => useJarvisCollectiveLearning(), { wrapper: createWrapper() });
    expect(result.current.hasSuggestions).toBe(false);
  });
});
