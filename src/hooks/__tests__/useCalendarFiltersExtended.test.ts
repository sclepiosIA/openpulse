import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCalendarFilters, type FilterableTask } from '../calendar/useCalendarFilters';
import { format, subDays, addDays } from 'date-fns';

const now = new Date();

const makeTask = (overrides: Partial<FilterableTask> = {}): FilterableTask => ({
  id: `t-${Math.random()}`,
  titre: 'Test task',
  statut: 'En cours',
  priorite: 'medium',
  echeance: format(now, 'yyyy-MM-dd'),
  responsable_id: 'user1',
  categorie_id: 'cat1',
  etablissement_id: 'etab1',
  archive: false,
  ...overrides,
});

describe('useCalendarFilters', () => {
  beforeEach(() => {
    localStorage.removeItem('calendar-filters');
  });

  it('initializes with default filters', () => {
    const { result } = renderHook(() => useCalendarFilters());
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.hideCompleted).toBe(true);
    expect(result.current.filters.hideObsolete).toBe(true);
  });

  it('filterTasks excludes archived tasks', () => {
    const { result } = renderHook(() => useCalendarFilters());
    const tasks = [makeTask(), makeTask({ archive: true })];
    const filtered = result.current.filterTasks(tasks);
    expect(filtered).toHaveLength(1);
  });

  it('filterTasks hides completed by default', () => {
    const { result } = renderHook(() => useCalendarFilters());
    const tasks = [makeTask(), makeTask({ statut: 'Terminé' })];
    const filtered = result.current.filterTasks(tasks);
    expect(filtered).toHaveLength(1);
  });

  it('filterTasks filters by search', () => {
    const { result } = renderHook(() => useCalendarFilters());
    act(() => result.current.updateFilters({ search: 'important' }));
    const tasks = [makeTask({ titre: 'Important task' }), makeTask({ titre: 'Other task' })];
    const filtered = result.current.filterTasks(tasks);
    expect(filtered).toHaveLength(1);
  });

  it('filterTasks filters by responsables', () => {
    const { result } = renderHook(() => useCalendarFilters());
    act(() => result.current.updateFilters({ responsables: ['user1'] }));
    const tasks = [makeTask({ responsable_id: 'user1' }), makeTask({ responsable_id: 'user2' })];
    const filtered = result.current.filterTasks(tasks);
    expect(filtered).toHaveLength(1);
  });

  it('filterTasks filters by categories', () => {
    const { result } = renderHook(() => useCalendarFilters());
    act(() => result.current.updateFilters({ categories: ['cat1'] }));
    const tasks = [makeTask({ categorie_id: 'cat1' }), makeTask({ categorie_id: 'cat2' })];
    const filtered = result.current.filterTasks(tasks);
    expect(filtered).toHaveLength(1);
  });

  it('filterTasks filters by statuts', () => {
    const { result } = renderHook(() => useCalendarFilters());
    act(() => result.current.updateFilters({ statuts: ['En cours'], hideCompleted: false }));
    const tasks = [makeTask({ statut: 'En cours' }), makeTask({ statut: 'A faire' })];
    const filtered = result.current.filterTasks(tasks);
    expect(filtered).toHaveLength(1);
  });

  it('filterTasks showOnlyMyTasks', () => {
    const { result } = renderHook(() => useCalendarFilters('user1'));
    act(() => result.current.updateFilters({ showOnlyMyTasks: true }));
    const tasks = [makeTask({ responsable_id: 'user1' }), makeTask({ responsable_id: 'user2' })];
    const filtered = result.current.filterTasks(tasks);
    expect(filtered).toHaveLength(1);
  });

  it('resetFilters restores defaults', () => {
    const { result } = renderHook(() => useCalendarFilters());
    act(() => result.current.updateFilters({ search: 'test' }));
    expect(result.current.filters.search).toBe('test');
    act(() => result.current.resetFilters());
    expect(result.current.filters.search).toBe('');
  });

  it('hasActiveFilters detects changes', () => {
    const { result } = renderHook(() => useCalendarFilters());
    expect(result.current.hasActiveFilters).toBe(false);
    act(() => result.current.updateFilters({ search: 'test' }));
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('hides obsolete tasks (>30 days past)', () => {
    const { result } = renderHook(() => useCalendarFilters());
    const tasks = [makeTask({ echeance: format(subDays(now, 60), 'yyyy-MM-dd') })];
    const filtered = result.current.filterTasks(tasks);
    expect(filtered).toHaveLength(0);
  });
});
