import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe('frontendErrorCapture extended2', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports frontendErrorCapture singleton', async () => {
    const { frontendErrorCapture } = await import('../frontendErrorCapture');
    expect(frontendErrorCapture).toBeDefined();
  });

  it('has init method', async () => {
    const { frontendErrorCapture } = await import('../frontendErrorCapture');
    expect(typeof frontendErrorCapture.init).toBe('function');
  });

  it('has reportBoundaryError method', async () => {
    const { frontendErrorCapture } = await import('../frontendErrorCapture');
    expect(typeof frontendErrorCapture.reportBoundaryError).toBe('function');
  });

  it('has reportNetworkError method', async () => {
    const { frontendErrorCapture } = await import('../frontendErrorCapture');
    expect(typeof frontendErrorCapture.reportNetworkError).toBe('function');
  });

  it('has cleanup method', async () => {
    const { frontendErrorCapture } = await import('../frontendErrorCapture');
    expect(typeof frontendErrorCapture.cleanup).toBe('function');
  });

  it('init is idempotent', async () => {
    const { frontendErrorCapture } = await import('../frontendErrorCapture');
    expect(() => {
      frontendErrorCapture.init();
      frontendErrorCapture.init();
    }).not.toThrow();
  });

  it('reportBoundaryError does not throw', async () => {
    const { frontendErrorCapture } = await import('../frontendErrorCapture');
    expect(() => {
      frontendErrorCapture.reportBoundaryError(new Error('test'), '<Stack />', 'TestComponent');
    }).not.toThrow();
  });

  it('reportNetworkError does not throw', async () => {
    const { frontendErrorCapture } = await import('../frontendErrorCapture');
    expect(() => {
      frontendErrorCapture.reportNetworkError('/api/test', 500, 'Server Error');
    }).not.toThrow();
  });

  it('cleanup does not throw', async () => {
    const { frontendErrorCapture } = await import('../frontendErrorCapture');
    expect(() => frontendErrorCapture.cleanup()).not.toThrow();
  });
});
