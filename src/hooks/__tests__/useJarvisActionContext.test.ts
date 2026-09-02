/**
 * Tests for useJarvisActionContext hook
 * 
 * Covers: context fetch, resume, pause, cancel actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';

// Mock useAuth
vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
  }),
}));

// Mock use-toast
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock Supabase
const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'new-job-id' }, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }),
  functions: {
    invoke: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useJarvisActionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export hook as a function', async () => {
    const module = await import('@/hooks/jarvis/useJarvisActionContext');
    expect(typeof module.useJarvisActionContext).toBe('function');
  });

  it('should initialize with empty pending contexts', async () => {
    const { useJarvisActionContext } = await import('@/hooks/jarvis/useJarvisActionContext');
    
    const { result } = renderHook(() => useJarvisActionContext(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.pendingContexts).toEqual([]);
      expect(result.current.hasPendingContexts).toBe(false);
      expect(result.current.pendingCount).toBe(0);
    });
  });

  it('should provide resumeAction as a function', async () => {
    const { useJarvisActionContext } = await import('@/hooks/jarvis/useJarvisActionContext');
    
    const { result } = renderHook(() => useJarvisActionContext(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.resumeAction).toBe('function');
  });

  it('should provide cancelContext as a function', async () => {
    const { useJarvisActionContext } = await import('@/hooks/jarvis/useJarvisActionContext');
    
    const { result } = renderHook(() => useJarvisActionContext(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.cancelContext).toBe('function');
  });

  it('should provide pauseContext as a function', async () => {
    const { useJarvisActionContext } = await import('@/hooks/jarvis/useJarvisActionContext');
    
    const { result } = renderHook(() => useJarvisActionContext(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.pauseContext).toBe('function');
  });

  it('should provide getContextSummary as a function', async () => {
    const { useJarvisActionContext } = await import('@/hooks/jarvis/useJarvisActionContext');
    
    const { result } = renderHook(() => useJarvisActionContext(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.getContextSummary).toBe('function');
  });

  it('should format context summary correctly', async () => {
    const { useJarvisActionContext } = await import('@/hooks/jarvis/useJarvisActionContext');
    
    const { result } = renderHook(() => useJarvisActionContext(), {
      wrapper: createWrapper(),
    });

    const mockContext = {
      id: 'test-id',
      user_id: 'user-123',
      action_type: 'send_email',
      action_data: {},
      status: 'paused' as const,
      original_message: 'Envoie un email à Andrei',
      conversation_id: null,
      last_interaction_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const summary = result.current.getContextSummary(mockContext);
    expect(summary).toContain('📧');
    expect(summary).toContain('Email');
    expect(summary).toContain('Envoie un email à Andrei');
  });

  it('should truncate long messages in summary', async () => {
    const { useJarvisActionContext } = await import('@/hooks/jarvis/useJarvisActionContext');
    
    const { result } = renderHook(() => useJarvisActionContext(), {
      wrapper: createWrapper(),
    });

    const longMessage = 'A'.repeat(100);
    const mockContext = {
      id: 'test-id',
      user_id: 'user-123',
      action_type: 'create_task',
      action_data: {},
      status: 'in_progress' as const,
      original_message: longMessage,
      conversation_id: null,
      last_interaction_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const summary = result.current.getContextSummary(mockContext);
    expect(summary).toContain('...');
    expect(summary.length).toBeLessThan(longMessage.length + 20);
  });

  it('should have correct loading states', async () => {
    const { useJarvisActionContext } = await import('@/hooks/jarvis/useJarvisActionContext');
    
    const { result } = renderHook(() => useJarvisActionContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isResuming).toBe(false);
    expect(result.current.isCancelling).toBe(false);
  });
});
