import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: (e: any) => e.progression * 1000 || 0,
}));

import { useProductionFilters, type ProductionFilters, type ProductionSortConfig } from '../production/useProductionFilters';

const etabs = [
  { id: 'e1', nom: 'CHU Paris', ville: 'Paris', region: 'IDF', type: 'CHU', statut: 'Production', progression: 90, date_signature: '2024-01-01', csm_id: 's1' },
  { id: 'e2', nom: 'CH Lyon', ville: 'Lyon', region: 'ARA', type: 'CH', statut: 'Production', progression: 50, date_signature: '2025-06-01', csm_id: 's2' },
] as any[];

const noFilters: ProductionFilters = {
  search: '', regions: [], types: [], healthStatuses: [], csmIds: [],
  durationRanges: [], adoptionRanges: [], npsRanges: [], supportLevels: [], renewalPeriods: [],
};
const defaultSort: ProductionSortConfig = { field: 'nom', direction: 'asc' };
const emptyHealth = new Map();

describe('useProductionFilters', () => {
  it('returns all when no filters', () => {
    const { result } = renderHook(() => useProductionFilters(etabs, noFilters, defaultSort, emptyHealth));
    expect(result.current).toHaveLength(2);
  });

  it('filters by search', () => {
    const { result } = renderHook(() => useProductionFilters(etabs, { ...noFilters, search: 'lyon' }, defaultSort, emptyHealth));
    expect(result.current).toHaveLength(1);
  });

  it('filters by CSM', () => {
    const { result } = renderHook(() => useProductionFilters(etabs, { ...noFilters, csmIds: ['s1'] }, defaultSort, emptyHealth));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('e1');
  });

  it('filters by health status', () => {
    const health = new Map([['e1', { score: 90, status: 'healthy' }], ['e2', { score: 30, status: 'at-risk' }]]);
    const { result } = renderHook(() => useProductionFilters(etabs, { ...noFilters, healthStatuses: ['at-risk'] as any }, defaultSort, health as any));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('e2');
  });

  it('filters by duration range', () => {
    const { result } = renderHook(() => useProductionFilters(etabs, { ...noFilters, durationRanges: ['24+'] }, defaultSort, emptyHealth));
    expect(result.current).toHaveLength(1); // e1 signed Jan 2024
  });

  it('sorts by revenue desc', () => {
    const { result } = renderHook(() => useProductionFilters(etabs, noFilters, { field: 'revenue', direction: 'desc' }, emptyHealth));
    expect(result.current[0].id).toBe('e1'); // 90*1000 > 50*1000
  });

  it('filters by NPS range', () => {
    const metrics = new Map([['e1', { nps_score: 9 }], ['e2', { nps_score: 5 }]]);
    const { result } = renderHook(() => useProductionFilters(etabs, { ...noFilters, npsRanges: ['promoters'] }, defaultSort, emptyHealth, metrics));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('e1');
  });

  it('filters by support level', () => {
    const metrics = new Map([['e1', { support_tickets_open: 5 }], ['e2', { support_tickets_open: 0 }]]);
    const { result } = renderHook(() => useProductionFilters(etabs, { ...noFilters, supportLevels: ['none'] }, defaultSort, emptyHealth, metrics));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('e2');
  });
});
