import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCalendarStats } from '../calendar/useCalendarStats';
import { addDays, subDays, format } from 'date-fns';

const now = new Date();
const startDate = subDays(now, 30);
const endDate = addDays(now, 30);

const makeTask = (overrides: Record<string, any> = {}) => ({
  echeance: format(now, 'yyyy-MM-dd'),
  statut: 'en_cours',
  responsable_id: 'user-1',
  categorie_id: 'cat-1',
  categories_taches: { nom: 'Dev', couleur: '#ff0000' },
  responsable: { prenom: 'Jean', nom: 'Dupont' },
  ...overrides,
});

describe('useCalendarStats', () => {
  it('returns zero stats for empty tasks', () => {
    const { result } = renderHook(() => useCalendarStats([], startDate, endDate));
    expect(result.current.totalTasks).toBe(0);
    expect(result.current.completedTasks).toBe(0);
    expect(result.current.completionRate).toBe(0);
    expect(result.current.overdueTasks).toBe(0);
  });

  it('counts tasks in period', () => {
    const tasks = [makeTask(), makeTask()];
    const { result } = renderHook(() => useCalendarStats(tasks, startDate, endDate));
    expect(result.current.totalTasks).toBe(2);
  });

  it('counts completed tasks', () => {
    const tasks = [
      makeTask({ statut: 'terminee' }),
      makeTask({ statut: 'en_cours' }),
    ];
    const { result } = renderHook(() => useCalendarStats(tasks, startDate, endDate));
    expect(result.current.completedTasks).toBe(1);
    expect(result.current.completionRate).toBe(50);
  });

  it('counts overdue tasks', () => {
    const tasks = [
      makeTask({ echeance: format(subDays(now, 5), 'yyyy-MM-dd'), statut: 'en_cours' }),
    ];
    const { result } = renderHook(() => useCalendarStats(tasks, subDays(now, 10), endDate));
    expect(result.current.overdueTasks).toBe(1);
  });

  it('does not count completed tasks as overdue', () => {
    const tasks = [
      makeTask({ echeance: format(subDays(now, 5), 'yyyy-MM-dd'), statut: 'terminee' }),
    ];
    const { result } = renderHook(() => useCalendarStats(tasks, subDays(now, 10), endDate));
    expect(result.current.overdueTasks).toBe(0);
  });

  it('ignores tasks without echeance', () => {
    const tasks = [makeTask({ echeance: undefined })];
    const { result } = renderHook(() => useCalendarStats(tasks, startDate, endDate));
    expect(result.current.totalTasks).toBe(0);
  });

  it('groups tasks by category', () => {
    const tasks = [
      makeTask({ categorie_id: 'c1', categories_taches: { nom: 'Dev', couleur: '#f00' } }),
      makeTask({ categorie_id: 'c1', categories_taches: { nom: 'Dev', couleur: '#f00' } }),
      makeTask({ categorie_id: 'c2', categories_taches: { nom: 'Support', couleur: '#0f0' } }),
    ];
    const { result } = renderHook(() => useCalendarStats(tasks, startDate, endDate));
    expect(result.current.tasksByCategory.length).toBeGreaterThanOrEqual(2);
  });

  it('groups tasks by assignee', () => {
    const tasks = [
      makeTask({ responsable_id: 'u1', responsable: { prenom: 'A', nom: 'B' } }),
      makeTask({ responsable_id: 'u2', responsable: { prenom: 'C', nom: 'D' } }),
    ];
    const { result } = renderHook(() => useCalendarStats(tasks, startDate, endDate));
    expect(result.current.tasksByAssignee.length).toBeGreaterThanOrEqual(2);
  });

  it('has period set correctly', () => {
    const { result } = renderHook(() => useCalendarStats([], startDate, endDate));
    expect(result.current.period.start).toEqual(startDate);
    expect(result.current.period.end).toEqual(endDate);
  });
});
