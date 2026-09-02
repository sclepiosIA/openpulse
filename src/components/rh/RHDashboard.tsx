import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRHKPIs } from "@/hooks/hr/useRHKPIs";
import { Users, DollarSign, Calendar } from "lucide-react";
import { RHTresorerieWidget } from "./RHTresorerieWidget";
import { RHReconciliation } from "./RHReconciliation";
import { StatsCard } from "@/components/shared/StatsCard";
import { StatsSkeleton } from "@/components/shared/LoadingStates";

export function RHDashboard() {
  const { data: kpis, isLoading } = useRHKPIs();

  if (isLoading) {
    return <StatsSkeleton count={4} />;
  }

  if (!kpis || (kpis.effectif_actif === 0 && kpis.masse_salariale_mensuelle === 0)) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground text-lg font-medium">
              Aucune donnée RH disponible pour le moment
            </p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Pour commencer, uploadez un bulletin de paie dans l'onglet <strong>Fiches employés</strong>. 
              Le système analysera automatiquement le document et créera les données salariales.
            </p>
            <div className="pt-4">
              <Button 
                variant="outline"
                onClick={() => { 
                  const tabTrigger = document.querySelector('[data-value="fiches"]') as HTMLButtonElement;
                  tabTrigger?.click();
                }}
              >
                Aller aux fiches employés
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Effectif actif"
          value={kpis?.effectif_actif || 0}
          subtitle={`Sur ${kpis?.effectif_total || 0} employés`}
          icon={Users}
          accentColor="blue"
          iconVariant="gradient"
        />
        
        <StatsCard
          title="Masse salariale nette"
          value={new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(kpis?.masse_salariale_nette_mensuelle || 0)}
          subtitle={`${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(kpis?.masse_salariale_nette_annuelle || 0)} /an`}
          icon={DollarSign}
          accentColor="green"
          permission="canViewSalaries"
        />

        <StatsCard
          title="Masse salariale brute"
          value={new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(kpis?.masse_salariale_brute_mensuelle || 0)}
          subtitle={`${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(kpis?.masse_salariale_brute_annuelle || 0)} /an`}
          icon={DollarSign}
          accentColor="cyan"
          permission="canViewSalaries"
        />
        
        <StatsCard
          title="Absentéisme"
          value={`${kpis?.taux_absenteisme?.toFixed(1) || 0}%`}
          subtitle="Taux mensuel"
          icon={Calendar}
          accentColor="orange"
          permission="canViewAllAbsences"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <RHTresorerieWidget />
        <RHReconciliation />
      </div>
    </div>
  );
}
