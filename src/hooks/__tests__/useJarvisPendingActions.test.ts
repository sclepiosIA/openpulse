/**
 * Tests for useJarvisPendingActions hook
 * 
 * Covers: fetch, approve, reject, modify actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock Supabase
const mockFrom = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

// Mock useToast
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Import AFTER mocks
import { useJarvisPendingActions } from '@/hooks/jarvis/useJarvisPendingActions';
import { supabase } from '@/integrations/supabase/client';

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
};

describe('useJarvisPendingActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Query - Pending Actions', () => {
    it('should return empty array when userId is undefined', async () => {
      const { result } = renderHook(() => useJarvisPendingActions(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.pendingActions).toEqual([]);
      });
      
      expect(result.current.pendingCount).toBe(0);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should fetch pending actions for authenticated user', async () => {
      const mockActions = [
        { id: '1', status: 'pending', action_type: 'create_task' },
        { id: '2', status: 'pending', action_type: 'send_email' },
      ];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockActions, error: null }),
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useJarvisPendingActions('user-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFrom).toHaveBeenCalledWith('jarvis_pending_actions');
    });

    it('should handle fetch errors', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ 
                  data: null, 
                  error: new Error('DB Error') 
                }),
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useJarvisPendingActions('user-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });
    });
  });

  describe('Mutations - Approve Action', () => {
    it('should call jarvis-execute edge function', async () => {
      // Setup query mock
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });

      mockInvoke.mockResolvedValue({ 
        data: { success: true, action_type: 'create_task' }, 
        error: null 
      });

      const { result } = renderHook(() => useJarvisPendingActions('user-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.approveAction('action-id-123');
      });

      expect(mockInvoke).toHaveBeenCalledWith('jarvis-execute', {
        body: { action_id: 'action-id-123', user_id: 'user-123' },
      });
    });
  });

  describe('Mutations - Reject Action', () => {
    it('should update action status to rejected', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'jarvis_pending_actions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gt: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return {};
      });

      const { result } = renderHook(() => useJarvisPendingActions('user-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.rejectAction('action-id-123', 'Not relevant');
      });

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'rejected',
        user_feedback: 'Not relevant',
      }));
    });

    it('should reject without reason', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'jarvis_pending_actions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gt: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return {};
      });

      const { result } = renderHook(() => useJarvisPendingActions('user-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.rejectAction('action-id-123');
      });

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'rejected',
        user_feedback: null,
      }));
    });
  });

  describe('Mutations - Modify and Approve', () => {
    it('should call jarvis-execute with modifications', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });

      mockInvoke.mockResolvedValue({ 
        data: { success: true }, 
        error: null 
      });

      const { result } = renderHook(() => useJarvisPendingActions('user-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const modifications = { title: 'Modified Title' };

      await act(async () => {
        await result.current.modifyAndApprove('action-id-123', modifications);
      });

      expect(mockInvoke).toHaveBeenCalledWith('jarvis-execute', {
        body: { 
          action_id: 'action-id-123', 
          user_id: 'user-123',
          modifications,
        },
      });
    });
  });

  describe('Mutations - Submit Feedback', () => {
    it('should update feedback on action', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'jarvis_pending_actions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gt: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return {};
      });

      const { result } = renderHook(() => useJarvisPendingActions('user-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.submitFeedback('action-id-123', 5, 'Great suggestion!');
      });

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        feedback_rating: 5,
        user_feedback: 'Great suggestion!',
      }));
    });
  });

  describe('Loading States', () => {
    it('should track approval loading state', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });

      // Make invoke hang to test loading state
      mockInvoke.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const { result } = renderHook(() => useJarvisPendingActions('user-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Initial state
      expect(result.current.isApproving).toBe(false);
      expect(result.current.isRejecting).toBe(false);
      expect(result.current.isModifying).toBe(false);
    });
  });
});
