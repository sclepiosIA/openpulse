import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ContractBuilderLayout } from "@/components/contrats/builder/ContractBuilderLayout";
import { useContrat } from "@/hooks/contracts/useContrats";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageDataState } from "@/components/common/PageDataState";

export default function ContractBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: contrat, isLoading, isError, error, refetch } = useContrat(id);

  useEffect(() => {
    if (error) {
      toast.error("Contrat introuvable");
    }
  }, [error]);

  if (isLoading || isError || !contrat) {
    return (
      <div className="p-6">
        <PageDataState
          isLoading={isLoading}
          isError={isError}
          isEmpty={!isLoading && !isError && !contrat}
          emptyTitle="Contrat introuvable"
          emptyDescription="Le contrat demandé n'existe pas ou a été supprimé."
          onRetry={() => refetch()}
        >
          <></>
        </PageDataState>
        <div className="flex justify-center mt-4">
          <Button onClick={() => navigate("/contrats")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux contrats
          </Button>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    toast.success("Contrat sauvegardé");
  };

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ContractBuilderLayout
        contratId={id!}
        contratTitre={contrat.titre || "Sans titre"}
        onSave={handleSave}
      />
    </div>
  );
}
