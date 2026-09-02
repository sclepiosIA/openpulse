import { describe, it, expect } from 'vitest';
import { calculateEtablissementValue, type EtablissementValueData } from '../valueCalculations';

describe('calculateEtablissementValue', () => {
  it('uses pallier tarif when Au succès with matching pallier', () => {
    const etab: EtablissementValueData = {
      type_offre: 'Au succès',
      pallier_vise: 'Palier 2',
      tarifs_palliers: { palier2: 15000 },
    };
    expect(calculateEtablissementValue(etab)).toBe(15000);
  });

  it('handles pallier variant spelling', () => {
    const etab: EtablissementValueData = {
      type_offre: 'Au succès',
      pallier_vise: 'Pallier 1',
      tarifs_palliers: { pallier1: 8000 },
    };
    expect(calculateEtablissementValue(etab)).toBe(8000);
  });

  it('falls back to modele_statique_succes when numeric', () => {
    const etab: EtablissementValueData = {
      modele_statique_succes: '12000',
    };
    expect(calculateEtablissementValue(etab)).toBe(12000);
  });

  it('skips non-numeric modele_statique_succes', () => {
    const etab: EtablissementValueData = {
      modele_statique_succes: 'Au succès',
      nombre_passages_urgences_annuel: 5000,
    };
    expect(calculateEtablissementValue(etab)).toBe(10000); // 5000 * 2
  });

  it('estimates from passages at 2€/passage', () => {
    const etab: EtablissementValueData = {
      nombre_passages_urgences_annuel: 20000,
    };
    expect(calculateEtablissementValue(etab)).toBe(40000);
  });

  it('returns 0 when no data', () => {
    expect(calculateEtablissementValue({})).toBe(0);
  });
});
