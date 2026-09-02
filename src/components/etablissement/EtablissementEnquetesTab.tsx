import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Mail, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { invokeEdge } from "@/services/edgeFunctions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const TYPE_LABEL: Record<string, string> = {
  post_formation: "Post-formation",
  ces: "CES (effort)",
  satisfaction: "Satisfaction + NPS",
  suivi_csm: "Suivi CSM",
};

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  scheduled: { label: "Planifiée", variant: "outline" },
  sent: { label: "Envoyée", variant: "secondary" },
  responded: { label: "Répondue", variant: "default" },
  reminded: { label: "Relancée", variant: "secondary" },
  expired: { label: "Expirée", variant: "destructive" },
};

interface Props {
  etablissementId: string;
}

export function EtablissementEnquetesTab({ etablissementId }: Props) {
  const qc = useQueryClient();
  const [enqueteType, setEnqueteType] = useState<string>("satisfaction");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const { data: users = [] } = useQuery({
    queryKey: ["etab-users", etablissementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("etablissement_users")
        .select("id, nom, prenom, email, fonction, actif")
        .eq("etablissement_id", etablissementId)
        .eq("actif", true)
        .order("nom");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: campagnes = [], isLoading: loadingCampagnes } = useQuery({
    queryKey: ["enquetes-campagnes", etablissementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enquetes_campagnes")
        .select("id, type, status, canal, scheduled_at, sent_at, responded_at, email_destinataire, token_unique, user_id, created_at")
        .eq("etablissement_id", etablissementId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const userMap = useMemo(() => {
    const m = new Map<string, { nom: string; prenom: string; email: string }>();
    users.forEach((u) => m.set(u.id, { nom: u.nom, prenom: u.prenom, email: u.email }));
    return m;
  }, [users]);

  const stats = useMemo(() => {
    const total = campagnes.length;
    const responded = campagnes.filter((c) => c.status === "responded").length;
    return {
      total,
      responded,
      rate: total > 0 ? Math.round((responded / total) * 100) : 0,
    };
  }, [campagnes]);

  const sendMutation = useMutation({
    mutationFn: async ({ userIds }: { userIds: string[] }) => {
      const results = [];
      for (const userId of userIds) {
        const user = userMap.get(userId);
        const res = await invokeEdge<{ success: boolean; url?: string; error?: string }>("send-enquete", {
          type: enqueteType,
          etablissement_id: etablissementId,
          user_id: userId,
          email: user?.email,
          canal: "email",
        });
        results.push({ userId, res });
      }
      return results;
    },
    onSuccess: (results) => {
      const ok = results.filter((r) => r.res?.success).length;
      const ko = results.length - ok;
      if (ok > 0) toast.success(`${ok} enquête(s) envoyée(s)`);
      if (ko > 0) toast.error(`${ko} envoi(s) en échec`);
      setSelectedUserIds(new Set());
      qc.invalidateQueries({ queryKey: ["enquetes-campagnes", etablissementId] });
    },
    onError: (err: Error) => toast.error(err.message || "Erreur lors de l'envoi"),
  });

  const resendMutation = useMutation({
    mutationFn: async (campagne: typeof campagnes[number]) => {
      const res = await invokeEdge<{ success: boolean; url?: string }>("send-enquete", {
        type: campagne.type,
        etablissement_id: etablissementId,
        user_id: campagne.user_id,
        email: campagne.email_destinataire,
        canal: "email",
      });
      return res;
    },
    onSuccess: () => {
      toast.success("Enquête renvoyée");
      qc.invalidateQueries({ queryKey: ["enquetes-campagnes", etablissementId] });
    },
    onError: (err: Error) => toast.error(err.message || "Erreur"),
  });

  const copyLink = async (token: string, type: string) => {
    const paths: Record<string, string> = {
      post_formation: "post-formation", ces: "ces", satisfaction: "satisfaction", suivi_csm: "suivi-csm",
    };
    const url = `${window.location.origin}/enquete/${paths[type]}/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Lien copié");
  };

  const toggleAll = (checked: boolean) => {
    setSelectedUserIds(checked ? new Set(users.map((u) => u.id)) : new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selectedUserIds);
    if (checked) next.add(id); else next.delete(id);
    setSelectedUserIds(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Enquêtes de satisfaction</h3>
          <p className="text-sm text-muted-foreground">
            Envoyer manuellement une enquête à un ou plusieurs utilisateurs.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Campagnes envoyées</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Répondues</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.responded}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Taux de réponse</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.rate}%</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="send">
        <TabsList>
          <TabsTrigger value="send">Envoyer une enquête</TabsTrigger>
          <TabsTrigger value="history">Historique ({campagnes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nouvelle campagne</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium block mb-1.5">Type d'enquête</label>
                  <Select value={enqueteType} onValueChange={setEnqueteType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => sendMutation.mutate({ userIds: Array.from(selectedUserIds) })}
                  disabled={selectedUserIds.size === 0 || sendMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer à {selectedUserIds.size} utilisateur{selectedUserIds.size > 1 ? "s" : ""}
                </Button>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedUserIds.size > 0 && selectedUserIds.size === users.length}
                          onCheckedChange={(c) => toggleAll(!!c)}
                        />
                      </TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Fonction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Aucun utilisateur actif</TableCell></TableRow>
                    ) : users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedUserIds.has(u.id)}
                            onCheckedChange={(c) => toggleOne(u.id, !!c)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{u.prenom} {u.nom}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell className="text-sm">{u.fonction}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Destinataire</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCampagnes ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6">Chargement…</TableCell></TableRow>
                  ) : campagnes.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucune campagne</TableCell></TableRow>
                  ) : campagnes.map((c) => {
                    const u = c.user_id ? userMap.get(c.user_id) : null;
                    const st = STATUS_LABEL[c.status] ?? { label: c.status, variant: "outline" as const };
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">{format(new Date(c.created_at), "dd MMM yyyy", { locale: fr })}</TableCell>
                        <TableCell>{TYPE_LABEL[c.type] ?? c.type}</TableCell>
                        <TableCell className="text-sm">
                          {u ? `${u.prenom} ${u.nom}` : c.email_destinataire ?? "—"}
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{c.canal}</Badge></TableCell>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="icon" variant="ghost" onClick={() => copyLink(c.token_unique, c.type)} title="Copier le lien">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => {
                            const paths: Record<string, string> = { post_formation: "post-formation", ces: "ces", satisfaction: "satisfaction", suivi_csm: "suivi-csm" };
                            window.open(`/enquete/${paths[c.type]}/${c.token_unique}`, "_blank");
                          }} title="Ouvrir l'enquête">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          {c.canal === "email" && c.status !== "responded" && (
                            <Button size="icon" variant="ghost" onClick={() => resendMutation.mutate(c)} disabled={resendMutation.isPending} title="Renvoyer">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
