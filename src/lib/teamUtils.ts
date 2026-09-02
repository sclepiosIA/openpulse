import { TeamMemberStats } from '@/hooks/hr/useTeamStats';
import { TeamFilters } from '@/hooks/hr/useTeamFilters';

interface Profile {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  role: string;
  actif?: boolean;
}

export const filterAndSortProfiles = (
  profiles: Profile[],
  stats: Record<string, TeamMemberStats>,
  filters: TeamFilters
): Profile[] => {
  let filtered = [...profiles];

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(p =>
      p.prenom.toLowerCase().includes(searchLower) ||
      p.nom.toLowerCase().includes(searchLower) ||
      p.email.toLowerCase().includes(searchLower)
    );
  }

  // Role filter
  if (filters.role !== 'all') {
    filtered = filtered.filter(p => p.role === filters.role);
  }

  // Status filter
  if (filters.status !== 'all') {
    const isActive = filters.status === 'actif';
    filtered = filtered.filter(p => (p.actif !== false) === isActive);
  }

  // Workload filter
  if (filters.workload !== 'all') {
    filtered = filtered.filter(p => {
      const stat = stats[p.id];
      return stat && stat.workload === filters.workload;
    });
  }

  // Sort
  filtered.sort((a, b) => {
    const statA = stats[a.id];
    const statB = stats[b.id];

    let comparison = 0;

    switch (filters.sortBy) {
      case 'name':
        comparison = `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`);
        break;
      case 'projects':
        comparison = (statA?.totalProjects || 0) - (statB?.totalProjects || 0);
        break;
      case 'tasks':
        comparison = (statA?.totalTasks || 0) - (statB?.totalTasks || 0);
        break;
      case 'completion':
        comparison = (statA?.completionRate || 0) - (statB?.completionRate || 0);
        break;
      case 'lastActivity':
        const dateA = statA?.lastActivity?.getTime() || 0;
        const dateB = statB?.lastActivity?.getTime() || 0;
        comparison = dateA - dateB;
        break;
    }

    return filters.sortOrder === 'asc' ? comparison : -comparison;
  });

  return filtered;
};

export const getWorkloadColor = (workload: 'low' | 'medium' | 'high'): string => {
  switch (workload) {
    case 'low':
      return 'bg-green-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'high':
      return 'bg-red-500';
  }
};

export const getWorkloadLabel = (workload: 'low' | 'medium' | 'high'): string => {
  switch (workload) {
    case 'low':
      return 'Faible';
    case 'medium':
      return 'Moyenne';
    case 'high':
      return 'Élevée';
  }
};

export const getCompletionRateColor = (rate: number): string => {
  if (rate >= 75) return 'text-green-600';
  if (rate >= 50) return 'text-yellow-600';
  return 'text-red-600';
};

export const formatLastActivity = (date: Date | null): string => {
  if (!date) return 'Aucune activité';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`;
  return `Il y a ${Math.floor(diffDays / 30)} mois`;
};
