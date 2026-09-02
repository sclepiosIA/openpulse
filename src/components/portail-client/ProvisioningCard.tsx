import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle, RefreshCw, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/shared/useUserRole";
import { toast } from "sonner";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  etablissementId: string;
  statut?: string | null;
  backendUrl?: string | null;
}

interface ExternalId {
  system: string;
  external_id: string;
  provisioned_at: string;
  metadata: any;
}

interface ProvLog {
  step: string;
  status: string;
  error: string | null;
  created_at: string;
  details: any;
}

export function ProvisioningCard({ etablissementId, statut, backendUrl }: Props) {
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data: externalIds } = useQuery({
    queryKey: ["client_external_ids", etablissementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_external_ids")
        .select("system, external_id, provisioned_at, metadata")
        .eq("etablissement_id", etablissementId);
      if (error) throw error;
      return (data ?? []) as ExternalId[];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["client_provisioning_log", etablissementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_provisioning_log")
        .select("step, status, error, created_at, details")
        .eq("etablissement_id", etablissementId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as ProvLog[];
    },
  });

  if (!isAdmin) return null;

  const siteWeb = externalIds?.find((x) => x.system === "site_web");
  const product = externalIds?.find((x) => x.system === "product");

  const handleRelaunch = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("provision-client-on-production", {
        body: { etablissement_id: etablissementId },
      });
      if (error) throw error;
      const res = (data as any)?.results?.[0];
      toast.success(`Provisionnement lancé — portail: ${res?.portal ?? "?"}, produit: ${res?.product ?? "?"}`);
      qc.invalidateQueries({ queryKey: ["client_external_ids", etablissementId] });
      qc.invalidateQueries({ queryKey: ["client_provisioning_log", etablissementId] });
      qc.invalidateQueries({ queryKey: ["client-portal-users", etablissementId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const renderStatus = (label: string, present: any, warn?: boolean) => (
    <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
      <div className="flex items-center gap-2">
        {present ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : warn ? (
          <AlertTriangle className="h-4 w-4 text-amber-600" />
        ) : (
          <Clock className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-medium text-sm">{label}</span>
      </div>
      <Badge variant={present ? "default" : warn ? "destructive" : "secondary"}>
        {present ? "Provisionné" : warn ? "Action requise" : "En attente"}
      </Badge>
    </div>
  );

  const copyPassword = () => {
    const pwd = siteWeb?.metadata?.generated_password;
    if (!pwd) return;
    navigator.clipboard.writeText(pwd);
    toast.success("Mot de passe copié");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Provisionnement automatique</CardTitle>
          <CardDescription>
            Crée le compte portail client et déclenche la création du tenant côté backend produit
            lorsque l'établissement passe en Production.
          </CardDescription>
        </div>
        <Button onClick={handleRelaunch} disabled={running} size="sm" variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
          {running ? "Lancement..." : "Relancer"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {statut !== "Production" && (
          <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
            ⚠ L'établissement n'est pas en statut "Production" — le scan automatique ne le traitera pas tant que le statut n'est pas basculé.
          </div>
        )}

        {renderStatus("Portail client (site-web)", siteWeb)}
        {renderStatus("Backend produit (DPI)", product, !backendUrl && !product)}

        {siteWeb?.metadata?.email && (
          <div className="text-xs space-y-1 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30">
            <div><span className="font-medium">Email portail :</span> {siteWeb.metadata.email}</div>
            {siteWeb.metadata.generated_password && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Mot de passe temporaire :</span>
                <code className="bg-background px-1.5 py-0.5 rounded">{siteWeb.metadata.generated_password}</code>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={copyPassword}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}

        {logs && logs.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Derniers logs ({logs.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {logs.map((l, i) => (
                <li key={i} className="flex items-center gap-2 p-1.5 rounded bg-muted/30">
                  <Badge variant={l.status === "success" ? "default" : l.status === "error" ? "destructive" : "secondary"} className="text-[10px]">
                    {l.step}
                  </Badge>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: fr })}
                  </span>
                  <span className="truncate flex-1">{l.error || l.status}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
