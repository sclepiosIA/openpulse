import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ListChecks } from "lucide-react";
import { ImmersivePageHeader } from "@/components/layout/ImmersivePageHeader";
import { TaskList } from "@/components/portail-client/TaskList";
import { useEtablissement } from "@/hooks/crm/useEtablissements";

export default function PortailClientTaches() {
  const { etablissementId } = useParams<{ etablissementId: string }>();
  const navigate = useNavigate();
  const { data: etab } = useEtablissement(etablissementId ?? "");

  if (!etablissementId) {
    return <div className="container mx-auto py-6">Établissement manquant.</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-6xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Button>

      <ImmersivePageHeader
        title="Tâches portail client"
        subtitle={etab?.nom ? `Échanges OpenPulse ↔ ${etab.nom}` : "Échanges bidirectionnels avec l'établissement"}
        icon={ListChecks}
      />

      <TaskList etablissementId={etablissementId} />
    </div>
  );
}
