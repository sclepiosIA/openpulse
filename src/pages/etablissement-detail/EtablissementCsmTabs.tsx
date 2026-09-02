import { CsmEtabSanteCard } from "@/components/csm/CsmEtabSanteCard";
import { CsmEtabParcours } from "@/components/csm/CsmEtabParcours";
import { CsmEtabFacturation } from "@/components/csm/CsmEtabFacturation";
import { CsmEtabKpisMensuels } from "@/components/csm/CsmEtabKpisMensuels";
import { CsmEtabKpisTrimestriels } from "@/components/csm/CsmEtabKpisTrimestriels";
import { CsmEtabInfoCard } from "@/components/csm/CsmEtabInfoCard";
import { CsmEtabPlaybooks } from "@/components/csm/CsmEtabPlaybooks";

export type CsmTabKey =
  | "csm-sante"
  | "csm-parcours"
  | "csm-facturation"
  | "csm-kpis-mensuels"
  | "csm-kpis-trimestriels"
  | "csm-playbooks";

interface EtablissementCsmTabsProps {
  tab: CsmTabKey;
  etablissementId: string;
}

/**
 * Rend l'un des 6 onglets CSM d'un établissement.
 * Extrait du `switch` de `EtablissementDetail.tsx` (session 93) pour réduire
 * la taille de la page et regrouper la responsabilité d'affichage CSM.
 */
export function EtablissementCsmTabs({ tab, etablissementId }: EtablissementCsmTabsProps) {
  switch (tab) {
    case "csm-sante":
      return (
        <div className="space-y-6">
          <CsmEtabInfoCard etablissementId={etablissementId} />
          <CsmEtabSanteCard etablissementId={etablissementId} />
        </div>
      );
    case "csm-parcours":
      return (
        <div className="space-y-6">
          <CsmEtabParcours etablissementId={etablissementId} />
        </div>
      );
    case "csm-facturation":
      return (
        <div className="space-y-6">
          <CsmEtabFacturation etablissementId={etablissementId} />
        </div>
      );
    case "csm-kpis-mensuels":
      return (
        <div className="space-y-6">
          <CsmEtabKpisMensuels etablissementId={etablissementId} />
        </div>
      );
    case "csm-kpis-trimestriels":
      return (
        <div className="space-y-6">
          <CsmEtabKpisTrimestriels etablissementId={etablissementId} />
        </div>
      );
    case "csm-playbooks":
      return (
        <div className="space-y-6">
          <CsmEtabPlaybooks etablissementId={etablissementId} />
        </div>
      );
    default:
      return null;
  }
}
