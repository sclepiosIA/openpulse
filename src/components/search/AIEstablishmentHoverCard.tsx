import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Building2, TrendingUp, Calendar, Target, MapPin, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  etablissementId: string;
  children: React.ReactNode;
}

const statusColors: Record<string, string> = {
  'Prospect': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Contractuel': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'En négociation': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Suspendu': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Refus': 'bg-gray-100 text-foreground dark:bg-gray-900/30 dark:text-muted-foreground',
  'Production': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Déploiement': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

interface EtablissementData {
  nom: string;
  ville: string | null;
  statut: string;
  progression: number | null;
  relationship_status: string | null;
  engagement_score: number | null;
  csm_principal: { nom: string; prenom: string } | null;
  nextTask: { id: string; titre: string; echeance: string | null; priorite: string } | null;
}

export function AIEstablishmentHoverCard({ etablissementId, children }: Props) {
  const { data: etablissement } = useQuery<EtablissementData | null>({
    queryKey: ['ai-etablissement-hover', etablissementId],
    queryFn: async (): Promise<EtablissementData | null> => {
      // Get establishment data
      const { data } = await supabase
        .from('etablissements')
        .select(`
          nom,
          ville,
          statut,
          progression,
          relationship_status,
          engagement_score
        `)
        .eq('id', etablissementId)
        .maybeSingle();

      if (!data) return null;

      // Get CSM separately to avoid deep type instantiation
      const { data: csmData } = await supabase
        .from('profiles')
        .select('nom, prenom')
        .eq('id', (data as any).csm_principal)
        .maybeSingle();

      // Get next task separately
      const { data: tasks } = await supabase
        .from('taches')
        .select('id, titre, echeance, priorite')
        .eq('etablissement_id', etablissementId)
        .eq('statut', 'A faire')
        .order('echeance', { ascending: true })
        .limit(1);

      const nextTask = tasks?.[0] || null;

      return {
        nom: data.nom,
        ville: data.ville,
        statut: data.statut,
        progression: data.progression,
        relationship_status: data.relationship_status,
        engagement_score: data.engagement_score,
        csm_principal: csmData,
        nextTask
      };
    },
    enabled: !!etablissementId,
    staleTime: 60000,
  });

  if (!etablissement) return <>{children}</>;

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-80" side="right" align="start">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold">{etablissement.nom}</h4>
              {etablissement.ville && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{etablissement.ville}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-wrap gap-2 items-center">
            <Badge className={statusColors[etablissement.statut as string] || 'bg-gray-100 text-foreground'}>
              {etablissement.statut}
            </Badge>
          </div>

          {/* CSM */}
          {etablissement.csm_principal && !Array.isArray(etablissement.csm_principal) && (
            <div className="flex items-center gap-2 text-xs">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">CSM:</span>
              <span className="font-medium">
                {(etablissement.csm_principal as { prenom?: string; nom?: string }).prenom} {(etablissement.csm_principal as { prenom?: string; nom?: string }).nom}
              </span>
            </div>
          )}

          {/* Progress */}
          {etablissement.progression !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-medium">{etablissement.progression}%</span>
              </div>
              <Progress value={etablissement.progression || 0} className="h-1.5" />
            </div>
          )}

          {/* Engagement */}
          {etablissement.engagement_score !== null && (
            <div className="flex items-center gap-2 text-xs">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Engagement:</span>
              <span className="font-medium">{etablissement.engagement_score}/100</span>
            </div>
          )}

          {/* Next task */}
          {etablissement.nextTask && (
            <div className="space-y-1 pt-2 border-t">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Target className="h-3 w-3" />
                <span>Prochaine étape:</span>
              </div>
              <p className="text-xs font-medium line-clamp-2">{etablissement.nextTask.titre}</p>
              {etablissement.nextTask.echeance && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Échéance: {format(new Date(etablissement.nextTask.echeance), 'dd MMM yyyy', { locale: fr })}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
