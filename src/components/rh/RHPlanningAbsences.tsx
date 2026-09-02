import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRHAbsences } from "@/hooks/hr/useRHAbsences";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Type strict pour les variantes de Badge
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export function RHPlanningAbsences() {
  const { absences, isLoading } = useRHAbsences();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Planning des absences</CardTitle>
          <CardDescription>Congés et absences de l'équipe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={`rh-absences-skeleton-${i}`} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (statut: string) => {
    const variants: Record<string, BadgeVariant> = {
      'En attente': 'default',
      'Validé': 'default',
      'Refusé': 'destructive',
    };
    return <Badge variant={variants[statut] || 'default'}>{statut}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      'Congés payés': 'bg-blue-500',
      'Congé maladie': 'bg-red-500',
      'RTT': 'bg-green-500',
      'Formation': 'bg-purple-500',
      'Autre': 'bg-gray-500',
    };
    return (
      <Badge className={colors[type] || 'bg-gray-500'}>
        {type}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planning des absences</CardTitle>
        <CardDescription>Congés et absences de l'équipe</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {absences && absences.length > 0 ? (
            absences.map((absence) => (
              <div key={absence.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {absence.profiles?.prenom} {absence.profiles?.nom}
                    </p>
                    {getTypeBadge(absence.type_absence)}
                    {getStatusBadge(absence.statut)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Du {format(new Date(absence.date_debut), 'dd MMM yyyy', { locale: fr })} au {format(new Date(absence.date_fin), 'dd MMM yyyy', { locale: fr })}
                  </p>
                  {absence.motif && (
                    <p className="text-sm text-muted-foreground italic">
                      {absence.motif}
                    </p>
                  )}
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {Math.ceil((new Date(absence.date_fin).getTime() - new Date(absence.date_debut).getTime()) / (1000 * 60 * 60 * 24)) + 1} jour(s)
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground">
              Aucune absence enregistrée
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
