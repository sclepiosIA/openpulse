import { Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { GroupeBadge } from "@/components/ui/groupe-badge";
import { useGroupesForEtablissement } from "@/hooks/crm/useEtablissementGroupes";

interface GroupeIndicatorProps {
  etablissementId: string;
  className?: string;
}

export function GroupeIndicator({ etablissementId, className }: GroupeIndicatorProps) {
  const { data: groupes, isLoading } = useGroupesForEtablissement(etablissementId);

  if (isLoading || !groupes || groupes.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className || ''}`}>
      <Building2 className="h-4 w-4 text-muted-foreground" />
      {groupes.map((eg: any) => (
        <Link 
          key={eg.id} 
          to={`/groupes/${eg.groupe.id}`}
          onClick={(e) => {
            // Support Cmd/Ctrl+Click pour ouvrir dans un nouvel onglet
            if (e.metaKey || e.ctrlKey) {
              e.preventDefault();
              window.open(`/groupes/${eg.groupe.id}`, '_blank');
            }
          }}
        >
          <GroupeBadge 
            type={eg.groupe.type} 
            nom={eg.groupe.nom}
            className="cursor-pointer hover:opacity-80"
          />
        </Link>
      ))}
    </div>
  );
}
