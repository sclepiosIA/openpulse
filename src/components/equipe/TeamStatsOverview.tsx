import { Users, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { useTeamOverviewStats } from "@/hooks/hr/useTeamStats";
import { StatsCard } from "@/components/shared/StatsCard";
import { StatsSkeleton } from "@/components/shared/LoadingStates";

export function TeamStatsOverview() {
  const { data: stats, isLoading } = useTeamOverviewStats();

  if (isLoading) {
    return <StatsSkeleton count={4} />;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      <StatsCard
        title="Total équipe"
        value={stats?.totalMembers || 0}
        subtitle={`${stats?.activeMembers || 0} actifs`}
        icon={Users}
        color="text-primary"
        permission="canViewAllTeamMembers"
      />
      <StatsCard
        title="Taux de complétion"
        value={`${stats?.avgCompletionRate || 0}%`}
        subtitle={`${stats?.totalTasks || 0} tâches`}
        icon={TrendingUp}
        color="text-green-600"
        permission="canViewTeamStats"
      />
      <StatsCard
        title="Tâches en retard"
        value={stats?.tasksOverdueTotal || 0}
        subtitle="À traiter"
        icon={AlertTriangle}
        color="text-red-600"
      />
      <StatsCard
        title="Projets actifs"
        value={stats?.totalProjects || 0}
        subtitle="En cours"
        icon={CheckCircle}
        color="text-blue-600"
      />
    </div>
  );
}
