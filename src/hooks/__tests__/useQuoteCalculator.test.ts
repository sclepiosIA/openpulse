import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useQuoteCalculator } from '../quote/useQuoteCalculator';

const baseParams = {
  passages: 50000, baseline: 20, cible: 30, taux_mono: 60,
  taux_avis_baseline: 10, taux_avis_cible: 15,
  taux_ccmu2_baseline: 5, taux_ccmu2_cible: 8,
  taux_ccmu3_baseline: 3, taux_ccmu3_cible: 5,
  TARIF_UHCD: 800, TARIF_AVIS_SPE: 60, TARIF_CCMU2: 25, TARIF_CCMU3: 69,
  BONUS_MONORUM: 0.05,
};

const mockConfig = {
  centerType: { id: 'chu', label: 'CHU', multiplicateurFrais: 1.5, prixPAU: 2 },
  dpiType: { id: 'standard', label: 'Standard', baseFrais: 10000 },
  resellerType: null,
  valorisationLevel: 'second' as const,
};

describe('useQuoteCalculator', () => {
  it('returns null when configuration is null', () => {
    const { result } = renderHook(() => useQuoteCalculator({ params: baseParams, configuration: null }));
    expect(result.current).toBeNull();
  });

  it('returns results with valid configuration', () => {
    const { result } = renderHook(() => useQuoteCalculator({ params: baseParams, configuration: mockConfig as any }));
    expect(result.current).not.toBeNull();
    expect(result.current!.passagesAnnuels).toBe(50000);
    expect(result.current!.uhcdActuels).toBe(10000); // 50000 * 20%
  });

  it('computes 4 paliers', () => {
    const { result } = renderHook(() => useQuoteCalculator({ params: baseParams, configuration: mockConfig as any }));
    expect(result.current!.paliers).toHaveLength(4);
  });

  it('paliers have increasing multiplicateur', () => {
    const { result } = renderHook(() => useQuoteCalculator({ params: baseParams, configuration: mockConfig as any }));
    const mults = result.current!.paliers.map(p => p.multiplicateur);
    for (let i = 1; i < mults.length; i++) {
      expect(mults[i]).toBeGreaterThanOrEqual(mults[i - 1]);
    }
  });

  it('computes baseline gains', () => {
    const { result } = renderHook(() => useQuoteCalculator({ params: baseParams, configuration: mockConfig as any }));
    expect(result.current!.gainUhcdBaseline).toBe(10000 * 800); // 8M
    expect(result.current!.gainAvisBaseline).toBeGreaterThan(0);
    expect(result.current!.gainCcmu2Baseline).toBeGreaterThan(0);
    expect(result.current!.gainCcmu3Baseline).toBeGreaterThan(0);
  });

  it('palier ROI net accounts for costs', () => {
    const { result } = renderHook(() => useQuoteCalculator({ params: baseParams, configuration: mockConfig as any }));
    const p = result.current!.paliers[0];
    expect(p.roiNet).toBe(p.roiTotal - p.coutTotal);
  });

  it('applies reseller markup when provided', () => {
    const configWithReseller = {
      ...mockConfig,
      resellerType: { id: 'reseller', label: 'Revendeur', markup: 0.2 },
    };
    const { result } = renderHook(() => useQuoteCalculator({ params: baseParams, configuration: configWithReseller as any }));
    const p = result.current!.paliers[0];
    expect(p.coutTotalRevendeur).toBeGreaterThan(p.coutTotal);
    expect(p.fraisAccesRevendeur).toBe(p.fraisAcces * 1.2);
  });
});
