import { describe, it, expect, beforeEach } from 'vitest';
import { frontendErrorCapture } from '../frontendErrorCapture';

describe('FrontendErrorCapture', () => {
  it('is defined', () => {
    expect(frontendErrorCapture).toBeDefined();
  });

  it('has init method', () => {
    expect(typeof frontendErrorCapture.init).toBe('function');
  });

  it('has reportBoundaryError method', () => {
    expect(typeof frontendErrorCapture.reportBoundaryError).toBe('function');
  });

  it('has cleanup method', () => {
    expect(typeof frontendErrorCapture.cleanup).toBe('function');
  });

  it('init is idempotent', () => {
    frontendErrorCapture.init();
    frontendErrorCapture.init(); // should not throw
  });

  it('reportBoundaryError does not throw', () => {
    expect(() => {
      frontendErrorCapture.reportBoundaryError(new Error('test'), '<Stack>', 'TestComponent');
    }).not.toThrow();
  });

  it('cleanup does not throw', () => {
    expect(() => frontendErrorCapture.cleanup()).not.toThrow();
  });
});
