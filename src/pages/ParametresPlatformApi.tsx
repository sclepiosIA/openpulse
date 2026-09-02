import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { callPlatformAdmin, type PlatformAdminAction } from "@/services/platform/platformAdmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ImmersivePageHeader } from "@/components/layout/ImmersivePageHeader";
import { PageDataState } from "@/components/common/PageDataState";
import { Plug, Key, Webhook, Activity, Link as LinkIcon, RotateCw, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Action = PlatformAdminAction;

const callAdmin = callPlatformAdmin;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-slate-200 text-foreground",
    retrying: "bg-amber-100 text-amber-900",
    delivered: "bg-emerald-100 text-emerald-900",
    dead: "bg-rose-100 text-rose-900",
  };
  return <Badge className={map[status] ?? "bg-muted"}>{status}</Badge>;
}

function CopyButton({ value }: { value: string }) {
  return (
    <Button
      size="sm" variant="outline"
      onClick={() => { navigator.clipboard.writeText(value); toast.success("Copié"); }}
    >
      <Copy className="h-3 w-3" />
    </Button>
  );
}

type SiteWebSetupResult = {
  secrets: Record<"PLATFORM_API_URL" | "PLATFORM_API_KEY" | "PLATFORM_WEBHOOK_HMAC_SECRET", string>;
  webhook_url: string;
  api_key_prefix: string;
};

