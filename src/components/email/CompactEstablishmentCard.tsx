import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EntityAvatar } from "@/components/ui/EntityAvatar";
import { TrendingUp, Target, Calendar, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getEtablissementStatusColor } from "@/config/emailStatusColors";

interface CompactEstablishmentCardProps {
  etablissement: {
    id: string;
    nom: string;
    ville?: string;
    region?: string;
    type?: string;
    statut?: string;
    progression?: number | null;
    engagement_score?: number | null;
    taches?: Array<{
      id: string;
      titre: string;
      statut: string;
      echeance?: string;
      priorite?: string;
    }>;
  };
  className?: string;
  onQuickClassify?: () => void;
}

export function CompactEstablishmentCard({ 
  etablissement, 
  className,
  onQuickClassify 
}: CompactEstablishmentCardProps) {
  const navigate = useNavigate();
  
  const activeTasks = etablissement.taches?.filter((t) => t.statut !== 'Terminé').length || 0;
  const nextTask = etablissement.taches
    ?.filter((t) => t.statut === 'A faire')
    .sort((a, b) => new Date(a.echeance || '').getTime() - new Date(b.echeance || '').getTime())[0];

  // Engagement color based on score
  const getEngagementColor = (score: number | null | undefined) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 70) return 'text-green-600 dark:text-green-400';
    if (score >= 40) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <Card className={cn(
      "bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border-primary/20 overflow-hidden",
      className
    )}>
      <div className="p-3 space-y-2.5">
        {/* Header: Avatar + Name + Type/Status + Button */}
        <div className="flex items-start gap-2.5">
          <EntityAvatar 
            name={etablissement.nom} 
            size="sm"
            className="shrink-0 mt-0.5"
          />
          
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate leading-tight">
              {etablissement.nom}
            </p>
            {etablissement.ville && (
              <p className="text-xs text-muted-foreground truncate">
                {etablissement.ville}{etablissement.region && ` • ${etablissement.region}`}
              </p>
            )}
          </div>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate(`/etablissements/${etablissement.id}`)}
            className="h-7 px-2 text-xs shrink-0"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Fiche
          </Button>
        </div>

        {/* Badges: Type + Status */}
        <div className="flex flex-wrap gap-1">
          {etablissement.type && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
              {etablissement.type}
            </Badge>
          )}
          {etablissement.statut && (
            <Badge className={cn("text-[10px] h-5 px-1.5", getEtablissementStatusColor(etablissement.statut))}>
              {etablissement.statut}
            </Badge>
          )}
        </div>

        {/* Metrics: Progression + Engagement + Tasks on one row */}
        <div className="flex items-center gap-3">
          {/* Progression */}
          {etablissement.progression !== null && etablissement.progression !== undefined && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-medium">{etablissement.progression}%</span>
              </div>
              <Progress value={etablissement.progression} className="h-1.5" />
            </div>
          )}
          
          {/* Engagement */}
          {etablissement.engagement_score !== null && etablissement.engagement_score !== undefined && (
            <div className="flex items-center gap-1 text-xs shrink-0">
              <TrendingUp className={cn("h-3 w-3", getEngagementColor(etablissement.engagement_score))} />
              <span className={cn("font-medium", getEngagementColor(etablissement.engagement_score))}>
                {etablissement.engagement_score}
              </span>
            </div>
          )}
          
          {/* Active tasks */}
          <div className="flex items-center gap-1 text-xs shrink-0">
            <Target className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{activeTasks}</span>
          </div>
        </div>

        {/* Next task - compact version */}
        {nextTask && (
          <div className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5 -mx-0.5">
            <span className="text-muted-foreground shrink-0">Prochaine:</span>
            <span className="font-medium truncate flex-1">{nextTask.titre}</span>
            {nextTask.echeance && (
              <span className="text-muted-foreground shrink-0 flex items-center gap-0.5">
                <Calendar className="h-2.5 w-2.5" />
                {new Date(nextTask.echeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
