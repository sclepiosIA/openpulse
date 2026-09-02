import { isThirdPartyIframe } from './iframeDetection';
import { debug } from '@/lib/debug';
import type { NavigatorWithConnection, PlausibleFunction, MatomoQueue } from '@/types/global';

interface PlausibleConfig {
  enabled: boolean
  domain: string
  apiHost?: string
  trackLocalhost?: boolean
}

interface MatomoConfig {
  enabled: boolean
  siteId: number
  trackerUrl: string
}

interface EventProperties {
  [key: string]: string | number | boolean | undefined | null;
}

interface PWAAnalyticsEvent {
  name: string
  properties?: EventProperties
  timestamp: number
  userAgent: string
  url: string
  offline: boolean
  connectionType?: string
}

export class PWAAnalytics {
  private static instance: PWAAnalytics
  private plausibleConfig: PlausibleConfig
  private matomoConfig: MatomoConfig
  private eventQueue: PWAAnalyticsEvent[] = []
  private isOnline: boolean = navigator.onLine
  private connectionType: string = this.getConnectionType()

  constructor(
    plausibleConfig: PlausibleConfig,
    matomoConfig: MatomoConfig
  ) {
    this.plausibleConfig = plausibleConfig
    this.matomoConfig = matomoConfig
    this.initializeEventListeners()
    this.initializeTrackers()
  }

  static getInstance(
    plausibleConfig?: PlausibleConfig,
    matomoConfig?: MatomoConfig
  ): PWAAnalytics {
    if (!PWAAnalytics.instance && plausibleConfig && matomoConfig) {
      PWAAnalytics.instance = new PWAAnalytics(plausibleConfig, matomoConfig)
    }
    return PWAAnalytics.instance
  }

