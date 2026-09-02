import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Inbox } from "lucide-react";
import { CreatePortalUserDialog } from "@/components/portail-client/CreatePortalUserDialog";
import { PortalUsersTable } from "@/components/portail-client/PortalUsersTable";
import { PortalRequestsTable } from "@/components/portail-client/PortalRequestsTable";
import { useClientPortalUsers, useClientPortalRequests } from "@/hooks/portail/useClientPortal";
import { ImmersivePageHeader } from "@/components/layout/ImmersivePageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageDataState } from "@/components/common/PageDataState";

export default function PortailClient() {
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "nouveau" | "en_cours" | "traite" | "ferme">("all");

  const usersQ = useClientPortalUsers();
  const requestsQ = useClientPortalRequests(
    statusFilter === "all" ? {} : { statut: statusFilter },
  );
  const { data: users, isLoading: loadingUsers, isError: usersError, refetch: refetchUsers } = usersQ;
  const { data: requests, isLoading: loadingRequests, isError: requestsError, refetch: refetchRequests } = requestsQ;

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <ImmersivePageHeader
        title="Portail client"
        subtitle="Gestion des comptes et demandes du portail externe"
        icon={Users}
      />

      <Tabs defaultValue="comptes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="comptes" className="gap-2"><Users className="h-4 w-4" />Comptes</TabsTrigger>
          <TabsTrigger value="demandes" className="gap-2"><Inbox className="h-4 w-4" />Demandes</TabsTrigger>
        </TabsList>

        <TabsContent value="comptes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Comptes portail client</CardTitle>
                <CardDescription>
                  {users?.length ?? 0} compte{(users?.length ?? 0) > 1 ? "s" : ""} · accès au portail externe
                </CardDescription>
              </div>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />Nouveau compte
              </Button>
            </CardHeader>
            <CardContent>
              <PageDataState isLoading={false} isError={usersError} onRetry={() => refetchUsers()}>
                <PortalUsersTable users={users ?? []} isLoading={loadingUsers} />
              </PageDataState>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demandes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Demandes du portail</CardTitle>
                <CardDescription>
                  Demandes envoyées par les clients depuis le portail externe
                </CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="nouveau">Nouveau</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="traite">Traitée</SelectItem>
                  <SelectItem value="ferme">Fermée</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <PageDataState isLoading={false} isError={requestsError} onRetry={() => refetchRequests()}>
                <PortalRequestsTable requests={requests ?? []} isLoading={loadingRequests} />
              </PageDataState>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreatePortalUserDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
