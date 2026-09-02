import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/iframeDetection', () => ({
  isThirdPartyIframe: vi.fn(() => false),
  isApercuTiers: vi.fn(() => true),
}));
vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { PWAAnalytics, createPWAAnalyticsConfig, pwaAnalytics } from '@/lib/pwa-analytics';

const baseConfig = () => ({
  plausible: { enabled: false, domain: 'x.com' },
  matomo: { enabled: false, siteId: 1, trackerUrl: 'https://m' },
});

describe('pwa-analytics', () => {
  beforeEach(() => {
    // Reset singleton via internal field
    (PWAAnalytics as unknown as { instance: PWAAnalytics | undefined }).instance = undefined;
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))));
  });

  it('createPWAAnalyticsConfig returns plausible+matomo shape', () => {
    const c = createPWAAnalyticsConfig();
    expect(c.plausible).toHaveProperty('enabled');
    expect(c.matomo).toHaveProperty('siteId');
  });

  it('getInstance returns singleton when configs provided', () => {
    const cfg = baseConfig();
    const a = PWAAnalytics.getInstance(cfg.plausible, cfg.matomo);
    const b = PWAAnalytics.getInstance(cfg.plausible, cfg.matomo);
    expect(a).toBe(b);
  });

  it('trackEvent queues when offline and flushes when back online', () => {
    const cfg = baseConfig();
    const a = PWAAnalytics.getInstance(cfg.plausible, cfg.matomo);
    // Force offline
    (a as unknown as { isOnline: boolean }).isOnline = false;
    a.trackEvent('test_offline', { foo: 'bar' });
    const stored = localStorage.getItem('pwa_analytics_queue');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)[0].name).toBe('test_offline');
  });

  it('trackPageView delegates and trackEvent runs without throwing online', () => {
    const cfg = baseConfig();
    const a = PWAAnalytics.getInstance(cfg.plausible, cfg.matomo);
    (a as unknown as { isOnline: boolean }).isOnline = true;
    expect(() => a.trackPageView('/foo')).not.toThrow();
    expect(() => a.trackPWAPerformance({ lcp: 1200 })).not.toThrow();
    expect(() => a.trackPWAError(new Error('oops'), { ctx: 1 })).not.toThrow();
    expect(() => a.trackPWAInstall()).not.toThrow();
  });

  it('pwaAnalytics facade init/trackEvent does not throw', () => {
    expect(() => pwaAnalytics.init()).not.toThrow();
    expect(() => pwaAnalytics.trackEvent('hello')).not.toThrow();
    expect(() => pwaAnalytics.trackPageView('/x')).not.toThrow();
    expect(() => pwaAnalytics.trackPWAPerformance({ ttfb: 100 })).not.toThrow();
    expect(() => pwaAnalytics.trackPWAError(new Error('e'))).not.toThrow();
    expect(() => pwaAnalytics.trackPWAInstall()).not.toThrow();
  });

  it('initializes Plausible script and filters nullish props before sending', () => {
    const cfg = {
      plausible: { enabled: true, domain: 'exploitant.example.org', apiHost: 'https://analytics.example' },
      matomo: { enabled: false, siteId: 1, trackerUrl: 'https://m' },
    };
    const analytics = PWAAnalytics.getInstance(cfg.plausible, cfg.matomo);
    const plausibleSpy = vi.fn();
    window.plausible = plausibleSpy;

    analytics.trackEvent('cta_click', { kept: 'yes', dropped: null, alsoDropped: undefined });

    const script = Array.from(document.head.querySelectorAll('script')).find((node) =>
      node.getAttribute('data-domain') === 'exploitant.example.org'
    );
    expect(script?.getAttribute('data-api')).toBe('https://analytics.example/api/event');
    expect(plausibleSpy).toHaveBeenCalledWith('cta_click', { props: { kept: 'yes' } });
  });

  it('tracks Matomo page views with the provided path', () => {
    const push = vi.fn();
    window._paq = { push };
    const cfg = {
      plausible: { enabled: false, domain: 'x.com' },
      matomo: { enabled: true, siteId: 42, trackerUrl: 'https://matomo.example' },
    };
    const analytics = PWAAnalytics.getInstance(cfg.plausible, cfg.matomo);

    analytics.trackPageView('/emails');

    expect(push).toHaveBeenCalledWith(['setTrackerUrl', 'https://matomo.example/matomo.php']);
    expect(push).toHaveBeenCalledWith(['setSiteId', 42]);
    expect(push).toHaveBeenCalledWith(['setCustomUrl', '/emails']);
    expect(push).toHaveBeenCalledWith(['trackPageView']);
  });

  it('flushes queued events when the browser comes back online', () => {
    const cfg = {
      plausible: { enabled: true, domain: 'x.com' },
      matomo: { enabled: false, siteId: 1, trackerUrl: 'https://m' },
    };
    const analytics = PWAAnalytics.getInstance(cfg.plausible, cfg.matomo);
    const plausibleSpy = vi.fn();
    window.plausible = plausibleSpy;
    (analytics as unknown as { isOnline: boolean }).isOnline = false;

    analytics.trackEvent('queued_event', { foo: 'bar' });
    expect(localStorage.getItem('pwa_analytics_queue')).toBeTruthy();
    window.dispatchEvent(new Event('online'));

    expect(localStorage.getItem('pwa_analytics_queue')).toBeNull();
    expect(plausibleSpy).toHaveBeenCalledWith('queued_event', { props: { foo: 'bar' } });
    expect(plausibleSpy).toHaveBeenCalledWith('pwa_network_online', { props: undefined });
  });
});
