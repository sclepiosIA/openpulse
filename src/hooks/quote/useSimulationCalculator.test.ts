/* @vitest-environment jsdom */
import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSimulationCalculator } from './useSimulationCalculator';
import { LEVIER_NAMES } from '@/lib/simulator-config';

type SimulationParams = Parameters<typeof useSimulationCalculator>[0];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useSimulationCalculator', () => {
  const baseParams: SimulationParams = {
    passages: 1000,
    baseline: 20,
    cible: 30,
    taux_mono: 50,
    taux_avis_baseline: 10,
    taux_avis_cible: 20,
    taux_ccmu2_baseline: 30,
    taux_ccmu2_cible: 25,
    taux_ccmu3_baseline: 15,
    taux_ccmu3_cible: 10,
    TARIF_UHCD: 200,
    TARIF_AVIS_SPE: 50,
    TARIF_CCMU2: 100,
    TARIF_CCMU3: 150,
    BONUS_MONORUM: 0.2,
  };

  it('calcule correctement tous les volumes, leviers et totaux', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSimulationCalculator(baseParams), { wrapper });

    expect(result.current.uhcdBaseline).toBe(200);
    expect(result.current.uhcdTarget).toBe(300);
    expect(result.current.uhcdDiff).toBe(100);

    expect(result.current.monoBaseline).toBe(100);
    expect(result.current.monoTarget).toBe(150);

    expect(result.current.consultExtBaseline).toBe(800);
    expect(result.current.consultExtTarget).toBe(700);

    expect(result.current.leviers).toHaveLength(5);

    expect(result.current.leviers[0]).toEqual({
      levier: LEVIER_NAMES.avis,
      volumeBaseline: 80,
      gainBaseline: 4000,
      volumeTarget: 140,
      gainTarget: 7000,
      volumeDiff: 60,
      gainDiff: 3000,
    });

    expect(result.current.leviers[1]).toEqual({
      levier: LEVIER_NAMES.ccmu2,
      volumeBaseline: 240,
      gainBaseline: 24000,
      volumeTarget: 175,
      gainTarget: 17500,
      volumeDiff: -65,
      gainDiff: -6500,
    });

    expect(result.current.leviers[2]).toEqual({
      levier: LEVIER_NAMES.ccmu3,
      volumeBaseline: 120,
      gainBaseline: 18000,
      volumeTarget: 70,
      gainTarget: 10500,
      volumeDiff: -50,
      gainDiff: -7500,
    });

    expect(result.current.leviers[3]).toEqual({
      levier: LEVIER_NAMES.uhcd,
      volumeBaseline: 100,
      gainBaseline: 40000,
      volumeTarget: 150,
      gainTarget: 60000,
      volumeDiff: 50,
      gainDiff: 20000,
    });

    expect(result.current.leviers[4]).toEqual({
      levier: LEVIER_NAMES.bonus,
      volumeBaseline: 0,
      gainBaseline: 0,
      volumeTarget: 150,
      gainTarget: 6000,
      volumeDiff: 150,
      gainDiff: 6000,
    });

    expect(result.current.totalGainBaseline).toBe(86000);
    expect(result.current.totalGainTarget).toBe(101000);
    expect(result.current.totalGainDiff).toBe(15000);
    expect(result.current.gainParDossier).toBe(220);
  });

  it('borne le différentiel UHCD à zéro quand la cible est inférieure à la baseline', () => {
    const wrapper = createWrapper();

    const params: SimulationParams = {
      ...baseParams,
      baseline: 35,
      cible: 20,
    };

    const { result } = renderHook(() => useSimulationCalculator(params), { wrapper });

    expect(result.current.uhcdBaseline).toBe(350);
    expect(result.current.uhcdTarget).toBe(200);
    expect(result.current.uhcdDiff).toBe(0);
    expect(result.current.consultExtBaseline).toBe(650);
    expect(result.current.consultExtTarget).toBe(800);
  });

  it('recalcule quand les paramètres changent', () => {
    const wrapper = createWrapper();

    const { result, rerender } = renderHook(
      ({ params }: { params: SimulationParams }) => useSimulationCalculator(params),
      {
        initialProps: { params: baseParams },
        wrapper,
      }
    );

    expect(result.current.totalGainDiff).toBe(15000);

    const nextParams: SimulationParams = {
      ...baseParams,
      passages: 2000,
      cible: 40,
    };

    rerender({ params: nextParams });

    expect(result.current.uhcdBaseline).toBe(400);
    expect(result.current.uhcdTarget).toBe(800);
    expect(result.current.uhcdDiff).toBe(400);
    expect(result.current.monoBaseline).toBe(200);
    expect(result.current.monoTarget).toBe(400);
    expect(result.current.consultExtBaseline).toBe(1600);
    expect(result.current.consultExtTarget).toBe(1200);

    expect(result.current.leviers[0]).toEqual({
      levier: LEVIER_NAMES.avis,
      volumeBaseline: 160,
      gainBaseline: 8000,
      volumeTarget: 240,
      gainTarget: 12000,
      volumeDiff: 80,
      gainDiff: 4000,
    });

    expect(result.current.leviers[1]).toEqual({
      levier: LEVIER_NAMES.ccmu2,
      volumeBaseline: 480,
      gainBaseline: 48000,
      volumeTarget: 300,
      gainTarget: 30000,
      volumeDiff: -180,
      gainDiff: -18000,
    });

    expect(result.current.leviers[2]).toEqual({
      levier: LEVIER_NAMES.ccmu3,
      volumeBaseline: 240,
      gainBaseline: 36000,
      volumeTarget: 120,
      gainTarget: 18000,
      volumeDiff: -120,
      gainDiff: -18000,
    });

    expect(result.current.leviers[3]).toEqual({
      levier: LEVIER_NAMES.uhcd,
      volumeBaseline: 200,
      gainBaseline: 80000,
      volumeTarget: 400,
      gainTarget: 160000,
      volumeDiff: 200,
      gainDiff: 80000,
    });

    expect(result.current.leviers[4]).toEqual({
      levier: LEVIER_NAMES.bonus,
      volumeBaseline: 0,
      gainBaseline: 0,
      volumeTarget: 400,
      gainTarget: 16000,
      volumeDiff: 400,
      gainDiff: 16000,
    });

    expect(result.current.totalGainBaseline).toBe(172000);
    expect(result.current.totalGainTarget).toBe(236000);
    expect(result.current.totalGainDiff).toBe(64000);
    expect(result.current.gainParDossier).toBe(220);
  });
});