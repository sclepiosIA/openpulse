import { describe, it, expect } from 'vitest';
import { commercialWeekToDate } from './commercial-import-payload';

/**
 * Branches de repli de `commercialWeekToDate`.
 *
 * C'est la seule logique exécutable du module : elle mérite une couverture exhaustive,
 * et elle est totalement indépendante du jeu de démonstration.
 *
 * L'ordre d'évaluation est significatif : « Semaine N » d'abord, puis les mots de mois
 * (sept, avr, mai, mars, juin), puis le format `JJ.MM.AAAA`, puis le repli final.
 */
describe('commercialWeekToDate — branches de repli par mot de mois', () => {
  it('reconnaît septembre avant les autres mots de mois', () => {
    expect(commercialWeekToDate('septembre')).toBe('2026-09-01');
    expect(commercialWeekToDate('début sept.')).toBe('2026-09-01');
  });

  it('reconnaît avril', () => {
    expect(commercialWeekToDate('avril')).toBe('2026-04-01');
    expect(commercialWeekToDate('fin avr.')).toBe('2026-04-01');
  });

  it('reconnaît mai', () => {
    expect(commercialWeekToDate('mai')).toBe('2026-05-01');
  });

  it('reconnaît mars', () => {
    expect(commercialWeekToDate('mars')).toBe('2026-03-15');
  });

  it('reconnaît juin', () => {
    expect(commercialWeekToDate('juin')).toBe('2026-06-01');
  });
});

describe('commercialWeekToDate — format JJ.MM.AAAA', () => {
  it('réordonne une date pointée en date seule ISO', () => {
    expect(commercialWeekToDate('07.05.2026')).toBe('2026-05-07');
    expect(commercialWeekToDate('31.12.2027')).toBe('2027-12-31');
  });

  it('extrait la date même entourée de texte', () => {
    expect(commercialWeekToDate('relance le 14.07.2026 au plus tard')).toBe('2026-07-14');
  });

  it('exige deux chiffres de jour et de mois', () => {
    // « 7.5.2026 » ne satisfait pas le motif : on retombe sur le repli final.
    expect(commercialWeekToDate('7.5.2026')).toBe('2026-04-15');
  });
});

describe('commercialWeekToDate — repli final et pièges de sous-chaîne', () => {
  it('retombe sur la date de repli pour une valeur non interprétable', () => {
    expect(commercialWeekToDate('date inconnue')).toBe('2026-04-15');
    expect(commercialWeekToDate('')).toBe('2026-04-15');
    expect(commercialWeekToDate('à planifier')).toBe('2026-04-15');
  });

  it('PIÈGE : « Semaine » sans numéro contient la sous-chaîne « mai » et part sur mai', () => {
    // Le mot « Semaine » contient littéralement « mai » (Se-MAI-ne). Comme le motif
    // /Semaine\s*(\d+)/ échoue faute de numéro, c'est la branche /mai/i qui gagne —
    // et non le repli final. Comportement contre-intuitif à préserver sciemment :
    // toute réécriture de l'ordre des branches changerait ces résultats.
    expect(commercialWeekToDate('Semaine prochaine')).toBe('2026-05-01');
    expect(commercialWeekToDate('Semaine à définir')).toBe('2026-05-01');
  });

  it('PIÈGE : « semaine du JJ.MM.AAAA » est capté par « mai » avant le format pointé', () => {
    // La branche mot-de-mois est évaluée AVANT le format JJ.MM.AAAA : la date pointée
    // est donc ignorée dès que le libellé contient « Semaine ».
    expect(commercialWeekToDate('semaine du 12.09.2026')).toBe('2026-05-01');
  });

  it('donne toujours une date seule syntaxiquement valide, quelle que soit la branche', () => {
    const libelles = [
      'Semaine 1',
      'Semaine 52',
      'septembre',
      'avril',
      'mai',
      'mars',
      'juin',
      '07.05.2026',
      'Semaine prochaine',
      'date inconnue',
    ];

    for (const libelle of libelles) {
      const valeur = commercialWeekToDate(libelle);
      expect(valeur).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(`${valeur}T00:00:00.000Z`))).toBe(false);
    }
  });
});
