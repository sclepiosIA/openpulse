import { describe, it, expect } from 'vitest';
import {
  commercialImportPayload,
  type ImportContact,
  type ImportPartenaire,
} from './commercial-import-payload';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CLES_PARTENAIRE = [
  'contacts',
  'date_prochaine_action',
  'nom',
  'prochaine_action',
  'sujet',
  'type',
] as const;

function contactEstImportable(contact: ImportContact): boolean {
  return (
    contact.prenom.trim().length > 0 &&
    contact.nom.trim().length > 0 &&
    contact.fonction.trim().length > 0 &&
    EMAIL_RE.test(contact.email) &&
    (contact.telephone === undefined || contact.telephone.trim().length > 0)
  );
}

function premierPartenaire(): ImportPartenaire {
  const partenaire = commercialImportPayload.partenaires[0];
  if (partenaire === undefined) {
    throw new Error('commercialImportPayload.partenaires est vide');
  }
  return partenaire;
}

/**
 * Contrat structurel des partenaires du jeu de démonstration.
 *
 * `ImportPartenaire` n'a aucun champ optionnel : la forme des objets est donc vérifiable
 * par égalité stricte de l'ensemble des clés, ce qui protège contre une dérive silencieuse
 * du jeu de démonstration lors d'un remplacement par l'organisation hôte.
 */
describe('commercialImportPayload — contrat structurel des partenaires', () => {
  it('expose exactement les six clés de ImportPartenaire sur chaque entrée', () => {
    expect(commercialImportPayload.partenaires.length).toBeGreaterThan(0);

    for (const partenaire of commercialImportPayload.partenaires) {
      expect(Object.keys(partenaire).sort()).toEqual([...CLES_PARTENAIRE]);
    }
  });

  it('rend chaque partenaire importable avec une date seule ISO et des contacts valides', () => {
    const invalides = commercialImportPayload.partenaires.filter(partenaire => {
      const champsRequis =
        partenaire.nom.trim().length > 0 &&
        partenaire.type.trim().length > 0 &&
        partenaire.sujet.trim().length > 0 &&
        partenaire.prochaine_action.trim().length > 0 &&
        ISO_DATE_RE.test(partenaire.date_prochaine_action) &&
        !Number.isNaN(Date.parse(`${partenaire.date_prochaine_action}T00:00:00.000Z`));

      const contactsValides =
        partenaire.contacts.length > 0 && partenaire.contacts.every(contactEstImportable);

      return !champsRequis || !contactsValides;
    });

    expect(invalides).toEqual([]);
  });

  it('conserve des noms de partenaires uniques', () => {
    const noms = commercialImportPayload.partenaires.map(partenaire => partenaire.nom);
    expect(new Set(noms).size).toBe(noms.length);
  });

  it('décrit le premier partenaire avec un sujet et une action lisibles', () => {
    const partenaire = premierPartenaire();

    expect(partenaire.sujet.trim().length).toBeGreaterThan(0);
    expect(partenaire.prochaine_action.trim().length).toBeGreaterThan(0);
    expect(partenaire.contacts.length).toBeGreaterThan(0);
  });

  it('partage la même forme de contact entre établissements et partenaires', () => {
    const clesAutorisees = new Set(['email', 'fonction', 'nom', 'prenom', 'telephone']);

    const tousLesContacts: ImportContact[] = [
      ...commercialImportPayload.etablissements.flatMap(etablissement => etablissement.contacts),
      ...commercialImportPayload.partenaires.flatMap(partenaire => partenaire.contacts),
    ];

    expect(tousLesContacts.length).toBeGreaterThan(0);

    for (const contact of tousLesContacts) {
      for (const cle of Object.keys(contact)) {
        expect(clesAutorisees.has(cle)).toBe(true);
      }
    }
  });
});
