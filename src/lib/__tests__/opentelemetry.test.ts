import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('OpenTelemetryAdapter', () => {
  let OpenTelemetryAdapter: typeof import('../opentelemetry').OpenTelemetryAdapter;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../opentelemetry');
    OpenTelemetryAdapter = mod.OpenTelemetryAdapter;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an instance', () => {
    const adapter = new OpenTelemetryAdapter({
      endpoint: 'http://localhost:4318',
      serviceName: 'test',
      environment: 'test',
    });
    expect(adapter).toBeDefined();
  });

  it('init is idempotent', async () => {
    const adapter = new OpenTelemetryAdapter({
      endpoint: 'http://localhost:4318',
      serviceName: 'test',
      environment: 'test',
    });
    await adapter.init();
    await adapter.init(); // should warn and skip
    adapter.stop();
  });

  it('records exceptions', () => {
    const adapter = new OpenTelemetryAdapter({
      endpoint: 'http://localhost:4318',
      serviceName: 'test',
      environment: 'test',
    });
    expect(() => adapter.recordException(new Error('boom'), { page: '/test' })).not.toThrow();
    adapter.stop();
  });

  it('records events', () => {
    const adapter = new OpenTelemetryAdapter({
      endpoint: 'http://localhost:4318',
      serviceName: 'test',
      environment: 'test',
    });
    expect(() => adapter.recordEvent('user_login', { userId: '123' })).not.toThrow();
    adapter.stop();
  });

  it('adds breadcrumbs', () => {
    const adapter = new OpenTelemetryAdapter({
      endpoint: 'http://localhost:4318',
      serviceName: 'test',
      environment: 'test',
    });
    expect(() => adapter.addBreadcrumb({ message: 'click', category: 'ui' })).not.toThrow();
    adapter.stop();
  });

  it('sets user and tags', () => {
    const adapter = new OpenTelemetryAdapter({
      endpoint: 'http://localhost:4318',
      serviceName: 'test',
      environment: 'test',
    });
    adapter.setUser({ id: 'u1', email: 'a@b.com' });
    adapter.setTag('version', '1.0');
    adapter.stop();
  });

  it('stop clears interval and flushes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    const adapter = new OpenTelemetryAdapter({
      endpoint: 'http://localhost:4318',
      serviceName: 'test',
      environment: 'test',
    });
    await adapter.init();
    adapter.recordEvent('test_event');
    adapter.stop();
    fetchSpy.mockRestore();
  });
});
