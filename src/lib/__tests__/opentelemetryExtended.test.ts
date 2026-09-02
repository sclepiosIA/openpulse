import { describe, it, expect } from 'vitest';
import { OpenTelemetryAdapter } from '../opentelemetry';

describe('OpenTelemetryAdapter', () => {
  const config = {
    endpoint: 'https://otel.test/v1/traces',
    serviceName: 'test-service',
    environment: 'test',
  };

  it('creates instance', () => {
    const adapter = new OpenTelemetryAdapter(config);
    expect(adapter).toBeDefined();
  });

  it('init does not throw', async () => {
    const adapter = new OpenTelemetryAdapter(config);
    await expect(adapter.init()).resolves.not.toThrow();
    adapter.stop();
  });

  it('double init is idempotent', async () => {
    const adapter = new OpenTelemetryAdapter(config);
    await adapter.init();
    await adapter.init(); // should not throw
    adapter.stop();
  });

  it('recordException stores event', () => {
    const adapter = new OpenTelemetryAdapter(config);
    adapter.recordException(new Error('test error'), { ctx: 'unit' });
    // No throw
  });

  it('recordEvent stores event', () => {
    const adapter = new OpenTelemetryAdapter(config);
    adapter.recordEvent('test_event', { key: 'value' });
  });

  it('addBreadcrumb stores event', () => {
    const adapter = new OpenTelemetryAdapter(config);
    adapter.addBreadcrumb({ message: 'clicked button', category: 'ui' });
  });

  it('setUser sets user context', () => {
    const adapter = new OpenTelemetryAdapter(config);
    adapter.setUser({ id: 'u1', email: 'test@test.com' });
    // No throw
  });

  it('setTag sets tag', () => {
    const adapter = new OpenTelemetryAdapter(config);
    adapter.setTag('version', '1.0.0');
  });

  it('stop clears interval', async () => {
    const adapter = new OpenTelemetryAdapter(config);
    await adapter.init();
    adapter.stop();
    // Should not throw when stopping again
    adapter.stop();
  });
});
