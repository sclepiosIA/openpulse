import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Calendar, CheckCircle2, Bell, FileText } from "lucide-react";
import { useContratAlertes, useTraiterAlerte } from "@/hooks/contracts/useContrats";
import { format, differenceInDays, isPast } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const ALERTE_TYPE_ICONS: Record<string, React.ReactNode> = {
  renouvellement: <Bell className="h-4 w-4" />,
  echeance: <Calendar className="h-4 w-4" />,
  preavis: <AlertTriangle className="h-4 w-4" />,
  custom: <FileText className="h-4 w-4" />,
};

const ALERTE_TYPE_COLORS: Record<string, string> = {
  renouvellement: "bg-blue-100 text-blue-700",
  echeance: "bg-orange-100 text-orange-700",
  preavis: "bg-amber-100 text-amber-700",
  custom: "bg-gray-100 text-foreground",
};

export default function ContratsAlertes() {
  const [showTraitees, setShowTraitees] = useState(false);
  const { data: alertes, isLoading } = useContratAlertes({ nonTraiteesOnly: !showTraitees });
  const { mutate: traiterAlerte, isPending } = useTraiterAlerte();

  const alertesGroupees = {
    passees: alertes?.filter(a => !a.est_traitee && isPast(new Date(a.date_alerte))) || [],
    prochaines7j: alertes?.filter(a => {
      if (a.est_traitee) return false;
      const days = differenceInDays(new Date(a.date_alerte), new Date());
      return days >= 0 && days <= 7;
    }) || [],
    prochaines30j: alertes?.filter(a => {
      if (a.est_traitee) return false;
      const days = differenceInDays(new Date(a.date_alerte), new Date());
      return days > 7 && days <= 30;
    }) || [],
    futures: alertes?.filter(a => {
      if (a.est_traitee) return false;
      const days = differenceInDays(new Date(a.date_alerte), new Date());
      return days > 30;
    }) || [],
    traitees: alertes?.filter(a => a.est_traitee) || [],
  };

  const renderAlerte = (alerte: any) => {
    const daysUntil = differenceInDays(new Date(alerte.date_alerte), new Date());
    const isOverdue = daysUntil < 0;
    const isUrgent = daysUntil >= 0 && daysUntil <= 7;

    return (
      <div
        key={alerte.id}
        className={cn(
          "flex items-start gap-4 p-4 rounded-lg border transition-colors",
          alerte.est_traitee && "bg-muted/50 opacity-60",
          isOverdue && !alerte.est_traitee && "border-red-200 bg-red-50",
          isUrgent && !alerte.est_traitee && "border-orange-200 bg-orange-50"
        )}
      >
        <div className={cn(
          "p-2 rounded-full",
          ALERTE_TYPE_COLORS[alerte.type] || ALERTE_TYPE_COLORS.custom
        )}>
          {ALERTE_TYPE_ICONS[alerte.type] || ALERTE_TYPE_ICONS.custom}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-medium">{alerte.titre}</h4>
              {alerte.description && (
                <p className="text-sm text-muted-foreground mt-1">{alerte.description}</p>
              )}
              {alerte.contrat && (
                <p className="text-xs text-muted-foreground mt-2">
                  Contrat : {alerte.contrat.numero} - {alerte.contrat.client_nom}
                </p>
              )}
            </div>
            <Badge className={ALERTE_TYPE_COLORS[alerte.type] || ALERTE_TYPE_COLORS.custom}>
              {alerte.type}
            </Badge>
          </div>

          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(new Date(alerte.date_alerte), 'dd MMMM yyyy', { locale: fr })}</span>
              {!alerte.est_traitee && (
                <Badge variant={isOverdue ? "destructive" : isUrgent ? "secondary" : "outline"}>
                  {isOverdue ? `En retard de ${Math.abs(daysUntil)}j` : `J-${daysUntil}`}
                </Badge>
              )}
            </div>

            {alerte.date_echeance && (
              <div className="text-xs text-muted-foreground">
                Échéance : {format(new Date(alerte.date_echeance), 'dd/MM/yyyy', { locale: fr })}
              </div>
            )}
          </div>
        </div>

        {!alerte.est_traitee && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => traiterAlerte(alerte.id)}
            disabled={isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Traiter
          </Button>
        )}
      </div>
    );
  };

  const renderSection = (title: string, alertes: any[], variant: 'danger' | 'warning' | 'info' | 'muted' = 'info') => {
    if (alertes.length === 0) return null;

    const colors = {
      danger: 'border-l-red-500',
      warning: 'border-l-orange-500',
      info: 'border-l-blue-500',
      muted: 'border-l-gray-300',
    };

    return (
      <div className={cn("border-l-4 pl-4", colors[variant])}>
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          {title}
          <Badge variant="secondary">{alertes.length}</Badge>
        </h3>
        <div className="space-y-3">
          {alertes.map(renderAlerte)}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alertes et échéances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={`contrats-alertes-skeleton-${i}`} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const totalNonTraitees = 
    alertesGroupees.passees.length + 
    alertesGroupees.prochaines7j.length + 
    alertesGroupees.prochaines30j.length + 
    alertesGroupees.futures.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Alertes et échéances
            {totalNonTraitees > 0 && (
              <Badge variant="destructive">{totalNonTraitees}</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Checkbox
              id="showTraitees"
              checked={showTraitees}
              onCheckedChange={(checked) => setShowTraitees(checked as boolean)}
            />
            <label htmlFor="showTraitees" className="text-sm cursor-pointer">
              Afficher les alertes traitées
            </label>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {totalNonTraitees === 0 && !showTraitees ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium">Aucune alerte en attente</p>
            <p className="text-sm text-muted-foreground">
              Toutes vos alertes contrats sont traitées
            </p>
          </div>
        ) : (
          <>
            {renderSection("⚠️ En retard", alertesGroupees.passees, 'danger')}
            {renderSection("🔴 Cette semaine", alertesGroupees.prochaines7j, 'warning')}
            {renderSection("🟠 Ce mois", alertesGroupees.prochaines30j, 'info')}
            {renderSection("🟢 À venir", alertesGroupees.futures, 'info')}
            {showTraitees && renderSection("✅ Traitées", alertesGroupees.traitees, 'muted')}
          </>
        )}
      </CardContent>
    </Card>
  );
}
