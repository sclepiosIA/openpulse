import { FolderOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

interface EtablissementDocumentFolderProps {
  etablissement: EtablissementWithDocuments;
  onClick: () => void;
  isSelected?: boolean;
}

export function EtablissementDocumentFolder({
  etablissement,
  onClick,
  isSelected = false,
}: EtablissementDocumentFolderProps) {
  // Badge de statut
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
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
        "group",
        isSelected && "border-primary ring-2 ring-primary/20"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex flex-col items-center text-center gap-3">
          {/* Icône dossier avec logo établissement */}
          <div className="relative">
            <div className="w-16 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-t-sm rounded-b-lg flex items-end justify-center pb-1 transition-colors group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50">
              <FolderOpen className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            {/* Avatar établissement en superposition (utilise logo_url avec fallback groupe) */}
            <div className="absolute -bottom-2 -right-2">
              <EntityAvatar 
                name={etablissement.nom}
                logoUrl={etablissement.logo_url}
                size="sm"
              />
            </div>
          </div>

          {/* Nom de l'établissement */}
          <div className="space-y-0.5 w-full">
            <p className="font-medium text-sm line-clamp-2 leading-tight">
              {etablissement.nom}
            </p>
            {/* Ville et groupe */}
            <p className="text-xs text-muted-foreground line-clamp-1">
              {etablissement.ville}
              {etablissement.ville && etablissement.groupe_nom && " • "}
              {etablissement.groupe_nom && (
                <span className="text-primary/70">{etablissement.groupe_nom}</span>
              )}
            </p>
          </div>

          {/* Badge statut et compteur */}
          <div className="flex flex-col items-center gap-2">
            {getStatusBadge()}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">
                {etablissement.document_count} document{etablissement.document_count > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
