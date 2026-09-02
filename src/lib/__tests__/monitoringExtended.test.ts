import { describe, it, expect, beforeEach } from 'vitest';
import { MonitoringService } from '../monitoring';

describe('MonitoringService', () => {
  beforeEach(() => {
    (MonitoringService as any).instance = undefined;
  });

  const config = {
    sentryEnabled: false,
    openTelemetryEnabled: false,
    environment: 'test',
  };

  it('creates singleton instance', () => {
    const instance1 = MonitoringService.getInstance(config);
    const instance2 = MonitoringService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('returns undefined without initial config', () => {
    const instance = MonitoringService.getInstance();
    expect(instance).toBeUndefined();
  });

  it('has init method', () => {
    const instance = new MonitoringService(config);
    expect(typeof instance.init).toBe('function');
  });

  it('init does not throw with disabled services', async () => {
    const instance = new MonitoringService(config);
    await expect(instance.init()).resolves.not.toThrow();
  });
});
