import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Target,
  Calendar,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { getEtablissementStatusColor } from "@/config/emailStatusColors";

interface MobileEstablishmentCardProps {
  etablissement: any;
  onViewFiche?: () => void;
}

// Fonctions utilitaires pour les couleurs de santé
const getHealthColor = (value: number) => {
  if (value >= 70) return 'text-green-600 dark:text-green-400';
  if (value >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

const getHealthBgColor = (value: number) => {
  if (value >= 70) return 'bg-green-500';
  if (value >= 40) return 'bg-amber-500';
  return 'bg-red-500';
};

export function MobileEstablishmentCard({ etablissement, onViewFiche }: MobileEstablishmentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  const handleViewFiche = () => {
    if (onViewFiche) {
      onViewFiche();
    } else {
      navigate(`/etablissements/${etablissement.id}`);
    }
  };

  const initials = etablissement.nom
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const nextTask = etablissement.taches
    ?.filter((t: any) => t.statut === 'A faire' || t.statut === 'En cours')
    .sort((a: any, b: any) => {
      if (!a.echeance) return 1;
      if (!b.echeance) return -1;
      return new Date(a.echeance).getTime() - new Date(b.echeance).getTime();
    })[0];

  const activeTasks = etablissement.taches?.filter((t: any) => t.statut !== 'Terminé' && t.statut !== 'termine').length || 0;

  const isOverdue = nextTask?.echeance && new Date(nextTask.echeance) < new Date();
  const isUrgent = nextTask?.priorite === 'high' || nextTask?.priorite === 'Haute';

  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      {/* Header avec gradient - toujours visible */}
      <div 
        className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3 flex items-center gap-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Avatar className="h-11 w-11 flex-shrink-0 border-2 border-background shadow-sm">
          {etablissement.logo_url ? (
            <AvatarImage src={etablissement.logo_url} alt={etablissement.nom} />
          ) : null}
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{etablissement.nom}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
              {etablissement.type}
            </Badge>
            <Badge className={`text-[10px] h-4 px-1.5 ${getEtablissementStatusColor(etablissement.statut)}`}>
              {etablissement.statut}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button 
            variant="default" 
            size="sm"
            className="h-8 text-xs px-2.5"
            onClick={(e) => {
              e.stopPropagation();
              handleViewFiche();
            }}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Fiche
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Précédent">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Détails expandables */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
          {/* Métriques en grille 2 colonnes */}
          <div className="grid grid-cols-2 gap-2">
            {/* Progression avec couleur */}
            {etablissement.progression !== null && (
              <div className="bg-muted/30 rounded-lg p-2.5">
                <div className="flex items-center justify-between text-[10px] mb-1.5">
                  <span className="text-muted-foreground font-medium">Progression</span>
                  <span className={`font-bold ${getHealthColor(etablissement.progression || 0)}`}>
                    {etablissement.progression}%
                  </span>
                </div>
                <Progress value={etablissement.progression || 0} className="h-1.5" />
              </div>
            )}

            {/* Engagement avec barre segmentée */}
            {etablissement.engagement_score !== null && (
              <div className="bg-muted/30 rounded-lg p-2.5">
                <div className="flex items-center justify-between text-[10px] mb-1.5">
                  <span className="text-muted-foreground font-medium">Engagement</span>
                  <div className="flex items-center gap-0.5">
                    <TrendingUp className={`h-3 w-3 ${getHealthColor(etablissement.engagement_score || 0)}`} />
                    <span className={`font-bold ${getHealthColor(etablissement.engagement_score || 0)}`}>
                      {etablissement.engagement_score}
                    </span>
                  </div>
                </div>
                {/* Mini barre segmentée */}
                <div className="flex gap-0.5">
                  {[...Array(10)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-1.5 flex-1 rounded-sm ${
                        i < (etablissement.engagement_score || 0) / 10 
                          ? getHealthBgColor(etablissement.engagement_score || 0) 
                          : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tâches actives */}
          {activeTasks > 0 && (
            <div className="flex items-center gap-2 text-xs bg-muted/30 rounded-lg px-2.5 py-2">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Tâches en cours:</span>
              <Badge variant="secondary" className="h-5 text-xs">{activeTasks}</Badge>
            </div>
          )}

          {/* Prochaine étape mise en avant */}
          {nextTask && (
            <div className={`rounded-lg p-2.5 border ${
              isOverdue 
                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' 
                : isUrgent
                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                  : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
            }`}>
              <div className="flex items-start gap-2">
                <Target className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                  isOverdue 
                    ? 'text-red-600 dark:text-red-400' 
                    : isUrgent
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-blue-600 dark:text-blue-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] font-semibold ${
                    isOverdue 
                      ? 'text-red-700 dark:text-red-400' 
                      : isUrgent
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-blue-700 dark:text-blue-400'
                  }`}>
                    {isOverdue ? 'En retard' : 'Prochaine étape'}
                  </p>
                  <p className="text-xs font-medium line-clamp-1 mt-0.5">{nextTask.titre}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {nextTask.echeance && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Calendar className="h-3 w-3" />
                        {new Date(nextTask.echeance).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                    )}
                    {(isUrgent || isOverdue) && (
                      <Badge variant="destructive" className="h-4 text-[9px] px-1">
                        {isOverdue ? 'Retard' : 'Urgent'}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Région/Ville */}
          {(etablissement.ville || etablissement.region) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{[etablissement.ville, etablissement.region].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
