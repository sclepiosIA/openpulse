import { useState, useMemo, useCallback } from 'react';
import { parseISO, isWithinInterval } from 'date-fns';
import { filterTasksByEstablishmentPhase } from '../tasks/useTaskPhaseFilter';

export interface EtablissementWithStatus {
  id: string;
  statut: string;
}

export interface CalendarFilters {
  search: string;
  responsables: string[];
  categories: string[];
  statuts: string[];
  priorites: string[];
  etablissements: string[];
  dateRange: { start: Date | null; end: Date | null };
  showOnlyMyTasks: boolean;
  hideCompleted: boolean;
  hideObsolete: boolean;
}

// Type strict pour les tâches filtrables
export interface FilterableTask {
  id: string;
  titre?: string;
  description?: string;
  statut?: string;
  priorite?: string;
  echeance?: string;
  responsable_id?: string;
  categorie_id?: string;
  etablissement_id?: string;
  archive?: boolean;
}

const defaultFilters: CalendarFilters = {
  search: '',
  responsables: [],
  categories: [],
  statuts: [],
  priorites: [],
  etablissements: [],
  dateRange: { start: null, end: null },
  showOnlyMyTasks: false,
  hideCompleted: true,
  hideObsolete: true,
};

export function useCalendarFilters(currentUserId?: string, etablissements?: EtablissementWithStatus[]) {
  const [filters, setFilters] = useState<CalendarFilters>(() => {
    const saved = localStorage.getItem('calendar-filters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<CalendarFilters>;
        // Reconvertir les dates si nécessaire
        if (parsed.dateRange?.start) parsed.dateRange.start = new Date(parsed.dateRange.start);
        if (parsed.dateRange?.end) parsed.dateRange.end = new Date(parsed.dateRange.end);
        return { ...defaultFilters, ...parsed };
      } catch {
        return defaultFilters;
      }
    }
    return defaultFilters;
  });

  const updateFilters = useCallback((updates: Partial<CalendarFilters>) => {
    setFilters(prev => {
      const newFilters = { ...prev, ...updates };
      localStorage.setItem('calendar-filters', JSON.stringify(newFilters));
      return newFilters;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    localStorage.removeItem('calendar-filters');
  }, []);

  const filterTasks = useCallback(<T extends FilterableTask>(tasks: T[]): T[] => {
    // First apply phase filtering based on establishment status
    const filteredByPhase = etablissements && etablissements.length > 0
      ? filterTasksByEstablishmentPhase(tasks, etablissements)
      : tasks;

    return filteredByPhase.filter(task => {
      // Toujours exclure les tâches archivées
      if (task.archive === true) {
        return false;
      }

      // Masquer les tâches terminées si activé
      if (filters.hideCompleted && task.statut === 'Terminé') {
        return false;
      }

      // Masquer les tâches obsolètes (échéance > 30 jours dans le passé)
      if (filters.hideObsolete && task.echeance) {
        const echeanceDate = parseISO(task.echeance);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        if (echeanceDate < thirtyDaysAgo) {
          return false;
        }
      }

      // Recherche textuelle
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = task.titre?.toLowerCase().includes(searchLower);
        const matchesDescription = task.description?.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesDescription) return false;
      }

      // Filtrer par mes tâches uniquement
      if (filters.showOnlyMyTasks && currentUserId) {
        if (task.responsable_id !== currentUserId) return false;
      }

      // Filtrer par responsables
      if (filters.responsables.length > 0) {
        if (!task.responsable_id || !filters.responsables.includes(task.responsable_id)) return false;
      }

      // Filtrer par catégories
      if (filters.categories.length > 0) {
        if (!task.categorie_id || !filters.categories.includes(task.categorie_id)) return false;
      }

      // Filtrer par statuts
      if (filters.statuts.length > 0) {
        if (!task.statut || !filters.statuts.includes(task.statut)) return false;
      }

      // Filtrer par priorités
      if (filters.priorites.length > 0) {
        if (!task.priorite || !filters.priorites.includes(task.priorite)) return false;
      }

      // Filtrer par établissements
      if (filters.etablissements.length > 0) {
        if (!task.etablissement_id || !filters.etablissements.includes(task.etablissement_id)) return false;
      }

      // Filtrer par plage de dates
      if (filters.dateRange.start || filters.dateRange.end) {
        if (!task.echeance) return false;
        
        const taskDate = parseISO(task.echeance);
        const { start, end } = filters.dateRange;

        if (start && end) {
          if (!isWithinInterval(taskDate, { start, end })) return false;
        } else if (start) {
          if (taskDate < start) return false;
        } else if (end) {
          if (taskDate > end) return false;
        }
      }

      return true;
    });
  }, [filters, currentUserId, etablissements]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== '' ||
      filters.responsables.length > 0 ||
      filters.categories.length > 0 ||
      filters.statuts.length > 0 ||
      filters.priorites.length > 0 ||
      filters.etablissements.length > 0 ||
      filters.dateRange.start !== null ||
      filters.dateRange.end !== null ||
      filters.showOnlyMyTasks ||
      !filters.hideCompleted ||
      !filters.hideObsolete
    );
  }, [filters]);

  return {
    filters,
    updateFilters,
    resetFilters,
    filterTasks,
    hasActiveFilters,
  };
}
