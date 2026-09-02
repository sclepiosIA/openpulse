import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('web-vitals', () => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
  onINP: vi.fn(),
}));

vi.mock('@/lib/pwa-analytics', () => ({
  pwaAnalytics: { trackPWAPerformance: vi.fn() },
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/iframeDetection', () => ({
  isThirdPartyIframe: vi.fn().mockReturnValue(false),
}));

describe('PerformanceMonitor', () => {
  let PerformanceMonitor: typeof import('../performance').PerformanceMonitor;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../performance');
    // Access via getInstance for singleton
    PerformanceMonitor = mod.PerformanceMonitor;
  });

  it('getInstance returns singleton', () => {
    const a = PerformanceMonitor.getInstance();
    const b = PerformanceMonitor.getInstance();
    expect(a).toBe(b);
  });

  it('getMetrics returns array', () => {
    const monitor = PerformanceMonitor.getInstance();
    expect(Array.isArray(monitor.getMetrics())).toBe(true);
  });

  it('getPerformanceReport returns summary', () => {
    const monitor = PerformanceMonitor.getInstance();
    const report = monitor.getPerformanceReport();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('summary');
    expect(report.summary).toHaveProperty('good');
    expect(report.summary).toHaveProperty('needsImprovement');
    expect(report.summary).toHaveProperty('poor');
  });

  it('init does not throw', () => {
    const monitor = PerformanceMonitor.getInstance();
    expect(() => monitor.init()).not.toThrow();
  });
});
