import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnalyticsCalculator } from '../analytics/useAnalyticsCalculator';

const defaultParams = {
  passages: 50000,
  baseline: 15,
  cible: 20,
  taux_mono: 70,
  taux_avis_baseline: 5,
  taux_avis_cible: 8,
  taux_ccmu2_baseline: 10,
  taux_ccmu2_cible: 12,
  taux_ccmu3_baseline: 3,
  taux_ccmu3_cible: 4,
  TARIF_UHCD: 750,
  TARIF_AVIS_SPE: 28,
  TARIF_CCMU2: 15,
  TARIF_CCMU3: 25,
  BONUS_MONORUM: 0.05,
};

const defaultAnalytics = {
  uhcdMois: 200,
  consultMois: 1000,
  plusMois: 50,
  totalProj: 20000,
};

describe('useAnalyticsCalculator', () => {
  it('computes annual values from monthly', () => {
    const { result } = renderHook(() =>
      useAnalyticsCalculator({ params: defaultParams, analyticsParams: defaultAnalytics })
    );
    expect(result.current.uhcdAn).toBe(2400);
    expect(result.current.consultAn).toBe(12000);
    expect(result.current.uhcdMarqueAn).toBe(600);
    expect(result.current.totalPassagesInit).toBe(14400);
  });

  it('computes UHCD percentages', () => {
    const { result } = renderHook(() =>
      useAnalyticsCalculator({ params: defaultParams, analyticsParams: defaultAnalytics })
    );
    // uhcdMois / (uhcdMois + consultMois) * 100
    const expected = (200 / 1200) * 100;
    expect(result.current.pctUhcd).toBeCloseTo(expected, 2);
  });

  it('computes revenue totals', () => {
    const { result } = renderHook(() =>
      useAnalyticsCalculator({ params: defaultParams, analyticsParams: defaultAnalytics })
    );
    expect(result.current.revTotalBase).toBeGreaterThan(0);
    expect(result.current.revTotalPlus).toBeGreaterThan(0);
  });

  it('computes ROI percentages', () => {
    const { result } = renderHook(() =>
      useAnalyticsCalculator({ params: defaultParams, analyticsParams: defaultAnalytics })
    );
    expect(typeof result.current.roiAnUhcdPct).toBe('number');
    expect(typeof result.current.roiAnTotalPct).toBe('number');
  });

  it('computes scale projection', () => {
    const { result } = renderHook(() =>
      useAnalyticsCalculator({ params: defaultParams, analyticsParams: defaultAnalytics })
    );
    // scale = totalProj / totalPassagesInit = 20000 / 14400
    expect(result.current.scale).toBeCloseTo(20000 / 14400, 4);
    expect(result.current.uhcdProj).toBe(Math.round(2400 * result.current.scale));
  });

  it('handles zero totalPassagesInit gracefully', () => {
    const { result } = renderHook(() =>
      useAnalyticsCalculator({
        params: defaultParams,
        analyticsParams: { uhcdMois: 0, consultMois: 0, plusMois: 0, totalProj: 10000 },
      })
    );
    expect(result.current.scale).toBe(1);
  });

  it('gainMonoRUM is positive', () => {
    const { result } = renderHook(() =>
      useAnalyticsCalculator({ params: defaultParams, analyticsParams: defaultAnalytics })
    );
    expect(result.current.gainMonoRUM).toBeGreaterThan(0);
  });
});
