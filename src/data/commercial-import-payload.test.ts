import { describe, it, expect } from 'vitest';
import {
  commercialImportPayload,
  commercialWeekToDate,
  ImportContact,
  ImportEtablissement,
} from './commercial-import-payload';

/**
 * Ce test valide deux choses distinctes :
 *  1. la convention de dates « Semaine N » (logique metier, inchangee) ;
 *  2. les invariants de forme ET de NEUTRALITE du jeu de demonstration OpenPulse
 *     (aucune donnee reelle : domaines reserves, numeros de fiction).
 *
 * Il remplace les assertions amont qui figeaient des noms, adresses de messagerie et
 * numeros de telephone reels : elles ne pouvaient pas survivre a la substitution du
 * jeu de donnees.
 */

// Domaines reserves par la norme : RFC 2606 (.test / .example / .invalid + example.*)
// et RFC 6761. Aucun d'entre eux ne peut etre enregistre par un tiers.
const DOMAINES_RESERVES = /@[a-z0-9.-]+\.(?:example\.(?:org|com|net)|test|invalid|example)$/i;

// Plages francaises reservees a la fiction, en notation pointee.
const TELEPHONE_FICTION = /^(?:01\.99\.00|02\.61\.91|03\.53\.01|04\.65\.71|05\.36\.49|06\.39\.98)(?:\.\d{2}){2}$/;

function findEtab(nom: string): ImportEtablissement | undefined {
  return commercialImportPayload.etablissements.find((e) => e.nom === nom);
}

function tousLesContacts(): ImportContact[] {
  return [
    ...commercialImportPayload.etablissements.flatMap((e) => e.contacts),
    ...commercialImportPayload.partenaires.flatMap((p) => p.contacts),
  ];
}

describe('commercialWeekToDate', () => {
  it('utilise la convention du premier lundi et non la numerotation ISO-8601', () => {
    expect(commercialWeekToDate('Semaine 1')).toBe('2026-01-05');
    expect(commercialWeekToDate('Semaine 13')).toBe('2026-03-30');
  });

  it('reconnait les mois abreges et les dates explicites', () => {
    expect(commercialWeekToDate('sept.')).toBe('2026-09-01');
    expect(commercialWeekToDate('15.05.2026')).toBe('2026-05-15');
    expect(commercialWeekToDate('inconnu')).toBe('2026-04-15');
  });
});

describe('commercialImportPayload — forme', () => {
  it('expose deux tableaux non vides', () => {
    expect(Array.isArray(commercialImportPayload.etablissements)).toBe(true);
    expect(Array.isArray(commercialImportPayload.partenaires)).toBe(true);
    expect(commercialImportPayload.etablissements.length).toBe(12);
    expect(commercialImportPayload.partenaires.length).toBe(6);
  });

  it('garantit des noms d etablissement uniques', () => {
    const noms = commercialImportPayload.etablissements.map((e) => e.nom);
    expect(new Set(noms).size).toBe(noms.length);
  });

  it('garantit des adresses de messagerie uniques sur tout le payload', () => {
    const emails = tousLesContacts().map((c) => c.email.toLowerCase());
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('renseigne tous les champs obligatoires de chaque contact', () => {
    for (const c of tousLesContacts()) {
      expect(typeof c.prenom).toBe('string');
      expect(c.prenom.length).toBeGreaterThan(0);
      expect(typeof c.nom).toBe('string');
      expect(c.nom.length).toBeGreaterThan(0);
      expect(typeof c.fonction).toBe('string');
      expect(c.fonction.length).toBeGreaterThan(0);
      expect(c.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    }
  });

  it('produit une date ISO date-only pour chaque echeance', () => {
    const dates = [
      ...commercialImportPayload.etablissements.map((e) => e.date_prochaine_action),
      ...commercialImportPayload.partenaires.map((p) => p.date_prochaine_action),
    ];
    for (const d of dates) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(`${d}T00:00:00.000Z`).getTime())).toBe(false);
    }
  });

  it('couvre plusieurs regions pour que la repartition de l ecran d import reste lisible', () => {
    const regions = new Set(commercialImportPayload.etablissements.map((e) => e.region));
    expect(regions.size).toBeGreaterThanOrEqual(5);
    expect(regions.has('Île-de-France')).toBe(true);
    expect(regions.has('Auvergne-Rhône-Alpes')).toBe(true);
  });
});

describe('commercialImportPayload — neutralite des donnees', () => {
  it('n utilise que des domaines reserves pour les adresses de messagerie', () => {
    for (const c of tousLesContacts()) {
      expect(c.email).toMatch(DOMAINES_RESERVES);
    }
  });

  it('n utilise que des numeros appartenant aux plages reservees a la fiction', () => {
    const telephones = tousLesContacts()
      .map((c) => c.telephone)
      .filter((t): t is string => typeof t === 'string');

    expect(telephones.length).toBeGreaterThan(0);
    for (const t of telephones) {
      expect(t).toMatch(TELEPHONE_FICTION);
    }
  });
});

describe('commercialImportPayload — ancrages metier', () => {
  it("GHT Val d'Ombreuse porte 4 contacts et la semaine 12", () => {
    const etab = findEtab("GHT Val d'Ombreuse");
    expect(etab).toBeDefined();
    expect(etab?.region).toBe('Île-de-France');
    expect(etab?.date_prochaine_action).toBe(commercialWeekToDate('Semaine 12'));
    expect(etab?.contacts.length).toBe(4);
    expect(etab?.contacts[0]?.fonction).toBe('DG');
  });

  it('CH Marnecourt utilise le repli « sept. » et conserve son telephone', () => {
    const etab = findEtab('CH Marnecourt');
    expect(etab).toBeDefined();
    expect(etab?.date_prochaine_action).toBe('2026-09-01');
    const principal = etab?.contacts.find((c) => c.fonction === 'Contact principal');
    expect(principal?.telephone).toBe('06.39.98.70.72');
  });

  it('GHT Chandreux-Vaupre utilise le repli date explicite', () => {
    const etab = findEtab('GHT Chandreux-Vaupré');
    expect(etab).toBeDefined();
    expect(etab?.date_prochaine_action).toBe('2026-05-15');
  });

  it('les entrees Semaine 13 partagent la meme date calculee', () => {
    const attendu = commercialWeekToDate('Semaine 13');
    for (const nom of ['CH Villebrume', 'GHT Rives de Vègre']) {
      expect(findEtab(nom)?.date_prochaine_action).toBe(attendu);
    }
  });
});
