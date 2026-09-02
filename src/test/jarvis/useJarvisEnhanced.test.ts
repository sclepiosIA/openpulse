/**
 * Tests for useJarvisEnhanced hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisEnhanced } from '@/hooks/jarvis/useJarvisEnhanced';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    }
  }
}));

// Mock auth
vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' }
  })
}));

// Mock toast
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

describe('useJarvisEnhanced', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0
        }
      }
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => 
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('should initialize with empty predictions', async () => {
    const { result } = renderHook(() => useJarvisEnhanced(), { wrapper });
    
    expect(result.current.predictions).toEqual([]);
    expect(result.current.workflows).toEqual([]);
    expect(result.current.isPredictionsLoading).toBe(true);
  });

  it('should return contextual predictions based on time', async () => {
    const { result } = renderHook(() => useJarvisEnhanced(), { wrapper });
    
    // Mock predictions data
    const mockPredictions = [
      { action: 'check_emails', probability: 0.8, reason: 'morning routine' },
      { action: 'review_tasks', probability: 0.5, reason: 'afternoon check' }
    ];
    
    await waitFor(() => {
      expect(result.current.getContextualPredictions).toBeDefined();
    });
    
    const contextual = result.current.getContextualPredictions();
    expect(Array.isArray(contextual)).toBe(true);
  });

  it('should provide workflow execution function', () => {
    const { result } = renderHook(() => useJarvisEnhanced(), { wrapper });
    
    expect(result.current.executeWorkflow).toBeDefined();
    expect(typeof result.current.executeWorkflow).toBe('function');
  });

  it('should provide feedback recording function', () => {
    const { result } = renderHook(() => useJarvisEnhanced(), { wrapper });
    
    expect(result.current.recordFeedback).toBeDefined();
    expect(typeof result.current.recordFeedback).toBe('function');
  });

  it('should return suggested workflows', () => {
    const { result } = renderHook(() => useJarvisEnhanced(), { wrapper });
    
    const suggested = result.current.getSuggestedWorkflows();
    expect(Array.isArray(suggested)).toBe(true);
  });
});
