import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceMonitor } from '../performance';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    // Create fresh instance (bypass singleton for testing)
    monitor = new (PerformanceMonitor as any)();
  });

  it('getInstance returns singleton', () => {
    const a = PerformanceMonitor.getInstance();
    const b = PerformanceMonitor.getInstance();
    expect(a).toBe(b);
  });

  it('getMetrics returns empty initially', () => {
    expect(monitor.getMetrics()).toEqual([]);
  });

  it('getPerformanceReport returns empty summary', () => {
    const report = monitor.getPerformanceReport();
    expect(report.metrics).toEqual([]);
    expect(report.summary).toEqual({ good: 0, needsImprovement: 0, poor: 0 });
  });

  it('getPerformanceReport counts ratings correctly', () => {
    // Simulate metrics by directly pushing
    (monitor as any).metrics.push(
      { name: 'FCP', value: 100, rating: 'good', delta: 100, id: '1' },
      { name: 'LCP', value: 3000, rating: 'needs-improvement', delta: 3000, id: '2' },
      { name: 'CLS', value: 0.5, rating: 'poor', delta: 0.5, id: '3' },
      { name: 'TTFB', value: 50, rating: 'good', delta: 50, id: '4' },
    );
    const report = monitor.getPerformanceReport();
    expect(report.summary.good).toBe(2);
    expect(report.summary.needsImprovement).toBe(1);
    expect(report.summary.poor).toBe(1);
  });

  it('getMetrics returns pushed metrics', () => {
    (monitor as any).metrics.push({ name: 'INP', value: 200, rating: 'good', delta: 200, id: '5' });
    expect(monitor.getMetrics()).toHaveLength(1);
    expect(monitor.getMetrics()[0].name).toBe('INP');
  });
});
