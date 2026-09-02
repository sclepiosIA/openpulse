import { useMemo, useCallback } from 'react';
import {
  getPhaseByStatus,
  getCumulativeCategoriesUpToPhase,
  getPhaseByCategory,
} from '@/config/phases';

export interface EtablissementWithStatus {
  id: string;
  statut: string;
}

// Type strict pour les tâches filtrables par phase
export interface PhaseFilterableTask {
  id: string;
  etablissement_id?: string | null;
  categories_taches?: {
    nom?: string;
  } | null;
}

// Normalize category name for comparison
const normalizeCategory = (categoryName: string): string => {
  return categoryName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .trim();
};

/**
 * Filter tasks based on establishment phase
 * - Excludes tasks from FUTURE phases (e.g., no Production tasks for Prospect establishments)
 * - Keeps tasks from PAST phases only if they are NOT completed
 */
export function filterTasksByEstablishmentPhase<T extends PhaseFilterableTask>(
  tasks: T[],
  etablissements: EtablissementWithStatus[]
): T[] {
  if (!tasks || !etablissements || etablissements.length === 0) {
    return tasks || [];
  }

  // Create a map for quick establishment lookup
  const etablissementMap = new Map(etablissements.map(e => [e.id, e]));

  return tasks.filter(task => {
    // Always show tasks without establishment (global tasks)
    if (!task.etablissement_id) {
      return true;
    }

    // Get the establishment for this task
    const etablissement = etablissementMap.get(task.etablissement_id);
    if (!etablissement) {
      return true; // Unknown establishment = no filtering
    }

    // Determine the establishment's current phase
    const currentPhase = getPhaseByStatus(etablissement.statut);
    if (!currentPhase) {
      return true; // Unknown phase = no filtering
    }

    // Get the task's category name
    const taskCategoryName = task.categories_taches?.nom;
    if (!taskCategoryName) {
      return true; // No category = no filtering
    }

    // Get allowed categories for this establishment's phase (current + past phases)
    const allowedCategories = getCumulativeCategoriesUpToPhase(currentPhase);
    const normalizedTaskCategory = normalizeCategory(taskCategoryName);

    // Check if task category is in allowed categories
    const isAllowed = allowedCategories.some(
      cat => normalizeCategory(cat) === normalizedTaskCategory
    );

    if (!isAllowed) {
      // Task is from a FUTURE phase - exclude it
      return false;
    }

    // Task is from current or past phase - include it
    return true;
  });
}

/**
 * Get allowed categories for an establishment based on its phase
 */
export function getAllowedCategoriesForEstablishment(
  etablissement: EtablissementWithStatus | undefined
): string[] | null {
  if (!etablissement) {
    return null; // All categories allowed
  }

  const phase = getPhaseByStatus(etablissement.statut);
  if (!phase) {
    return null; // All categories allowed
  }

  return getCumulativeCategoriesUpToPhase(phase);
}

/**
 * Hook to use phase-based task filtering
 */
export function useTaskPhaseFilter<T extends PhaseFilterableTask>(
  tasks: T[] | undefined,
  etablissements: EtablissementWithStatus[] | undefined
) {
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (!etablissements || etablissements.length === 0) return tasks;
    
    return filterTasksByEstablishmentPhase(tasks, etablissements);
  }, [tasks, etablissements]);

  const getTaskPhaseInfo = useCallback((task: T) => {
    if (!task.etablissement_id || !etablissements) {
      return { phase: null, isInAllowedPhase: true };
    }

    const etablissement = etablissements.find(e => e.id === task.etablissement_id);
    if (!etablissement) {
      return { phase: null, isInAllowedPhase: true };
    }

    const currentPhase = getPhaseByStatus(etablissement.statut);
    const taskCategoryName = task.categories_taches?.nom;
    
    if (!currentPhase || !taskCategoryName) {
      return { phase: currentPhase, isInAllowedPhase: true };
    }

    const taskPhase = getPhaseByCategory(taskCategoryName);
    const allowedCategories = getCumulativeCategoriesUpToPhase(currentPhase);
    const normalizedTaskCategory = normalizeCategory(taskCategoryName);
    
    const isInAllowedPhase = allowedCategories.some(
      cat => normalizeCategory(cat) === normalizedTaskCategory
    );

    return {
      phase: currentPhase,
      taskPhase,
      isInAllowedPhase
    };
  }, [etablissements]);

  return {
    filteredTasks,
    getTaskPhaseInfo,
    filterTasksByPhase: (tasksToFilter: T[]) => 
      filterTasksByEstablishmentPhase(tasksToFilter, etablissements || [])
  };
}

export default useTaskPhaseFilter;
