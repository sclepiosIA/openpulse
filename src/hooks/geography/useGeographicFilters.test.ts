// @vitest-environment jsdom

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGeographicFilters } from './useGeographicFilters';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children?: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useGeographicFilters', () => {
  it('initialise les filtres avec les valeurs par défaut et aucun filtre actif', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeographicFilters(), { wrapper });

    expect(result.current.filters).toEqual({
      search: '',
      regions: [],
      types: [],
      phases: [],
      dpis: [],
      licensesRange: [0, 1000],
      passagesRange: [0, 500000],
    });
    expect(result.current.filters.commercialId).toBeUndefined();
    expect(result.current.filters.chefProjetId).toBeUndefined();
    expect(result.current.filters.csmId).toBeUndefined();
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('met à jour un filtre texte sans altérer les autres valeurs par défaut', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeographicFilters(), { wrapper });

    await act(async () => {
      result.current.updateFilter('search', 'Paris');
    });

    expect(result.current.filters.search).toBe('Paris');
    expect(result.current.filters.regions).toEqual([]);
    expect(result.current.filters.licensesRange).toEqual([0, 1000]);
    expect(result.current.filters.passagesRange).toEqual([0, 500000]);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('met à jour les filtres tableau avec les valeurs métier attendues', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeographicFilters(), { wrapper });

    await act(async () => {
      result.current.updateFilter('regions', ['Île-de-France', 'Occitanie']);
      result.current.updateFilter('types', ['Hospital']);
      result.current.updateFilter('phases', ['Déploiement']);
      result.current.updateFilter('dpis', ['Maincare']);
    });

    expect(result.current.filters.regions).toEqual(['Île-de-France', 'Occitanie']);
    expect(result.current.filters.types).toEqual(['Hospital']);
    expect(result.current.filters.phases).toEqual(['Déploiement']);
    expect(result.current.filters.dpis).toEqual(['Maincare']);
    expect(result.current.filters.search).toBe('');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('met à jour les bornes numériques et détecte des filtres actifs', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeographicFilters(), { wrapper });

    await act(async () => {
      result.current.updateFilter('licensesRange', [10, 400]);
      result.current.updateFilter('passagesRange', [1000, 250000]);
    });

    expect(result.current.filters.licensesRange).toEqual([10, 400]);
    expect(result.current.filters.passagesRange).toEqual([1000, 250000]);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('active les filtres quand les identifiants optionnels sont définis', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeographicFilters(), { wrapper });

    await act(async () => {
      result.current.updateFilter('commercialId', 'comm-1');
      result.current.updateFilter('chefProjetId', 'cp-1');
      result.current.updateFilter('csmId', 'csm-1');
    });

    expect(result.current.filters.commercialId).toBe('comm-1');
    expect(result.current.filters.chefProjetId).toBe('cp-1');
    expect(result.current.filters.csmId).toBe('csm-1');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('considère undefined sur les ids optionnels comme inactif quand tout le reste est au défaut', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeographicFilters(), { wrapper });

    await act(async () => {
      result.current.updateFilter('commercialId', 'comm-1');
      result.current.updateFilter('commercialId', undefined);
      result.current.updateFilter('chefProjetId', undefined);
      result.current.updateFilter('csmId', undefined);
    });

    expect(result.current.filters.commercialId).toBeUndefined();
    expect(result.current.filters.chefProjetId).toBeUndefined();
    expect(result.current.filters.csmId).toBeUndefined();
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('resetFilters rétablit exactement les valeurs par défaut après plusieurs modifications', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeographicFilters(), { wrapper });

    await act(async () => {
      result.current.updateFilter('search', 'Lyon');
      result.current.updateFilter('regions', ['Auvergne-Rhône-Alpes']);
      result.current.updateFilter('types', ['Clinic']);
      result.current.updateFilter('phases', ['Prospection']);
      result.current.updateFilter('dpis', ['DxCare']);
      result.current.updateFilter('licensesRange', [25, 300]);
      result.current.updateFilter('passagesRange', [5000, 120000]);
      result.current.updateFilter('commercialId', 'comm-2');
      result.current.updateFilter('chefProjetId', 'cp-3');
      result.current.updateFilter('csmId', 'csm-4');
    });

    expect(result.current.hasActiveFilters).toBe(true);

    await act(async () => {
      result.current.resetFilters();
    });

    expect(result.current.filters).toEqual({
      search: '',
      regions: [],
      types: [],
      phases: [],
      dpis: [],
      licensesRange: [0, 1000],
      passagesRange: [0, 500000],
    });
    expect(result.current.filters.commercialId).toBeUndefined();
    expect(result.current.filters.chefProjetId).toBeUndefined();
    expect(result.current.filters.csmId).toBeUndefined();
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('bascule hasActiveFilters selon les seuils exacts des ranges', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeographicFilters(), { wrapper });

    expect(result.current.hasActiveFilters).toBe(false);

    await act(async () => {
      result.current.updateFilter('licensesRange', [0, 999]);
    });
    expect(result.current.hasActiveFilters).toBe(true);

    await act(async () => {
      result.current.updateFilter('licensesRange', [0, 1000]);
    });
    expect(result.current.hasActiveFilters).toBe(false);

    await act(async () => {
      result.current.updateFilter('passagesRange', [1, 500000]);
    });
    expect(result.current.hasActiveFilters).toBe(true);

    await act(async () => {
      result.current.updateFilter('passagesRange', [0, 500000]);
    });
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('cumule plusieurs filtres puis les remplace proprement via updateFilter', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeographicFilters(), { wrapper });

    await act(async () => {
      result.current.updateFilter('regions', ['Nord']);
      result.current.updateFilter('regions', ['Sud', 'Est']);
      result.current.updateFilter('search', 'Marseille');
    });

    expect(result.current.filters.regions).toEqual(['Sud', 'Est']);
    expect(result.current.filters.search).toBe('Marseille');
    expect(result.current.filters.types).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(true);
  });
});