function SetupSiteWebCard() {
  const qc = useQueryClient();
  const [result, setResult] = useState<SiteWebSetupResult | null>(null);
  const setup = useMutation({
    mutationFn: () => callAdmin<SiteWebSetupResult>({ method: "POST", body: { action: "setup_site_web" } }),
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["platform-admin"] });
      toast.success("Configuration Site Web préparée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyAll = () => {
    if (!result) return;
    const value = Object.entries(result.secrets).map(([k, v]) => `${k}=${v}`).join("\n");
    navigator.clipboard.writeText(value);
    toast.success("Secrets copiés");
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Plug className="h-5 w-5" /> Configuration automatique — Site Web OpenPulse
        </CardTitle>
        <CardDescription>
          Prépare l'endpoint webhook, révoque l'ancienne clé <code>platform:site_web</code> et génère les secrets à coller côté Site Web.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button onClick={() => setup.mutate()} disabled={setup.isPending} className="w-full sm:w-auto">
          <RotateCw className="h-4 w-4 mr-2" /> {setup.isPending ? "Configuration..." : "Lancer la configuration"}
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" /> Rotation clé API + secret HMAC
        </div>
      </CardContent>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plug className="h-5 w-5" /> Secrets Site Web prêts</DialogTitle>
            <DialogDescription>
              Copiez ces trois valeurs dans le projet Site Web OpenPulse → Settings → Secrets. Elles ne seront plus affichées.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {result && Object.entries(result.secrets).map(([name, value]) => (
              <div key={name} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[220px_1fr_auto] sm:items-center">
                <Label className="font-mono text-xs">{name}</Label>
                <code className="min-w-0 break-all rounded bg-muted px-2 py-2 text-xs">{value}</code>
                <CopyButton value={value} />
              </div>
            ))}
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Webhook enregistré : <code className="break-all">{result?.webhook_url}</code> · clé <code>{result?.api_key_prefix}…</code>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={copyAll}><Copy className="h-4 w-4 mr-2" /> Copier les 3 secrets</Button>
            <Button onClick={() => setResult(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────

function WebhooksTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["platform-admin", "webhooks"],
    queryFn: () => callAdmin<{ endpoints: any[] }>({ method: "GET", action: "list_webhooks" }),
  });
  const [system, setSystem] = useState<"site_web" | "product">("site_web");
  const [url, setUrl] = useState("");
  const [revealed, setRevealed] = useState<{ system: string; secret: string } | null>(null);

  const upsert = useMutation({
    mutationFn: () => callAdmin({ method: "POST", body: { action: "upsert_webhook", system, url, active: true } }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["platform-admin", "webhooks"] });
      setUrl("");
      if (data?.hmac_secret) setRevealed({ system: data.system, secret: data.hmac_secret });
      else toast.success("Endpoint enregistré (secret existant conservé)");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rotate = useMutation({
    mutationFn: (system: string) =>
      callAdmin<{ system: string; hmac_secret: string }>({ method: "POST", body: { action: "rotate_webhook_secret", system } }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["platform-admin", "webhooks"] });
      setRevealed({ system: data.system, secret: data.hmac_secret });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Endpoints webhooks</CardTitle>
        <CardDescription>
          URLs où les événements Gestion sont POSTés (signés HMAC). Un par système : <code>site_web</code>, <code>product</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto] items-end">
          <div className="space-y-1">
            <Label>Système</Label>
            <Select value={system} onValueChange={(v) => setSystem(v as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="site_web">site_web</SelectItem>
                <SelectItem value="product">product</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>URL HTTPS</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://siteweb.../functions/v1/platform-webhook-receive" />
          </div>
          <Button disabled={!url || upsert.isPending} onClick={() => upsert.mutate()}>
            <Plus className="h-4 w-4 mr-1" /> Enregistrer
          </Button>
        </div>

        <PageDataState isLoading={q.isLoading} isError={q.isError} error={q.error} onRetry={() => q.refetch()}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Système</TableHead><TableHead>URL</TableHead>
                <TableHead>Actif</TableHead><TableHead>MAJ</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data?.endpoints ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell><Badge variant="outline">{e.system}</Badge></TableCell>
                  <TableCell className="font-mono text-xs break-all max-w-[400px]">{e.url}</TableCell>
                  <TableCell>{e.active ? "Oui" : "Non"}</TableCell>
                  <TableCell className="text-xs">{new Date(e.updated_at ?? e.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => rotate.mutate(e.system)}>
                      <RotateCw className="h-3 w-3 mr-1" /> Rotation secret
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(q.data?.endpoints ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Aucun endpoint</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </PageDataState>
      </CardContent>

      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Secret HMAC — {revealed?.system}</DialogTitle>
            <DialogDescription>
              Copiez ce secret maintenant. Il sert à vérifier la signature <code>X-Marque-Signature</code>. Il ne sera plus affiché.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 items-center bg-muted p-3 rounded font-mono text-xs break-all">
            {revealed?.secret} {revealed && <CopyButton value={revealed.secret} />}
          </div>
          <DialogFooter><Button onClick={() => setRevealed(null)}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ApiKeysTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["platform-admin", "keys"],
    queryFn: () => callAdmin<{ keys: any[] }>({ method: "GET", action: "list_keys" }),
  });
  const [name, setName] = useState("");
  const [scope, setScope] = useState("platform:site_web");
  const [revealed, setRevealed] = useState<{ key: string; prefix: string } | null>(null);

  const create = useMutation({
    mutationFn: () => callAdmin<any>({ method: "POST", body: { action: "create_api_key", name, scope } }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["platform-admin", "keys"] });
      setName(""); setRevealed({ key: data.key, prefix: data.prefix });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => callAdmin({ method: "POST", body: { action: "revoke_api_key", id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-admin", "keys"] }); toast.success("Clé révoquée"); },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clés API</CardTitle>
        <CardDescription>Authentification <code>x-api-key</code> pour Site Web et Backend Produit.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto] items-end">
          <div className="space-y-1">
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Site Web prod" />
          </div>
          <div className="space-y-1">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="platform:site_web">platform:site_web</SelectItem>
                <SelectItem value="platform:product">platform:product</SelectItem>
                <SelectItem value="platform:product:sandbox">platform:product:sandbox</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button disabled={!name || create.isPending} onClick={() => create.mutate()}>
            <Plus className="h-4 w-4 mr-1" /> Créer
          </Button>
        </div>

        <PageDataState isLoading={q.isLoading} isError={q.isError} error={q.error} onRetry={() => q.refetch()}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead><TableHead>Préfixe</TableHead><TableHead>Scope</TableHead>
                <TableHead>Utilisations</TableHead><TableHead>Dernière</TableHead>
                <TableHead>État</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data?.keys ?? []).map((k) => (
                <TableRow key={k.id}>
                  <TableCell>{k.nom}</TableCell>
                  <TableCell className="font-mono text-xs">{k.key_prefix}…</TableCell>
                  <TableCell>{(k.permissions ?? []).join(", ")}</TableCell>
                  <TableCell>{k.total_requests ?? 0}</TableCell>
                  <TableCell className="text-xs">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "—"}</TableCell>
                  <TableCell>{k.est_active && !k.revoked_at ? <Badge>Active</Badge> : <Badge variant="destructive">Révoquée</Badge>}</TableCell>
                  <TableCell>
                    {k.est_active && !k.revoked_at && (
                      <Button size="sm" variant="ghost" onClick={() => revoke.mutate(k.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(q.data?.keys ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Aucune clé</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </PageDataState>
      </CardContent>

      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clé API créée</DialogTitle>
            <DialogDescription>Copiez-la maintenant. Elle ne sera plus jamais affichée.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 items-center bg-muted p-3 rounded font-mono text-xs break-all">
            {revealed?.key} {revealed && <CopyButton value={revealed.key} />}
          </div>
          <DialogFooter><Button onClick={() => setRevealed(null)}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EventsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const q = useQuery({
    queryKey: ["platform-admin", "events", status],
    queryFn: () => callAdmin<{ events: any[] }>({
      method: "GET", action: "list_events",
      params: status === "all" ? { limit: "100" } : { limit: "100", status },
    }),
    refetchInterval: 15000,
  });
  const retry = useMutation({
    mutationFn: (id: string) => callAdmin({ method: "POST", body: { action: "retry_event", id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-admin", "events"] }); toast.success("Réinjecté"); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <div>
          <CardTitle>Bus d'événements</CardTitle>
          <CardDescription>Dispatch CRON 1 min, retry expo, DLQ après 5 échecs.</CardDescription>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="pending">pending</SelectItem>
            <SelectItem value="retrying">retrying</SelectItem>
            <SelectItem value="delivered">delivered</SelectItem>
            <SelectItem value="dead">dead</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <PageDataState isLoading={q.isLoading} isError={q.isError} error={q.error} onRetry={() => q.refetch()}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead><TableHead>État</TableHead><TableHead>Tentatives</TableHead>
                <TableHead>Cible</TableHead><TableHead>Erreur</TableHead><TableHead>Créé</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data?.events ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.event_type}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell>{e.attempts}</TableCell>
                  <TableCell><Badge variant="outline">{e.target}</Badge></TableCell>
                  <TableCell className="text-xs text-rose-700 max-w-[260px] truncate" title={e.last_error}>{e.last_error ?? "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(e.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {(e.status === "dead" || e.status === "retrying") && (
                      <Button size="sm" variant="outline" onClick={() => retry.mutate(e.id)}>
                        <RotateCw className="h-3 w-3 mr-1" />Rejouer
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(q.data?.events ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Aucun événement</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </PageDataState>
      </CardContent>
    </Card>
  );
}

function MappingsTab() {
  const q = useQuery({
    queryKey: ["platform-admin", "mappings"],
    queryFn: () => callAdmin<{ mappings: any[] }>({ method: "GET", action: "list_mappings" }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mappings clients ↔ systèmes externes</CardTitle>
        <CardDescription>Identifiants externes renvoyés par Site Web et Backend Produit après provisioning.</CardDescription>
      </CardHeader>
      <CardContent>
        <PageDataState isLoading={q.isLoading} isError={q.isError} error={q.error} onRetry={() => q.refetch()}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Établissement</TableHead><TableHead>Système</TableHead>
                <TableHead>External ID</TableHead><TableHead>Provisionné</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data?.mappings ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.etablissement_id}</TableCell>
                  <TableCell><Badge variant="outline">{m.system}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{m.external_id}</TableCell>
                  <TableCell className="text-xs">{m.provisioned_at ? new Date(m.provisioned_at).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))}
              {(q.data?.mappings ?? []).length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Aucun mapping</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </PageDataState>
      </CardContent>
    </Card>
  );
}

export default function ParametresPlatformApi() {
  const [tab, setTab] = useState("webhooks");
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <ImmersivePageHeader
        title="Platform API"
        subtitle="Intégration tri-projet — Gestion ⇄ Site Web ⇄ Backend Produit"
        icon={Plug}
      />
      <SetupSiteWebCard />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-grid sm:w-auto sm:grid-cols-4">
          <TabsTrigger value="webhooks" className="gap-2"><Webhook className="h-4 w-4" />Webhooks</TabsTrigger>
          <TabsTrigger value="keys" className="gap-2"><Key className="h-4 w-4" />Clés API</TabsTrigger>
          <TabsTrigger value="events" className="gap-2"><Activity className="h-4 w-4" />Événements</TabsTrigger>
          <TabsTrigger value="mappings" className="gap-2"><LinkIcon className="h-4 w-4" />Mappings</TabsTrigger>
        </TabsList>
        <TabsContent value="webhooks"><WebhooksTab /></TabsContent>
        <TabsContent value="keys"><ApiKeysTab /></TabsContent>
        <TabsContent value="events"><EventsTab /></TabsContent>
        <TabsContent value="mappings"><MappingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
