import { describe, it, expect } from 'vitest';
import { newProspects, type ProspectData } from './newProspectsData';

/**
 * Traitement conjoint obligatoire avec `newProspectsData.ts` : ce test figeait des
 * etablissements de l amont (« CH Albi », « CHU Bordeaux »). Il valide desormais la
 * forme, la coherence des enumeres attendus par `ImportNewProspects`, et la neutralite
 * du jeu de demonstration.
 */

const TYPES_ATTENDUS: ProspectData['type'][] = ['CH', 'GHT', 'CHU', 'ESPIC', 'Privé'];

// Cles reconnues par `mapStatut` dans ImportNewProspects.tsx. Toute autre valeur
// retombe silencieusement sur le statut « Prospect » a l import.
const STATUTS_MAPPES = [
  'I-Etude médico-éco émise',
  'H-Dans les rdvs',
  'G-Attente post rdv',
  'F-RDV pris',
  'E-Attente rdv',
  'C-Bloqué',
  'B-Reporté',
];

// Libelles que `mapDPI` sait convertir sans retomber sur le repli generique,
// volontairement depourvus de tout nom de produit tiers.
const DPI_AUTORISES = ['Maison', 'Autres lourd', 'Autres web', 'Inconnu'];

describe('newProspectsData module', () => {
  it('exporte un tableau newProspects de 12 entrees', () => {
    expect(Array.isArray(newProspects)).toBe(true);
    expect(newProspects).toHaveLength(12);
  });

  it('reste au-dessus du seuil de 10 pour que l ecran affiche « ... et N autres »', () => {
    expect(newProspects.length).toBeGreaterThan(10);
  });

  it('contient uniquement des objets conformes à ProspectData', () => {
    for (const prospect of newProspects) {
      const p: ProspectData = prospect;

      expect(typeof p.nom).toBe('string');
      expect(p.nom.length).toBeGreaterThan(0);
      expect(TYPES_ATTENDUS).toContain(p.type);
      expect(typeof p.statut).toBe('string');

      if (p.dpi !== null) {
        expect(typeof p.dpi).toBe('string');
      }

      if (p.prix_unitaire_annuel !== null) {
        expect(typeof p.prix_unitaire_annuel).toBe('number');
        expect(p.prix_unitaire_annuel).toBeGreaterThanOrEqual(0);
      }

      if (p.eta_signature !== null) {
        expect(typeof p.eta_signature).toBe('string');
      }

      if (p.notes !== null) {
        expect(typeof p.notes).toBe('string');
      }

      expect(typeof p.ville).toBe('string');
      expect(typeof p.region).toBe('string');

      if (p.adresse !== undefined) {
        expect(typeof p.adresse).toBe('string');
        expect(p.adresse.length).toBeGreaterThan(0);
      }

      if (p.code_postal !== undefined) {
        expect(p.code_postal).toMatch(/^\d{5}$/);
      }
    }
  });

  it('n utilise que des statuts reconnus par le mapping d import', () => {
    for (const p of newProspects) {
      expect(STATUTS_MAPPES).toContain(p.statut);
    }
  });

  it('couvre les cinq types d etablissement supportes par l enumere', () => {
    const types = new Set(newProspects.map((p) => p.type));
    for (const attendu of TYPES_ATTENDUS) {
      expect(types.has(attendu)).toBe(true);
    }
  });

  it('n utilise que des libelles de dossier patient generiques', () => {
    for (const p of newProspects) {
      if (p.dpi !== null) {
        expect(DPI_AUTORISES).toContain(p.dpi);
      }
    }
  });

  it('contient au moins un prospect sans prix et un ETA « soon »', () => {
    expect(newProspects.some((p) => p.prix_unitaire_annuel === null)).toBe(true);
    expect(newProspects.some((p) => p.eta_signature === 'soon')).toBe(true);
    expect(newProspects.some((p) => p.eta_signature === null)).toBe(true);
  });

  it('ne contient pas de doublon exact de nom + ville', () => {
    const seen = new Set<string>();
    for (const p of newProspects) {
      const key = `${p.nom}::${p.ville}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('ne contient pas de doublon d adresse ni de code postal', () => {
    const adresses = newProspects.map((p) => p.adresse).filter(Boolean);
    const codes = newProspects.map((p) => p.code_postal).filter(Boolean);
    expect(new Set(adresses).size).toBe(adresses.length);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('ancre un prospect precis du jeu de demonstration (CH Villebrume)', () => {
    const villebrume = newProspects.find((p) => p.nom === 'CH Villebrume');
    expect(villebrume).toBeDefined();
    if (!villebrume) return;

    expect(villebrume.type).toBe('CH');
    expect(villebrume.ville).toBe('Villebrume');
    expect(villebrume.region).toBe('Occitanie');
    expect(villebrume.dpi).toBe('Maison');
    expect(villebrume.prix_unitaire_annuel).toBe(37510);
    expect(villebrume.eta_signature).toBe('2026 T3');
  });

  it('ancre le prospect sans prix (CHU Pierrefosse)', () => {
    const pierrefosse = newProspects.find((p) => p.nom === 'CHU Pierrefosse');
    expect(pierrefosse).toBeDefined();
    if (!pierrefosse) return;

    expect(pierrefosse.type).toBe('CHU');
    expect(pierrefosse.prix_unitaire_annuel).toBeNull();
    expect(pierrefosse.ville).toBe('Pierrefosse');
  });
});
