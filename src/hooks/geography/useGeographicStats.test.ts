import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGeographicStats } from './useGeographicStats';

const { mockUseEtablissements, MOCK_REGIONS, MOCK_ETABS } = vi.hoisted(() => {
  return {
    mockUseEtablissements: vi.fn(),
    MOCK_REGIONS: ['Ile-de-France', 'Auvergne-Rhone-Alpes', 'Occitanie', 'Normandie'],
    MOCK_ETABS: [
      { region: 'Ile-de-France', statut: 'Production', type: 'CHU', nombre_passages_urgences_annuel: 100 },
      { region: 'Ile-de-France', statut: 'Contractuel', type: 'Clinique', nombre_passages_urgences_annuel: 50 },
      { region: 'Occitanie', statut: 'Prospect', type: undefined, nombre_passages_urgences_annuel: null },
      { region: null, statut: null, type: 'CHU', nombre_passages_urgences_annuel: 10 },
      { region: 'Auvergne-Rhone-Alpes', statut: 'Conformité', type: 'CH', nombre_passages_urgences_annuel: 20 },
      { region: 'Ile-de-France', statut: 'Production', type: null, nombre_passages_urgences_annuel: 30 },
    ],
  };
});

vi.mock('../crm/useEtablissements', () => ({
  useEtablissements: mockUseEtablissements,
}));

vi.mock('@/lib/geography', () => ({
  getAllRegions: () => MOCK_REGIONS,
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe('useGeographicStats', () => {
  beforeEach(() => {
    mockUseEtablissements.mockReset();
  });

  it('returns loading true and default stats when etablissements are loading', () => {
    mockUseEtablissements.mockReturnValue({ data: undefined, isLoading: true });
    const { result } = renderHook(() => useGeographicStats(), { wrapper: createWrapper() });

    expect(result.current.loading).toBe(true);
    expect(result.current.stats.totalEtablissements).toBe(0);
    expect(result.current.stats.byRegion).toEqual({});
    expect(result.current.stats.byStatus).toEqual({});
    expect(result.current.stats.byType).toEqual({});
    expect(result.current.stats.byPhase).toEqual({});
    expect(result.current.stats.topRegions).toEqual([]);
    expect(result.current.stats.regionsCount).toBe(0);
    expect(result.current.stats.averagePerRegion).toBe(0);
    expect(result.current.stats.totalPassagesUrgences).toBe(0);
    expect(result.current.stats.conversionRate).toBe(0);
    expect(result.current.stats.coverageRate).toBe(0);
  });

  it('computes geographic stats correctly on success', () => {
    mockUseEtablissements.mockReturnValue({ data: MOCK_ETABS, isLoading: false });
    const { result } = renderHook(() => useGeographicStats(), { wrapper: createWrapper() });

    expect(result.current.loading).toBe(false);

    const { stats } = result.current;

    expect(stats.totalEtablissements).toBe(6);

    expect(stats.byRegion).toEqual({
      'Ile-de-France': 3,
      'Occitanie': 1,
      'Non définie': 1,
      'Auvergne-Rhone-Alpes': 1,
    });

    expect(stats.byStatus).toEqual({
      'Production': 2,
      'Contractuel': 1,
      'Prospect': 1,
      'Non défini': 1,
      'Conformité': 1,
    });

    expect(stats.byType).toEqual({
      'CHU': 2,
      'Clinique': 1,
      'Non défini': 2,
      'CH': 1,
    });

    expect(stats.byPhase).toEqual({
      'Production': 2,
      'Déploiement': 2,
      'Prospects': 2,
    });

    expect(stats.totalPassagesUrgences).toBe(210);

    expect(stats.regionsCount).toBe(4);
    expect(stats.averagePerRegion).toBe(1.5);

    expect(stats.coverageRate).toBe(100);

    expect(stats.conversionRate).toBe(100);

    expect(stats.topRegions[0]).toEqual({
      region: 'Ile-de-France',
      count: 3,
      byStatus: { Production: 2, Contractuel: 1 },
    });

    const topRegionsMap = new Map(stats.topRegions.map((r) => [r.region, r]));
    expect(topRegionsMap.get('Occitanie')).toEqual({
      region: 'Occitanie',
      count: 1,
      byStatus: { Prospect: 1 },
    });
    expect(topRegionsMap.get('Non définie')).toEqual({
      region: 'Non définie',
      count: 1,
      byStatus: { 'Non défini': 1 },
    });
    expect(topRegionsMap.get('Auvergne-Rhone-Alpes')).toEqual({
      region: 'Auvergne-Rhone-Alpes',
      count: 1,
      byStatus: { 'Conformité': 1 },
    });
  });

  it('returns default stats when etablissements is null (error-like case)', () => {
    mockUseEtablissements.mockReturnValue({ data: null, isLoading: false });
    const { result } = renderHook(() => useGeographicStats(), { wrapper: createWrapper() });

    expect(result.current.loading).toBe(false);
    const s = result.current.stats;

    expect(s.totalEtablissements).toBe(0);
    expect(s.byRegion).toEqual({});
    expect(s.byStatus).toEqual({});
    expect(s.byType).toEqual({});
    expect(s.byPhase).toEqual({});
    expect(s.topRegions).toEqual([]);
    expect(s.regionsCount).toBe(0);
    expect(s.averagePerRegion).toBe(0);
    expect(s.totalPassagesUrgences).toBe(0);
    expect(s.conversionRate).toBe(0);
    expect(s.coverageRate).toBe(0);
  });
})