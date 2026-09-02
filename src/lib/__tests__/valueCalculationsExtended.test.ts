import { describe, it, expect } from 'vitest';
import { calculateEtablissementValue, type EtablissementValueData } from '../valueCalculations';

describe('calculateEtablissementValue', () => {
  it('returns 0 for empty etab', () => {
    expect(calculateEtablissementValue({})).toBe(0);
  });

  it('priority 1: Au succès with pallier tarif', () => {
    const etab: EtablissementValueData = {
      type_offre: 'Au succès',
      pallier_vise: 'Palier 2',
      tarifs_palliers: { palier2: 15000 },
    };
    expect(calculateEtablissementValue(etab)).toBe(15000);
  });

  it('priority 1: case-insensitive pallier matching', () => {
    const etab: EtablissementValueData = {
      type_offre: 'Au succès',
      pallier_vise: 'Pallier 3',
      tarifs_palliers: { Pallier3: 20000 },
    };
    expect(calculateEtablissementValue(etab)).toBe(20000);
  });

  it('priority 1: returns 0 if pallier not found in tarifs', () => {
    const etab: EtablissementValueData = {
      type_offre: 'Au succès',
      pallier_vise: 'Palier 5',
      tarifs_palliers: { palier1: 5000 },
    };
    // Falls through to priority 2/3
    expect(calculateEtablissementValue(etab)).toBe(0);
  });

  it('priority 2: modele_statique_succes numeric', () => {
    const etab: EtablissementValueData = {
      modele_statique_succes: '12000',
    };
    expect(calculateEtablissementValue(etab)).toBe(12000);
  });

  it('priority 2: ignores non-numeric modele_statique', () => {
    const etab: EtablissementValueData = {
      modele_statique_succes: 'texte',
      nombre_passages_urgences_annuel: 5000,
    };
    expect(calculateEtablissementValue(etab)).toBe(10000); // falls to priority 3
  });

  it('priority 3: 2€ per passage', () => {
    const etab: EtablissementValueData = {
      nombre_passages_urgences_annuel: 30000,
    };
    expect(calculateEtablissementValue(etab)).toBe(60000);
  });

  it('priority order: Au succès beats modele_statique', () => {
    const etab: EtablissementValueData = {
      type_offre: 'Au succès',
      pallier_vise: 'Palier 1',
      tarifs_palliers: { palier1: 8000 },
      modele_statique_succes: '15000',
      nombre_passages_urgences_annuel: 50000,
    };
    expect(calculateEtablissementValue(etab)).toBe(8000);
  });

  it('priority order: modele_statique beats passage estimation', () => {
    const etab: EtablissementValueData = {
      modele_statique_succes: '25000',
      nombre_passages_urgences_annuel: 50000,
    };
    expect(calculateEtablissementValue(etab)).toBe(25000);
  });

  it('handles decimal modele_statique', () => {
    expect(calculateEtablissementValue({ modele_statique_succes: '12500.50' })).toBe(12500.50);
  });
});
