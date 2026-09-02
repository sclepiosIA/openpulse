import type { MonitoringContext, BreadcrumbData } from '@/types/taches-export';
import { debug } from '@/lib/debug'

interface MonitoringConfig {
  sentryEnabled: boolean
  sentryDsn?: string
  openTelemetryEnabled: boolean
  openTelemetryEndpoint?: string
  environment: string
}

// Lazy-loaded Sentry module reference
let SentryModule: typeof import('@sentry/react') | null = null;
let sentryInitialized = false;

export class MonitoringService {
  private static instance: MonitoringService
  private config: MonitoringConfig
  private otAdapter?: import('./opentelemetry').OpenTelemetryAdapter // OpenTelemetryAdapter loaded lazily

  constructor(config: MonitoringConfig) {
    this.config = config
  }

  static getInstance(config?: MonitoringConfig): MonitoringService {
    if (!MonitoringService.instance && config) {
      MonitoringService.instance = new MonitoringService(config)
    }
    return MonitoringService.instance
  }

  async init(): Promise<void> {
    if (this.config.sentryEnabled && this.config.sentryDsn) {
      // Defer Sentry init to after first paint for better FCP
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => { this.initSentry() });
      } else {
        setTimeout(() => { this.initSentry() }, 2000);
      }
    }

    if (this.config.openTelemetryEnabled && this.config.openTelemetryEndpoint) {
      await this.initOpenTelemetry()
    }
  }

  private async initSentry(): Promise<void> {
    try {
      SentryModule = await import('@sentry/react');
      SentryModule.init({
        dsn: this.config.sentryDsn,
        environment: this.config.environment,
        integrations: [
          SentryModule.browserTracingIntegration(),
        ],
        tracesSampleRate: this.config.environment === 'production' ? 0.1 : 1.0,
        beforeSend(event) {
          // Remove sensitive data before sending to Sentry
          if (event.request?.headers) {
            delete event.request.headers.Authorization;
            delete event.request.headers.authorization;
          }
          
          // Scrub sensitive data from event
          if (event.extra) {
            Object.keys(event.extra).forEach(key => {
              const value = event.extra![key];
              if (typeof value === 'string') {
                event.extra![key] = value
                  .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]')
                  .replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, '[REDACTED_UUID]')
                  .replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b/g, '[REDACTED_JWT]');
              }
            });
          }
          
          if (import.meta.env.DEV) {
            debug.log('Sentry event:', event)
          }
          return event
        },
      })
      sentryInitialized = true;
      if (import.meta.env.DEV) debug.log('✅ Sentry monitoring initialized (lazy)')
    } catch (error) {
      debug.error('❌ Failed to initialize Sentry:', error)
    }
  }

  private async initOpenTelemetry(): Promise<void> {
    try {
      const { OpenTelemetryAdapter } = await import('./opentelemetry');
      this.otAdapter = new OpenTelemetryAdapter({
        endpoint: this.config.openTelemetryEndpoint!,
        serviceName: 'marque-manager',
        environment: this.config.environment
      })
      await this.otAdapter.init()
      if (import.meta.env.DEV) debug.log('✅ OpenTelemetry monitoring initialized')
    } catch (error) {
      debug.error('❌ Failed to initialize OpenTelemetry:', error)
    }
  }

  captureException(error: Error, context?: MonitoringContext): void {
    if (this.config.sentryEnabled && SentryModule && sentryInitialized) {
      SentryModule.withScope((scope) => {
        if (context) {
          scope.setContext('error_context', context)
        }
        SentryModule!.captureException(error)
      })
    }

    if (this.otAdapter) {
      this.otAdapter.recordException(error, context)
    }

    debug.error('🚨 Exception captured:', error, context)
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: MonitoringContext): void {
    if (this.config.sentryEnabled && SentryModule && sentryInitialized) {
      SentryModule.withScope((scope) => {
        if (context) {
          scope.setContext('message_context', context)
        }
        SentryModule!.captureMessage(message, level)
      })
    }

    if (this.otAdapter) {
      this.otAdapter.recordEvent(message, { level, ...context })
    }

    if (import.meta.env.DEV) debug.log(`📊 Message captured [${level}]:`, message, context)
  }

  addBreadcrumb(breadcrumb: { message: string; category?: string; level?: 'info' | 'warning' | 'error'; data?: BreadcrumbData }): void {
    if (this.config.sentryEnabled && SentryModule && sentryInitialized) {
      SentryModule.addBreadcrumb({
        message: breadcrumb.message,
        category: breadcrumb.category,
        level: breadcrumb.level,
        data: breadcrumb.data
      })
    }

    if (this.otAdapter) {
      this.otAdapter.addBreadcrumb(breadcrumb)
    }
  }

  setUser(user: { id: string; email?: string; name?: string }): void {
    if (this.config.sentryEnabled && SentryModule && sentryInitialized) {
      SentryModule.setUser(user)
    }

    if (this.otAdapter) {
      this.otAdapter.setUser(user)
    }
  }

  setTag(key: string, value: string): void {
    if (this.config.sentryEnabled && SentryModule && sentryInitialized) {
      SentryModule.setTag(key, value)
    }

    if (this.otAdapter) {
      this.otAdapter.setTag(key, value)
    }
  }
}

// Configuration auto-détectée selon l'environnement
export function createMonitoringConfig(): MonitoringConfig {
  const isProduction = import.meta.env.MODE === 'production'
  
  return {
    sentryEnabled: Boolean(import.meta.env.VITE_SENTRY_DSN),
    sentryDsn: import.meta.env.VITE_SENTRY_DSN,
    openTelemetryEnabled: Boolean(import.meta.env.VITE_OTEL_ENDPOINT),
    openTelemetryEndpoint: import.meta.env.VITE_OTEL_ENDPOINT,
    environment: isProduction ? 'production' : 'development'
  }
}

// Instance globale
export const monitoring = MonitoringService.getInstance(createMonitoringConfig())
