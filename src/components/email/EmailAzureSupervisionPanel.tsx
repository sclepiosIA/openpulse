/**
 * Panneau de supervision du backend email Azure (lot 1 Smart Inbox).
 *
 * - Rendu UNIQUEMENT si `VITE_EMAIL_BACKEND` ∈ {azure, hybrid} : en mode
 *   `supabase` (défaut) le composant retourne `null` et n'a aucun effet.
 * - Lecture seule : santé des comptes, dernier sync, erreurs, files IA.
 * - Aucun secret manipulé côté front.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, CloudCog, RefreshCw, ServerCrash } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEmailAzureSyncStatus } from '@/hooks/email/useEmailAzureSyncStatus';
import type { EmailAzureMailboxHealth } from '@/types/emailAzure';

const HEALTH_LABELS: Record<EmailAzureMailboxHealth, string> = {
  healthy: 'Opérationnel',
  degraded: 'Dégradé',
  error: 'Erreur',
  unknown: 'Inconnu',
};

const HEALTH_VARIANTS: Record<EmailAzureMailboxHealth, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  healthy: 'default',
  degraded: 'secondary',
  error: 'destructive',
  unknown: 'outline',
};

function formatLastSync(lastSyncAt: string | null): string {
  if (!lastSyncAt) return 'Jamais synchronisé';
  try {
    return formatDistanceToNow(parseISO(lastSyncAt), { addSuffix: true, locale: fr });
  } catch {
    return lastSyncAt;
  }
}

export function EmailAzureSupervisionPanel() {
  const { azureEnabled, backend, result, isLoading, refetch } = useEmailAzureSyncStatus();

  // Mode supabase (défaut) : totalement invisible, comportement historique intact.
  if (!azureEnabled) return null;

  return (
    <Card data-testid="email-azure-supervision-panel">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudCog className="h-5 w-5 text-primary" />
            Supervision Azure — Smart Inbox
          </CardTitle>
          {/* div (pas CardDescription/<p>) : le Badge est un <div>, nesting DOM valide */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Backend email :
            <Badge variant="outline" className="uppercase">{backend}</Badge>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          aria-label="Rafraîchir la supervision Azure"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="space-y-2" data-testid="azure-supervision-loading">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        )}

        {!isLoading && result?.state === 'unconfigured' && (
          <div
            className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground"
            data-testid="azure-supervision-unconfigured"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              API Azure non configurée. Renseigner <code>VITE_EMAIL_AZURE_API_URL</code> pour
              activer la supervision (la messagerie Supabase actuelle reste pleinement
              fonctionnelle).
            </span>
          </div>
        )}

        {!isLoading && result?.state === 'error' && (
          <div
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
            data-testid="azure-supervision-error"
          >
            <ServerCrash className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>Supervision indisponible : {result.message}</span>
          </div>
        )}

        {!isLoading && result?.state === 'ok' && (
          <div className="space-y-3" data-testid="azure-supervision-accounts">
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span>
                File IA : <strong>{result.data.queue.ai_pending}</strong> en attente
              </span>
              <span>
                Non classés : <strong>{result.data.queue.unclassified}</strong>
              </span>
            </div>
            {result.data.accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun compte email Azure provisionné pour le moment.
              </p>
            ) : (
              <ul className="space-y-2">
                {result.data.accounts.map((account) => (
                  <li
                    key={account.account_id}
                    className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{account.email_address}</p>
                      <p className="text-xs text-muted-foreground">
                        {account.provider} · {formatLastSync(account.last_sync_at)}
                        {account.last_error ? ` · Dernière erreur : ${account.last_error}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.health === 'healthy' && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                      <Badge variant={HEALTH_VARIANTS[account.health]}>
                        {HEALTH_LABELS[account.health]}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
