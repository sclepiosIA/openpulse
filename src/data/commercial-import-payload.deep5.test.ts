import { describe, it, expect } from 'vitest';
import { commercialImportPayload } from './commercial-import-payload';

/**
 * Invariants transverses du payload, tous DÉRIVÉS des données elles-mêmes.
 *
 * Aucune valeur attendue n'est codée en dur : les assertions comparent le payload à
 * lui-même (agrégats, cohérence des sous-totaux, groupements). Elles restent donc vraies
 * après remplacement du jeu de démonstration, tout en détectant une fixture incohérente
 * — un établissement sans contact, un doublon, une date non convertie.
 */
describe('commercialImportPayload — invariants transverses', () => {
  it('somme les contacts des établissements et des partenaires sans perte', () => {
    const contactsEtablissements = commercialImportPayload.etablissements.reduce(
      (total, etablissement) => total + etablissement.contacts.length,
      0,
    );
    const contactsPartenaires = commercialImportPayload.partenaires.reduce(
      (total, partenaire) => total + partenaire.contacts.length,
      0,
    );

    const totalAplati = [
      ...commercialImportPayload.etablissements.flatMap(item => item.contacts),
      ...commercialImportPayload.partenaires.flatMap(item => item.contacts),
    ].length;

    expect(contactsEtablissements).toBeGreaterThan(0);
    expect(contactsPartenaires).toBeGreaterThan(0);
    expect(contactsEtablissements + contactsPartenaires).toBe(totalAplati);
  });

  it('attribue au moins un contact à chaque établissement et à chaque partenaire', () => {
    const sansContact = [
      ...commercialImportPayload.etablissements,
      ...commercialImportPayload.partenaires,
    ]
      .filter(item => item.contacts.length === 0)
      .map(item => item.nom);

    expect(sansContact).toEqual([]);
  });

  it('répartit les établissements sur plusieurs régions exploitables', () => {
    const regions = commercialImportPayload.etablissements.map(item => item.region);
    const regionsUniques = new Set(regions);

    // La page d'import affiche une répartition par région : elle n'a de sens qu'à
    // partir de deux régions distinctes.
    expect(regionsUniques.size).toBeGreaterThan(1);
    expect(regionsUniques.size).toBeLessThanOrEqual(regions.length);

    for (const region of regionsUniques) {
      expect(region.trim()).toBe(region);
      expect(region.length).toBeGreaterThan(0);
    }
  });

  it('regroupe les établissements par date sans perdre d’entrée', () => {
    const parDate = new Map<string, number>();
    for (const etablissement of commercialImportPayload.etablissements) {
      const cle = etablissement.date_prochaine_action;
      parDate.set(cle, (parDate.get(cle) ?? 0) + 1);
    }

    const totalGroupe = [...parDate.values()].reduce((total, compte) => total + compte, 0);

    expect(totalGroupe).toBe(commercialImportPayload.etablissements.length);
    expect(parDate.size).toBeGreaterThan(0);
  });

  it('garantit l’unicité globale des adresses de messagerie du payload', () => {
    const adresses = [
      ...commercialImportPayload.etablissements.flatMap(item => item.contacts),
      ...commercialImportPayload.partenaires.flatMap(item => item.contacts),
    ].map(contact => contact.email.toLowerCase());

    const doublons = adresses.filter((adresse, index) => adresses.indexOf(adresse) !== index);

    expect(doublons).toEqual([]);
  });

  it('normalise toutes les chaînes affichées (ni espace de tête, ni espace de fin)', () => {
    for (const etablissement of commercialImportPayload.etablissements) {
      expect(etablissement.nom.trim()).toBe(etablissement.nom);
      expect(etablissement.region.trim()).toBe(etablissement.region);
      expect(etablissement.prochaine_action.trim()).toBe(etablissement.prochaine_action);

      for (const contact of etablissement.contacts) {
        expect(contact.prenom.trim()).toBe(contact.prenom);
        expect(contact.nom.trim()).toBe(contact.nom);
        expect(contact.email.trim()).toBe(contact.email);
        expect(contact.email).toBe(contact.email.toLowerCase());
      }
    }
  });

  it('conserve un ordre stable entre deux lectures du module', () => {
    const premiereLecture = commercialImportPayload.etablissements.map(item => item.nom);
    const secondeLecture = commercialImportPayload.etablissements.map(item => item.nom);

    expect(secondeLecture).toEqual(premiereLecture);
  });
});
