import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAnalyticsCalculator } from '../analytics/useAnalyticsCalculator';
import type { AnalyticsParams, SimulationParams } from '@/types/simulator';

const baseParams: SimulationParams = {
  passages: 3600,
  baseline: 30,
  cible: 40,
  taux_mono: 20,
  taux_avis_baseline: 10,
  taux_avis_cible: 20,
  taux_ccmu2_baseline: 50,
  taux_ccmu2_cible: 60,
  taux_ccmu3_baseline: 30,
  taux_ccmu3_cible: 40,
  TARIF_UHCD: 1000,
  TARIF_AVIS_SPE: 50,
  TARIF_CCMU2: 20,
  TARIF_CCMU3: 30,
  BONUS_MONORUM: 0.05,
};

describe('useAnalyticsCalculator', () => {
  it('annualise les volumes mensuels et calcule les revenus projetés', () => {
    const analyticsParams: AnalyticsParams = {
      uhcdMois: 100,
      consultMois: 200,
      plusMois: 10,
      totalProj: 7200,
    };

    const { result } = renderHook(() =>
      useAnalyticsCalculator({ params: baseParams, analyticsParams }),
    );

    expect(result.current.uhcdAn).toBe(1200);
    expect(result.current.consultAn).toBe(2400);
    expect(result.current.uhcdMarqueAn).toBe(120);
    expect(result.current.totalPassagesInit).toBe(3600);
    expect(result.current.pctUhcd).toBeCloseTo(33.33, 2);
    expect(result.current.pctUhcdPlus).toBeCloseTo(36.67, 2);
    expect(result.current.consultAnPlus).toBe(2280);
    expect(result.current.revTotalBase).toBe(1_257_600);
    expect(result.current.revTotalPlus).toBe(1_463_520);
    expect(result.current.gainMonoRUM).toBe(66_000);
    expect(result.current.scale).toBe(2);
    expect(result.current.uhcdProj).toBe(2400);
    expect(result.current.uhcdPlusProj).toBe(2640);
  });

  it('gère les volumes nuls sans division invalide', () => {
    const analyticsParams: AnalyticsParams = {
      uhcdMois: 0,
      consultMois: 0,
      plusMois: 0,
      totalProj: 5000,
    };

    const { result } = renderHook(() =>
      useAnalyticsCalculator({ params: baseParams, analyticsParams }),
    );

    expect(result.current.totalPassagesInit).toBe(0);
    expect(result.current.pctUhcd).toBe(0);
    expect(result.current.pctUhcdPlus).toBe(0);
    expect(result.current.roiAnUhcdPct).toBe(0);
    expect(result.current.roiAnTotalPct).toBe(0);
    expect(result.current.scale).toBe(1);
    expect(result.current.uhcdProj).toBe(0);
    expect(result.current.uhcdPlusProj).toBe(0);
  });
});