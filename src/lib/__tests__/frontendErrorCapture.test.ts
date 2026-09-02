import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock supabase before import
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe('FrontendErrorCapture', () => {
  let frontendErrorCapture: typeof import('../frontendErrorCapture').frontendErrorCapture;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../frontendErrorCapture');
    frontendErrorCapture = mod.frontendErrorCapture;
  });

  it('exports a singleton instance', () => {
    expect(frontendErrorCapture).toBeDefined();
    expect(typeof frontendErrorCapture.init).toBe('function');
    expect(typeof frontendErrorCapture.reportBoundaryError).toBe('function');
    expect(typeof frontendErrorCapture.reportNetworkError).toBe('function');
    expect(typeof frontendErrorCapture.cleanup).toBe('function');
  });

  it('init registers event listeners', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    frontendErrorCapture.init();
    expect(addSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    addSpy.mockRestore();
  });

  it('init is idempotent', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    frontendErrorCapture.init();
    const count1 = addSpy.mock.calls.length;
    frontendErrorCapture.init();
    expect(addSpy.mock.calls.length).toBe(count1); // no new listeners
    addSpy.mockRestore();
  });

  it('reportBoundaryError does not throw', () => {
    expect(() => {
      frontendErrorCapture.reportBoundaryError(new Error('test'), '<App>', 'App');
    }).not.toThrow();
  });

  it('reportNetworkError does not throw', () => {
    expect(() => {
      frontendErrorCapture.reportNetworkError('/api/test', 500, 'Server Error');
    }).not.toThrow();
  });

  it('cleanup does not throw', () => {
    expect(() => frontendErrorCapture.cleanup()).not.toThrow();
  });
});
