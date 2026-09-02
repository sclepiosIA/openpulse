import { FolderOpen, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EntityAvatar } from "@/components/ui/EntityAvatar";
import { cn } from "@/lib/utils";

interface EtablissementWithDocuments {
  id: string;
  nom: string;
  ville: string | null;
  logo_url: string | null;
  etablissement_logo_url: string | null;
  groupe_logo_url: string | null;
  groupe_nom: string | null;
  statut: string | null;
  document_count: number;
}

interface EtablissementDocumentListItemProps {
  etablissement: EtablissementWithDocuments;
  onClick: () => void;
  isSelected?: boolean;
}

export function EtablissementDocumentListItem({
  etablissement,
  onClick,
  isSelected = false,
}: EtablissementDocumentListItemProps) {
  const getStatusBadge = () => {
    switch (etablissement.statut) {
      case 'production':
        return <Badge variant="default" className="text-xs bg-green-500/10 text-green-600 border-green-200">Production</Badge>;
      case 'deploiement':
        return <Badge variant="default" className="text-xs bg-blue-500/10 text-blue-600 border-blue-200">Déploiement</Badge>;
      case 'contractuel':
        return <Badge variant="default" className="text-xs bg-amber-500/10 text-amber-600 border-amber-200">Contractuel</Badge>;
      case 'prospect':
        return <Badge variant="secondary" className="text-xs">Prospect</Badge>;
      default:
        return null;
    }
  };

  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
        "hover:bg-muted/50 border border-transparent hover:border-border",
        "group",
        isSelected && "bg-primary/5 border-primary/30"
      )}
      onClick={onClick}
    >
      {/* Avatar établissement */}
      <EntityAvatar 
        name={etablissement.nom}
        logoUrl={etablissement.logo_url}
        size="md"
      />

      {/* Infos principales */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">
            {etablissement.nom}
          </p>
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {etablissement.ville && (
            <span className="truncate">{etablissement.ville}</span>
          )}
          {etablissement.ville && etablissement.groupe_nom && (
            <span>•</span>
          )}
          {etablissement.groupe_nom && (
            <span className="truncate text-primary/70">
              {etablissement.groupe_nom}
            </span>
          )}
        </div>
      </div>

      {/* Compteur documents */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <FolderOpen className="w-4 h-4" />
          <span className="text-sm font-medium">
            {etablissement.document_count}
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}
