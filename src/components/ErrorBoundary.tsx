import React, { Component, ErrorInfo, ReactNode } from 'react'
import { monitoring } from '@/lib/monitoring'
import { debug } from '@/lib/debug'
import { frontendErrorCapture } from '@/lib/frontendErrorCapture'
import { safeReload } from '@/lib/safeReload'
import { isPreviewContext } from '@/lib/isPreviewContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  isChunkError(err?: Error): boolean {
    const e = err || this.state.error
    const msg = e?.message || ''
    const name = e?.name || ''
    return (
      msg.includes('dynamically imported module') ||
      msg.includes('Failed to fetch dynamically') ||
      msg.includes('Loading chunk') ||
      msg.includes('Loading CSS chunk') ||
      name === 'ChunkLoadError'
    )
  }

  async clearCachesAndReload() {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {
      /* noop */
    } finally {
      safeReload('ErrorBoundary-chunk')
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    debug.error('ErrorBoundary caught an error:', error, errorInfo)

    // Auto-récupération sur erreur de chunk (nouveau build déployé) — prod uniquement.
    // En preview/dev, HMR invalide les chunks lazy et déclencherait une boucle
    // de rechargements ; on laisse l'UI d'erreur s'afficher.
    if (this.isChunkError(error) && !isPreviewContext()) {
      const KEY = 'eb-chunk-autoreload-at'
      const last = Number(sessionStorage.getItem(KEY) || '0')
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(KEY, String(Date.now()))
        void this.clearCachesAndReload()
        return
      }
    }

    // Reporter l'erreur via le service de monitoring (Sentry lazy-loaded)
    monitoring.captureException(error, {
      componentStack: errorInfo.componentStack || undefined,
      source: 'ErrorBoundary',
    })

    // Reporter l'erreur au Monitor frontend
    frontendErrorCapture.reportBoundaryError(
      error,
      errorInfo.componentStack || undefined,
      'ErrorBoundary'
    )
  }

  handleReload = () => {
    if (this.isChunkError()) {
      void this.clearCachesAndReload()
      return
    }
    // Soft reset: re-render children without full page reload
    this.setState({ hasError: false, error: undefined })
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: undefined })
    // Use pushState + popstate to trigger React Router navigation without full reload
    window.history.pushState({}, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh flex items-center justify-center p-6 bg-background">
          <Card className="max-w-lg w-full">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
              <CardTitle>Une erreur est survenue</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">
                  Une erreur inattendue s'est produite. Nos équipes ont été automatiquement
                  notifiées. Vous pouvez réessayer ou retourner à l'accueil.
                </p>
                <details className="text-left">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Détails techniques
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                    {this.state.error?.message}
                  </pre>
                </details>
              </div>

              <div className="flex gap-3 justify-center">
                <Button onClick={this.handleReload} variant="default">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Réessayer
                </Button>
                <Button onClick={this.handleGoHome} variant="outline">
                  <Home className="w-4 h-4 mr-2" />
                  Retour accueil
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
