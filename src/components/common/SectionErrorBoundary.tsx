import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { debug } from '@/lib/debug';

interface Props {
  children: ReactNode;
  /** Libellé affiché au-dessus du message d'erreur. */
  label?: string;
  /** Fallback custom : reçoit l'erreur + une fonction de reset. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary léger, conçu pour isoler une section (widget, grille, etc.)
 * sans casser toute la page. À utiliser pour les zones avec données dynamiques
 * issues de RPC potentiellement instables.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    debug.error('[SectionErrorBoundary]', this.props.label, error, info.componentStack);
  }

  private reset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (!this.state.hasError) return this.props.children;
    const err = this.state.error ?? new Error('Erreur inconnue');
    if (this.props.fallback) return <>{this.props.fallback(err, this.reset)}</>;
    return (
      <div className="border border-dashed border-destructive/40 bg-destructive/5 rounded-lg p-6 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-medium">
            {this.props.label || 'Une erreur est survenue dans cette section.'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground max-w-md mx-auto break-words">
          {err.message}
        </p>
        <Button size="sm" variant="outline" onClick={this.reset} className="gap-2">
          <RotateCcw className="h-3.5 w-3.5" /> Réessayer
        </Button>
      </div>
    );
  }
}
