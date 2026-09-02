/**
 * Tests for useJarvisConversationSearch hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null }))
  }
}));

// Mock useDebounce
vi.mock('@/hooks/shared/useDebounce', () => ({
  useDebounce: (value: string) => value
}));

// Mock auth
vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } })
}));

import { useJarvisConversationSearch } from '@/hooks/jarvis/useJarvisConversationSearch';
import { supabase } from '@/integrations/supabase/client';

describe('useJarvisConversationSearch', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => 
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useJarvisConversationSearch(), { wrapper });
    expect(result.current.searchTerm).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  it('should provide setSearchTerm function', () => {
    const { result } = renderHook(() => useJarvisConversationSearch(), { wrapper });
    expect(typeof result.current.setSearchTerm).toBe('function');
  });

  it('should provide clearSearch function', () => {
    const { result } = renderHook(() => useJarvisConversationSearch(), { wrapper });
    expect(typeof result.current.clearSearch).toBe('function');
  });

  it('should highlight search terms correctly', () => {
    const { result } = renderHook(() => useJarvisConversationSearch(), { wrapper });
    const highlighted = result.current.highlightMatch('Hello world test', 'world');
    expect(highlighted.some(p => p.highlight)).toBe(true);
  });
});
