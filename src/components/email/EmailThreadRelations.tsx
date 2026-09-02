import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  TrendingUp,
  Target,
  Calendar,
  Building2,
  Users,
  UserCheck,
  ExternalLink,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { EmailEtablissementBadge } from "./EmailEtablissementBadge";
import { PartenaireBadge } from "@/components/ui/partenaire-badge";
import { TaskQuickAddDialog } from "./TaskQuickAddDialog";
import { useNavigate } from "react-router-dom";
import { getEtablissementStatusColor } from "@/config/emailStatusColors";

interface EmailThreadRelationsProps {
  thread: any;
  groupeInfo: any;
  etablissementsGroupe: any[];
  onQuickClassify: (type: "etablissement" | "partenaire" | "groupe") => void;
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

export function EmailThreadRelations({
  thread,
  groupeInfo,
  etablissementsGroupe,
  onQuickClassify
}: EmailThreadRelationsProps) {
  const navigate = useNavigate();

  // Calculer les initiales pour l'avatar
  const getInitials = (nom: string) => {
    return nom
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Trouver la prochaine tâche urgente
  const getNextTask = (taches: any[]) => {
    if (!taches || taches.length === 0) return null;
    return taches
      .filter((t: any) => t.statut !== 'Terminé' && t.statut !== 'termine')
      .sort((a: any, b: any) => {
        if (!a.echeance) return 1;
        if (!b.echeance) return -1;
        return new Date(a.echeance).getTime() - new Date(b.echeance).getTime();
      })[0];
  };

  return (
    <div className="space-y-6">
      {/* Établissement associé */}
      {thread.etablissement ? (
        <Card className="overflow-hidden border-0 shadow-md">
          {/* Header avec gradient et avatar */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                  {thread.etablissement.logo_url ? (
                    <AvatarImage src={thread.etablissement.logo_url} alt={thread.etablissement.nom} />
                  ) : null}
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                    {getInitials(thread.etablissement.nom)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h3 className="font-semibold text-base truncate">{thread.etablissement.nom}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {thread.etablissement.ville}
                    </span>
                    <Badge className={`${getEtablissementStatusColor(thread.etablissement.statut)} h-5 text-xs`}>
                      {thread.etablissement.statut}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => navigate(`/etablissement/${thread.etablissement.id}`)}
                className="shrink-0"
              >
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Fiche complète
              </Button>
            </div>
          </div>

          {/* Métriques en grille */}
          <div className="p-4 grid grid-cols-2 gap-3">
            {/* Progression avec couleur */}
            {thread.etablissement.progression !== null && (
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground font-medium">Progression</span>
                  <span className={`font-bold ${getHealthColor(thread.etablissement.progression)}`}>
                    {thread.etablissement.progression}%
                  </span>
                </div>
                <Progress value={thread.etablissement.progression} className="h-2" />
              </div>
            )}

            {/* Engagement avec barre segmentée */}
            {thread.etablissement.engagement_score !== null && (
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground font-medium">Engagement</span>
                  <div className="flex items-center gap-1">
                    <TrendingUp className={`h-3 w-3 ${getHealthColor(thread.etablissement.engagement_score)}`} />
                    <span className={`font-bold ${getHealthColor(thread.etablissement.engagement_score)}`}>
                      {thread.etablissement.engagement_score}/100
                    </span>
                  </div>
                </div>
                {/* Mini barre segmentée */}
                <div className="flex gap-0.5">
                  {[...Array(10)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-1.5 flex-1 rounded-sm transition-colors ${
                        i < (thread.etablissement.engagement_score || 0) / 10 
                          ? getHealthBgColor(thread.etablissement.engagement_score) 
                          : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Prochaine étape mise en avant */}
          {(() => {
            const nextTask = getNextTask(thread.etablissement.taches);
            if (!nextTask) return null;
            
            const isOverdue = nextTask.echeance && new Date(nextTask.echeance) < new Date();
            const isUrgent = nextTask.priorite === 'high' || nextTask.priorite === 'Haute';
            
            return (
              <div className={`mx-4 mb-4 rounded-lg p-3 border ${
                isOverdue 
                  ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' 
                  : isUrgent
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                    : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
              }`}>
                <div className="flex items-start gap-2">
                  <Target className={`h-4 w-4 mt-0.5 shrink-0 ${
                    isOverdue 
                      ? 'text-red-600 dark:text-red-400' 
                      : isUrgent
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-blue-600 dark:text-blue-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${
                      isOverdue 
                        ? 'text-red-700 dark:text-red-400' 
                        : isUrgent
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-blue-700 dark:text-blue-400'
                    }`}>
                      {isOverdue ? 'En retard' : 'Prochaine étape'}
                    </p>
                    <p className="text-sm font-medium mt-0.5 line-clamp-1">{nextTask.titre}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {nextTask.echeance && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(nextTask.echeance).toLocaleDateString('fr-FR', { 
                            day: 'numeric', 
                            month: 'short' 
                          })}
                        </span>
                      )}
                      {(isUrgent || isOverdue) && (
                        <Badge variant="destructive" className="h-4 text-[10px] px-1.5">
                          {isOverdue ? 'Retard' : 'Urgent'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Autres tâches (si plusieurs) */}
          {thread.etablissement.taches && thread.etablissement.taches.length > 1 && (
            <div className="px-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Autres tâches en cours
                </span>
                <Badge variant="secondary" className="h-5 text-xs">
                  {thread.etablissement.taches.filter((t: any) => t.statut !== 'Terminé' && t.statut !== 'termine').length}
                </Badge>
              </div>
            </div>
          )}

          {/* Actions rapides */}
          <div className="px-4 pb-4 flex gap-2 border-t border-border/50 pt-3">
            <TaskQuickAddDialog
              etablissementId={thread.etablissement.id}
              etablissementNom={thread.etablissement.nom}
            />
            <Button 
              variant="ghost" 
              size="sm"
              className="h-8"
              onClick={() => {
                // Ouvrir le composeur d'email si disponible
              }}
            >
              <Mail className="h-4 w-4" />
            </Button>
            {thread.etablissement.telephone && (
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8"
                onClick={() => window.open(`tel:${thread.etablissement.telephone}`, '_self')}
              >
                <Phone className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>
      ) : thread.partenaire ? (
        <Card className="overflow-hidden border-0 shadow-md">
          <div className="bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-purple-500" />
                </div>
                <h3 className="font-semibold">Partenaire</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/partenaires/${thread.partenaire.id}`)}
              >
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Voir la fiche
              </Button>
            </div>

            <PartenaireBadge 
              type={thread.partenaire.type_partenaire}
              nom={thread.partenaire.nom}
              ville={thread.partenaire.ville}
              partenaireId={thread.partenaire.id}
            />
          </div>
        </Card>
      ) : (
        <Card className="p-5 border-dashed">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-muted-foreground">Aucune association</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Cet email n'est pas encore associé à un établissement, groupe ou partenaire.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onQuickClassify("etablissement")}
            >
              <Building2 className="h-4 w-4 mr-2" />
              Associer à un établissement
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onQuickClassify("partenaire")}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Associer à un partenaire
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onQuickClassify("groupe")}
            >
              <Users className="h-4 w-4 mr-2" />
              Associer à un groupe
            </Button>
          </div>
        </Card>
      )}

      {/* Groupe information */}
      {groupeInfo?.hasMultipleEtablissementsInGroupe && etablissementsGroupe && (
        <Card className="p-5 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold">Groupe détecté</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Plusieurs établissements d'un même groupe participent à cette conversation
          </p>
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Établissements concernés :</h4>
            <div className="space-y-1">
              {etablissementsGroupe.map((etab: any) => (
                <EmailEtablissementBadge 
                  key={etab.id} 
                  etablissementId={etab.id}
                  etablissementNom={etab.nom}
                  etablissementVille={etab.ville}
                />
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
