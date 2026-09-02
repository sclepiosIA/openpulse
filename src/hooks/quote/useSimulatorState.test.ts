/// <reference types="vitest" />
/**
 * @vitest-environment jsdom
 */

import React, { type PropsWithChildren } from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  DEFAULT_SIMULATION_PARAMS,
  CENTER_TYPES,
  DPI_TYPES,
  mockUseSimulationCalculator,
  mockUseQuoteCalculator,
  mockUseAnalyticsCalculator,
} = vi.hoisted(() => {
  const DEFAULT_SIMULATION_PARAMS = { passages: 10, baseline: 100 };
  const CENTER_TYPES = [
    { id: 'center-a', label: 'Center A' },
    { id: 'center-b', label: 'Center B' },
  ];
  const DPI_TYPES = [
    { id: 'dpi-a', label: 'DPI A' },
    { id: 'dpi-b', label: 'DPI B' },
  ];

  const mockUseSimulationCalculator = vi.fn();
  const mockUseQuoteCalculator = vi.fn();
  const mockUseAnalyticsCalculator = vi.fn();

  return {
    DEFAULT_SIMULATION_PARAMS,
    CENTER_TYPES,
    DPI_TYPES,
    mockUseSimulationCalculator,
    mockUseQuoteCalculator,
    mockUseAnalyticsCalculator,
  };
});

vi.mock('@/lib/simulator-config', () => ({
  DEFAULT_SIMULATION_PARAMS,
  CENTER_TYPES,
  DPI_TYPES,
}));

vi.mock('./useSimulationCalculator', () => ({
  useSimulationCalculator: (params: unknown) => mockUseSimulationCalculator(params),
}));

vi.mock('./useQuoteCalculator', () => ({
  useQuoteCalculator: (input: unknown) => mockUseQuoteCalculator(input),
}));

vi.mock('../analytics/useAnalyticsCalculator', () => ({
  useAnalyticsCalculator: (input: unknown) => mockUseAnalyticsCalculator(input),
}));

import { useSimulatorState } from './useSimulatorState';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const Wrapper = ({ children }: PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return Wrapper;
}

