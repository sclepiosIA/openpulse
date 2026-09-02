import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeploymentFilters, type DeploymentFilters, type SortConfig } from '../production/useDeploymentFilters';

const makeEtab = (overrides: Record<string, any> = {}): any => ({
  id: `e-${Math.random()}`,
  nom: 'CHU Test',
  ville: 'Paris',
  region: 'Île-de-France',
  type: 'CHU',
  statut: 'Contractuel',
  progression: 50,
  date_signature: '2025-06-01',
  commercial_id: 'u1',
  chef_projet_id: 'u2',
  csm_id: 'u3',
  ...overrides,
});

const defaultFilters: DeploymentFilters = {
  searchTerm: '',
  regions: [],
  types: [],
  statuts: [],
  healthStatuses: [],
  teamMembers: [],
};

const defaultSort: SortConfig = { field: 'nom', direction: 'asc' };

describe('useDeploymentFilters', () => {
  it('returns all with no filters', () => {
    const etabs = [makeEtab(), makeEtab()];
    const { result } = renderHook(() => useDeploymentFilters(etabs, defaultFilters, defaultSort, new Map()));
    expect(result.current).toHaveLength(2);
  });

  it('filters by searchTerm', () => {
    const etabs = [makeEtab({ nom: 'CHU Marseille' }), makeEtab({ nom: 'CH Lyon' })];
    const { result } = renderHook(() =>
      useDeploymentFilters(etabs, { ...defaultFilters, searchTerm: 'Marseille' }, defaultSort, new Map())
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].nom).toBe('CHU Marseille');
  });

  it('filters by region', () => {
    const etabs = [makeEtab({ region: 'PACA' }), makeEtab({ region: 'Île-de-France' })];
    const { result } = renderHook(() =>
      useDeploymentFilters(etabs, { ...defaultFilters, regions: ['PACA'] }, defaultSort, new Map())
    );
    expect(result.current).toHaveLength(1);
  });

  it('filters by type', () => {
    const etabs = [makeEtab({ type: 'CHU' }), makeEtab({ type: 'CH' })];
    const { result } = renderHook(() =>
      useDeploymentFilters(etabs, { ...defaultFilters, types: ['CH'] }, defaultSort, new Map())
    );
    expect(result.current).toHaveLength(1);
  });

  it('filters by statut', () => {
    const etabs = [makeEtab({ statut: 'Go-Live' }), makeEtab({ statut: 'Formation' })];
    const { result } = renderHook(() =>
      useDeploymentFilters(etabs, { ...defaultFilters, statuts: ['Go-Live'] }, defaultSort, new Map())
    );
    expect(result.current).toHaveLength(1);
  });

  it('filters by health status', () => {
    const e1 = makeEtab();
    const e2 = makeEtab();
    const healthScores = new Map([
      [e1.id, { score: 80, status: 'healthy' as const }],
      [e2.id, { score: 30, status: 'delayed' as const }],
    ]);
    const { result } = renderHook(() =>
      useDeploymentFilters([e1, e2], { ...defaultFilters, healthStatuses: ['healthy'] }, defaultSort, healthScores)
    );
    expect(result.current).toHaveLength(1);
  });

  it('filters by team members', () => {
    const etabs = [makeEtab({ commercial_id: 'u1' }), makeEtab({ commercial_id: 'u9' })];
    const { result } = renderHook(() =>
      useDeploymentFilters(etabs, { ...defaultFilters, teamMembers: ['u1'] }, defaultSort, new Map())
    );
    expect(result.current).toHaveLength(1);
  });

  it('filters by progression range', () => {
    const etabs = [makeEtab({ progression: 20 }), makeEtab({ progression: 80 })];
    const { result } = renderHook(() =>
      useDeploymentFilters(etabs, { ...defaultFilters, progressionMin: 50 }, defaultSort, new Map())
    );
    expect(result.current).toHaveLength(1);
  });

  it('sorts by nom ascending', () => {
    const etabs = [makeEtab({ nom: 'Z Hospital' }), makeEtab({ nom: 'A Hospital' })];
    const { result } = renderHook(() =>
      useDeploymentFilters(etabs, defaultFilters, { field: 'nom', direction: 'asc' }, new Map())
    );
    expect(result.current[0].nom).toBe('A Hospital');
  });

  it('sorts by progression descending', () => {
    const etabs = [makeEtab({ progression: 20 }), makeEtab({ progression: 80 })];
    const { result } = renderHook(() =>
      useDeploymentFilters(etabs, defaultFilters, { field: 'progression', direction: 'desc' }, new Map())
    );
    expect(result.current[0].progression).toBe(80);
  });

  it('returns empty for null input', () => {
    const { result } = renderHook(() =>
      useDeploymentFilters(null as any, defaultFilters, defaultSort, new Map())
    );
    expect(result.current).toEqual([]);
  });
});
