import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeploymentFilters, type DeploymentFilters, type SortConfig } from '../production/useDeploymentFilters';

const etabs = [
  { id: 'e1', nom: 'CHU Paris', ville: 'Paris', region: 'IDF', type: 'CHU', statut: 'Contractuel', progression: 80, date_signature: '2025-06-01', commercial_id: 'c1', chef_projet_id: 'cp1', csm_id: 's1' },
  { id: 'e2', nom: 'CH Lyon', ville: 'Lyon', region: 'ARA', type: 'CH', statut: 'Prospect', progression: 30, date_signature: '2025-01-01', commercial_id: 'c2', chef_projet_id: null, csm_id: null },
  { id: 'e3', nom: 'Clinique Marseille', ville: 'Marseille', region: 'PACA', type: 'Clinique', statut: 'Contractuel', progression: 60, date_signature: null, commercial_id: null, chef_projet_id: null, csm_id: null },
] as any[];

const noFilters: DeploymentFilters = {
  searchTerm: '', regions: [], types: [], statuts: [], healthStatuses: [], teamMembers: [],
};
const defaultSort: SortConfig = { field: 'nom', direction: 'asc' };
const emptyHealth = new Map();

describe('useDeploymentFilters', () => {
  it('returns all when no filters', () => {
    const { result } = renderHook(() => useDeploymentFilters(etabs, noFilters, defaultSort, emptyHealth));
    expect(result.current).toHaveLength(3);
  });

  it('filters by searchTerm', () => {
    const { result } = renderHook(() => useDeploymentFilters(etabs, { ...noFilters, searchTerm: 'lyon' }, defaultSort, emptyHealth));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('e2');
  });

  it('filters by region', () => {
    const { result } = renderHook(() => useDeploymentFilters(etabs, { ...noFilters, regions: ['IDF'] }, defaultSort, emptyHealth));
    expect(result.current).toHaveLength(1);
  });

  it('filters by type', () => {
    const { result } = renderHook(() => useDeploymentFilters(etabs, { ...noFilters, types: ['Clinique'] }, defaultSort, emptyHealth));
    expect(result.current).toHaveLength(1);
  });

  it('filters by statut', () => {
    const { result } = renderHook(() => useDeploymentFilters(etabs, { ...noFilters, statuts: ['Contractuel'] }, defaultSort, emptyHealth));
    expect(result.current).toHaveLength(2);
  });

  it('filters by team member', () => {
    const { result } = renderHook(() => useDeploymentFilters(etabs, { ...noFilters, teamMembers: ['c1'] }, defaultSort, emptyHealth));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('e1');
  });

  it('filters by progression range', () => {
    const { result } = renderHook(() => useDeploymentFilters(etabs, { ...noFilters, progressionMin: 50, progressionMax: 90 }, defaultSort, emptyHealth));
    expect(result.current).toHaveLength(2); // e1 (80) and e3 (60)
  });

  it('sorts by progression desc', () => {
    const { result } = renderHook(() => useDeploymentFilters(etabs, noFilters, { field: 'progression', direction: 'desc' }, emptyHealth));
    expect(result.current[0].id).toBe('e1');
    expect(result.current[2].id).toBe('e2');
  });

  it('filters by health status', () => {
    const health = new Map([['e1', { score: 90, status: 'healthy' as const }], ['e2', { score: 40, status: 'delayed' as const }]]);
    const { result } = renderHook(() => useDeploymentFilters(etabs, { ...noFilters, healthStatuses: ['healthy'] }, defaultSort, health));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('e1');
  });

  it('returns empty for null etablissements', () => {
    const { result } = renderHook(() => useDeploymentFilters(null as any, noFilters, defaultSort, emptyHealth));
    expect(result.current).toEqual([]);
  });
});
