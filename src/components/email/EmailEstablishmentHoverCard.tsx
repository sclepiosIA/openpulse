import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Building2, TrendingUp, Calendar, Target } from "lucide-react";
import { useEmailEstablishmentPreview } from "@/hooks/email/useEmailEstablishmentPreview";

interface Props {
  etablissementId: string;
  children: React.ReactNode;
}

const statusColors = {
  'Prospect': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Contractuel': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'En négociation': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Suspendu': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Refus': 'bg-gray-100 text-foreground dark:bg-gray-900/30 dark:text-muted-foreground',
  'Production': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

export function EmailEstablishmentHoverCard({ etablissementId, children }: Props) {
  const { data: etablissement } = useEmailEstablishmentPreview(etablissementId);

  if (!etablissement) return <>{children}</>;

  const nextTask = etablissement.taches?.[0];

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-80" side="right" align="start">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground mt-1" />
            <div className="flex-1">
              <h4 className="font-semibold">{etablissement.nom}</h4>
              <p className="text-sm text-muted-foreground">{etablissement.ville}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Statut:</span>
            <Badge className={statusColors[etablissement.statut as keyof typeof statusColors]}>
              {etablissement.statut}
            </Badge>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-medium">{etablissement.progression}%</span>
            </div>
            <Progress value={etablissement.progression || 0} className="h-2" />
          </div>

          {etablissement.engagement_score !== null && (
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Engagement:</span>
              <span className="text-sm font-medium">{etablissement.engagement_score}/100</span>
            </div>
          )}

          {nextTask && (
            <div className="space-y-1 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                <span>Prochaine étape:</span>
              </div>
              <p className="text-sm font-medium">{nextTask.titre}</p>
              {nextTask.echeance && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Échéance: {new Date(nextTask.echeance).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
