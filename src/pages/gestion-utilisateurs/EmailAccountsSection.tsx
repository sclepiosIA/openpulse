import { useEffect, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mail, ChevronDown, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseBrowser";
import { fromExtended } from "@/lib/supabaseTyped";
import { sanitizeSupabaseError } from "@/lib/supabaseErrorSanitizer";
import { useToast } from "@/hooks/shared/use-toast";
import { debug } from "@/lib/debug";
import type { UserEmailAccountSafe } from "@/types/ui-states";

interface Props {
  profileId: string;
  prenom: string;
  nom: string;
}

const DEFAULT_FORM = {
  email_address: "",
  password: "",
  imap_host: "smtp.example.org",
  imap_port: 993,
  smtp_host: "smtp.example.org",
  smtp_port: 465,
};

export function EmailAccountsSection({ profileId, prenom, nom }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<UserEmailAccountSafe[]>([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);

  const fetchAccounts = async (pid: string) => {
    const { data, error } = await fromExtended("user_email_accounts_safe")
      .select("id, email_address, is_active, sync_enabled, last_sync_at")
      .eq("profile_id", pid)
      .eq("is_active", true);
    if (!error) setAccounts(data || []);
  };

  useEffect(() => {
    if (profileId) {
      fetchAccounts(profileId);
      setForm(DEFAULT_FORM);
    }
  }, [profileId]);

  const handleConnect = async () => {
    if (!form.email_address || !form.password) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("connect-email-account", {
        body: { ...form, target_profile_id: profileId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Compte email configuré",
        description: `Le compte ${form.email_address} a été configuré pour ${prenom} ${nom}`,
      });
      setForm({ ...form, email_address: "", password: "" });
      fetchAccounts(profileId);
    } catch (error: unknown) {
      debug.error("Erreur configuration email:", error);
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-6 border-t pt-4">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Mail className="h-4 w-4" />
            Configuration Email
            {accounts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {accounts.length} compte{accounts.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-4">
        {accounts.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Comptes configurés</Label>
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{account.email_address}</span>
                </div>
                <div className="flex items-center gap-2">
                  {account.sync_enabled ? (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Sync actif
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Sync désactivé</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-3 p-3 border rounded-lg bg-background">
          <Label className="text-sm font-medium">Ajouter un compte email</Label>
          <Input placeholder="prenom.nom@exploitant.example.org" value={form.email_address}
            onChange={(e) => setForm({ ...form, email_address: e.target.value })} />
          <Input type="password" placeholder="Mot de passe email" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Serveur IMAP</Label>
              <Input placeholder="smtp.example.org" value={form.imap_host}
                onChange={(e) => setForm({ ...form, imap_host: e.target.value })} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Port IMAP</Label>
              <Input type="number" value={form.imap_port}
                onChange={(e) => setForm({ ...form, imap_port: parseInt(e.target.value) })} className="text-sm" />
            </div>
          </div>
          <Button type="button" size="sm" className="w-full" onClick={handleConnect}
            disabled={loading || !form.email_address || !form.password}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Validation IMAP...</>
            ) : (
              <><Mail className="h-4 w-4 mr-2" />Configurer ce compte</>
            )}
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
