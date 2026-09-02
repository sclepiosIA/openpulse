import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./consoleCapture', () => ({
  consoleCapture: { captureExternal: vi.fn() },
}));

describe('consoleErrorFilter extended', () => {
  let originalError: typeof console.error;

  beforeEach(() => {
    originalError = console.error;
    vi.resetModules();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('exports installConsoleErrorFilter function', async () => {
    const mod = await import('../consoleErrorFilter');
    expect(typeof mod.installConsoleErrorFilter).toBe('function');
  });

  it('installConsoleErrorFilter replaces console.error', async () => {
    const mod = await import('../consoleErrorFilter');
    const before = console.error;
    mod.installConsoleErrorFilter();
    expect(console.error).not.toBe(before);
  });

  it('suppresses ip-validator 401 errors', async () => {
    const mod = await import('../consoleErrorFilter');
    const spy = vi.fn();
    console.error = spy;
    mod.installConsoleErrorFilter();
    console.error('ip-validator returned 401');
    // The original spy should NOT have been called (suppressed)
    expect(spy).not.toHaveBeenCalled();
  });

  it('suppresses supabase auth 401', async () => {
    const mod = await import('../consoleErrorFilter');
    const spy = vi.fn();
    console.error = spy;
    mod.installConsoleErrorFilter();
    console.error('Error 401 from supabase.co/auth/v1/user');
    expect(spy).not.toHaveBeenCalled();
  });

  it('suppresses removeChild/appendChild errors', async () => {
    const mod = await import('../consoleErrorFilter');
    const spy = vi.fn();
    console.error = spy;
    mod.installConsoleErrorFilter();
    console.error('removeChild on element');
    expect(spy).not.toHaveBeenCalled();
  });

  it('passes through non-suppressed errors', async () => {
    const mod = await import('../consoleErrorFilter');
    const spy = vi.fn();
    console.error = spy;
    mod.installConsoleErrorFilter();
    console.error('A real error happened');
    expect(spy).toHaveBeenCalledWith('A real error happened');
  });
});
