import { TeamFilters } from "@/hooks/hr/useTeamFilters";
import { TeamMemberStats } from "@/hooks/hr/useTeamStats";
import type { ProfileWithRole } from "@/hooks/profile/useProfilesWithRoles";

export function applyTeamFilters<T extends ProfileWithRole>(
  profiles: T[],
  filters: TeamFilters,
  stats: Record<string, TeamMemberStats>
): T[] {
  let filtered = [...profiles];

  // Filtre de recherche
  if (filters.search) {
    const search = filters.search.toLowerCase();
    filtered = filtered.filter(
      p =>
        p.prenom.toLowerCase().includes(search) ||
        p.nom.toLowerCase().includes(search) ||
        p.email.toLowerCase().includes(search) ||
        (p.fonction && p.fonction.toLowerCase().includes(search))
    );
  }

  // Filtre par rôle
  if (filters.role !== 'all') {
    filtered = filtered.filter(p => p.role === filters.role);
  }

  // Filtre par statut
  if (filters.status !== 'all') {
    const isActive = filters.status === 'actif';
    filtered = filtered.filter(p => p.actif === isActive);
  }

  // Filtre par charge de travail
  if (filters.workload !== 'all') {
    filtered = filtered.filter(p => {
      const profileStats = stats[p.id];
      if (!profileStats) return false;

      const workload = profileStats.workload || '0';
      const workloadNum = typeof workload === 'string' ? parseFloat(workload) : workload;
      
      if (filters.workload === 'low') return workloadNum < 50;
      if (filters.workload === 'medium') return workloadNum >= 50 && workloadNum < 80;
      if (filters.workload === 'high') return workloadNum >= 80;
      return true;
    });
  }

  // Tri
  filtered.sort((a, b) => {
    let comparison = 0;
    const statsA = stats[a.id];
    const statsB = stats[b.id];

    switch (filters.sortBy) {
      case 'name':
        comparison = `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`);
        break;
      case 'projects':
        comparison = (statsA?.totalProjects || 0) - (statsB?.totalProjects || 0);
        break;
      case 'tasks':
        comparison = (statsA?.totalTasks || 0) - (statsB?.totalTasks || 0);
        break;
      case 'completion':
        comparison = (statsA?.completionRate || 0) - (statsB?.completionRate || 0);
        break;
      case 'lastActivity':
        const dateA = statsA?.lastActivity ? new Date(statsA.lastActivity).getTime() : 0;
        const dateB = statsB?.lastActivity ? new Date(statsB.lastActivity).getTime() : 0;
        comparison = dateA - dateB;
        break;
    }

    return filters.sortOrder === 'asc' ? comparison : -comparison;
  });

  return filtered;
}
