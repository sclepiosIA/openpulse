import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SIMULATION_PARAMS,
  CENTER_TYPES,
  DPI_TYPES,
} from '../simulator-config';

describe('simulator-config', () => {
  it('DEFAULT_SIMULATION_PARAMS has valid baseline/cible relationships', () => {
    const p = DEFAULT_SIMULATION_PARAMS;
    expect(p.passages).toBeGreaterThan(0);
    expect(p.cible).toBeGreaterThan(p.baseline);
    expect(p.taux_avis_cible).toBeGreaterThan(p.taux_avis_baseline);
    expect(p.taux_ccmu2_cible).toBeGreaterThan(p.taux_ccmu2_baseline);
    expect(p.taux_ccmu3_cible).toBeGreaterThan(p.taux_ccmu3_baseline);
    expect(p.taux_mono).toBeGreaterThan(0);
    expect(p.taux_mono).toBeLessThanOrEqual(100);
  });

  it('tarifs are positive numbers', () => {
    const p = DEFAULT_SIMULATION_PARAMS;
    expect(p.TARIF_UHCD).toBeGreaterThan(0);
    expect(p.TARIF_AVIS_SPE).toBeGreaterThan(0);
    expect(p.TARIF_CCMU2).toBeGreaterThan(0);
    expect(p.TARIF_CCMU3).toBeGreaterThan(0);
    expect(p.BONUS_MONORUM).toBeGreaterThan(0);
  });

  it('CENTER_TYPES are well-formed and unique', () => {
    expect(CENTER_TYPES.length).toBeGreaterThanOrEqual(3);
    const ids = CENTER_TYPES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CENTER_TYPES) {
      expect(typeof c.name).toBe('string');
      expect(c.prixPAU).toBeGreaterThan(0);
      expect(c.multiplicateurFrais).toBeGreaterThan(0);
    }
  });

  it('CENTER_TYPES is sorted by increasing prixPAU', () => {
    for (let i = 1; i < CENTER_TYPES.length; i++) {
      expect(CENTER_TYPES[i].prixPAU).toBeGreaterThanOrEqual(CENTER_TYPES[i - 1].prixPAU);
    }
  });

  it('DPI_TYPES is a non-empty array with unique ids', () => {
    expect(Array.isArray(DPI_TYPES)).toBe(true);
    expect(DPI_TYPES.length).toBeGreaterThan(0);
    const ids = DPI_TYPES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
