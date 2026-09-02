import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { supabase } from "@/integrations/supabase/client";
import { fromExtended } from "@/lib/supabaseTyped";
import { Mail, Trash2, Loader2, RefreshCw, Settings2, ChevronDown, CheckCircle, Clock, Eye, EyeOff, MailPlus } from "lucide-react";
import { debug } from "@/lib/debug";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface EmailAccount {
  id: string;
  email_address: string;
  last_sync_at: string | null;
  sync_enabled: boolean;
}

export function EmailSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    // Vides et obligatoires : il n'existe pas de serveur de messagerie par
    // défaut. Un gabarit prérempli faisait échouer la connexion en donnant
    // l'impression que le champ était déjà renseigné.
    imapHost: "",
    imapPort: 993,
    smtpHost: "",
    smtpPort: 465,
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    // Using safe view to avoid exposing encrypted_password
    const { data } = await fromExtended("user_email_accounts_safe")
      .select("id, email_address, last_sync_at, sync_enabled")
      .eq("is_active", true);
    
    setAccounts((data || []) as EmailAccount[]);
  };

  const handleConnect = async () => {
    if (!formData.email || !formData.password) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir votre email et mot de passe",
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
          imap_host: formData.imapHost,
          imap_port: formData.imapPort,
          smtp_host: formData.smtpHost,
          smtp_port: formData.smtpPort,
        },
      });

      if (error) {
        debug.error("Edge function error:", error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error + (data.details ? `: ${data.details}` : ''));
      }

      toast({
        title: "Compte connecté !",
        description: `${formData.email} est maintenant synchronisé`,
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

  const handleDelete = async (accountId: string, email: string) => {
    const { error } = await supabase
      .from("user_email_accounts")
      .update({ is_active: false })
      .eq("id", accountId);

    if (!error) {
      toast({ 
        title: "Compte déconnecté",
        description: `${email} a été déconnecté`
      });
      fetchAccounts();
    }
  };

  const handleSync = async (accountId: string) => {
    setSyncLoading(accountId);
    let totalSynced = 0;
    
    try {
      const { data, error } = await supabase.functions.invoke("sync-emails", {
        body: { account_id: accountId, full_resync: false },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      totalSynced = data?.messages_synced || 0;

      toast({
        title: "Synchronisation terminée",
        description: totalSynced > 0 
          ? `${totalSynced} nouveaux messages synchronisés`
          : "Aucun nouveau message",
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

  const getAccountStatus = (account: EmailAccount) => {
    if (account.last_sync_at) {
      return { icon: CheckCircle, label: "Connecté", color: "text-green-600", bg: "bg-green-500/10" };
    }
    return { icon: Clock, label: "En attente", color: "text-amber-600", bg: "bg-amber-500/10" };
  };

  return (
    <div className="space-y-6">
      {/* Connected accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-500" />
            Comptes connectés
          </CardTitle>
          <CardDescription>
            Gérez vos comptes email synchronisés avec OpenPulse
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MailPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Aucun compte email connecté</p>
              <p className="text-sm mt-1">
                Connectez votre compte pour synchroniser vos emails
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => {
                const status = getAccountStatus(account);
                const StatusIcon = status.icon;
                
                return (
                  <div 
                    key={account.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors gap-4"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-full ${status.bg}`}>
                        <StatusIcon className={`w-4 h-4 ${status.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{account.email_address}</p>
                        <p className="text-sm text-muted-foreground">
                          {account.last_sync_at 
                            ? `Dernière sync ${formatDistanceToNow(new Date(account.last_sync_at), { addSuffix: true, locale: fr })}`
                            : 'Jamais synchronisé'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(account.id)}
                        disabled={syncLoading === account.id}
                        className="gap-1.5"
                      >
                        {syncLoading === account.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">Sync</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(account.id, account.email_address)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add new account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailPlus className="w-5 h-5 text-primary" />
            Ajouter un compte
          </CardTitle>
          <CardDescription>
            Connectez un nouveau compte email @exploitant.example.org
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                placeholder="prenom.nom@exploitant.example.org"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Advanced settings */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground w-full justify-start">
                <Settings2 className="h-4 w-4" />
                Paramètres avancés (IMAP/SMTP)
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 p-4 border rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <Label htmlFor="imapHost">Serveur IMAP</Label>
                  <Input
                    id="imapHost"
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
                    onChange={(e) => setFormData({ ...formData, imapPort: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">Serveur SMTP</Label>
                  <Input
                    id="smtpHost"
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
                    onChange={(e) => setFormData({ ...formData, smtpPort: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Les paramètres par défaut sont configurés pour OVH. Modifiez-les uniquement si nécessaire.
              </p>
            </CollapsibleContent>
          </Collapsible>

          <Button onClick={handleConnect} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connexion en cours...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Connecter mon compte
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
