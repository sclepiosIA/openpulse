import { useTachesAllEtablissementsGroupe } from "@/hooks/tasks/useTachesGroupe";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Calendar, User, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface GroupeAllTasksViewProps {
  groupeId: string;
}

export function GroupeAllTasksView({ groupeId }: GroupeAllTasksViewProps) {
  const { data: tachesParEtablissement, isLoading } = useTachesAllEtablissementsGroupe(groupeId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!tachesParEtablissement || Object.keys(tachesParEtablissement).length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-semibold">Aucune tâche</p>
          <p className="text-muted-foreground">Les établissements du groupe n'ont pas encore de tâches</p>
        </CardContent>
      </Card>
    );
  }

  // Calculer les KPIs globaux
  const allTasks = Object.values(tachesParEtablissement).flat();
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.statut === 'Terminé').length;
  const inProgressTasks = allTasks.filter(t => t.statut === 'En cours').length;
  const todoTasks = allTasks.filter(t => t.statut === 'A faire').length;
  const overdueTasks = allTasks.filter(t => 
    t.date_echeance && new Date(t.date_echeance) < new Date() && t.statut !== 'Terminé'
  ).length;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0;

  const getStatutBadgeVariant = (statut: string) => {
    switch (statut) {
      case 'Terminé':
        return 'default';
      case 'En cours':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getPrioriteBadgeVariant = (priorite: string) => {
    switch (priorite) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getPrioriteLabel = (priorite: string) => {
    switch (priorite) {
      case 'high':
        return 'Haute';
      case 'medium':
        return 'Moyenne';
      case 'low':
        return 'Basse';
      default:
        return priorite;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPIs globaux */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total tâches</CardDescription>
            <CardTitle className="text-3xl">{totalTasks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>À faire</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">{todoTasks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>En cours</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{inProgressTasks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Terminées</CardDescription>
            <CardTitle className="text-3xl text-green-600">{completedTasks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Taux complétion</CardDescription>
            <CardTitle className="text-3xl">{completionRate}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {overdueTasks > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Tâches en retard</CardTitle>
            </div>
            <CardDescription>
              {overdueTasks} tâche{overdueTasks > 1 ? 's' : ''} en retard nécessite{overdueTasks > 1 ? 'nt' : ''} une attention
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Tâches par établissement */}
      <div className="space-y-6">
        {Object.entries(tachesParEtablissement).map(([etablissementId, taches]) => {
          if (!taches || taches.length === 0) return null;
          
          const etablissement = (taches[0] as any)?.etablissement;
          if (!etablissement) return null;

          const etabCompletedTasks = taches.filter(t => t.statut === 'Terminé').length;
          const etabCompletionRate = (etabCompletedTasks / taches.length * 100).toFixed(0);

          return (
            <Card key={etablissementId}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-xl">
                      <Link 
                        to={`/etablissements/${etablissement.id}`}
                        className="hover:underline flex items-center gap-2"
                      >
                        <Building2 className="h-5 w-5" />
                        {etablissement.nom}
                      </Link>
                    </CardTitle>
                    <CardDescription>{etablissement.ville}</CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Tâches</p>
                      <p className="text-2xl font-bold">{taches.length}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Complétion</p>
                      <p className="text-2xl font-bold">{etabCompletionRate}%</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {taches.map((tache: any) => (
                    <div
                      key={tache.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start gap-2 flex-wrap">
                          <h4 className="font-medium">{tache.titre}</h4>
                          <Badge variant={getStatutBadgeVariant(tache.statut)}>
                            {tache.statut}
                          </Badge>
                          <Badge variant={getPrioriteBadgeVariant(tache.priorite)}>
                            {getPrioriteLabel(tache.priorite)}
                          </Badge>
                        </div>
                        {tache.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {tache.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          {tache.echeance && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {format(new Date(tache.echeance), 'dd MMM yyyy', { locale: fr })}
                              </span>
                              {new Date(tache.echeance) < new Date() && tache.statut !== 'Terminé' && (
                                <Badge variant="destructive" className="text-xs ml-1">
                                  En retard
                                </Badge>
                              )}
                            </div>
                          )}
                          {tache.responsable && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>
                                {tache.responsable.prenom} {tache.responsable.nom}
                              </span>
                            </div>
                          )}
                          {tache.categorie && (
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                              style={{ borderColor: tache.categorie.couleur }}
                            >
                              {tache.categorie.nom}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
