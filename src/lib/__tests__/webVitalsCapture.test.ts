import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) },
}));

describe('webVitalsCapture', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports a singleton with init method', async () => {
    const { webVitalsCapture } = await import('../webVitalsCapture');
    expect(webVitalsCapture).toBeDefined();
    expect(typeof webVitalsCapture.init).toBe('function');
  });

  it('init is idempotent and tolerates being called twice', async () => {
    const { webVitalsCapture } = await import('../webVitalsCapture');
    // Force sample by stubbing Math.random
    const r = vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(() => webVitalsCapture.init()).not.toThrow();
    expect(() => webVitalsCapture.init()).not.toThrow();
    r.mockRestore();
  });

  it('init bails when sampling rejects user', async () => {
    const { webVitalsCapture } = await import('../webVitalsCapture');
    const r = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(() => webVitalsCapture.init()).not.toThrow();
    r.mockRestore();
  });
});
