import { describe, it, expect } from 'vitest';
import {
  commercialImportPayload,
  type ImportContact,
  type ImportEtablissement,
} from './commercial-import-payload';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CLES_ETABLISSEMENT_REQUISES = [
  'contacts',
  'date_prochaine_action',
  'nom',
  'prochaine_action',
  'region',
] as const;

const CLES_CONTACT_REQUISES = ['email', 'fonction', 'nom', 'prenom'] as const;

function estDateSeuleValide(valeur: string): boolean {
  if (!ISO_DATE_RE.test(valeur)) {
    return false;
  }

  const horodatage = Date.parse(`${valeur}T00:00:00.000Z`);
  if (Number.isNaN(horodatage)) {
    return false;
  }

  // Rejette les dates syntaxiquement valides mais inexistantes (31 février, par exemple).
  return new Date(horodatage).toISOString().slice(0, 10) === valeur;
}

function contactEstImportable(contact: ImportContact): boolean {
  return (
    contact.prenom.trim().length > 0 &&
    contact.nom.trim().length > 0 &&
    contact.fonction.trim().length > 0 &&
    EMAIL_RE.test(contact.email) &&
    (contact.telephone === undefined || contact.telephone.trim().length > 0)
  );
}

/**
 * Contrat structurel des établissements du jeu de démonstration.
 *
 * Aucune identité nominative n'est asserée : ce qui doit rester vrai après remplacement du
 * jeu de démonstration par celui de l'organisation hôte, c'est que CHAQUE entrée reste
 * importable par la page d'import commercial.
 */
describe('commercialImportPayload — contrat structurel des établissements', () => {
  it('rend chaque établissement importable (champs requis, date seule valide, contacts valides)', () => {
    const invalides = commercialImportPayload.etablissements.filter(etablissement => {
      const champsRequis =
        etablissement.nom.trim().length > 0 &&
        etablissement.region.trim().length > 0 &&
        etablissement.prochaine_action.trim().length > 0 &&
        estDateSeuleValide(etablissement.date_prochaine_action);

      const contactsValides =
        etablissement.contacts.length > 0 && etablissement.contacts.every(contactEstImportable);

      return !champsRequis || !contactsValides;
    });

    // Le tableau est renvoyé tel quel pour que l'échec nomme l'entrée fautive.
    expect(invalides).toEqual([]);
  });

  it('porte au minimum les clés requises sur chaque établissement et chaque contact', () => {
    for (const etablissement of commercialImportPayload.etablissements) {
      const clesEtablissement = Object.keys(etablissement);
      for (const cle of CLES_ETABLISSEMENT_REQUISES) {
        expect(clesEtablissement).toContain(cle);
      }

      for (const contact of etablissement.contacts) {
        const clesContact = Object.keys(contact);
        for (const cle of CLES_CONTACT_REQUISES) {
          expect(clesContact).toContain(cle);
        }
      }
    }
  });

  it("n'expose aucune clé inconnue de l'interface ImportEtablissement", () => {
    const clesAutorisees = new Set([...CLES_ETABLISSEMENT_REQUISES, 'notes']);
    const clesContactAutorisees = new Set([...CLES_CONTACT_REQUISES, 'telephone']);

    for (const etablissement of commercialImportPayload.etablissements) {
      for (const cle of Object.keys(etablissement)) {
        expect(clesAutorisees.has(cle)).toBe(true);
      }
      for (const contact of etablissement.contacts) {
        for (const cle of Object.keys(contact)) {
          expect(clesContactAutorisees.has(cle)).toBe(true);
        }
      }
    }
  });

  it('renseigne des notes non vides lorsque le champ optionnel est présent', () => {
    const avecNotes = commercialImportPayload.etablissements.filter(
      (etablissement): etablissement is ImportEtablissement & { notes: string } =>
        etablissement.notes !== undefined,
    );

    for (const etablissement of avecNotes) {
      expect(etablissement.notes.trim().length).toBeGreaterThan(0);
    }
  });

  it('conserve des noms uniques et des adresses de messagerie uniques par établissement', () => {
    const noms = commercialImportPayload.etablissements.map(etablissement => etablissement.nom);
    expect(new Set(noms).size).toBe(noms.length);

    for (const etablissement of commercialImportPayload.etablissements) {
      const adresses = etablissement.contacts.map(contact => contact.email.toLowerCase());
      expect(new Set(adresses).size).toBe(adresses.length);
    }
  });
});
