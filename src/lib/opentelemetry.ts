import { debug } from '@/lib/debug';

interface OpenTelemetryConfig {
  endpoint: string
  serviceName: string
  environment: string
}

interface Breadcrumb {
  message: string
  category?: string
  level?: string
  data?: Record<string, unknown>
}

/** Type pour les événements de télémétrie */
interface TelemetryEvent {
  timestamp: string
  type: 'exception' | 'event' | 'breadcrumb'
  service: string
  environment: string
  error?: {
    name: string
    message: string
    stack?: string
  }
  message?: string
  data?: Record<string, unknown>
  breadcrumb?: Breadcrumb
  context?: Record<string, unknown>
  user: TelemetryUser | null
  tags: Record<string, string>
}

/** Type pour l'utilisateur de télémétrie */
interface TelemetryUser {
  id: string
  email?: string
  name?: string
}

export class OpenTelemetryAdapter {
  private config: OpenTelemetryConfig
  private events: TelemetryEvent[] = []
  private user: TelemetryUser | null = null
  private tags: Record<string, string> = {}
  private flushIntervalId: ReturnType<typeof setInterval> | null = null
  private isInitialized: boolean = false
  private static readonly MAX_QUEUE_SIZE = 500

  constructor(config: OpenTelemetryConfig) {
    this.config = config
  }

  async init(): Promise<void> {
    // Prevent multiple initializations
    if (this.isInitialized) {
      debug.warn('⚠️ OpenTelemetry already initialized, skipping duplicate init')
      return
    }
    this.isInitialized = true
    
    // Configuration basique OpenTelemetry
    // En production, ceci devrait utiliser les vrais SDKs OpenTelemetry
    debug.log(`🔧 OpenTelemetry configured for ${this.config.serviceName} -> ${this.config.endpoint}`)
    
    // Envoyer les métriques périodiquement - store interval ID for cleanup
    this.flushIntervalId = setInterval(() => {
      this.flushEvents()
    }, 30000) // Toutes les 30 secondes
  }

  /**
   * Stop the OpenTelemetry adapter and cleanup resources
   */
  stop(): void {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId)
      this.flushIntervalId = null
    }
    // Flush remaining events before stopping
    this.flushEvents()
    this.isInitialized = false
  }

  recordException(error: Error, context?: Record<string, unknown>): void {
    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      type: 'exception',
      service: this.config.serviceName,
      environment: this.config.environment,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      user: this.user,
      tags: this.tags
    }
    
    this.events.push(event)
  }

  recordEvent(message: string, data?: Record<string, unknown>): void {
    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      type: 'event',
      service: this.config.serviceName,
      environment: this.config.environment,
      message,
      data,
      user: this.user,
      tags: this.tags
    }
    
    this.events.push(event)
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      type: 'breadcrumb',
      service: this.config.serviceName,
      environment: this.config.environment,
      breadcrumb,
      user: this.user,
      tags: this.tags
    }
    
    this.events.push(event)
  }

  setUser(user: { id: string; email?: string; name?: string }): void {
    this.user = user
  }

  setTag(key: string, value: string): void {
    this.tags[key] = value
  }

  private async flushEvents(): Promise<void> {
    if (this.events.length === 0) return

    const batch = [...this.events]
    this.events = []

    try {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: this.config.serviceName,
          environment: this.config.environment,
          events: batch
        })
      })

      debug.log(`📤 Sent ${batch.length} events to OpenTelemetry`)
    } catch (error) {
      debug.error('❌ Failed to send events to OpenTelemetry:', error)
      // Re-ajouter les événements en cas d'échec, avec cap pour éviter fuite mémoire
      this.events.unshift(...batch)
      if (this.events.length > OpenTelemetryAdapter.MAX_QUEUE_SIZE) {
        const dropped = this.events.length - OpenTelemetryAdapter.MAX_QUEUE_SIZE
        this.events = this.events.slice(0, OpenTelemetryAdapter.MAX_QUEUE_SIZE)
        debug.warn(`⚠️ OpenTelemetry queue overflow: dropped ${dropped} oldest events`)
      }
    }
  }
}