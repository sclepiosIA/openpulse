import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCalendarStats } from '../calendar/useCalendarStats';

const makeTasks = () => [
  { echeance: '2026-03-05', statut: 'terminee', responsable_id: 'u1', categorie_id: 'c1', categories_taches: { nom: 'Dev', couleur: '#f00' }, responsable: { prenom: 'Jean', nom: 'Dupont' } },
  { echeance: '2026-03-06', statut: 'en_cours', responsable_id: 'u1', categorie_id: 'c1', categories_taches: { nom: 'Dev', couleur: '#f00' }, responsable: { prenom: 'Jean', nom: 'Dupont' } },
  { echeance: '2026-03-07', statut: 'en_cours', responsable_id: 'u2', categorie_id: 'c2', categories_taches: { nom: 'Design', couleur: '#0f0' }, responsable: { prenom: 'Marie', nom: 'Martin' } },
  { echeance: '2026-03-20', statut: 'en_cours', responsable_id: 'u2' }, // no category
  { statut: 'en_cours' }, // no echeance
];

describe('useCalendarStats', () => {
  const start = new Date('2026-03-01');
  const end = new Date('2026-03-31');

  it('counts total and completed tasks in period', () => {
    const { result } = renderHook(() => useCalendarStats(makeTasks(), start, end));
    expect(result.current.totalTasks).toBe(4); // 4 with echeance in March
    expect(result.current.completedTasks).toBe(1);
  });

  it('calculates completion rate', () => {
    const { result } = renderHook(() => useCalendarStats(makeTasks(), start, end));
    expect(result.current.completionRate).toBe(25); // 1/4
  });

  it('groups by category', () => {
    const { result } = renderHook(() => useCalendarStats(makeTasks(), start, end));
    expect(result.current.tasksByCategory.length).toBeGreaterThanOrEqual(1);
    const devCat = result.current.tasksByCategory.find(c => c.categoryName === 'Dev');
    expect(devCat).toBeDefined();
    expect(devCat!.count).toBe(2);
  });

  it('groups by assignee', () => {
    const { result } = renderHook(() => useCalendarStats(makeTasks(), start, end));
    expect(result.current.tasksByAssignee.length).toBeGreaterThanOrEqual(1);
    const jean = result.current.tasksByAssignee.find(a => a.assigneeName === 'Jean Dupont');
    expect(jean).toBeDefined();
    expect(jean!.count).toBe(2);
  });

  it('computes average tasks per day', () => {
    const { result } = renderHook(() => useCalendarStats(makeTasks(), start, end));
    expect(result.current.avgTasksPerDay).toBeCloseTo(4 / 30, 1);
  });

  it('builds time distribution', () => {
    const { result } = renderHook(() => useCalendarStats(makeTasks(), start, end));
    expect(result.current.timeDistribution.length).toBeGreaterThanOrEqual(1);
    expect(result.current.timeDistribution[0]).toHaveProperty('date');
    expect(result.current.timeDistribution[0]).toHaveProperty('count');
  });

  it('handles empty tasks', () => {
    const { result } = renderHook(() => useCalendarStats([], start, end));
    expect(result.current.totalTasks).toBe(0);
    expect(result.current.completionRate).toBe(0);
    expect(result.current.tasksByCategory).toEqual([]);
  });

  it('classifies workload correctly', () => {
    const { result } = renderHook(() => useCalendarStats(makeTasks(), start, end));
    result.current.tasksByAssignee.forEach(a => {
      expect(['low', 'medium', 'high']).toContain(a.workload);
    });
  });
});
