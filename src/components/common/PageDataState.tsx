import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { ShieldAlert, AlertTriangle, RefreshCw, WifiOff, Inbox, SearchX } from 'lucide-react';
import { classifyError } from '@/lib/errorClassifier';

interface PageDataStateProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  loadingFallback?: ReactNode;
  /** Children rendered when data is OK and not empty. */
  children: ReactNode;
}

/**
 * Standardise les états page-level (loading / error / unauthorized / empty / ok).
 * Évite les spinners infinis et les Error Boundary globales sur les RPC qui rejettent par RLS.
 */
export function PageDataState({
  isLoading,
  isError,
  error,
  isEmpty = false,
  onRetry,
  emptyTitle = 'Aucune donnée',
  emptyDescription = "Il n'y a rien à afficher pour le moment.",
  emptyAction,
  loadingFallback,
  children,
}: PageDataStateProps) {
  if (isLoading) {
    return (
      <>
        {loadingFallback ?? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}
      </>
    );
  }

  if (isError) {
    const kind = classifyError(error);
    const isAuth = kind === 'unauthorized';
    const isNet = kind === 'network';
    // Audit fullrun-0621-2355 : détecter "introuvable" / "not found" pour afficher
    // un message 404 explicite plutôt qu'une erreur générique.
    const rawMsg = (error instanceof Error && error.message) || '';
    const isNotFound = /introuvable|not\s*found|n'?existe pas|inexistant/i.test(rawMsg);
    const Icon = isAuth ? ShieldAlert : isNet ? WifiOff : isNotFound ? SearchX : AlertTriangle;
    const title = isAuth
      ? 'Accès refusé'
      : isNet
        ? 'Connexion indisponible'
        : isNotFound
          ? 'Introuvable (404)'
          : 'Erreur de chargement';
    const description = isAuth
      ? "Votre rôle n'a pas accès à cette ressource. Contactez un administrateur si besoin."
      : isNet
        ? 'Vérifiez votre connexion internet puis réessayez.'
        : isNotFound
          ? "La ressource demandée n'existe pas ou a été supprimée. Vérifiez le lien ou retournez à l'accueil."
          : rawMsg || 'Une erreur inattendue est survenue.';

    return (
      <div className="container mx-auto max-w-2xl py-12 px-4">
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2 text-base">
              <Icon className="h-5 w-5" />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p className="break-words">{description}</p>
            <div className="flex flex-wrap gap-2">
              {!isAuth && !isNotFound && onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Réessayer
                </Button>
              )}
              <Button asChild size="sm" variant="ghost">
                <Link to="/">Retour à l'accueil</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="container mx-auto max-w-2xl py-16 px-4">
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <div>
              <p className="font-medium">{emptyTitle}</p>
              <p className="text-sm text-muted-foreground">{emptyDescription}</p>
            </div>
            {emptyAction && <div className="flex justify-center pt-2">{emptyAction}</div>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
