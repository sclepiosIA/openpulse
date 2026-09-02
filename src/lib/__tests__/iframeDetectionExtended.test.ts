import { describe, it, expect, vi, beforeEach } from 'vitest';

// Reset module cache between tests to reset cached values
describe('iframeDetection', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports isApercuTiers', async () => {
    const mod = await import('../iframeDetection');
    expect(typeof mod.isApercuTiers).toBe('function');
  });

  it('exports isThirdPartyIframe', async () => {
    const mod = await import('../iframeDetection');
    expect(typeof mod.isThirdPartyIframe).toBe('function');
  });

  it('isApercuTiers returns boolean', async () => {
    const mod = await import('../iframeDetection');
    expect(typeof mod.isApercuTiers()).toBe('boolean');
  });

  it('isThirdPartyIframe returns boolean', async () => {
    const mod = await import('../iframeDetection');
    expect(typeof mod.isThirdPartyIframe()).toBe('boolean');
  });
});
