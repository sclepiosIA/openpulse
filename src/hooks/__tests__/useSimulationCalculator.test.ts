import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSimulationCalculator } from '../quote/useSimulationCalculator';

const params = {
  passages: 50000, baseline: 20, cible: 30, taux_mono: 60,
  taux_avis_baseline: 10, taux_avis_cible: 15,
  taux_ccmu2_baseline: 5, taux_ccmu2_cible: 8,
  taux_ccmu3_baseline: 3, taux_ccmu3_cible: 5,
  TARIF_UHCD: 800, TARIF_AVIS_SPE: 60, TARIF_CCMU2: 25, TARIF_CCMU3: 69,
  BONUS_MONORUM: 0.05,
};

describe('useSimulationCalculator', () => {
  it('calculates UHCD volumes correctly', () => {
    const { result } = renderHook(() => useSimulationCalculator(params));
    expect(result.current.uhcdBaseline).toBe(10000); // 50000 * 20%
    expect(result.current.uhcdTarget).toBe(15000); // 50000 * 30%
    expect(result.current.uhcdDiff).toBe(5000);
  });

  it('calculates consultation volumes', () => {
    const { result } = renderHook(() => useSimulationCalculator(params));
    expect(result.current.consultExtBaseline).toBe(40000); // 50000 - 10000
    expect(result.current.consultExtTarget).toBe(35000); // 50000 - 15000
  });

  it('returns 5 leviers', () => {
    const { result } = renderHook(() => useSimulationCalculator(params));
    expect(result.current.leviers).toHaveLength(5);
  });

  it('total gains are positive', () => {
    const { result } = renderHook(() => useSimulationCalculator(params));
    expect(result.current.totalGainBaseline).toBeGreaterThan(0);
    expect(result.current.totalGainTarget).toBeGreaterThan(0);
    expect(result.current.totalGainDiff).toBeGreaterThan(0);
  });

  it('gain par dossier is calculated', () => {
    const { result } = renderHook(() => useSimulationCalculator(params));
    // TARIF_UHCD + BONUS * TARIF_UHCD * taux_mono / 100 = 800 + 0.05 * 800 * 60/100 = 800 + 24 = 824
    expect(result.current.gainParDossier).toBe(824);
  });

  it('handles zero passages', () => {
    const zeroParams = { ...params, passages: 0 };
    const { result } = renderHook(() => useSimulationCalculator(zeroParams));
    expect(result.current.uhcdBaseline).toBe(0);
    expect(result.current.totalGainBaseline).toBe(0);
  });
});
