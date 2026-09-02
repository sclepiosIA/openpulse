import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnalyticsCalculator } from '../analytics/useAnalyticsCalculator';

const baseParams = {
  passages: 50000, baseline: 20, cible: 30, taux_mono: 60,
  taux_avis_baseline: 10, taux_avis_cible: 15,
  taux_ccmu2_baseline: 5, taux_ccmu2_cible: 8,
  taux_ccmu3_baseline: 3, taux_ccmu3_cible: 5,
  TARIF_UHCD: 800, TARIF_AVIS_SPE: 60, TARIF_CCMU2: 25, TARIF_CCMU3: 69,
  BONUS_MONORUM: 0.05,
};

describe('useAnalyticsCalculator', () => {
  it('calculates annual projections from monthly data', () => {
    const { result } = renderHook(() => useAnalyticsCalculator({
      params: baseParams,
      analyticsParams: { uhcdMois: 100, consultMois: 400, plusMois: 30, totalProj: 50000 },
    }));
    expect(result.current.uhcdAn).toBe(1200);
    expect(result.current.consultAn).toBe(4800);
    expect(result.current.uhcdMarqueAn).toBe(360);
    expect(result.current.totalPassagesInit).toBe(6000);
  });

  it('computes UHCD percentages', () => {
    const { result } = renderHook(() => useAnalyticsCalculator({
      params: baseParams,
      analyticsParams: { uhcdMois: 200, consultMois: 800, plusMois: 50, totalProj: 50000 },
    }));
    expect(result.current.pctUhcd).toBe(20);
    expect(result.current.pctUhcdPlus).toBe(25);
  });

  it('computes revenue baseline and plus', () => {
    const { result } = renderHook(() => useAnalyticsCalculator({
      params: baseParams,
      analyticsParams: { uhcdMois: 100, consultMois: 400, plusMois: 30, totalProj: 50000 },
    }));
    expect(result.current.revTotalBase).toBeGreaterThan(0);
    expect(result.current.revTotalPlus).toBeGreaterThan(0);
    expect(result.current.gainMonoRUM).toBeGreaterThan(0);
  });

  it('handles zero monthly values', () => {
    const { result } = renderHook(() => useAnalyticsCalculator({
      params: baseParams,
      analyticsParams: { uhcdMois: 0, consultMois: 0, plusMois: 0, totalProj: 0 },
    }));
    expect(result.current.pctUhcd).toBe(0);
    expect(result.current.revTotalBase).toBe(0);
  });

  it('computes ROI percentages', () => {
    const { result } = renderHook(() => useAnalyticsCalculator({
      params: baseParams,
      analyticsParams: { uhcdMois: 100, consultMois: 400, plusMois: 50, totalProj: 50000 },
    }));
    expect(typeof result.current.roiAnUhcdPct).toBe('number');
    expect(typeof result.current.roiAnTotalPct).toBe('number');
  });
});
