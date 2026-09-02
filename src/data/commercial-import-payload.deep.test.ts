import { describe, it, expect } from 'vitest';
import {
  commercialImportPayload,
  commercialWeekToDate,
  type CommercialImportPayload,
} from './commercial-import-payload';

/**
 * Surface du module et branche « Semaine N » de la conversion de dates.
 *
 * Ces assertions sont volontairement INDÉPENDANTES du contenu du jeu de démonstration :
 * une distribution auto-hébergée doit pouvoir remplacer les établissements de démonstration
 * sans casser sa propre suite de tests. Les identités nominatives sont donc exclues, seules
 * la forme du payload et la logique pure de `commercialWeekToDate` sont vérifiées.
 */
describe('commercial-import-payload — surface du module', () => {
  it('expose un payload typé dont les deux collections sont des tableaux non vides', () => {
    const payload: CommercialImportPayload = commercialImportPayload;

    expect(Array.isArray(payload.etablissements)).toBe(true);
    expect(Array.isArray(payload.partenaires)).toBe(true);
    expect(payload.etablissements.length).toBeGreaterThan(0);
    expect(payload.partenaires.length).toBeGreaterThan(0);
  });

  it("n'expose que les deux clés attendues à la racine du payload", () => {
    expect(Object.keys(commercialImportPayload).sort()).toEqual(['etablissements', 'partenaires']);
  });

  it('expose commercialWeekToDate comme une fonction pure retournant une date seule', () => {
    expect(typeof commercialWeekToDate).toBe('function');

    const premier = commercialWeekToDate('Semaine 12');
    const second = commercialWeekToDate('Semaine 12');

    expect(premier).toBe(second);
    expect(premier).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('commercialWeekToDate — branche « Semaine N »', () => {
  it('ancre la semaine 1 sur le premier lundi de 2026', () => {
    expect(commercialWeekToDate('Semaine 1')).toBe('2026-01-05');
  });

  it('convertit les semaines de référence de la matrice commerciale', () => {
    expect(commercialWeekToDate('Semaine 12')).toBe('2026-03-23');
    expect(commercialWeekToDate('Semaine 13')).toBe('2026-03-30');
  });

  it('avance strictement de sept jours par semaine', () => {
    for (let semaine = 1; semaine <= 20; semaine += 1) {
      const courante = Date.parse(`${commercialWeekToDate(`Semaine ${semaine}`)}T00:00:00.000Z`);
      const suivante = Date.parse(`${commercialWeekToDate(`Semaine ${semaine + 1}`)}T00:00:00.000Z`);

      expect(Number.isNaN(courante)).toBe(false);
      expect(suivante - courante).toBe(7 * 24 * 60 * 60 * 1000);
    }
  });

  it('tolère la casse et un espacement variable autour du numéro de semaine', () => {
    expect(commercialWeekToDate('semaine 13')).toBe('2026-03-30');
    expect(commercialWeekToDate('SEMAINE 13')).toBe('2026-03-30');
    expect(commercialWeekToDate('Semaine  13')).toBe('2026-03-30');
    expect(commercialWeekToDate('Semaine13')).toBe('2026-03-30');
  });

  it('reste invariant au fuseau horaire en calculant en UTC', () => {
    // Le résultat est une date seule : elle ne doit jamais glisser d'un jour selon le fuseau.
    const valeur = commercialWeekToDate('Semaine 13');
    const reconstruite = new Date(`${valeur}T00:00:00.000Z`).toISOString().slice(0, 10);

    expect(reconstruite).toBe(valeur);
  });
});
