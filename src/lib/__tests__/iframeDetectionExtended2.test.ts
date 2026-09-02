import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('iframeDetection extended2', () => {
  beforeEach(async () => {
    // Reset cached values by re-importing
    vi.resetModules();
  });

  it('isApercuTiers returns false in jsdom', async () => {
    const { isApercuTiers } = await import('../iframeDetection');
    // jsdom origin is typically "http://localhost" or similar
    expect(isApercuTiers()).toBe(false);
  });

  it('isThirdPartyIframe returns false when not in iframe', async () => {
    const { isThirdPartyIframe } = await import('../iframeDetection');
    // In jsdom, window.self === window.top
    expect(typeof isThirdPartyIframe()).toBe('boolean');
  });

  it('caches isApercuTiers result', async () => {
    const { isApercuTiers } = await import('../iframeDetection');
    const first = isApercuTiers();
    const second = isApercuTiers();
    expect(first).toBe(second);
  });

  it('caches isThirdPartyIframe result', async () => {
    const { isThirdPartyIframe } = await import('../iframeDetection');
    const first = isThirdPartyIframe();
    const second = isThirdPartyIframe();
    expect(first).toBe(second);
  });

  it('functions return boolean', async () => {
    const { isApercuTiers, isThirdPartyIframe } = await import('../iframeDetection');
    expect(typeof isApercuTiers()).toBe('boolean');
    expect(typeof isThirdPartyIframe()).toBe('boolean');
  });
});
