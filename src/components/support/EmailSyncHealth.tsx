import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeEdge } from "@/services/edgeFunctions";
import { fromExtended } from "@/lib/supabaseTyped";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Loader2,
  Mail,
  Server,
  Activity,
  Key,
} from "lucide-react";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EmailAccount {
  id: string;
  email_address: string;
  imap_host: string;
  is_active: boolean;
  sync_enabled: boolean;
  is_shared: boolean;
  last_sync_at: string | null;
}

interface SyncHealthStatus {
  status: 'healthy' | 'stale' | 'error' | 'never';
  label: string;
  color: string;
  icon: typeof CheckCircle2;
}

function getSyncHealth(lastSyncAt: string | null): SyncHealthStatus {
  if (!lastSyncAt) {
    return {
      status: 'never',
      label: 'Jamais synchronisé',
      color: 'text-destructive',
      icon: XCircle,
    };
  }

  const minutesAgo = differenceInMinutes(new Date(), new Date(lastSyncAt));

  if (minutesAgo < 120) { // < 2h
    return {
      status: 'healthy',
      label: 'Sync OK',
      color: 'text-green-600 dark:text-green-400',
      icon: CheckCircle2,
    };
  }

  if (minutesAgo < 360) { // < 6h
    return {
      status: 'stale',
      label: 'Sync ancien',
      color: 'text-amber-600 dark:text-amber-400',
      icon: Clock,
    };
  }

  return {
    status: 'error',
    label: 'Sync en erreur',
    color: 'text-destructive',
    icon: AlertTriangle,
  };
}

export function EmailSyncHealth() {
  const [testingAccountId, setTestingAccountId] = useState<string | null>(null);
  const [passwordModalAccount, setPasswordModalAccount] = useState<EmailAccount | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const queryClient = useQueryClient();

  // Fetch support email accounts
  const { data: accounts, isLoading } = useQuery({
    queryKey: ["support-email-accounts"],
    queryFn: async () => {
      // Using safe view to avoid exposing encrypted_password
      const { data, error } = await fromExtended("user_email_accounts_safe")
        .select("id, email_address, imap_host, is_active, sync_enabled, is_shared, last_sync_at")
        .or("is_shared.eq.true,email_address.ilike.%support%")
        .order("is_shared", { ascending: false });
      return data as EmailAccount[];
    },
    staleTime: 60 * 1000, // 1 minute
  });

  // Test connection mutation
  const testConnection = useMutation({
    mutationFn: async (accountId: string) => {
      setTestingAccountId(accountId);
      const data = await invokeEdge<any>("test-email-connection", { account_id: accountId });
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Connexion réussie! ${data.diagnostics?.summary?.inbox_messages || 0} messages dans INBOX`);
      } else {
        toast.error(`Échec: ${data.error}`);
      }
      setTestingAccountId(null);
    },
    onError: (error) => {
      toast.error(`Erreur de test: ${sanitizeSupabaseError(error)}`);
      setTestingAccountId(null);
    },
  });

  // Force sync mutation
  const forceSync = useMutation({
    mutationFn: async (accountId: string) => {
      const data = await invokeEdge<any>("sync-emails", { account_id: accountId });
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Synchronisation terminée: ${data.messages_synced || 0} messages`);
      queryClient.invalidateQueries({ queryKey: ["support-email-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (error) => {
      toast.error(`Erreur de sync: ${sanitizeSupabaseError(error)}`);
    },
  });

  // Update password mutation
  const updatePassword = useMutation({
    mutationFn: async ({ accountId, password }: { accountId: string; password: string }) => {
      const data = await invokeEdge<any>("update-email-password", { account_id: accountId, new_password: password });
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Mot de passe mis à jour avec succès");
      setPasswordModalAccount(null);
      setNewPassword("");
      queryClient.invalidateQueries({ queryKey: ["support-email-accounts"] });
    },
    onError: (error) => {
      toast.error(`Erreur: ${sanitizeSupabaseError(error)}`);
    },
  });

  const handleUpdatePassword = () => {
    if (!passwordModalAccount || !newPassword.trim()) return;
    updatePassword.mutate({ accountId: passwordModalAccount.id, password: newPassword });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Santé des comptes email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Santé des comptes email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun compte support configuré
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Santé des comptes email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {accounts.map((account) => {
          const health = getSyncHealth(account.last_sync_at);
          const StatusIcon = health.icon;
          const isTesting = testingAccountId === account.id;
          const isSyncing = forceSync.isPending;

          return (
            <div
              key={account.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-full bg-background", health.color)}>
                  <StatusIcon className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{account.email_address}</span>
                    {account.is_shared && (
                      <Badge variant="outline" className="text-xs">Partagé</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Server className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{account.imap_host}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className={cn("text-xs", health.color)}>
                      {account.last_sync_at
                        ? `Sync ${formatDistanceToNow(new Date(account.last_sync_at), { addSuffix: true, locale: fr })}`
                        : health.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPasswordModalAccount(account)}
                  title="Modifier le mot de passe"
                  aria-label="Modifier le mot de passe"
                >
                  <Key className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection.mutate(account.id)}
                  disabled={isTesting}
                  aria-label="Tester la connexion"
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Activity className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="ml-1.5 hidden sm:inline">Tester</span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => forceSync.mutate(account.id)}
                  disabled={isSyncing}
                  aria-label="Forcer la synchronisation"
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="ml-1.5 hidden sm:inline">Sync</span>
                </Button>
              </div>
            </div>
          );
        })}

        {/* Global info */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          La synchronisation automatique s'exécute toutes les heures
        </div>
      </CardContent>

      {/* Password update modal */}
      <Dialog open={!!passwordModalAccount} onOpenChange={(open) => {
        if (!open) {
          setPasswordModalAccount(null);
          setNewPassword("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Modifier le mot de passe
            </DialogTitle>
            <DialogDescription>
              Saisissez le nouveau mot de passe pour {passwordModalAccount?.email_address}. 
              La connexion IMAP sera testée avant la mise à jour.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nouveau mot de passe"
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUpdatePassword();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPasswordModalAccount(null);
                setNewPassword("");
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpdatePassword}
              disabled={updatePassword.isPending || !newPassword.trim()}
            >
              {updatePassword.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Validation...
                </>
              ) : (
                "Mettre à jour"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
