import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));
vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn() },
}));
vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: unknown) => e instanceof Error ? e.message : String(e),
}));

import { useErrorHandler } from '../shared/useErrorHandler';
import { toast } from 'sonner';

describe('useErrorHandler', () => {
  it('returns handleError function', () => {
    const { result } = renderHook(() => useErrorHandler());
    expect(typeof result.current.handleError).toBe('function');
  });

  it('shows toast with sanitized error', () => {
    const { result } = renderHook(() => useErrorHandler());
    act(() => {
      result.current.handleError(new Error('Test error'), 'TestContext');
    });
    expect(toast.error).toHaveBeenCalledWith('Test error', expect.objectContaining({
      description: 'Contexte : TestContext',
    }));
  });
});
