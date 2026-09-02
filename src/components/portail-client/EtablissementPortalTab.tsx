import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Save, ExternalLink, ListChecks } from "lucide-react";
import { CreatePortalUserDialog } from "./CreatePortalUserDialog";
import { PortalUsersTable } from "./PortalUsersTable";
import { PortalRequestsTable } from "./PortalRequestsTable";
import { TaskList } from "./TaskList";
import { useClientPortalUsersByEtablissement, useClientPortalRequests } from "@/hooks/portail/useClientPortal";
import { useUserRole } from "@/hooks/shared/useUserRole";
import { updateEtablissementBackendUrl } from "@/services/etablissement/etablissementMutations";
import { ProvisioningCard } from "./ProvisioningCard";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  etablissementId: string;
  initialBackendUrl?: string | null;
}

export function EtablissementPortalTab({ etablissementId, initialBackendUrl }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [backendUrl, setBackendUrl] = useState(initialBackendUrl ?? "");
  const [saving, setSaving] = useState(false);
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();

  const { data: users, isLoading: loadingUsers } = useClientPortalUsersByEtablissement(etablissementId);
  const { data: requests, isLoading: loadingRequests } = useClientPortalRequests({ etablissementId });

  const handleSaveBackendUrl = async () => {
    setSaving(true);
    try {
      await updateEtablissementBackendUrl(etablissementId, backendUrl.trim() || null);
      toast.success("URL backend enregistrée");
      qc.invalidateQueries({ queryKey: ["etablissement", etablissementId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Comptes portail client</CardTitle>
            <CardDescription>
              {users?.length ?? 0} compte{(users?.length ?? 0) > 1 ? "s" : ""} pour cet établissement
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Nouveau compte
          </Button>
        </CardHeader>
        <CardContent>
          <PortalUsersTable users={users ?? []} isLoading={loadingUsers} hideEtablissement />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Tâches portail client
          </CardTitle>
          <CardDescription>
            Échanges bidirectionnels entre OpenPulse et l'établissement (déploiement & production)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaskList etablissementId={etablissementId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demandes récentes</CardTitle>
          <CardDescription>Demandes envoyées depuis le portail pour cet établissement</CardDescription>
        </CardHeader>
        <CardContent>
          <PortalRequestsTable requests={requests ?? []} isLoading={loadingRequests} />
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              URL backend dédié (iframe stats)
            </CardTitle>
            <CardDescription>
              URL du backend HM/Resurgences/Easily affichée dans le portail client.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="backend-url">URL</Label>
              <div className="flex gap-2">
                <Input
                  id="backend-url"
                  type="url"
                  placeholder="https://backend.exemple.fr/stats"
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                />
                <Button onClick={handleSaveBackendUrl} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "..." : "Enregistrer"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ProvisioningCard
        etablissementId={etablissementId}
        backendUrl={backendUrl}
      />

      <CreatePortalUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        etablissementId={etablissementId}
      />
    </div>
  );
}
