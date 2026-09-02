import React, { Component, ReactNode } from 'react'
import { debug } from '@/lib/debug'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Vérifier si c'est une erreur DOM de manipulation de nœuds
    const isDOMError = error.message.includes('removeChild') || 
                       error.message.includes('appendChild') || 
                       error.message.includes('insertBefore')
    
    if (isDOMError) {
      debug.warn('ErrorBoundary caught DOM manipulation error, attempting auto-recovery')
      
      // Nettoyer les portals et overlays orphelins
      setTimeout(() => {
        document.body.removeAttribute('data-scroll-locked')
        document.body.style.removeProperty('pointer-events')
        
        const overlays = document.querySelectorAll('[data-radix-portal]')
        overlays.forEach(overlay => {
          if (overlay.children.length === 0) {
            overlay.remove()
          }
        })
        
        // Auto-reset après nettoyage
        this.setState({ hasError: false, error: undefined })
      }, 100)
    } else {
      debug.error('ErrorBoundary caught an error:', error, errorInfo)
    }
    
    // Log vers Sentry si disponible
    if (window.Sentry) {
      window.Sentry.withScope((scope) => {
        scope.setTag('errorBoundary', true)
        scope.setTag('isDOMError', isDOMError)
        scope.setContext('errorInfo', {
          componentStack: errorInfo.componentStack,
          errorBoundary: this.constructor.name,
        })
        window.Sentry!.captureException(error)
      })
    }
    
    // Appeler le callback d'erreur personnalisé
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  handleReload = () => {
    // Soft reset instead of full page reload
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-dvh flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Une erreur est survenue
              </CardTitle>
              <CardDescription>
                L'application a rencontré un problème inattendu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-mono text-muted-foreground">
                    {this.state.error.message}
                  </p>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="outline" size="sm">
                  Réessayer
                </Button>
                <Button onClick={this.handleReload} size="sm" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Recharger la page
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

// Hook pour une error boundary plus légère
export function ErrorFallback({ 
  error, 
  resetErrorBoundary 
}: { 
  error: Error
  resetErrorBoundary: () => void 
}) {
  return (
    <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h3 className="font-medium text-destructive">Erreur</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        {error.message || "Une erreur inattendue s'est produite"}
      </p>
      <Button onClick={resetErrorBoundary} size="sm" variant="outline">
        Réessayer
      </Button>
    </div>
  )
}