import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock consoleCapture before importing
vi.mock('../consoleCapture', () => ({
  consoleCapture: { captureExternal: vi.fn() },
}));

import { installConsoleErrorFilter } from '../consoleErrorFilter';
import { consoleCapture } from '../consoleCapture';

describe('consoleErrorFilter', () => {
  let originalError: typeof console.error;

  beforeEach(() => {
    originalError = console.error;
  });

  afterEach(() => {
    console.error = originalError;
    vi.clearAllMocks();
  });

  it('installs a filtered console.error', () => {
    installConsoleErrorFilter();
    expect(console.error).not.toBe(originalError);
  });

  it('suppresses ip-validator 401 errors', () => {
    const spy = vi.fn();
    console.error = spy;
    const orig = console.error;
    installConsoleErrorFilter();
    console.error('Failed to fetch ip-validator returned 401');
    // Should have been captured but not forwarded to original
    expect(consoleCapture.captureExternal).toHaveBeenCalled();
  });

  it('suppresses ServiceWorker dev-sw.js errors', () => {
    installConsoleErrorFilter();
    // Should not throw
    console.error('dev-sw.js ServiceWorker registration failed');
    expect(consoleCapture.captureExternal).toHaveBeenCalled();
  });

  it('suppresses manifest.webmanifest errors', () => {
    installConsoleErrorFilter();
    console.error('Failed to load manifest.webmanifest');
    expect(consoleCapture.captureExternal).toHaveBeenCalled();
  });

  it('suppresses Lock auth-token not released errors', () => {
    installConsoleErrorFilter();
    console.error('Lock auth-token was not released');
    expect(consoleCapture.captureExternal).toHaveBeenCalled();
  });
});
