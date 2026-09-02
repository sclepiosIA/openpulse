import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePartenaire, useDeletePartenaire } from "@/hooks/crm/usePartenaires";
import { Loader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import { PartenaireInfo } from "@/components/partenaire/PartenaireInfo";
import { PartenaireContacts } from "@/components/partenaire/PartenaireContacts";
import { PartenaireEmailsTab } from "@/components/partenaire/PartenaireEmailsTab";
import { PartenaireDomainManager } from "@/components/partenaire/PartenaireDomainManager";
import { PartenaireAISuggestionsPanel } from "@/components/partenaire/PartenaireAISuggestionsPanel";
import { PartenaireConsolidatedView } from "@/components/partenaire/PartenaireConsolidatedView";
import { PartenaireActivitiesTimeline } from "@/components/partenaire/PartenaireActivitiesTimeline";
import { PartenaireTaches } from "@/components/partenaire/PartenaireTaches";
import { PartenaireEditForm } from '@/components/partenaire/PartenaireEditForm';
import { PartenaireHeader } from "@/components/partenaire/PartenaireHeader";
import { PageDataState } from "@/components/common/PageDataState";

export default function PartenaireDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: partenaire, isLoading, isError, error, refetch } = usePartenaire(id!);
  const deletePartenaire = useDeletePartenaire();
  const [editOpen, setEditOpen] = useState(false);

  const handleDelete = async () => {
    if (!id) return;
    await deletePartenaire.mutateAsync(id);
    navigate('/partenaires');
  };

  if (isLoading) {
    return <Loader />;
  }

  if (isError) {
    return (
      <div className="container mx-auto py-6">
        <PageDataState isLoading={false} isError={true} error={error} onRetry={() => refetch()}>
          <></>
        </PageDataState>
      </div>
    );
  }

  if (!partenaire) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Partenaire non trouvé</h2>
          <Button onClick={() => navigate('/partenaires')} className="mt-4">
            Retour à la liste
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden min-h-dvh bg-gradient-page px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 space-y-4 sm:space-y-6">
      {/* Header Premium */}
      <PartenaireHeader
        partenaire={partenaire}
        onEdit={() => setEditOpen(true)}
        onDelete={handleDelete}
      />

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="taches">Tâches</TabsTrigger>
          <TabsTrigger value="activities">Activités & CRM</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          <PartenaireInfo partenaire={partenaire} />
          <PartenaireDomainManager 
            partenaireId={id!} 
            officialDomains={partenaire.email_domains || []} 
          />
        </TabsContent>

        <TabsContent value="contacts">
          <PartenaireContacts partenaireId={id!} />
        </TabsContent>

        <TabsContent value="taches">
          <PartenaireTaches partenaireId={id!} />
        </TabsContent>

        <TabsContent value="activities" className="space-y-6">
          <PartenaireAISuggestionsPanel partenaireId={id!} />
          <PartenaireActivitiesTimeline partenaireId={id!} />
        </TabsContent>

        <TabsContent value="emails" className="min-h-[600px]">
          <PartenaireEmailsTab partenaireId={id!} partenaireNom={partenaire.nom} />
        </TabsContent>

        <TabsContent value="dashboard">
          <PartenaireConsolidatedView partenaire={partenaire} />
        </TabsContent>
      </Tabs>

      {/* Dialog de modification */}
      <PartenaireEditForm
        partenaire={partenaire}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
