import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { supabase } from "@/integrations/supabase/client";
import { fromExtended } from "@/lib/supabaseTyped";
import { useCurrentProfile } from "@/hooks/profile/useProfiles";
import { Mail, Trash2, Loader2, RefreshCw } from "lucide-react";
import { debug } from "@/lib/debug";

/**
 * Mode de chiffrement de la liaison.
 *
 * `ssl` ouvre la liaison directement chiffrée (ports 993 et 465) ; `starttls`
 * l'ouvre en clair puis la promeut (ports 143 et 587). Les deux sont courants :
 * imposer le premier revient à exclure une partie des serveurs.
 */
type Chiffrement = "ssl" | "starttls";

/** Le port habituel du mode choisi, proposé quand l'utilisateur en change. */
const PORT_HABITUEL: Record<"imap" | "smtp", Record<Chiffrement, number>> = {
  imap: { ssl: 993, starttls: 143 },
  smtp: { ssl: 465, starttls: 587 },
};

export function EmailAccountConnection() {
  const { toast } = useToast();
  const { data: profile } = useCurrentProfile();
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  // Les hôtes ne sont plus préremplis. Ils l'étaient avec un gabarit
  // (`smtp.example.org`) hérité de la neutralisation : le formulaire n'ayant
  // jamais offert de champ serveur — tous les comptes d'origine étaient chez le
  // même fournisseur — il postait ce gabarit en silence, et toute connexion
  // échouait sur « Serveur ou port IMAP non autorisé », sans que rien à l'écran
  // n'explique pourquoi. Un champ vide et obligatoire dit la vérité.
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    imapHost: "",
    imapPort: 993,
    imapChiffrement: "ssl" as Chiffrement,
    smtpHost: "",
    smtpPort: 465,
    smtpChiffrement: "ssl" as Chiffrement,
  });

  useEffect(() => {
    if (profile?.id) fetchAccounts();
  }, [profile?.id]);

  const fetchAccounts = async () => {
    if (!profile?.id) return;
    // Using safe view to avoid exposing encrypted_password
    // Filter by profile_id to only show current user's accounts + shared accounts
    const { data } = await fromExtended("user_email_accounts_safe")
      .select("id, email_address, last_sync_at, is_active, sync_enabled, is_shared, profile_id")
      .eq("is_active", true)
      .or(`profile_id.eq.${profile.id},is_shared.eq.true`);
    
    setAccounts(data || []);
  };

  const handleConnect = async () => {
    if (!formData.email || !formData.password) {
      toast({
        title: "Erreur",
        description: "Renseignez l'adresse et le mot de passe.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.imapHost.trim() || !formData.smtpHost.trim()) {
      toast({
        title: "Serveurs manquants",
        description:
          "Renseignez les serveurs IMAP et SMTP de votre fournisseur. Ils figurent dans sa documentation.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("connect-email-account", {
        body: {
          email_address: formData.email,
          password: formData.password,
          imap_host: formData.imapHost.trim(),
          imap_port: formData.imapPort,
          imap_use_ssl: formData.imapChiffrement === "ssl",
          smtp_host: formData.smtpHost.trim(),
          smtp_port: formData.smtpPort,
          smtp_use_ssl: formData.smtpChiffrement === "ssl",
        },
      });

      if (error) {
        debug.error("Edge function error:", error);
        throw error;
      }

      // Check if the response contains an error
      if (data?.error) {
        throw new Error(data.error + (data.details ? `: ${data.details}` : ''));
      }

      toast({
        title: "Compte connecté",
        description: `Votre compte ${formData.email} a été connecté avec succès`,
      });

      setFormData({ ...formData, email: "", password: "" });
      fetchAccounts();
    } catch (error: unknown) {
      debug.error("Connection error:", error);
      toast({
        title: "Erreur de connexion",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (accountId: string) => {
    const { error } = await supabase
      .from("user_email_accounts")
      .update({ is_active: false })
      .eq("id", accountId);

    if (!error) {
      toast({ title: "Compte déconnecté" });
      fetchAccounts();
    }
  };

  const handleSync = async (accountId: string) => {
    setSyncLoading(accountId);
    let totalSynced = 0;
    let hasMore = true;
    let retries = 0;
    const maxRetries = 3;
    
    try {
      debug.log("Starting incremental email sync for account:", accountId);
      
      // Sync incrementally, 1 message at a time
      const MAX_SYNC_TIME = 5 * 60 * 1000; // 5 minutes max
      const syncStartTime = Date.now();
      
      while (hasMore && (Date.now() - syncStartTime < MAX_SYNC_TIME)) {
        try {
          const { data, error } = await supabase.functions.invoke("sync-emails", {
            body: { account_id: accountId, full_resync: true },
          });

          // Handle 546 WORKER_LIMIT error with backoff
          if (error && error.message?.includes('546')) {
            debug.warn("Worker limit hit, backing off for 5s...");
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }

          if (error) {
            debug.error("Sync error:", error);
            retries++;
            if (retries >= maxRetries) {
              throw new Error(`Échec après ${maxRetries} tentatives: ${error.message}`);
            }
            debug.log(`Retry ${retries}/${maxRetries} in 2s...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }

          if (data?.error) {
            retries++;
            if (retries >= maxRetries) {
              throw new Error(`Échec après ${maxRetries} tentatives: ${data.error}`);
            }
            debug.log(`Retry ${retries}/${maxRetries} in 2s...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }

          // Reset retries on success
          retries = 0;
          totalSynced += data?.messages_synced || 0;
          hasMore = data?.has_more || false;

          const remaining = data?.remaining_estimate || 0;
          debug.log(`Progress: ${totalSynced} synced, ~${remaining} remaining, has_more: ${hasMore}`);

          // 1.5s delay between calls for slow but reliable sync
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        } catch (batchError: unknown) {
          debug.error("Batch error:", batchError);
          retries++;
          if (retries >= maxRetries) {
            throw batchError;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      // Timeout protection
      if (Date.now() - syncStartTime >= MAX_SYNC_TIME) {
        throw new Error("⏱️ Timeout: Synchronisation trop longue (>5min). Veuillez réessayer.");
      }

      toast({
        title: "Synchronisation terminée",
        description: `${totalSynced} nouveaux messages synchronisés`,
      });
      
      fetchAccounts();
    } catch (error: unknown) {
      debug.error("Sync failed:", error);
      toast({
        title: "Erreur de synchronisation",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    } finally {
      setSyncLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion à une messagerie</CardTitle>
        <CardDescription>
          Connectez n'importe quelle boîte IMAP/SMTP. Les serveurs et les ports
          figurent dans la documentation de votre fournisseur.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Adresse email</Label>
          <Input
            id="email"
            type="email"
            placeholder="prenom.nom@exemple.org"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="imapHost">Serveur IMAP (réception)</Label>
            <Input
              id="imapHost"
              placeholder="imap.mon-fournisseur.example"
              value={formData.imapHost}
              onChange={(e) => setFormData({ ...formData, imapHost: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imapPort">Port IMAP</Label>
            <Input
              id="imapPort"
              type="number"
              value={formData.imapPort}
              onChange={(e) =>
                setFormData({ ...formData, imapPort: Number(e.target.value) })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="imapChiffrement">Chiffrement IMAP</Label>
          <select
            id="imapChiffrement"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={formData.imapChiffrement}
            onChange={(e) => {
              const chiffrement = e.target.value as Chiffrement;
              setFormData({
                ...formData,
                imapChiffrement: chiffrement,
                imapPort: PORT_HABITUEL.imap[chiffrement],
              });
            }}
          >
            <option value="ssl">SSL/TLS (port 993)</option>
            <option value="starttls">STARTTLS (port 143)</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="smtpHost">Serveur SMTP (envoi)</Label>
            <Input
              id="smtpHost"
              placeholder="smtp.mon-fournisseur.example"
              value={formData.smtpHost}
              onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPort">Port SMTP</Label>
            <Input
              id="smtpPort"
              type="number"
              value={formData.smtpPort}
              onChange={(e) =>
                setFormData({ ...formData, smtpPort: Number(e.target.value) })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtpChiffrement">Chiffrement SMTP</Label>
          <select
            id="smtpChiffrement"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={formData.smtpChiffrement}
            onChange={(e) => {
              const chiffrement = e.target.value as Chiffrement;
              setFormData({
                ...formData,
                smtpChiffrement: chiffrement,
                smtpPort: PORT_HABITUEL.smtp[chiffrement],
              });
            }}
          >
            <option value="ssl">SSL/TLS (port 465)</option>
            <option value="starttls">STARTTLS (port 587)</option>
          </select>
        </div>

        <Button onClick={handleConnect} disabled={loading} className="w-full">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
          {loading ? "Connexion..." : "Connecter mon compte"}
        </Button>

        {accounts.length > 0 && (
          <div className="mt-6 space-y-2">
            <h4 className="font-medium">Comptes connectés</h4>
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="flex-1">
                  <p className="font-medium">{account.email_address}</p>
                  <p className="text-sm text-muted-foreground">
                    Dernière sync: {account.last_sync_at 
                      ? new Date(account.last_sync_at).toLocaleString('fr-FR')
                      : 'Jamais'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(account.id)}
                    disabled={syncLoading === account.id}
                  >
                    {syncLoading === account.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(account.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}