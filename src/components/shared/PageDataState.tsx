import { ReactNode, useEffect, useState } from "react";
import { Loader2, AlertCircle, RefreshCw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeSupabaseError } from "@/lib/supabaseErrorSanitizer";

interface PageDataStateProps {
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  loadingLabel?: string;
  /**
   * Délai (ms) avant qu'un état de chargement bloqué bascule sur un message
   * d'erreur explicite. Évite les spinners infinis silencieux. 0 = désactivé.
   */
  timeoutMs?: number;
  onRetry?: () => void;
  children: ReactNode;
}

/**
 * Pattern unifié pour gérer les 4 états d'une page data-driven :
 * loading → empty → error → success.
 *
 * Bascule automatiquement sur un état d'erreur visible si le chargement
 * dépasse `timeoutMs` (par défaut 12s) afin d'éviter les spinners infinis
 * mentionnés par l'audit Browser Use de mai 2026.
 */
export function PageDataState({
  isLoading = false,
  isError = false,
  error,
  isEmpty = false,
  emptyTitle = "Aucune donnée",
  emptyDescription,
  loadingLabel = "Chargement...",
  timeoutMs = 12000,
  onRetry,
  children,
}: PageDataStateProps) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (!isLoading || !timeoutMs) {
      setStuck(false);
      return;
    }
    const t = setTimeout(() => setStuck(true), timeoutMs);
    return () => clearTimeout(t);
  }, [isLoading, timeoutMs]);

  if (isError || stuck) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="font-medium text-foreground">
          {stuck && !isError
            ? "Le chargement prend trop de temps"
            : "Impossible de charger les données"}
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          {isError
            ? sanitizeSupabaseError(error)
            : "Vérifiez votre connexion ou vos permissions, puis réessayez."}
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </Button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{loadingLabel}</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-8 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground/60" />
        <p className="font-medium text-foreground">{emptyTitle}</p>
        {emptyDescription && (
          <p className="max-w-md text-sm text-muted-foreground">{emptyDescription}</p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
