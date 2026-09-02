import { useState } from 'react';

export interface TeamFilters {
  search: string;
  role: 'all' | 'admin' | 'commercial' | 'chef_projet' | 'csm' | 'manager';
  status: 'all' | 'actif' | 'inactif';
  workload: 'all' | 'low' | 'medium' | 'high';
  sortBy: 'name' | 'projects' | 'tasks' | 'completion' | 'lastActivity';
  sortOrder: 'asc' | 'desc';
}

export const useTeamFilters = () => {
  const [filters, setFilters] = useState<TeamFilters>({
    search: '',
    role: 'all',
    status: 'all',
    workload: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const updateFilter = <K extends keyof TeamFilters>(key: K, value: TeamFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      role: 'all',
      status: 'all',
      workload: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
    });
  };

  return {
    filters,
    updateFilter,
    resetFilters,
  };
};
