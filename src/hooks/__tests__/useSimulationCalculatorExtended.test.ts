import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSimulationCalculator } from '../quote/useSimulationCalculator';

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

describe('useSimulationCalculator', () => {
  it('computes UHCD volumes', () => {
    const { result } = renderHook(() => useSimulationCalculator(defaultParams));
    expect(result.current.uhcdBaseline).toBe(Math.round(50000 * 0.15));
    expect(result.current.uhcdTarget).toBe(Math.round(50000 * 0.20));
    expect(result.current.uhcdDiff).toBe(Math.round(50000 * 0.05));
  });

  it('computes mono-RUM volumes', () => {
    const { result } = renderHook(() => useSimulationCalculator(defaultParams));
    expect(result.current.monoBaseline).toBe(Math.round(7500 * 0.70));
    expect(result.current.monoTarget).toBe(Math.round(10000 * 0.70));
  });

  it('computes consultation ext volumes', () => {
    const { result } = renderHook(() => useSimulationCalculator(defaultParams));
    expect(result.current.consultExtBaseline).toBe(Math.round(50000 - 7500));
    expect(result.current.consultExtTarget).toBe(Math.round(50000 - 10000));
  });

  it('computes 5 levier rows', () => {
    const { result } = renderHook(() => useSimulationCalculator(defaultParams));
    expect(result.current.leviers).toHaveLength(5);
  });

  it('has positive total gains', () => {
    const { result } = renderHook(() => useSimulationCalculator(defaultParams));
    expect(result.current.totalGainBaseline).toBeGreaterThan(0);
    expect(result.current.totalGainTarget).toBeGreaterThan(0);
    expect(result.current.totalGainDiff).not.toBe(0);
  });

  it('computes gainParDossier', () => {
    const { result } = renderHook(() => useSimulationCalculator(defaultParams));
    const expected = 750 + (0.05 * 750 * 70 / 100);
    expect(result.current.gainParDossier).toBeCloseTo(expected, 2);
  });

  it('handles zero passages', () => {
    const { result } = renderHook(() => useSimulationCalculator({ ...defaultParams, passages: 0 }));
    expect(result.current.uhcdBaseline).toBe(0);
    expect(result.current.uhcdTarget).toBe(0);
    expect(result.current.totalGainBaseline).toBe(0);
  });

  it('levier rows have consistent structure', () => {
    const { result } = renderHook(() => useSimulationCalculator(defaultParams));
    result.current.leviers.forEach(l => {
      expect(l.levier).toBeTruthy();
      expect(typeof l.volumeBaseline).toBe('number');
      expect(typeof l.gainBaseline).toBe('number');
      expect(typeof l.volumeTarget).toBe('number');
      expect(typeof l.gainTarget).toBe('number');
      expect(typeof l.volumeDiff).toBe('number');
      expect(typeof l.gainDiff).toBe('number');
    });
  });
});
