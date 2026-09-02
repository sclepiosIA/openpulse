import { describe, it, expect, vi } from 'vitest';

vi.mock('@/config/phases', () => ({
  getPhaseByStatus: (statut: string) => {
    const map: Record<string, string> = { 'Prospect': 'prospect', 'Contractuel': 'deploiement', 'Production': 'production' };
    return map[statut] || null;
  },
  getCumulativeCategoriesUpToPhase: (phase: string) => {
    const map: Record<string, string[]> = {
      'prospect': ['Commercial', 'Qualification'],
      'deploiement': ['Commercial', 'Qualification', 'Déploiement', 'Formation'],
      'production': ['Commercial', 'Qualification', 'Déploiement', 'Formation', 'Production', 'Support'],
    };
    return map[phase] || [];
  },
  getPhaseByCategory: (cat: string) => cat === 'Production' ? 'production' : 'deploiement',
}));

import { filterTasksByEstablishmentPhase, getAllowedCategoriesForEstablishment, useTaskPhaseFilter } from '../tasks/useTaskPhaseFilter';
import { renderHook } from '@testing-library/react';

describe('filterTasksByEstablishmentPhase', () => {
  const etabs = [
    { id: 'e1', statut: 'Prospect' },
    { id: 'e2', statut: 'Production' },
  ];

  it('returns all tasks when no etablissements', () => {
    const tasks = [{ id: 't1', etablissement_id: 'e1' }];
    expect(filterTasksByEstablishmentPhase(tasks, [])).toEqual(tasks);
  });

  it('keeps global tasks (no etablissement_id)', () => {
    const tasks = [{ id: 't1' }];
    const result = filterTasksByEstablishmentPhase(tasks, etabs);
    expect(result).toHaveLength(1);
  });

  it('excludes future phase tasks', () => {
    const tasks = [
      { id: 't1', etablissement_id: 'e1', categories_taches: { nom: 'Production' } }, // Prospect can't have Production
    ];
    const result = filterTasksByEstablishmentPhase(tasks, etabs);
    expect(result).toHaveLength(0);
  });

  it('keeps current phase tasks', () => {
    const tasks = [
      { id: 't1', etablissement_id: 'e1', categories_taches: { nom: 'Commercial' } },
    ];
    const result = filterTasksByEstablishmentPhase(tasks, etabs);
    expect(result).toHaveLength(1);
  });

  it('keeps tasks for Production etablissement', () => {
    const tasks = [
      { id: 't1', etablissement_id: 'e2', categories_taches: { nom: 'Production' } },
      { id: 't2', etablissement_id: 'e2', categories_taches: { nom: 'Commercial' } },
    ];
    const result = filterTasksByEstablishmentPhase(tasks, etabs);
    expect(result).toHaveLength(2);
  });

  it('keeps tasks without category', () => {
    const tasks = [{ id: 't1', etablissement_id: 'e1' }];
    const result = filterTasksByEstablishmentPhase(tasks, etabs);
    expect(result).toHaveLength(1);
  });

  it('handles null input', () => {
    expect(filterTasksByEstablishmentPhase(null as any, etabs)).toEqual([]);
    expect(filterTasksByEstablishmentPhase(undefined as any, etabs)).toEqual([]);
  });
});

describe('getAllowedCategoriesForEstablishment', () => {
  it('returns null for undefined etablissement', () => {
    expect(getAllowedCategoriesForEstablishment(undefined)).toBeNull();
  });

  it('returns categories for valid etab', () => {
    const cats = getAllowedCategoriesForEstablishment({ id: 'e1', statut: 'Prospect' });
    expect(cats).toContain('Commercial');
    expect(cats).not.toContain('Production');
  });
});

describe('useTaskPhaseFilter', () => {
  const etabs = [{ id: 'e1', statut: 'Prospect' }];

  it('filters tasks via hook', () => {
    const tasks = [
      { id: 't1', etablissement_id: 'e1', categories_taches: { nom: 'Commercial' } },
      { id: 't2', etablissement_id: 'e1', categories_taches: { nom: 'Production' } },
    ];
    const { result } = renderHook(() => useTaskPhaseFilter(tasks, etabs));
    expect(result.current.filteredTasks).toHaveLength(1);
    expect(result.current.filteredTasks[0].id).toBe('t1');
  });

  it('getTaskPhaseInfo returns phase info', () => {
    const tasks = [{ id: 't1', etablissement_id: 'e1', categories_taches: { nom: 'Commercial' } }];
    const { result } = renderHook(() => useTaskPhaseFilter(tasks, etabs));
    const info = result.current.getTaskPhaseInfo(tasks[0]);
    expect(info.phase).toBe('prospect');
    expect(info.isInAllowedPhase).toBe(true);
  });

  it('handles undefined tasks', () => {
    const { result } = renderHook(() => useTaskPhaseFilter(undefined, etabs));
    expect(result.current.filteredTasks).toEqual([]);
  });
});
