import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { observability } from '../observability';

// We mock frontendErrorCapture to assert reportNetworkError is called as expected.
vi.mock('../frontendErrorCapture', () => ({
  frontendErrorCapture: {
    reportNetworkError: vi.fn(),
  },
}));

import { frontendErrorCapture } from '../frontendErrorCapture';

describe('observability', () => {
  beforeEach(() => {
    // Reset the nav buffer between tests by pushing many empty distinct routes is fragile;
    // instead, we test trackNavigation behavior step-by-step.
    vi.clearAllMocks();
  });

  describe('trackNavigation', () => {
    it('records distinct routes in order', () => {
      observability.trackNavigation('/a');
      observability.trackNavigation('/b');
      observability.trackNavigation('/c');
      const trail = observability.getNavigationTrail();
      const lastThree = trail.slice(-3).map((t) => t.route);
      expect(lastThree).toEqual(['/a', '/b', '/c']);
    });

    it('does not record duplicate consecutive routes', () => {
      const beforeLen = observability.getNavigationTrail().length;
      observability.trackNavigation('/dup');
      observability.trackNavigation('/dup');
      observability.trackNavigation('/dup');
      const trail = observability.getNavigationTrail();
      // only +1 entry
      expect(trail.length).toBe(beforeLen + 1);
    });

    it('ignores empty route', () => {
      const before = observability.getNavigationTrail().length;
      observability.trackNavigation('');
      expect(observability.getNavigationTrail().length).toBe(before);
    });

    it('returns a copy (immutable accessor)', () => {
      observability.trackNavigation('/snapshot');
      const trail = observability.getNavigationTrail();
      trail.push({ route: '/poison', ts: Date.now() });
      const after = observability.getNavigationTrail();
      expect(after.some((t) => t.route === '/poison')).toBe(false);
    });
  });

  describe('installFetchInterceptor', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('does not report 401/403/404 (expected statuses)', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('x', { status: 404, statusText: 'Not Found' }));
      globalThis.fetch = mockFetch;
      observability.installFetchInterceptor();
      await window.fetch('https://api.example.com/missing');
      expect(frontendErrorCapture.reportNetworkError).not.toHaveBeenCalled();
    });

    it('ignores supabase auth endpoints', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('x', { status: 500, statusText: 'fail' }));
      globalThis.fetch = mockFetch;
      observability.installFetchInterceptor();
      await window.fetch('https://supabase.example.com/auth/v1/token');
      expect(frontendErrorCapture.reportNetworkError).not.toHaveBeenCalled();
    });

    it('does not reinstall if called twice (idempotent)', () => {
      const before = window.fetch;
      observability.installFetchInterceptor();
      const after = window.fetch;
      expect(after).toBe(before);
    });
  });
});
