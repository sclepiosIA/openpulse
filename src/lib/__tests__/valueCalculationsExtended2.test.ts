import { describe, expect, it } from 'vitest';
import { calculateEtablissementValue, type EtablissementValueData } from '../valueCalculations';

describe('calculateEtablissementValue extended branches', () => {
  it('trouve un tarif avec une clé palier soulignée et un pallier numérique', () => {
    const etab: EtablissementValueData = {
      type_offre: 'Au succès',
      pallier_vise: 3,
      tarifs_palliers: { palier_3: '21000' },
    };

    expect(calculateEtablissementValue(etab)).toBe(21000);
  });

  it('trouve un tarif avec orthographe pallier soulignée', () => {
    const etab: EtablissementValueData = {
      type_offre: 'Au succès',
      pallier_vise: 'Pallier 4',
      tarifs_palliers: { pallier_4: 33000 },
    };

    expect(calculateEtablissementValue(etab)).toBe(33000);
  });

  it('ignore les tarifs sans numéro de pallier exploitable puis utilise le modèle statique', () => {
    const etab: EtablissementValueData = {
      type_offre: 'Au succès',
      pallier_vise: 'Grand compte',
      tarifs_palliers: { palier1: 9000 },
      modele_statique_succes: 12000,
    };

    expect(calculateEtablissementValue(etab)).toBe(12000);
  });

  it('retourne 0 pour un tarif trouvé mais non numérique', () => {
    const etab: EtablissementValueData = {
      type_offre: 'Au succès',
      pallier_vise: 'Palier 2',
      tarifs_palliers: { palier2: 'non-numerique' },
      nombre_passages_urgences_annuel: 5000,
    };

    expect(calculateEtablissementValue(etab)).toBe(0);
  });

  it('ignore les paliers quand le type offre n’est pas Au succès', () => {
    const etab: EtablissementValueData = {
      type_offre: 'Forfait',
      pallier_vise: 'Palier 2',
      tarifs_palliers: { palier2: 50000 },
      nombre_passages_urgences_annuel: 1000,
    };

    expect(calculateEtablissementValue(etab)).toBe(2000);
  });
});