  private initializeEventListeners(): void {
    // Network status monitoring
    window.addEventListener('online', () => {
      this.isOnline = true
      this.flushEventQueue()
      this.trackEvent('pwa_network_online')
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.trackEvent('pwa_network_offline')
    })

    // Connection type monitoring
    const nav = navigator as NavigatorWithConnection
    if (nav.connection) {
      nav.connection.addEventListener('change', () => {
        this.connectionType = this.getConnectionType()
        this.trackEvent('pwa_connection_change', {
          connectionType: this.connectionType,
          downlink: nav.connection?.downlink,
          effectiveType: nav.connection?.effectiveType
        })
      })
    }

    // PWA installation tracking
    window.addEventListener('beforeinstallprompt', () => {
      this.trackEvent('pwa_install_prompt_shown')
    })

    // Service Worker events
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        this.trackEvent('pwa_sw_updated')
      })
    }

    // Visibility change (mobile app switching)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackEvent('pwa_app_hidden')
      } else {
        this.trackEvent('pwa_app_visible')
      }
    })
  }

  private initializeTrackers(): void {
    if (this.plausibleConfig.enabled) {
      this.initializePlausible()
    }

    if (this.matomoConfig.enabled) {
      this.initializeMatomo()
    }
  }

  private initializePlausible(): void {
    const script = document.createElement('script')
    script.defer = true
    script.setAttribute('data-domain', this.plausibleConfig.domain)
    
    if (this.plausibleConfig.apiHost) {
      script.setAttribute('data-api', `${this.plausibleConfig.apiHost}/api/event`)
      script.src = `${this.plausibleConfig.apiHost}/js/script.js`
    } else {
      script.src = 'https://plausible.io/js/script.js'
    }

    if (this.plausibleConfig.trackLocalhost) {
      script.setAttribute('data-include-localhost', 'true')
    }

    document.head.appendChild(script)

    // Define plausible function globally
    const plausibleFn: PlausibleFunction = function(...args: Parameters<PlausibleFunction>) {
      if (!plausibleFn.q) plausibleFn.q = []
      plausibleFn.q.push(args as unknown as IArguments)
    }
    window.plausible = window.plausible || plausibleFn

    debug.log('📊 Plausible Analytics initialized')
  }

  private initializeMatomo(): void {
    const paq: MatomoQueue = window._paq || { push: (args: unknown[]) => { (window._paq?.push || (() => {}))(args) } }
    window._paq = paq

    paq.push(['trackPageView'])
    paq.push(['enableLinkTracking'])
    paq.push(['setTrackerUrl', `${this.matomoConfig.trackerUrl}/matomo.php`])
    paq.push(['setSiteId', this.matomoConfig.siteId])

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    script.src = `${this.matomoConfig.trackerUrl}/matomo.js`
    document.head.appendChild(script)

    debug.log('📊 Matomo Analytics initialized')
  }

  private getConnectionType(): string {
    const nav = navigator as NavigatorWithConnection
    if (nav.connection) {
      return nav.connection.effectiveType || 'unknown'
    }
    return 'unknown'
  }

  trackEvent(name: string, properties?: EventProperties): void {
    const event: PWAAnalyticsEvent = {
      name,
      properties,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      offline: !this.isOnline,
      connectionType: this.connectionType
    }

    if (this.isOnline) {
      this.sendEvent(event)
    } else {
      this.eventQueue.push(event)
      this.saveEventQueue()
    }
  }

  trackPageView(path?: string): void {
    const page = path || window.location.pathname

    if (this.plausibleConfig.enabled && window.plausible) {
      window.plausible('pageview', { props: { u: page } })
    }

    if (this.matomoConfig.enabled && window._paq) {
      window._paq.push(['setCustomUrl', page])
      window._paq.push(['trackPageView'])
    }

    this.trackEvent('page_view', { 
      path: page,
      referrer: document.referrer,
      title: document.title
    })
  }

  trackPWAPerformance(metrics: Record<string, number>): void {
    this.trackEvent('pwa_performance', {
      ...metrics,
      platform: this.getMobilePlatform(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      pixelRatio: window.devicePixelRatio
    })
  }

  trackPWAError(error: Error, context?: EventProperties): void {
    this.trackEvent('pwa_error', {
      message: error.message,
      stack: error.stack?.substring(0, 500), // Limiter la taille
      ...context,
      platform: this.getMobilePlatform()
    })
  }

  trackPWAInstall(): void {
    this.trackEvent('pwa_installed', {
      platform: this.getMobilePlatform(),
      standalone: window.matchMedia('(display-mode: standalone)').matches
    })
  }

  private getMobilePlatform(): string {
    const userAgent = navigator.userAgent.toLowerCase()
    if (/android/.test(userAgent)) return 'android'
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios'
    if (/windows phone/.test(userAgent)) return 'windows'
    return 'desktop'
  }

  private sendEvent(event: PWAAnalyticsEvent): void {
    // Filtrer les propriétés null/undefined pour compatibilité avec Plausible
    const cleanProps = event.properties 
      ? Object.fromEntries(
          Object.entries(event.properties).filter(([, v]) => v != null)
        ) as Record<string, string | number | boolean>
      : undefined

    // Envoyer vers Plausible
    if (this.plausibleConfig.enabled && window.plausible) {
      window.plausible(event.name, { 
        props: cleanProps 
      })
    }

    // Envoyer vers Matomo
    if (this.matomoConfig.enabled && window._paq) {
      window._paq.push([
        'trackEvent',
        'PWA',
        event.name,
        JSON.stringify(event.properties),
        1
      ])
    }

    // Envoyer vers endpoint personnalisé si disponible
    if (this.plausibleConfig.apiHost) {
      fetch(`${this.plausibleConfig.apiHost}/api/pwa-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      }).catch(console.warn)
    }
  }

  private flushEventQueue(): void {
    if (this.eventQueue.length === 0) return

    debug.log(`📤 Envoi de ${this.eventQueue.length} événements PWA en attente`)

    this.eventQueue.forEach(event => this.sendEvent(event))
    this.eventQueue = []
    
    try {
      localStorage.removeItem('pwa_analytics_queue')
    } catch {
      // localStorage bloqué (iframe), ignorer
    }
  }

  private saveEventQueue(): void {
    try {
      localStorage.setItem('pwa_analytics_queue', JSON.stringify(this.eventQueue))
    } catch (error) {
      // localStorage bloqué (iframe), ignorer silencieusement
    }
  }

  private loadEventQueue(): void {
    try {
      const saved = localStorage.getItem('pwa_analytics_queue')
      if (saved) {
        this.eventQueue = JSON.parse(saved)
      }
    } catch (error) {
      // localStorage bloqué (iframe), ignorer silencieusement
      this.eventQueue = []
    }
  }

  init(): void {
    this.loadEventQueue()
    if (this.isOnline && this.eventQueue.length > 0) {
      setTimeout(() => this.flushEventQueue(), 1000)
    }
    debug.log('🚀 PWA Analytics initialized')
  }
}

// Configuration factory
export function createPWAAnalyticsConfig(): {
  plausible: PlausibleConfig
  matomo: MatomoConfig
} {
  return {
    plausible: {
      enabled: Boolean(import.meta.env.VITE_PLAUSIBLE_DOMAIN),
      domain: import.meta.env.VITE_PLAUSIBLE_DOMAIN || '',
      apiHost: import.meta.env.VITE_PLAUSIBLE_API_HOST,
      trackLocalhost: import.meta.env.MODE === 'development'
    },
    matomo: {
      enabled: Boolean(import.meta.env.VITE_MATOMO_SITE_ID),
      siteId: parseInt(import.meta.env.VITE_MATOMO_SITE_ID || '1'),
      trackerUrl: import.meta.env.VITE_MATOMO_TRACKER_URL || ''
    }
  }
}

// Initialisation lazy - ne pas créer l'instance au chargement du module
let _instance: PWAAnalytics | null = null;

export const pwaAnalytics = {
  init(): void {
    try {
      // Skip dans les iframes tierces pour éviter les problèmes
      if (isThirdPartyIframe()) {
        if (import.meta.env.DEV) {
          console.info('[PWA Analytics] Disabled in third-party iframe');
        }
        return;
      }
      
      const config = createPWAAnalyticsConfig();
      _instance = PWAAnalytics.getInstance(config.plausible, config.matomo);
      _instance.init();
    } catch (error) {
      if (import.meta.env.DEV) {
        debug.warn('[PWA Analytics] Init failed:', error);
      }
    }
  },
  trackEvent(name: string, properties?: EventProperties): void {
    _instance?.trackEvent(name, properties);
  },
  trackPageView(path?: string): void {
    _instance?.trackPageView(path);
  },
  trackPWAPerformance(metrics: Record<string, number>): void {
    _instance?.trackPWAPerformance(metrics);
  },
  trackPWAError(error: Error, context?: EventProperties): void {
    _instance?.trackPWAError(error, context);
  },
  trackPWAInstall(): void {
    _instance?.trackPWAInstall();
  }
};