describe('useSimulatorState', () => {
  it('initialise les états par défaut et alimente les calculateurs avec les bons paramètres', () => {
    mockUseSimulationCalculator.mockImplementation((p: unknown) => ({
      kind: 'sim-ok',
      passages: (p as { passages: number }).passages,
    }));
    mockUseQuoteCalculator.mockImplementation(() => ({ kind: 'quote-ok', total: 123 }));
    mockUseAnalyticsCalculator.mockImplementation(() => ({ kind: 'ana-ok', score: 7 }));

    const { result } = renderHook(() => useSimulatorState(), { wrapper: createWrapper() });

    expect(result.current.activeTab).toBe('simulation');
    expect(result.current.params).toEqual(DEFAULT_SIMULATION_PARAMS);

    expect(result.current.configuration).not.toBeNull();
    expect(result.current.configuration?.centerType).toEqual(CENTER_TYPES[0]);
    expect(result.current.configuration?.dpiType).toEqual(DPI_TYPES[0]);
    expect(result.current.configuration?.resellerType).toBeNull();
    expect(result.current.configuration?.valorisationLevel).toBe('second');

    expect(result.current.analyticsParams).toEqual({
      uhcdMois: 200,
      consultMois: 3000,
      plusMois: 50,
      totalProj: 40000,
    });

    expect(mockUseSimulationCalculator).toHaveBeenCalledTimes(1);
    expect(mockUseSimulationCalculator).toHaveBeenCalledWith(DEFAULT_SIMULATION_PARAMS);

    expect(mockUseQuoteCalculator).toHaveBeenCalledTimes(1);
    expect(mockUseQuoteCalculator).toHaveBeenCalledWith({
      params: DEFAULT_SIMULATION_PARAMS,
      configuration: result.current.configuration,
    });

    expect(mockUseAnalyticsCalculator).toHaveBeenCalledTimes(1);
    expect(mockUseAnalyticsCalculator).toHaveBeenCalledWith({
      params: DEFAULT_SIMULATION_PARAMS,
      analyticsParams: result.current.analyticsParams,
    });

    expect(result.current.simulationResults).toEqual({
      kind: 'sim-ok',
      passages: DEFAULT_SIMULATION_PARAMS.passages,
    });
    expect(result.current.quoteResults).toEqual({ kind: 'quote-ok', total: 123 });
    expect(result.current.analyticsResults).toEqual({ kind: 'ana-ok', score: 7 });
  });

  it('prend en compte les valeurs initiales et met à jour les paramètres via updateParam/updateParams/resetParams', async () => {
    mockUseSimulationCalculator.mockImplementation((p: unknown) => ({
      kind: 'sim',
      baseline: (p as { baseline: number }).baseline,
    }));
    mockUseQuoteCalculator.mockImplementation(() => ({ kind: 'quote' }));
    mockUseAnalyticsCalculator.mockImplementation(() => ({ kind: 'ana' }));

    const { result } = renderHook(
      () =>
        useSimulatorState({
          initialPassages: 22,
          initialBaseline: 333,
          initialCenterType: 'center-b',
          initialDPIType: 'dpi-b',
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.params.passages).toBe(22);
    expect(result.current.params.baseline).toBe(333);
    expect(result.current.configuration?.centerType).toEqual(CENTER_TYPES[1]);
    expect(result.current.configuration?.dpiType).toEqual(DPI_TYPES[1]);

    await act(async () => {
      result.current.updateParam('passages', 99);
    });
    expect(result.current.params.passages).toBe(99);
    expect(mockUseSimulationCalculator).toHaveBeenLastCalledWith(
      expect.objectContaining({ passages: 99, baseline: 333 })
    );

    await act(async () => {
      result.current.updateParams({ passages: 5, baseline: 6 });
    });
    expect(result.current.params.passages).toBe(5);
    expect(result.current.params.baseline).toBe(6);

    await act(async () => {
      result.current.resetParams();
    });
    expect(result.current.params).toEqual(DEFAULT_SIMULATION_PARAMS);
  });

  it('met à jour la configuration et les paramètres analytics, et permet de changer d’onglet', async () => {
    mockUseSimulationCalculator.mockImplementation(() => ({ ok: true }));
    mockUseQuoteCalculator.mockImplementation((input: unknown) => ({
      ok: true,
      centerId: (input as { configuration: { centerType: { id: string } } }).configuration.centerType.id,
    }));
    mockUseAnalyticsCalculator.mockImplementation((input: unknown) => ({
      ok: true,
      uhcd: (input as { analyticsParams: { uhcdMois: number } }).analyticsParams.uhcdMois,
    }));

    const { result } = renderHook(() => useSimulatorState(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.setActiveTab('quote');
    });
    expect(result.current.activeTab).toBe('quote');

    await act(async () => {
      result.current.updateConfiguration({ centerType: CENTER_TYPES[1] });
    });
    expect(result.current.configuration?.centerType).toEqual(CENTER_TYPES[1]);
    expect(mockUseQuoteCalculator).toHaveBeenLastCalledWith({
      params: result.current.params,
      configuration: result.current.configuration,
    });
    expect(result.current.quoteResults).toEqual({ ok: true, centerId: 'center-b' });

    await act(async () => {
      result.current.updateAnalyticsParam('uhcdMois', 777);
    });
    expect(result.current.analyticsParams.uhcdMois).toBe(777);
    expect(mockUseAnalyticsCalculator).toHaveBeenLastCalledWith({
      params: result.current.params,
      analyticsParams: result.current.analyticsParams,
    });
    expect(result.current.analyticsResults).toEqual({ ok: true, uhcd: 777 });
  });

  it('couvre "isLoading → succès → isError" via les calculateurs (contrat consommable)', async () => {
    const simLoading = { isLoading: true, isError: false, data: null as null };
    const simSuccess = { isLoading: false, isError: false, data: { total: 10 } };
    const simError = { isLoading: false, isError: true, error: { message: 'x' } as { message: string } };

    mockUseSimulationCalculator
      .mockImplementationOnce(() => simLoading)
      .mockImplementationOnce(() => simSuccess)
      .mockImplementationOnce(() => simError);

    mockUseQuoteCalculator.mockImplementation(() => ({ isLoading: false, isError: false }));
    mockUseAnalyticsCalculator.mockImplementation(() => ({ isLoading: false, isError: false }));

    const { result } = renderHook(() => useSimulatorState(), { wrapper: createWrapper() });

    expect(result.current.simulationResults).toBe(simLoading);
    expect((result.current.simulationResults as { isLoading: boolean }).isLoading).toBe(true);

    await act(async () => {
      result.current.updateParam('passages', DEFAULT_SIMULATION_PARAMS.passages + 1);
    });

    expect(result.current.simulationResults).toBe(simSuccess);
    expect((result.current.simulationResults as { isLoading: boolean }).isLoading).toBe(false);
    expect((result.current.simulationResults as { data: { total: number } }).data.total).toBe(10);

    await act(async () => {
      result.current.updateParam('passages', DEFAULT_SIMULATION_PARAMS.passages + 2);
    });

    expect(result.current.simulationResults).toBe(simError);
    expect((result.current.simulationResults as { isError: boolean }).isError).toBe(true);
    expect((result.current.simulationResults as { error: { message: string } }).error.message).toBe('x');
  });
});