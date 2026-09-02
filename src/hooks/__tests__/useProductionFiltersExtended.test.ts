import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProductionFilters, type ProductionFilters, type ProductionSortConfig } from '../production/useProductionFilters';

const makeEtab = (overrides: Record<string, any> = {}): any => ({
  id: `e-${Math.random().toString(36).slice(2)}`,
  nom: 'CHU Test',
  ville: 'Paris',
  region: 'Île-de-France',
  type: 'CHU',
  statut: 'Production',
  csm_id: 'csm1',
  date_signature: '2024-01-01',
  nb_licences: 10,
  nb_passages: 50000,
  ...overrides,
});

const defaultFilters: ProductionFilters = {
  search: '',
  regions: [],
  types: [],
  healthStatuses: [],
  csmIds: [],
  durationRanges: [],
  adoptionRanges: [],
  npsRanges: [],
  supportLevels: [],
  renewalPeriods: [],
};

const defaultSort: ProductionSortConfig = { field: 'nom', direction: 'asc' };

describe('useProductionFilters', () => {
  it('returns all with no filters', () => {
    const etabs = [makeEtab(), makeEtab()];
    const { result } = renderHook(() =>
      useProductionFilters(etabs, defaultFilters, defaultSort, new Map())
    );
    expect(result.current).toHaveLength(2);
  });

  it('filters by search', () => {
    const etabs = [makeEtab({ nom: 'CHU Bordeaux' }), makeEtab({ nom: 'CH Lille' })];
    const { result } = renderHook(() =>
      useProductionFilters(etabs, { ...defaultFilters, search: 'Bordeaux' }, defaultSort, new Map())
    );
    expect(result.current).toHaveLength(1);
  });

  it('filters by region', () => {
    const etabs = [makeEtab({ region: 'PACA' }), makeEtab({ region: 'Bretagne' })];
    const { result } = renderHook(() =>
      useProductionFilters(etabs, { ...defaultFilters, regions: ['PACA'] }, defaultSort, new Map())
    );
    expect(result.current).toHaveLength(1);
  });

  it('filters by CSM', () => {
    const etabs = [makeEtab({ csm_id: 'csm1' }), makeEtab({ csm_id: 'csm2' })];
    const { result } = renderHook(() =>
      useProductionFilters(etabs, { ...defaultFilters, csmIds: ['csm1'] }, defaultSort, new Map())
    );
    expect(result.current).toHaveLength(1);
  });

  it('filters by health status', () => {
    const e1 = makeEtab();
    const e2 = makeEtab();
    const healthScores = new Map([
      [e1.id, { score: 90, status: 'healthy' as const, label: 'OK', color: 'green', factors: [], alerts: [] }],
      [e2.id, { score: 30, status: 'critical' as const, label: 'Bad', color: 'red', factors: [], alerts: [] }],
    ]) as any;
    const { result } = renderHook(() =>
      useProductionFilters([e1, e2], { ...defaultFilters, healthStatuses: ['healthy'] }, defaultSort, healthScores)
    );
    expect(result.current).toHaveLength(1);
  });

  it('sorts by nom ascending', () => {
    const etabs = [makeEtab({ nom: 'Z Hospital' }), makeEtab({ nom: 'A Hospital' })];
    const { result } = renderHook(() =>
      useProductionFilters(etabs, defaultFilters, { field: 'nom', direction: 'asc' }, new Map())
    );
    expect(result.current[0].nom).toBe('A Hospital');
  });

  it('sorts descending', () => {
    const etabs = [makeEtab({ nom: 'A' }), makeEtab({ nom: 'Z' })];
    const { result } = renderHook(() =>
      useProductionFilters(etabs, defaultFilters, { field: 'nom', direction: 'desc' }, new Map())
    );
    expect(result.current[0].nom).toBe('Z');
  });
});
