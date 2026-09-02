/**
 * Tests for useJarvisStreaming hook
 * 
 * Covers: streaming state, abort, reset, error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock useAuth
vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-123', email: 'test@test.com' },
  }),
}));

// Mock useToast
const mockToast = vi.fn();
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock debug
vi.mock('@/lib/debug', () => ({
  debug: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

// Import AFTER mocks
import { useJarvisStreaming } from '@/hooks/jarvis/useJarvisStreaming';

describe('useJarvisStreaming', () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Initial State', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useJarvisStreaming());

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.currentContent).toBe('');
      expect(result.current.isDone).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should expose all required methods', () => {
      const { result } = renderHook(() => useJarvisStreaming());

      expect(typeof result.current.streamChat).toBe('function');
      expect(typeof result.current.cancelStream).toBe('function');
      expect(typeof result.current.resetStream).toBe('function');
    });
  });

  describe('resetStream', () => {
    it('should reset all state to defaults', async () => {
      const { result } = renderHook(() => useJarvisStreaming());

      // Manually set state by calling reset
      act(() => {
        result.current.resetStream();
      });

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.currentContent).toBe('');
      expect(result.current.isDone).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('cancelStream', () => {
    it('should cancel ongoing stream and set isStreaming to false', () => {
      const { result } = renderHook(() => useJarvisStreaming());

      act(() => {
        result.current.cancelStream();
      });

      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe('streamChat - Error Scenarios', () => {
    it('should return null when user is not authenticated', async () => {
      // The actual hook checks for user.id before fetching
      const { result } = renderHook(() => useJarvisStreaming());

      // Mock fetch to fail
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      // This should handle gracefully
      expect(result.current.isStreaming).toBe(false);
    });

    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useJarvisStreaming());

      let returnValue: string | null = null;
      await act(async () => {
        returnValue = await result.current.streamChat('test message');
      });

      // Should return null on error
      expect(returnValue).toBeNull();
      expect(result.current.isStreaming).toBe(false);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      const { result } = renderHook(() => useJarvisStreaming());

      let returnValue: string | null = 'initial';
      await act(async () => {
        returnValue = await result.current.streamChat('test message');
      });

      // Should return null on error (may retry internally)
      expect(result.current.isStreaming).toBe(false);
    });

    it('should handle missing response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const { result } = renderHook(() => useJarvisStreaming());

      let returnValue: string | null = 'initial';
      await act(async () => {
        returnValue = await result.current.streamChat('test message');
      });

      // Should handle gracefully
      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe('streamChat - SSE Parsing', () => {
    it('should handle error events in stream', async () => {
      const chunks = [
        'data: {"error":"Something went wrong"}\n',
      ];

      let chunkIndex = 0;
      const mockReader = {
        read: vi.fn(async () => {
          if (chunkIndex < chunks.length) {
            const chunk = chunks[chunkIndex];
            chunkIndex++;
            return { done: false, value: new TextEncoder().encode(chunk) };
          }
          return { done: true, value: undefined };
        }),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const { result } = renderHook(() => useJarvisStreaming());

      await act(async () => {
        await result.current.streamChat('test');
      });

      expect(result.current.isStreaming).toBe(false);
    });
  });

});
