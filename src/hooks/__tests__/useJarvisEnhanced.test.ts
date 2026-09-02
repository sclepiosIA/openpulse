import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'test@test.com' } }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message || 'Error',
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: {
          success: true,
          predictions: [
            { action: 'check_emails', probability: 0.8, reason: 'morning routine' },
            { action: 'review_tasks', probability: 0.7, reason: 'daily check' },
          ],
          behavior_stats: { total_actions: 100, peak_hours: [9, 14], peak_days: [1, 2], most_common_actions: [] },
          workflows: [
            { id: 'morning-briefing', name: 'Briefing matinal', description: 'desc', category: 'daily', triggerCommand: '/morning', stepsCount: 3, estimatedDurationMs: 5000 },
          ],
          metrics: { totalInteractions: 50, acceptanceRate: 0.75, topActions: [], suggestions: [] },
        },
        error: null,
      }),
    },
  },
}));

describe('useJarvisEnhanced', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  });

  it('should return predictions, workflows and learning data', async () => {
    const { useJarvisEnhanced } = await import('@/hooks/jarvis/useJarvisEnhanced');
    const { result } = renderHook(() => useJarvisEnhanced(), { wrapper });

    await waitFor(() => {
      expect(result.current.isPredictionsLoading).toBe(false);
    });

    expect(result.current.predictions).toBeDefined();
    expect(result.current.workflows).toBeDefined();
    expect(typeof result.current.getContextualPredictions).toBe('function');
    expect(typeof result.current.getSuggestedWorkflows).toBe('function');
    expect(typeof result.current.executeWorkflow).toBe('function');
    expect(typeof result.current.recordFeedback).toBe('function');
    expect(typeof result.current.refetchPredictions).toBe('function');
  });

  it('getContextualPredictions should return filtered predictions', async () => {
    const { useJarvisEnhanced } = await import('@/hooks/jarvis/useJarvisEnhanced');
    const { result } = renderHook(() => useJarvisEnhanced(), { wrapper });

    await waitFor(() => {
      expect(result.current.isPredictionsLoading).toBe(false);
    });

    const contextual = result.current.getContextualPredictions();
    expect(Array.isArray(contextual)).toBe(true);
  });

  it('isExecutingWorkflow should be false initially', async () => {
    const { useJarvisEnhanced } = await import('@/hooks/jarvis/useJarvisEnhanced');
    const { result } = renderHook(() => useJarvisEnhanced(), { wrapper });

    expect(result.current.isExecutingWorkflow).toBe(false);
  });
});
