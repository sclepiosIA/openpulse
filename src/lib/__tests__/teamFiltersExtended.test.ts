import { describe, it, expect } from 'vitest';
import { applyTeamFilters } from '../teamFilters';

const makeProfile = (overrides: any = {}) => ({
  id: `p-${Math.random().toString(36).slice(2)}`,
  prenom: 'Jean',
  nom: 'Dupont',
  email: 'jean@test.com',
  role: 'commercial',
  actif: true,
  fonction: 'Commercial',
  ...overrides,
});

const emptyStats: any = {};

describe('teamFilters applyTeamFilters', () => {
  const defaults: any = {
    search: '', role: 'all', status: 'all', workload: 'all', sortBy: 'name', sortOrder: 'asc',
  };

  it('returns all with no filters', () => {
    const profiles = [makeProfile(), makeProfile()];
    expect(applyTeamFilters(profiles, defaults, emptyStats)).toHaveLength(2);
  });

  it('filters by search on prenom', () => {
    const profiles = [makeProfile({ prenom: 'Alice' }), makeProfile({ prenom: 'Bob' })];
    expect(applyTeamFilters(profiles, { ...defaults, search: 'Alice' }, emptyStats)).toHaveLength(1);
  });

  it('filters by search on nom', () => {
    const profiles = [makeProfile({ nom: 'Martin' }), makeProfile({ nom: 'Durand' })];
    expect(applyTeamFilters(profiles, { ...defaults, search: 'martin' }, emptyStats)).toHaveLength(1);
  });

  it('filters by search on email', () => {
    const profiles = [makeProfile({ email: 'alice@x.com' }), makeProfile({ email: 'bob@x.com' })];
    expect(applyTeamFilters(profiles, { ...defaults, search: 'alice' }, emptyStats)).toHaveLength(1);
  });

  it('filters by search on fonction', () => {
    const profiles = [makeProfile({ fonction: 'Dev' }), makeProfile({ fonction: 'Commercial' })];
    expect(applyTeamFilters(profiles, { ...defaults, search: 'dev' }, emptyStats)).toHaveLength(1);
  });

  it('filters by role', () => {
    const profiles = [makeProfile({ role: 'admin' }), makeProfile({ role: 'commercial' })];
    expect(applyTeamFilters(profiles, { ...defaults, role: 'admin' }, emptyStats)).toHaveLength(1);
  });

  it('filters by status actif', () => {
    const profiles = [makeProfile({ actif: true }), makeProfile({ actif: false })];
    expect(applyTeamFilters(profiles, { ...defaults, status: 'actif' }, emptyStats)).toHaveLength(1);
  });

  it('filters by status inactif', () => {
    const profiles = [makeProfile({ actif: true }), makeProfile({ actif: false })];
    expect(applyTeamFilters(profiles, { ...defaults, status: 'inactif' }, emptyStats)).toHaveLength(1);
  });

  it('filters by workload low', () => {
    const p1 = makeProfile();
    const p2 = makeProfile();
    const stats: any = {
      [p1.id]: { workload: 20 },
      [p2.id]: { workload: 90 },
    };
    expect(applyTeamFilters([p1, p2], { ...defaults, workload: 'low' }, stats)).toHaveLength(1);
  });

  it('filters by workload high', () => {
    const p1 = makeProfile();
    const p2 = makeProfile();
    const stats: any = {
      [p1.id]: { workload: 20 },
      [p2.id]: { workload: 90 },
    };
    expect(applyTeamFilters([p1, p2], { ...defaults, workload: 'high' }, stats)).toHaveLength(1);
  });

  it('filters by workload medium', () => {
    const p1 = makeProfile();
    const stats: any = { [p1.id]: { workload: 65 } };
    expect(applyTeamFilters([p1], { ...defaults, workload: 'medium' }, stats)).toHaveLength(1);
  });

  it('sorts by name asc', () => {
    const profiles = [makeProfile({ nom: 'Z', prenom: 'A' }), makeProfile({ nom: 'A', prenom: 'A' })];
    const result = applyTeamFilters(profiles, defaults, emptyStats);
    expect(result[0].nom).toBe('A');
  });

  it('sorts by name desc', () => {
    const profiles = [makeProfile({ nom: 'A', prenom: 'A' }), makeProfile({ nom: 'Z', prenom: 'A' })];
    const result = applyTeamFilters(profiles, { ...defaults, sortOrder: 'desc' }, emptyStats);
    expect(result[0].nom).toBe('Z');
  });

  it('sorts by projects', () => {
    const p1 = makeProfile();
    const p2 = makeProfile();
    const stats: any = {
      [p1.id]: { totalProjects: 2 },
      [p2.id]: { totalProjects: 10 },
    };
    const result = applyTeamFilters([p1, p2], { ...defaults, sortBy: 'projects' }, stats);
    expect(stats[result[0].id].totalProjects).toBe(2);
  });

  it('sorts by tasks', () => {
    const p1 = makeProfile();
    const p2 = makeProfile();
    const stats: any = {
      [p1.id]: { totalTasks: 5 },
      [p2.id]: { totalTasks: 50 },
    };
    const result = applyTeamFilters([p1, p2], { ...defaults, sortBy: 'tasks' }, stats);
    expect(stats[result[0].id].totalTasks).toBe(5);
  });

  it('sorts by completion', () => {
    const p1 = makeProfile();
    const p2 = makeProfile();
    const stats: any = {
      [p1.id]: { completionRate: 90 },
      [p2.id]: { completionRate: 30 },
    };
    const result = applyTeamFilters([p1, p2], { ...defaults, sortBy: 'completion' }, stats);
    expect(stats[result[0].id].completionRate).toBe(30);
  });

  it('sorts by lastActivity', () => {
    const p1 = makeProfile();
    const p2 = makeProfile();
    const stats: any = {
      [p1.id]: { lastActivity: '2026-01-01' },
      [p2.id]: { lastActivity: '2026-06-01' },
    };
    const result = applyTeamFilters([p1, p2], { ...defaults, sortBy: 'lastActivity' }, stats);
    expect(stats[result[0].id].lastActivity).toBe('2026-01-01');
  });
});
