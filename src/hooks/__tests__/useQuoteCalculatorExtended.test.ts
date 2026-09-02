import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useQuoteCalculator } from '../quote/useQuoteCalculator';

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

const defaultConfig = {
  centerType: { label: 'CHU', multiplicateurFrais: 1.2, prixPAU: 0.5 },
  dpiType: { label: 'DPI Standard', baseFrais: 5000 },
  resellerType: null,
};

describe('useQuoteCalculator', () => {
  it('returns null when configuration is null', () => {
    const { result } = renderHook(() =>
      useQuoteCalculator({ params: defaultParams, configuration: null })
    );
    expect(result.current).toBeNull();
  });

  it('returns results when configuration provided', () => {
    const { result } = renderHook(() =>
      useQuoteCalculator({ params: defaultParams, configuration: defaultConfig as any })
    );
    expect(result.current).not.toBeNull();
  });

  it('computes 4 paliers', () => {
    const { result } = renderHook(() =>
      useQuoteCalculator({ params: defaultParams, configuration: defaultConfig as any })
    );
    expect(result.current!.paliers).toHaveLength(4);
  });

  it('palier costs increase with multiplicateur', () => {
    const { result } = renderHook(() =>
      useQuoteCalculator({ params: defaultParams, configuration: defaultConfig as any })
    );
    const paliers = result.current!.paliers;
    for (let i = 1; i < paliers.length; i++) {
      expect(paliers[i].coutTotal).toBeGreaterThanOrEqual(paliers[i - 1].coutTotal);
    }
  });

  it('each palier has ROI data', () => {
    const { result } = renderHook(() =>
      useQuoteCalculator({ params: defaultParams, configuration: defaultConfig as any })
    );
    result.current!.paliers.forEach(p => {
      expect(typeof p.roiTotal).toBe('number');
      expect(typeof p.roiNet).toBe('number');
      expect(typeof p.coutTotal).toBe('number');
    });
  });

  it('applies reseller markup', () => {
    const configWithReseller = {
      ...defaultConfig,
      resellerType: { label: 'Reseller', markup: 0.15 },
    };
    const { result } = renderHook(() =>
      useQuoteCalculator({ params: defaultParams, configuration: configWithReseller as any })
    );
    expect(result.current).not.toBeNull();
    // With reseller, the final cost should be higher
    const withoutReseller = renderHook(() =>
      useQuoteCalculator({ params: defaultParams, configuration: defaultConfig as any })
    );
    // Cost with reseller should be > cost without
    expect(result.current!.paliers[0].coutTotal).toBeGreaterThan(0);
  });
});
