import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Mail, MapPin, Calendar } from "lucide-react";
import { Partenaire } from "@/hooks/crm/usePartenaires";
import { PartenaireBadge } from "@/components/ui/partenaire-badge";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EntityAvatar } from "@/components/ui/EntityAvatar";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PartenairesListViewProps {
  partenaires: Partenaire[];
  selectedIds: string[];
  onSelectOne: (id: string) => void;
}

export function PartenairesListView({ partenaires, selectedIds, onSelectOne }: PartenairesListViewProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-1">
      {partenaires.map((partenaire) => {
        const isSelected = selectedIds.includes(partenaire.id);
        const isActionPassed = partenaire.prochaine_action && new Date(partenaire.prochaine_action) < new Date();

        return (
          <div
            key={partenaire.id}
            className={cn(
              "flex items-center gap-4 p-3 rounded-md border hover:bg-muted/50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected && "bg-muted border-primary"
            )}
            onClick={() => navigate(`/partenaires/${partenaire.id}`)}
            role="button"
            tabIndex={0}
            aria-label={`Ouvrir la fiche partenaire ${partenaire.nom}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(`/partenaires/${partenaire.id}`);
              }
            }}
          >
            {/* Checkbox */}
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelectOne(partenaire.id)}
                aria-label={`Sélectionner ${partenaire.nom}`}
              />
            </div>

            {/* Logo + Nom + Badge type */}
            <div className="flex items-center gap-3 min-w-[200px] flex-1">
              <EntityAvatar 
                name={partenaire.nom} 
                logoUrl={partenaire.logo_url} 
                size="sm"
              />
              <span className="font-medium truncate">{partenaire.nom}</span>
              <PartenaireBadge
                type={partenaire.type_partenaire}
                nom=""
                partenaireId={partenaire.id}
                size="sm"
                showLink={false}
              />
            </div>

            {/* Statut */}
            <Badge 
              variant={
                partenaire.statut_relation === 'actif' ? 'default' :
                partenaire.statut_relation === 'prospect' ? 'secondary' :
                partenaire.statut_relation === 'termine' ? 'destructive' : 'outline'
              }
              className="shrink-0"
            >
              {partenaire.statut_relation}
            </Badge>

            {/* Ville */}
            {partenaire.ville && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-[150px]">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{partenaire.ville}</span>
              </div>
            )}

            {/* Responsable */}
            {partenaire.responsable && (
              <div className="flex items-center gap-2 min-w-[140px]">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {partenaire.responsable.prenom[0]}{partenaire.responsable.nom[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground truncate">
                  {partenaire.responsable.prenom} {partenaire.responsable.nom}
                </span>
              </div>
            )}

            {/* Dernier contact */}
            {partenaire.dernier_contact && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[120px]">
                <Calendar className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {formatDistanceToNow(new Date(partenaire.dernier_contact), { addSuffix: true, locale: fr })}
                </span>
              </div>
            )}

            {/* Score engagement */}
            {partenaire.engagement_score > 0 && (
              <div className="flex items-center gap-2 min-w-[100px]">
                <div className="flex-1 bg-muted rounded-full h-1.5 max-w-[60px]">
                  <div 
                    className="bg-primary h-1.5 rounded-full" 
                    style={{ width: `${partenaire.engagement_score}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {partenaire.engagement_score}%
                </span>
              </div>
            )}

            {/* Actions */}
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Plus d'options">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(`/partenaires/${partenaire.id}`)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Voir
                  </DropdownMenuItem>
                  {partenaire.email && (
                    <DropdownMenuItem onClick={() => window.location.href = `mailto:${partenaire.email}`}>
                      <Mail className="mr-2 h-4 w-4" />
                      Email
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}

      {partenaires.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border rounded-md">
          Aucun partenaire à afficher
        </div>
      )}
    </div>
  );
}