import { describe, it, expect } from 'vitest';
import { applyTeamFilters } from '../teamFilters';

const profiles = [
  { id: '1', prenom: 'Alice', nom: 'Dupont', email: 'alice@test.com', role: 'admin', actif: true, fonction: 'Dev' },
  { id: '2', prenom: 'Bob', nom: 'Martin', email: 'bob@test.com', role: 'commercial', actif: true, fonction: 'Sales' },
  { id: '3', prenom: 'Clara', nom: 'Petit', email: 'clara@test.com', role: 'csm', actif: false, fonction: 'CSM' },
] as any[];

const stats: any = {
  '1': { workload: '90', totalProjects: 5, totalTasks: 20, completionRate: 80, lastActivity: '2025-03-01' },
  '2': { workload: '40', totalProjects: 3, totalTasks: 10, completionRate: 60, lastActivity: '2025-02-15' },
  '3': { workload: '60', totalProjects: 2, totalTasks: 8, completionRate: 70, lastActivity: '2025-01-01' },
};

const baseFilters = { search: '', role: 'all' as const, status: 'all' as const, workload: 'all' as const, sortBy: 'name' as const, sortOrder: 'asc' as const };

describe('teamFilters - applyTeamFilters', () => {
  it('returns all profiles with no filters', () => {
    expect(applyTeamFilters(profiles, baseFilters, stats)).toHaveLength(3);
  });

  it('filters by search on name', () => {
    expect(applyTeamFilters(profiles, { ...baseFilters, search: 'alice' }, stats)).toHaveLength(1);
  });

  it('filters by search on email', () => {
    expect(applyTeamFilters(profiles, { ...baseFilters, search: 'bob@' }, stats)).toHaveLength(1);
  });

  it('filters by search on fonction', () => {
    expect(applyTeamFilters(profiles, { ...baseFilters, search: 'CSM' }, stats)).toHaveLength(1);
  });

  it('filters by role', () => {
    expect(applyTeamFilters(profiles, { ...baseFilters, role: 'commercial' }, stats)).toHaveLength(1);
  });

  it('filters by active status', () => {
    expect(applyTeamFilters(profiles, { ...baseFilters, status: 'actif' }, stats)).toHaveLength(2);
  });

  it('filters by inactive status', () => {
    expect(applyTeamFilters(profiles, { ...baseFilters, status: 'inactif' }, stats)).toHaveLength(1);
  });

  it('filters by high workload', () => {
    expect(applyTeamFilters(profiles, { ...baseFilters, workload: 'high' }, stats)).toHaveLength(1);
  });

  it('filters by low workload', () => {
    expect(applyTeamFilters(profiles, { ...baseFilters, workload: 'low' }, stats)).toHaveLength(1);
  });

  it('sorts by name ascending', () => {
    const result = applyTeamFilters(profiles, baseFilters, stats);
    expect(result[0].prenom).toBe('Alice');
  });

  it('sorts by name descending', () => {
    const result = applyTeamFilters(profiles, { ...baseFilters, sortOrder: 'desc' }, stats);
    expect(result[0].prenom).toBe('Clara');
  });

  it('sorts by tasks', () => {
    const result = applyTeamFilters(profiles, { ...baseFilters, sortBy: 'tasks', sortOrder: 'desc' }, stats);
    expect(result[0].id).toBe('1'); // 20 tasks
  });

  it('sorts by completion rate', () => {
    const result = applyTeamFilters(profiles, { ...baseFilters, sortBy: 'completion', sortOrder: 'desc' }, stats);
    expect(result[0].id).toBe('1'); // 80%
  });
});
