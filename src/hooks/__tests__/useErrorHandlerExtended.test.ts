import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useErrorHandler } from '../shared/useErrorHandler';

vi.mock('@/lib/debug', () => ({ debug: { error: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: unknown) => e instanceof Error ? e.message : String(e),
}));

describe('useErrorHandler', () => {
  it('returns handleError function', () => {
    const { result } = renderHook(() => useErrorHandler());
    expect(typeof result.current.handleError).toBe('function');
  });

  it('handleError calls toast.error', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useErrorHandler());
    result.current.handleError(new Error('test'), 'TestCtx');
    expect(toast.error).toHaveBeenCalledWith('test', expect.objectContaining({
      description: 'Contexte : TestCtx',
    }));
  });

  it('handleError calls debug.error', async () => {
    const { debug } = await import('@/lib/debug');
    const { result } = renderHook(() => useErrorHandler());
    result.current.handleError(new Error('err'), 'Ctx');
    expect(debug.error).toHaveBeenCalledWith('[Ctx]', expect.any(Error));
  });

  it('handles string errors', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useErrorHandler());
    result.current.handleError('string error', 'Ctx');
    expect(toast.error).toHaveBeenCalledWith('string error', expect.any(Object));
  });

  it('handleError is stable across renders', () => {
    const { result, rerender } = renderHook(() => useErrorHandler());
    const first = result.current.handleError;
    rerender();
    expect(result.current.handleError).toBe(first);
  });
});
