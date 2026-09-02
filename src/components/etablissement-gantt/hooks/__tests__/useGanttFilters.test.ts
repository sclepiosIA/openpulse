import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGanttFilters } from '../useGanttFilters';

const tasks: any[] = [
  { id: '1', titre: 'Alpha', statut: 'En cours', priorite: 'high', responsable_id: 'u1', etablissement_id: 'e1', echeance: '2020-01-01', categorie_id: 'c1' },
  { id: '2', titre: 'Beta', statut: 'Terminé', priorite: 'low', responsable_id: 'u2', etablissement_id: 'e2', categorie_id: 'c2' },
  { id: '3', titre: 'Gamma blocked', statut: 'Bloqué', priorite: 'medium', responsable_id: 'u1', etablissement_id: 'e1' },
];

const etabs = [
  { id: 'e1', statut: 'Prospect' },
  { id: 'e2', statut: 'Production' },
];

describe('useGanttFilters', () => {
  it('hides completed by default (hideCompleted=true)', () => {
    const { result } = renderHook(() => useGanttFilters(tasks, etabs));
    const ids = result.current.filteredTasks.map((t) => t.id);
    expect(ids).not.toContain('2');
    expect(result.current.hasActiveFilters).toBe(true); // hideCompleted is active
  });

  it('filters by search term across title', () => {
    const { result } = renderHook(() => useGanttFilters(tasks, etabs));
    act(() => result.current.updateFilter('searchTerm', 'alpha'));
    expect(result.current.filteredTasks.map((t) => t.id)).toEqual(['1']);
  });

  it('toggleQuickFilter highPriorityOnly keeps only high', () => {
    const { result } = renderHook(() => useGanttFilters(tasks, etabs));
    act(() => result.current.toggleQuickFilter('highPriorityOnly'));
    expect(result.current.filteredTasks.every((t) => t.priorite === 'high')).toBe(true);
  });

  it('blockedOnly keeps only blocked tasks', () => {
    const { result } = renderHook(() => useGanttFilters(tasks, etabs));
    act(() => result.current.toggleQuickFilter('blockedOnly'));
    expect(result.current.filteredTasks.map((t) => t.id)).toEqual(['3']);
  });

  it('filter by statut multi-select', () => {
    const { result } = renderHook(() => useGanttFilters(tasks, etabs));
    act(() => result.current.toggleQuickFilter('hideCompleted')); // disable hideCompleted
    act(() => result.current.updateFilter('statuts', ['Terminé']));
    expect(result.current.filteredTasks.map((t) => t.id)).toEqual(['2']);
  });

  it('filter by responsable', () => {
    const { result } = renderHook(() => useGanttFilters(tasks, etabs));
    act(() => result.current.updateFilter('responsables', ['u2']));
    // u2 -> task 2 but hideCompleted hides it
    expect(result.current.filteredTasks).toHaveLength(0);
  });

  it('resetFilters returns to defaults', () => {
    const { result } = renderHook(() => useGanttFilters(tasks, etabs));
    act(() => result.current.updateFilter('searchTerm', 'foo'));
    act(() => result.current.toggleQuickFilter('blockedOnly'));
    act(() => result.current.resetFilters());
    expect(result.current.filters.searchTerm).toBe('');
    expect(result.current.filters.quickFilters.blockedOnly).toBe(false);
    expect(result.current.filters.quickFilters.hideCompleted).toBe(true);
  });

  it('handles empty tasks array', () => {
    const { result } = renderHook(() => useGanttFilters([], []));
    expect(result.current.filteredTasks).toEqual([]);
  });
});
