import { describe, it, expect } from 'vitest';
import { newProspects, type ProspectData } from './newProspectsData';

const TYPES_ATTENDUS: ReadonlyArray<ProspectData['type']> = ['CH', 'GHT', 'CHU', 'ESPIC', 'Privé'];

const CLES_REQUISES = [
  'eta_signature',
  'dpi',
  'nom',
  'notes',
  'prix_unitaire_annuel',
  'region',
  'statut',
  'type',
  'ville',
] as const;

const CLES_OPTIONNELLES = ['adresse', 'code_postal'] as const;

/**
 * Contrat structurel du jeu de prospects de démonstration.
 *
 * Aucune identité d'établissement ni aucun effectif n'est codé en dur : l'organisation
 * hôte doit pouvoir substituer ses propres prospects sans casser la suite de tests.
 */
describe('newProspectsData — contrat structurel', () => {
  it('expose un tableau non vide', () => {
    expect(Array.isArray(newProspects)).toBe(true);
    expect(newProspects.length).toBeGreaterThan(0);
  });

  it('porte toutes les clés requises et aucune clé inconnue', () => {
    const clesAutorisees = new Set<string>([...CLES_REQUISES, ...CLES_OPTIONNELLES]);

    for (const prospect of newProspects) {
      const cles = Object.keys(prospect);

      for (const cle of CLES_REQUISES) {
        expect(cles).toContain(cle);
      }
      for (const cle of cles) {
        expect(clesAutorisees.has(cle)).toBe(true);
      }
    }
  });

  it("restreint le type d'établissement à l'union déclarée", () => {
    for (const prospect of newProspects) {
      expect(TYPES_ATTENDUS).toContain(prospect.type);
    }
  });

  it('renseigne un nom, une ville et une région exploitables', () => {
    for (const prospect of newProspects) {
      expect(prospect.nom.trim().length).toBeGreaterThan(0);
      expect(prospect.nom.trim()).toBe(prospect.nom);
      expect(prospect.ville.trim().length).toBeGreaterThan(0);
      expect(prospect.region.trim().length).toBeGreaterThan(0);
    }
  });

  it('conserve des noms de prospects uniques', () => {
    const noms = newProspects.map(prospect => prospect.nom);
    expect(new Set(noms).size).toBe(noms.length);
  });

  it('typé nullable : dpi, notes et eta_signature sont null ou des chaînes non vides', () => {
    for (const prospect of newProspects) {
      for (const valeur of [prospect.dpi, prospect.notes, prospect.eta_signature]) {
        if (valeur !== null) {
          expect(typeof valeur).toBe('string');
          expect(valeur.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('exprime le prix unitaire annuel en entier positif ou en null', () => {
    for (const prospect of newProspects) {
      if (prospect.prix_unitaire_annuel !== null) {
        expect(typeof prospect.prix_unitaire_annuel).toBe('number');
        expect(Number.isFinite(prospect.prix_unitaire_annuel)).toBe(true);
        expect(Number.isInteger(prospect.prix_unitaire_annuel)).toBe(true);
        expect(prospect.prix_unitaire_annuel).toBeGreaterThan(0);
      }
    }
  });

  it('renseigne un code postal à cinq chiffres et une adresse non vide lorsque présents', () => {
    for (const prospect of newProspects) {
      if (prospect.code_postal !== undefined) {
        expect(prospect.code_postal).toMatch(/^\d{5}$/);
      }
      if (prospect.adresse !== undefined) {
        expect(prospect.adresse.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
