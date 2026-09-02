import { Users, DollarSign, TrendingUp, Calendar, CheckCircle, AlertTriangle } from "lucide-react";
import { useRHKPIs } from "@/hooks/hr/useRHKPIs";
import { useTeamOverviewStats } from "@/hooks/hr/useTeamStats";
import { StatsCard } from "@/components/shared/StatsCard";
import { StatsSkeleton } from "@/components/shared/LoadingStates";
import { useRolePermissions } from "@/hooks/auth/useRolePermissions";

interface PeopleOverviewProps {
  context: 'rh' | 'equipe';
}

export function PeopleOverview({ context }: PeopleOverviewProps) {
  const permissions = useRolePermissions();
  const { data: rhKpis, isLoading: rhLoading } = useRHKPIs();
  const { data: teamStats, isLoading: teamLoading } = useTeamOverviewStats();

  const isLoading = rhLoading || teamLoading;

  if (isLoading) {
    return <StatsSkeleton count={4} />;
  }

  // Afficher les stats selon le contexte et les permissions
  if (context === 'rh' || permissions.canViewSalaries) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatsCard
          title="Effectif actif"
          value={rhKpis?.effectif_actif || 0}
          subtitle={`Sur ${rhKpis?.effectif_total || 0} employés`}
          icon={Users}
          accentColor="blue"
          iconVariant="gradient"
        />
        
        <StatsCard
          title="Masse salariale nette"
          value={new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(rhKpis?.masse_salariale_nette_mensuelle || 0)}
          subtitle={`${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(rhKpis?.masse_salariale_nette_annuelle || 0)} /an`}
          icon={DollarSign}
          accentColor="green"
          permission="canViewSalaries"
        />

        <StatsCard
          title="Masse salariale brute"
          value={new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(rhKpis?.masse_salariale_brute_mensuelle || 0)}
          subtitle={`${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(rhKpis?.masse_salariale_brute_annuelle || 0)} /an`}
          icon={DollarSign}
          accentColor="cyan"
          permission="canViewSalaries"
        />

        <StatsCard
          title="Coût employeur"
          value={new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(rhKpis?.masse_salariale_mensuelle || 0)}
          subtitle={`${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(rhKpis?.masse_salariale_annuelle || 0)} /an`}
          icon={DollarSign}
          accentColor="purple"
          permission="canViewSalaries"
        />
        
        <StatsCard
          title="Absentéisme"
          value={`${rhKpis?.taux_absenteisme?.toFixed(1) || 0}%`}
          subtitle="Taux mensuel"
          icon={Calendar}
          accentColor="orange"
          permission="canViewAllAbsences"
        />
      </div>
    );
  }

  // Vue équipe seulement
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      <StatsCard
        title="Total équipe"
        value={teamStats?.totalMembers || 0}
        subtitle={`${teamStats?.activeMembers || 0} actifs`}
        icon={Users}
        accentColor="blue"
        permission="canViewAllTeamMembers"
      />
      <StatsCard
        title="Taux de complétion"
        value={`${teamStats?.avgCompletionRate || 0}%`}
        subtitle={`${teamStats?.totalTasks || 0} tâches`}
        icon={TrendingUp}
        accentColor="green"
        permission="canViewTeamStats"
      />
      <StatsCard
        title="Tâches en retard"
        value={teamStats?.tasksOverdueTotal || 0}
        subtitle="À traiter"
        icon={AlertTriangle}
        accentColor="red"
      />
      <StatsCard
        title="Projets actifs"
        value={teamStats?.totalProjects || 0}
        subtitle="En cours"
        icon={CheckCircle}
        accentColor="cyan"
      />
    </div>
  );
}
