import React from 'react'
import { debug } from '@/lib/debug'
import { safeReload } from '@/lib/safeReload'
import { FullPageLoader } from './full-page-loader'
import { Button } from './button'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface RouterErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorType: 'router' | 'chunk' | 'unknown'
}

interface RouterErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * ErrorBoundary amélioré pour les erreurs de Router Context et de chargement dynamique
 * Capture les erreurs useContext, lazy loading et affiche un fallback avec retry
 */
export class RouterErrorBoundary extends React.Component<
  RouterErrorBoundaryProps,
  RouterErrorBoundaryState
> {
  constructor(props: RouterErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, errorType: 'unknown' }
  }

  static getDerivedStateFromError(error: Error): RouterErrorBoundaryState {
    const message = error.message || ''
    const name = error.name || ''

    // Erreurs de chargement dynamique (chunks, modules)
    if (
      message.includes('dynamically imported module') ||
      message.includes('Failed to fetch') ||
      message.includes('Loading chunk') ||
      message.includes('Loading CSS chunk') ||
      name === 'ChunkLoadError'
    ) {
      debug.warn('[RouterErrorBoundary] Chunk loading error:', message)
      return { hasError: true, error, errorType: 'chunk' }
    }

    // Erreurs de contexte Router
    if (message.includes('useContext') || message.includes('useNavigate')) {
      debug.warn('[RouterErrorBoundary] Router context error:', message)
      return { hasError: true, error, errorType: 'router' }
    }

    // Erreurs de contexte Radix UI (TabsList, DialogContent, etc.)
    // Ces erreurs sont récupérables via un retry
    if (message.includes('must be used within') || message.includes('must be a child of')) {
      debug.warn('[RouterErrorBoundary] Radix context error (recoverable):', message)
      return { hasError: true, error, errorType: 'router' }
    }

    // Si ce n'est pas une erreur gérée, la relancer
    throw error
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    debug.warn('Router/Chunk error caught:', error.message)
    // No auto-reload — user clicks "Recharger" or "Réessayer" manually
  }

  handleReload = async () => {
    // Nettoyer SW et caches pour éviter de resservir le vieux build
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    safeReload('RouterErrorBoundary')
  }

  handleRetry = () => {
    // Essayer de réinitialiser l'état sans recharger
    this.setState({ hasError: false, error: undefined, errorType: 'unknown' })
  }

  render() {
    if (this.state.hasError) {
      // UI de récupération pour les erreurs de chunk
      if (this.state.errorType === 'chunk') {
        return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-6">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground">Erreur de chargement</h2>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Une mise à jour est disponible ou la connexion a été interrompue. Rechargez la page
              pour continuer.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={this.handleRetry}>
                Réessayer
              </Button>
              <Button onClick={this.handleReload}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Recharger la page
              </Button>
            </div>
          </div>
        )
      }

      // Fallback par défaut pour les autres erreurs
      return this.props.fallback || <FullPageLoader />
    }

    return this.props.children
  }
}
