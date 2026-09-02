/* @vitest-environment jsdom */
import { PWAAnalytics, createPWAAnalyticsConfig, pwaAnalytics } from './pwa-analytics';

const { debugLog, debugWarn, isThirdPartyIframeMock } = vi.hoisted(() => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  isThirdPartyIframeMock: vi.fn(() => false),
}));

vi.mock('./iframeDetection', () => ({
  isThirdPartyIframe: isThirdPartyIframeMock,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    log: debugLog,
    warn: debugWarn,
  },
}));

declare global {
  interface Window {
    plausible?: ((eventName: string, options?: unknown) => void) & { q?: IArguments[] };
    _paq?: { push: (args: unknown[]) => void };
  }
}

describe('pwa-analytics', () => {
  const originalFetch = global.fetch;
  const originalDateNow = Date.now;
  const originalNavigatorOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
  const originalNavigatorUserAgent = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
  const originalNavigatorServiceWorker = Object.getOwnPropertyDescriptor(window.navigator, 'serviceWorker');
  const originalNavigatorConnection = Object.getOwnPropertyDescriptor(window.navigator, 'connection');
  const originalMatchMedia = window.matchMedia;
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;
  const originalDevicePixelRatio = window.devicePixelRatio;
  const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');
  const originalTitle = document.title;
  const originalReferrer = Object.getOwnPropertyDescriptor(document, 'referrer');
  const originalLocation = window.location;

  let fetchMock: ReturnType<typeof vi.fn>;
  let plausibleMock: ReturnType<typeof vi.fn>;
  let paqPushMock: ReturnType<typeof vi.fn>;
  let connectionAddEventListener: ReturnType<typeof vi.fn>;
  let serviceWorkerAddEventListener: ReturnType<typeof vi.fn>;
  let localStorageGetItemSpy: ReturnType<typeof vi.spyOn>;
  let localStorageSetItemSpy: ReturnType<typeof vi.spyOn>;
  let localStorageRemoveItemSpy: ReturnType<typeof vi.spyOn>;

  function setNavigatorOnline(value: boolean) {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => value,
    });
  }

  function setNavigatorUserAgent(value: string) {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      get: () => value,
    });
  }

  function setNavigatorConnection(effectiveType: string, downlink: number) {
    Object.defineProperty(window.navigator, 'connection', {
      configurable: true,
      value: {
        effectiveType,
        downlink,
        addEventListener: connectionAddEventListener,
      },
    });
  }

  function setNavigatorServiceWorker() {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: serviceWorkerAddEventListener,
      },
    });
  }

  function setDocumentHidden(value: boolean) {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => value,
    });
  }

  function setDocumentReferrer(value: string) {
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      get: () => value,
    });
  }

  function setLocation(url: string) {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL(url),
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useFakeTimers();

    fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    plausibleMock = vi.fn();
    paqPushMock = vi.fn();
    connectionAddEventListener = vi.fn();
    serviceWorkerAddEventListener = vi.fn();

    global.fetch = fetchMock;
    window.plausible = plausibleMock;
    window._paq = { push: paqPushMock };

    setNavigatorOnline(true);
    setNavigatorUserAgent('Mozilla/5.0 (Linux; Android 14)');
    setNavigatorConnection('4g', 12);
    setNavigatorServiceWorker();
    setDocumentHidden(false);
    setDocumentReferrer('https://ref.example/source');
    setLocation('https://app.example/dashboard');
    document.title = 'Dashboard';
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });

    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);

    localStorageGetItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    localStorageSetItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    localStorageRemoveItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;

    if (originalNavigatorOnLine) {
      Object.defineProperty(window.navigator, 'onLine', originalNavigatorOnLine);
    }
    if (originalNavigatorUserAgent) {
      Object.defineProperty(window.navigator, 'userAgent', originalNavigatorUserAgent);
    }
    if (originalNavigatorServiceWorker) {
      Object.defineProperty(window.navigator, 'serviceWorker', originalNavigatorServiceWorker);
    }
    if (originalNavigatorConnection) {
      Object.defineProperty(window.navigator, 'connection', originalNavigatorConnection);
    }
    if (originalHidden) {
      Object.defineProperty(document, 'hidden', originalHidden);
    }
    if (originalReferrer) {
      Object.defineProperty(document, 'referrer', originalReferrer);
    }
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: originalDevicePixelRatio });
    document.title = originalTitle;
  });

  it('initialise Plausible et Matomo avec les scripts et listeners attendus', () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild');

    const analytics = new PWAAnalytics(
      {
        enabled: true,
        domain: 'app.example',
        apiHost: 'https://metrics.example',
        trackLocalhost: true,
      },
      {
        enabled: true,
        siteId: 7,
        trackerUrl: 'https://matomo.example',
      }
    );

    expect(appendSpy).toHaveBeenCalledTimes(2);

    const plausibleScript = appendSpy.mock.calls[0][0] as HTMLScriptElement;
    expect(plausibleScript.tagName).toBe('SCRIPT');
    expect(plausibleScript.defer).toBe(true);
    expect(plausibleScript.getAttribute('data-domain')).toBe('app.example');
    expect(plausibleScript.getAttribute('data-api')).toBe('https://metrics.example/api/event');
    expect(plausibleScript.getAttribute('data-include-localhost')).toBe('true');
    expect(plausibleScript.src).toBe('https://metrics.example/js/script.js');

    const matomoScript = appendSpy.mock.calls[1][0] as HTMLScriptElement;
    expect(matomoScript.src).toBe('https://matomo.example/matomo.js');
    expect(matomoScript.async).toBe(true);

    expect(paqPushMock).toHaveBeenNthCalledWith(1, ['trackPageView']);
    expect(paqPushMock).toHaveBeenNthCalledWith(2, ['enableLinkTracking']);
    expect(paqPushMock).toHaveBeenNthCalledWith(3, ['setTrackerUrl', 'https://matomo.example/matomo.php']);
    expect(paqPushMock).toHaveBeenNthCalledWith(4, ['setSiteId', 7]);

    expect(connectionAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(serviceWorkerAddEventListener).toHaveBeenCalledWith('controllerchange', expect.any(Function));
    expect(debugLog).toHaveBeenCalledWith('📊 Plausible Analytics initialized');
    expect(debugLog).toHaveBeenCalledWith('📊 Matomo Analytics initialized');

    expect(analytics).toBeInstanceOf(PWAAnalytics);
  });

  it('trackEvent en ligne envoie vers plausible, matomo et endpoint custom avec propriétés filtrées', () => {
    const analytics = new PWAAnalytics(
      {
        enabled: true,
        domain: 'app.example',
        apiHost: 'https://metrics.example',
      },
      {
        enabled: true,
        siteId: 5,
        trackerUrl: 'https://matomo.example',
      }
    );

    analytics.trackEvent('checkout_started', {
      amount: 42,
      coupon: null,
      step: 'shipping',
      valid: true,
      optional: undefined,
    });

    expect(plausibleMock).toHaveBeenCalledWith('checkout_started', {
      props: {
        amount: 42,
        step: 'shipping',
        valid: true,
      },
    });

    expect(paqPushMock).toHaveBeenCalledWith([
      'trackEvent',
      'PWA',
      'checkout_started',
      JSON.stringify({
        amount: 42,
        coupon: null,
        step: 'shipping',
        valid: true,
        optional: undefined,
      }),
      1,
    ]);

    expect(fetchMock).toHaveBeenCalledWith('https://metrics.example/api/pwa-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'checkout_started',
        properties: {
          amount: 42,
          coupon: null,
          step: 'shipping',
          valid: true,
          optional: undefined,
        },
        timestamp: 1700000000000,
        userAgent: 'Mozilla/5.0 (Linux; Android 14)',
        url: 'https://app.example/dashboard',
        offline: false,
        connectionType: '4g',
      }),
    });
  });

  it('trackPageView envoie la vue de page et l’événement métier page_view', () => {
    const analytics = new PWAAnalytics(
      {
        enabled: true,
        domain: 'app.example',
      },
      {
        enabled: true,
        siteId: 9,
        trackerUrl: 'https://matomo.example',
      }
    );

    const trackEventSpy = vi.spyOn(analytics, 'trackEvent');

    analytics.trackPageView('/orders/123');

    expect(plausibleMock).toHaveBeenCalledWith('pageview', { props: { u: '/orders/123' } });
    expect(paqPushMock).toHaveBeenCalledWith(['setCustomUrl', '/orders/123']);
    expect(paqPushMock).toHaveBeenCalledWith(['trackPageView']);
    expect(trackEventSpy).toHaveBeenCalledWith('page_view', {
      path: '/orders/123',
      referrer: 'https://ref.example/source',
      title: 'Dashboard',
    });
  });

  it('sauvegarde la file hors ligne puis la flush au retour en ligne', async () => {
    setNavigatorOnline(false);

    const analytics = new PWAAnalytics(
      {
        enabled: true,
        domain: 'app.example',
        apiHost: 'https://metrics.example',
      },
      {
        enabled: true,
        siteId: 3,
        trackerUrl: 'https://matomo.example',
      }
    );

    analytics.trackEvent('draft_saved', { draftId: 'd-1' });

    expect(localStorageSetItemSpy).toHaveBeenCalledWith(
      'pwa_analytics_queue',
      JSON.stringify([
        {
          name: 'draft_saved',
          properties: { draftId: 'd-1' },
          timestamp: 1700000000000,
          userAgent: 'Mozilla/5.0 (Linux; Android 14)',
          url: 'https://app.example/dashboard',
          offline: true,
          connectionType: '4g',
        },
      ])
    );
    expect(plausibleMock).not.toHaveBeenCalledWith('draft_saved', expect.anything());

    setNavigatorOnline(true);
    window.dispatchEvent(new Event('online'));

    expect(plausibleMock).toHaveBeenCalledWith('draft_saved', {
      props: { draftId: 'd-1' },
    });
    expect(plausibleMock).toHaveBeenCalledWith('pwa_network_online', {
      props: undefined,
    });
    expect(localStorageRemoveItemSpy).toHaveBeenCalledWith('pwa_analytics_queue');
  });

  it('trackPWAPerformance, trackPWAError et trackPWAInstall enrichissent les propriétés métier', () => {
    const analytics = new PWAAnalytics(
      {
        enabled: true,
        domain: 'app.example',
      },
      {
        enabled: false,
        siteId: 1,
        trackerUrl: '',
      }
    );

    const trackEventSpy = vi.spyOn(analytics, 'trackEvent');

    analytics.trackPWAPerformance({ lcp: 2100, cls: 0.03 });
    analytics.trackPWAError(new Error('Boom'), { screen: 'checkout' });
    analytics.trackPWAInstall();

    expect(trackEventSpy).toHaveBeenNthCalledWith(1, 'pwa_performance', {
      lcp: 2100,
      cls: 0.03,
      platform: 'android',
      viewport: '390x844',
      pixelRatio: 3,
    });

    expect(trackEventSpy).toHaveBeenNthCalledWith(
      2,
      'pwa_error',
      expect.objectContaining({
        message: 'Boom',
        screen: 'checkout',
        platform: 'android',
      })
    );

    expect(trackEventSpy).toHaveBeenNthCalledWith(3, 'pwa_installed', {
      platform: 'android',
      standalone: true,
    });
  });

  it('init charge la file persistée et la flush après délai quand en ligne', async () => {
    localStorageGetItemSpy.mockReturnValue(
      JSON.stringify([
        {
          name: 'queued_event',
          properties: { source: 'cache' },
          timestamp: 1699999999000,
          userAgent: 'UA',
          url: 'https://cached.example',
          offline: true,
          connectionType: '3g',
        },
      ])
    );

    const analytics = new PWAAnalytics(
      {
        enabled: true,
        domain: 'app.example',
      },
      {
        enabled: false,
        siteId: 1,
        trackerUrl: '',
      }
    );

    analytics.init();

    expect(localStorageGetItemSpy).toHaveBeenCalledWith('pwa_analytics_queue');
    expect(debugLog).toHaveBeenCalledWith('🚀 PWA Analytics initialized');

    await vi.advanceTimersByTimeAsync(1000);

    expect(plausibleMock).toHaveBeenCalledWith('queued_event', {
      props: { source: 'cache' },
    });
    expect(localStorageRemoveItemSpy).toHaveBeenCalledWith('pwa_analytics_queue');
  });

  it('tolère les erreurs localStorage lors du chargement et de la sauvegarde', () => {
    localStorageGetItemSpy.mockImplementation(() => {
      throw new Error('blocked');
    });
    localStorageSetItemSpy.mockImplementation(() => {
      throw new Error('blocked');
    });

    setNavigatorOnline(false);

    const analytics = new PWAAnalytics(
      {
        enabled: true,
        domain: 'app.example',
      },
      {
        enabled: false,
        siteId: 1,
        trackerUrl: '',
      }
    );

    expect(() => analytics.init()).not.toThrow();
    expect(() => analytics.trackEvent('offline_only', { test: true })).not.toThrow();
    expect(plausibleMock).not.toHaveBeenCalledWith('offline_only', expect.anything());
  });

  it('createPWAAnalyticsConfig lit import.meta.env', () => {
    expect(createPWAAnalyticsConfig()).toEqual({
      plausible: {
        enabled: false,
        domain: '',
        apiHost: undefined,
        trackLocalhost: false,
      },
      matomo: {
        enabled: false,
        siteId: 1,
        trackerUrl: '',
      },
    });
  });

  it('pwaAnalytics.init ne fait rien dans une iframe tierce', () => {
    isThirdPartyIframeMock.mockReturnValue(true);

    const getInstanceSpy = vi.spyOn(PWAAnalytics, 'getInstance');

    pwaAnalytics.init();

    expect(getInstanceSpy).not.toHaveBeenCalled();
  });

  it('pwaAnalytics délègue vers l’instance singleton après init', () => {
    isThirdPartyIframeMock.mockReturnValue(false);

    const trackEventSpy = vi.spyOn(PWAAnalytics.prototype, 'trackEvent');
    const trackPageViewSpy = vi.spyOn(PWAAnalytics.prototype, 'trackPageView');
    const trackPerfSpy = vi.spyOn(PWAAnalytics.prototype, 'trackPWAPerformance');
    const trackErrorSpy = vi.spyOn(PWAAnalytics.prototype, 'trackPWAError');
    const trackInstallSpy = vi.spyOn(PWAAnalytics.prototype, 'trackPWAInstall');

    pwaAnalytics.init();
    pwaAnalytics.trackEvent('cta_clicked', { section: 'hero' });
    pwaAnalytics.trackPageView('/pricing');
    pwaAnalytics.trackPWAPerformance({ fid: 20 });
    pwaAnalytics.trackPWAError(new Error('UI failed'), { component: 'modal' });
    pwaAnalytics.trackPWAInstall();

    expect(trackEventSpy).toHaveBeenCalledWith('cta_clicked', { section: 'hero' });
    expect(trackPageViewSpy).toHaveBeenCalledWith('/pricing');
    expect(trackPerfSpy).toHaveBeenCalledWith({ fid: 20 });
    expect(trackErrorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'UI failed' }), {
      component: 'modal',
    });
    expect(trackInstallSpy).toHaveBeenCalled();
  });

  it('gère les événements système: offline, beforeinstallprompt, visibilitychange et service worker', () => {
    const analytics = new PWAAnalytics(
      {
        enabled: true,
        domain: 'app.example',
      },
      {
        enabled: false,
        siteId: 1,
        trackerUrl: '',
      }
    );

    const trackEventSpy = vi.spyOn(analytics, 'trackEvent');

    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('beforeinstallprompt'));
    setDocumentHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    setDocumentHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));

    const swHandler = serviceWorkerAddEventListener.mock.calls.find(([name]) => name === 'controllerchange')?.[1] as EventListener;
    swHandler(new Event('controllerchange'));

    expect(trackEventSpy).toHaveBeenCalledWith('pwa_network_offline');
    expect(trackEventSpy).toHaveBeenCalledWith('pwa_install_prompt_shown');
    expect(trackEventSpy).toHaveBeenCalledWith('pwa_app_hidden');
    expect(trackEventSpy).toHaveBeenCalledWith('pwa_app_visible');
    expect(trackEventSpy).toHaveBeenCalledWith('pwa_sw_updated');
  });

  it('gère le changement de connexion avec les données de bande passante', () => {
    const analytics = new PWAAnalytics(
      {
        enabled: true,
        domain: 'app.example',
      },
      {
        enabled: false,
        siteId: 1,
        trackerUrl: '',
      }
    );

    const trackEventSpy = vi.spyOn(analytics, 'trackEvent');
    const handler = connectionAddEventListener.mock.calls.find(([name]) => name === 'change')?.[1] as EventListener;

    setNavigatorConnection('3g', 1.5);
    handler(new Event('change'));

    expect(trackEventSpy).toHaveBeenCalledWith('pwa_connection_change', {
      connectionType: '3g',
      downlink: 1.5,
      effectiveType: '3g',
    });
  });
});