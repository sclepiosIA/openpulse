import { describe, it, expect } from 'vitest';
import {
  STATUS_FLOW,
  PIPELINE_PROBABILITIES,
  isValidTransition,
  calculatePipelineValue,
  formatContactName,
  isValidFrenchPhone,
  calculatePriorityScore,
  isTaskOverdue,
  groupByRegion,
  haversineDistance,
  calculateMonthlyRevenue,
  formatForCSV,
  buildSearchQuery,
  filterEtablissements,
} from '../crmUtils';

describe('crmUtils extended3', () => {
  describe('STATUS_FLOW', () => {
    it('has 6 statuses', () => expect(STATUS_FLOW).toHaveLength(6));
    it('starts with Prospect', () => expect(STATUS_FLOW[0]).toBe('Prospect'));
    it('ends with Production', () => expect(STATUS_FLOW[5]).toBe('Production'));
  });

  describe('isValidTransition', () => {
    it('same status → valid', () => expect(isValidTransition('Prospect', 'Prospect')).toBe(true));
    it('forward → valid', () => expect(isValidTransition('Prospect', 'Négociation')).toBe(true));
    it('backward → invalid', () => expect(isValidTransition('Production', 'Prospect')).toBe(false));
  });

  describe('calculatePipelineValue', () => {
    it('weights by probability', () => {
      const etabs = [
        { statut: 'Prospect', valeur_contrat: 1000 },
        { statut: 'Négociation', valeur_contrat: 2000 },
      ];
      const value = calculatePipelineValue(etabs);
      expect(value).toBe(1000 * 0.1 + 2000 * 0.6);
    });
    it('0 for unknown status', () => {
      expect(calculatePipelineValue([{ statut: 'Production', valeur_contrat: 5000 }])).toBe(0);
    });
    it('0 for empty', () => expect(calculatePipelineValue([])).toBe(0));
  });

  describe('formatContactName', () => {
    it('full name', () => expect(formatContactName({ prenom: 'Jean', nom: 'Dupont', email: 'j@t.com' })).toBe('Jean Dupont'));
    it('nom only', () => expect(formatContactName({ nom: 'Dupont', email: 'j@t.com' })).toBe('Dupont'));
    it('email fallback', () => expect(formatContactName({ email: 'j@t.com' })).toBe('j@t.com'));
  });

  describe('isValidFrenchPhone', () => {
    it('valid 01', () => expect(isValidFrenchPhone('01 99 00 12 34')).toBe(true));
    it('valid 06', () => expect(isValidFrenchPhone('0612345678')).toBe(true));
    it('valid +33', () => expect(isValidFrenchPhone('+33612345678')).toBe(true));
    it('invalid short', () => expect(isValidFrenchPhone('01234')).toBe(false));
    it('invalid 00', () => expect(isValidFrenchPhone('0023456789')).toBe(false));
  });

  describe('calculatePriorityScore', () => {
    it('high priority overdue', () => {
      const past = new Date(); past.setDate(past.getDate() - 5);
      expect(calculatePriorityScore({ priorite: 'haute', echeance: past })).toBe(75 + 50);
    });
    it('low priority far future', () => {
      const future = new Date(); future.setDate(future.getDate() + 30);
      expect(calculatePriorityScore({ priorite: 'basse', echeance: future })).toBe(25);
    });
    it('unknown priority uses 50', () => {
      const future = new Date(); future.setDate(future.getDate() + 30);
      expect(calculatePriorityScore({ priorite: 'unknown', echeance: future })).toBe(50);
    });
  });

  describe('isTaskOverdue', () => {
    it('past → true', () => expect(isTaskOverdue(new Date('2020-01-01'))).toBe(true));
    it('future → false', () => expect(isTaskOverdue(new Date('2099-01-01'))).toBe(false));
  });

  describe('groupByRegion', () => {
    it('groups correctly', () => {
      const etabs = [
        { id: '1', region: 'IDF' },
        { id: '2', region: 'IDF' },
        { id: '3', region: 'PACA' },
      ];
      const groups = groupByRegion(etabs);
      expect(groups['IDF']).toHaveLength(2);
      expect(groups['PACA']).toHaveLength(1);
    });
    it('empty region → Non renseigné', () => {
      const groups = groupByRegion([{ id: '1', region: '' }]);
      expect(groups['Non renseigné']).toHaveLength(1);
    });
  });

  describe('haversineDistance', () => {
    it('same point → 0', () => expect(haversineDistance(48.8, 2.3, 48.8, 2.3)).toBe(0));
    it('Paris-Lyon ≈ 392km', () => {
      const d = haversineDistance(48.8566, 2.3522, 45.7640, 4.8357);
      expect(d).toBeGreaterThan(380);
      expect(d).toBeLessThan(420);
    });
  });

  describe('calculateMonthlyRevenue', () => {
    it('mensuel statique', () => {
      expect(calculateMonthlyRevenue({ modele_economique: 'Statique', prix_licence_mensuel: 500, periodicite_paiement: 'mensuel' })).toBe(500);
    });
    it('annuel statique /12', () => {
      expect(calculateMonthlyRevenue({ modele_economique: 'Statique', prix_licence_annuel: 1200, periodicite_paiement: 'annuel' })).toBe(100);
    });
    it('non-statique → 0', () => {
      expect(calculateMonthlyRevenue({ modele_economique: 'Dynamique', periodicite_paiement: 'mensuel' })).toBe(0);
    });
  });

  describe('formatForCSV', () => {
    it('empty → empty string', () => expect(formatForCSV([])).toBe(''));
    it('formats headers + rows', () => {
      const result = formatForCSV([{ Nom: 'A', Ville: 'Paris' }]);
      expect(result).toContain('Nom,Ville');
      expect(result).toContain('A,Paris');
    });
    it('quotes commas', () => {
      const result = formatForCSV([{ Nom: 'A, B' }]);
      expect(result).toContain('"A, B"');
    });
  });

  describe('buildSearchQuery', () => {
    it('wraps with %', () => expect(buildSearchQuery('test')).toBe('%test%'));
    it('escapes %', () => expect(buildSearchQuery('50%')).toBe('%50\\%%'));
    it('escapes _', () => expect(buildSearchQuery('a_b')).toBe('%a\\_b%'));
  });

  describe('filterEtablissements', () => {
    const etabs = [
      { nom: 'CHU Lyon', region: 'ARA', statut: 'Production' },
      { nom: 'CH Paris', region: 'IDF', statut: 'Prospect' },
    ];
    it('no filter → all', () => expect(filterEtablissements(etabs, {})).toHaveLength(2));
    it('search filter', () => expect(filterEtablissements(etabs, { search: 'Lyon' })).toHaveLength(1));
    it('region filter', () => expect(filterEtablissements(etabs, { region: 'IDF' })).toHaveLength(1));
    it('statut filter', () => expect(filterEtablissements(etabs, { statut: 'Prospect' })).toHaveLength(1));
    it('combined filters', () => expect(filterEtablissements(etabs, { search: 'CH', region: 'IDF' })).toHaveLength(1));
  });
});
