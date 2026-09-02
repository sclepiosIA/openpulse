import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  withScope: vi.fn((cb: (scope: any) => void) => cb({ setContext: vi.fn() })),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({})),
}));

vi.mock('@/lib/opentelemetry', () => ({
  OpenTelemetryAdapter: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    recordException: vi.fn(),
    recordEvent: vi.fn(),
    addBreadcrumb: vi.fn(),
    setUser: vi.fn(),
    setTag: vi.fn(),
  })),
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('MonitoringService', () => {
  let MonitoringService: typeof import('../monitoring').MonitoringService;
  let createMonitoringConfig: typeof import('../monitoring').createMonitoringConfig;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../monitoring');
    MonitoringService = mod.MonitoringService;
    createMonitoringConfig = mod.createMonitoringConfig;
  });

  it('creates config from env', () => {
    const config = createMonitoringConfig();
    expect(config).toHaveProperty('sentryEnabled');
    expect(config).toHaveProperty('openTelemetryEnabled');
    expect(config).toHaveProperty('environment');
  });

  it('captureException does not throw without init', () => {
    const service = new MonitoringService({
      sentryEnabled: false,
      openTelemetryEnabled: false,
      environment: 'test',
    });
    expect(() => service.captureException(new Error('test'))).not.toThrow();
  });

  it('captureMessage does not throw', () => {
    const service = new MonitoringService({
      sentryEnabled: false,
      openTelemetryEnabled: false,
      environment: 'test',
    });
    expect(() => service.captureMessage('test message', 'info')).not.toThrow();
  });

  it('addBreadcrumb does not throw', () => {
    const service = new MonitoringService({
      sentryEnabled: false,
      openTelemetryEnabled: false,
      environment: 'test',
    });
    expect(() => service.addBreadcrumb({ message: 'click', category: 'ui' })).not.toThrow();
  });

  it('setUser and setTag do not throw', () => {
    const service = new MonitoringService({
      sentryEnabled: false,
      openTelemetryEnabled: false,
      environment: 'test',
    });
    expect(() => service.setUser({ id: 'u1' })).not.toThrow();
    expect(() => service.setTag('version', '1.0')).not.toThrow();
  });

  it('works with sentry enabled', async () => {
    // Force the setTimeout path (requestIdleCallback is undefined in jsdom);
    // fake timers let us flush the deferred Sentry init synchronously.
    vi.useFakeTimers();
    try {
      const service = new MonitoringService({
        sentryEnabled: true,
        sentryDsn: 'https://test@sentry.io/123',
        openTelemetryEnabled: false,
        environment: 'test',
      });
      await service.init();

      // Flush the deferred init (setTimeout 2000ms when requestIdleCallback is absent)
      await vi.advanceTimersByTimeAsync(3000);

      const Sentry = await import('@sentry/react');
      expect(Sentry.init).toHaveBeenCalled();

      service.captureException(new Error('test'));
      expect(Sentry.withScope).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
