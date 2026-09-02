import { useParams, useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGroupe, useDeleteGroupe } from "@/hooks/crm/useGroupes";
import { useEtablissementsInGroupe } from "@/hooks/crm/useEtablissementGroupes";
import { useContactsGroupe } from "@/hooks/crm/useContactsGroupe";
import { useTachesGroupe } from "@/hooks/tasks/useTachesGroupe";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GroupeConsolidatedView } from "@/components/groupe/GroupeConsolidatedView";
import { GroupeEmailsTab } from "@/components/groupe/GroupeEmailsTab";
import { GroupeEditDialog } from "@/components/groupe/GroupeEditDialog";
import { EtablissementEditForm } from '@/components/etablissement/EtablissementEditForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Etablissement } from "@/hooks/crm/useEtablissements";
import { GroupeDomainManager } from "@/components/groupe/GroupeDomainManager";
import { GroupeAllTasksView } from "@/components/groupe/GroupeAllTasksView";
import { GroupeEtablissementsTab } from "@/components/groupe/GroupeEtablissementsTab";
import { useUserPreferences } from "@/hooks/profile/useUserPreferences";
import { exportGroupesToPDF } from "@/lib/exportGroupesUtils";
import { GroupeContacts } from "@/components/groupe/GroupeContacts";
import { GroupeHeader } from "@/components/groupe/GroupeHeader";
import { Package, Activity } from "lucide-react";
import { PageDataState } from "@/components/common/PageDataState";

export default function GroupeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: groupe, isLoading: loadingGroupe, isError: groupeError, error: groupeErr, refetch: refetchGroupe } = useGroupe(id!);
  const { data: etablissements, isLoading: loadingEtabs } = useEtablissementsInGroupe(id);
  const { data: contacts, isLoading: loadingContacts } = useContactsGroupe(id);
  const { data: taches, isLoading: loadingTaches } = useTachesGroupe(id);
  
  const deleteGroupe = useDeleteGroupe();
  const { toggleFavoriteGroupe, isFavoriteGroupe } = useUserPreferences();
  
  const [showEditGroupe, setShowEditGroupe] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingEtablissement, setEditingEtablissement] = useState<Etablissement | null>(null);

  const isFavorite = id ? isFavoriteGroupe(id) : false;

  const handleToggleFavorite = async () => {
    if (id) {
      await toggleFavoriteGroupe(id);
    }
  };

  const handleExportPDF = () => {
    if (groupe) {
      exportGroupesToPDF([groupe]);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteGroupe.mutateAsync(id);
    navigate('/groupes');
  };

  const isGroupeProspect = etablissements?.every(etab => etab.etablissement?.statut === 'Prospect');
  const modulesLabel = isGroupeProspect ? 'proposés' : 'déployés';

  // Affiche le compteur réel (liste chargée) plutôt que le cache `nombre_etablissements`
  // pour éviter l'incohérence "compteur 3 mais détail 0" (BUG audit run-1781711522).
  const etablissementsCount = loadingEtabs
    ? groupe?.nombre_etablissements ?? 0
    : etablissements?.length ?? 0;

  if (loadingGroupe) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (groupeError) {
    return (
      <div className="container mx-auto p-6">
        <PageDataState isLoading={false} isError={true} error={groupeErr} onRetry={() => refetchGroupe()}>
          <></>
        </PageDataState>
      </div>
    );
  }

  if (!groupe) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">Groupe introuvable</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden min-h-dvh bg-gradient-page px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 space-y-4 sm:space-y-6">
      {/* Header Premium */}
      <GroupeHeader
        groupe={groupe}
        isFavorite={isFavorite}
        onToggleFavorite={handleToggleFavorite}
        onEdit={() => setShowEditGroupe(true)}
        onDelete={() => setShowDeleteDialog(true)}
        onExportPDF={handleExportPDF}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Établissements</CardDescription>
            <CardTitle className="text-3xl">{etablissementsCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Modules {modulesLabel}
            </CardDescription>
            <CardTitle className="text-3xl">
              {groupe.modules_deployes?.length || 0}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {groupe.modules_deployes?.join(', ') || 'Aucun'}
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Progression moyenne</CardDescription>
            <CardTitle className="text-3xl">{groupe.progression_moyenne.toFixed(1)}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Passages aux urgences/an
            </CardDescription>
            <CardTitle className="text-3xl">
              {(groupe.total_passages_urgences_annuel || 0).toLocaleString('fr-FR')}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="etablissements" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6">
          <TabsTrigger value="etablissements">
            Établissements ({etablissementsCount})
          </TabsTrigger>
          <TabsTrigger value="tableau-bord">
            Tableau de bord
          </TabsTrigger>
          <TabsTrigger value="taches">
            Tâches
          </TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts ({contacts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="communications">
            Emails
          </TabsTrigger>
          <TabsTrigger value="domaines">
            Domaines
          </TabsTrigger>
        </TabsList>

        <TabsContent value="etablissements" className="space-y-4">
          <GroupeEtablissementsTab
            groupeId={id!}
            etablissements={etablissements || []}
            onEditEtablissement={setEditingEtablissement}
            isLoading={loadingEtabs}
          />
        </TabsContent>

        <TabsContent value="tableau-bord">
          <GroupeConsolidatedView
            groupe={groupe}
            etablissements={etablissements || []}
            contacts={contacts || []}
            taches={taches || []}
          />
        </TabsContent>

        <TabsContent value="taches" className="space-y-4">
          <Tabs defaultValue="communes" className="w-full">
            <TabsList>
              <TabsTrigger value="communes">
                Tâches communes ({taches?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="etablissements">
                Tâches des établissements
              </TabsTrigger>
            </TabsList>

            <TabsContent value="communes" className="space-y-4 mt-4">
              {loadingTaches ? (
                <Skeleton className="h-40 w-full" />
              ) : taches && taches.length > 0 ? (
                <div className="grid gap-4">
                  {taches.map((tache: any) => (
                    <Card key={tache.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{tache.titre}</CardTitle>
                            {tache.description && (
                              <CardDescription className="mt-2">{tache.description}</CardDescription>
                            )}
                          </div>
                          <Badge variant={
                            tache.statut === 'Terminé' ? 'default' :
                            tache.statut === 'En cours' ? 'secondary' : 'outline'
                          }>
                            {tache.statut}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-semibold">Aucune tâche commune</p>
                    <p className="text-muted-foreground mb-4">Créez des tâches au niveau du groupe</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="etablissements" className="mt-4">
              <GroupeAllTasksView groupeId={id!} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <GroupeContacts groupeId={id!} />
        </TabsContent>

        <TabsContent value="communications" className="min-h-[600px]">
          <GroupeEmailsTab groupeId={id!} groupeNom={groupe.nom} />
        </TabsContent>

        <TabsContent value="domaines" className="space-y-4">
          <GroupeDomainManager 
            groupeId={id!} 
            officialDomains={groupe.email_domains || []} 
          />
        </TabsContent>
      </Tabs>

      {groupe && (
        <GroupeEditDialog
          open={showEditGroupe}
          onOpenChange={setShowEditGroupe}
          groupe={groupe}
        />
      )}

      {editingEtablissement && (
        <EtablissementEditForm
          etablissement={editingEtablissement}
          open={!!editingEtablissement}
          onOpenChange={(open) => !open && setEditingEtablissement(null)}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le groupe "{groupe?.nom}" ? 
              Cette action est irréversible et supprimera toutes les associations avec les établissements.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteGroupe.isPending}
            >
              {deleteGroupe.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
