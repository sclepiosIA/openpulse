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

describe('crmUtils', () => {
  describe('isValidTransition', () => {
    it('forward transition OK', () => expect(isValidTransition('Prospect', 'Négociation')).toBe(true));
    it('same status OK', () => expect(isValidTransition('Production', 'Production')).toBe(true));
    it('backward NOT OK', () => expect(isValidTransition('Production', 'Prospect')).toBe(false));
  });

  describe('calculatePipelineValue', () => {
    it('applies probabilities', () => {
      const etabs = [
        { statut: 'Prospect', valeur_contrat: 10000 },
        { statut: 'Négociation', valeur_contrat: 20000 },
      ];
      expect(calculatePipelineValue(etabs)).toBe(10000 * 0.1 + 20000 * 0.6);
    });
    it('0 for Production', () => {
      expect(calculatePipelineValue([{ statut: 'Production', valeur_contrat: 50000 }])).toBe(0);
    });
  });

  describe('formatContactName', () => {
    it('full name', () => expect(formatContactName({ prenom: 'Jean', nom: 'Dupont', email: 'j@t.com' })).toBe('Jean Dupont'));
    it('nom only', () => expect(formatContactName({ nom: 'Dupont', email: 'j@t.com' })).toBe('Dupont'));
    it('email fallback', () => expect(formatContactName({ email: 'j@t.com' })).toBe('j@t.com'));
  });

  describe('isValidFrenchPhone', () => {
    it('valid +33', () => expect(isValidFrenchPhone('+33612345678')).toBe(true));
    it('valid 06', () => expect(isValidFrenchPhone('06 12 34 56 78')).toBe(true));
    it('invalid', () => expect(isValidFrenchPhone('123')).toBe(false));
  });

  describe('calculatePriorityScore', () => {
    it('overdue critique = high score', () => {
      const past = new Date(); past.setDate(past.getDate() - 5);
      expect(calculatePriorityScore({ priorite: 'critique', echeance: past })).toBeGreaterThanOrEqual(150);
    });
    it('future basse = low score', () => {
      const future = new Date(); future.setDate(future.getDate() + 30);
      expect(calculatePriorityScore({ priorite: 'basse', echeance: future })).toBeLessThan(50);
    });
  });

  describe('isTaskOverdue', () => {
    it('past → true', () => {
      const past = new Date(); past.setDate(past.getDate() - 1);
      expect(isTaskOverdue(past)).toBe(true);
    });
    it('future → false', () => {
      const future = new Date(); future.setDate(future.getDate() + 1);
      expect(isTaskOverdue(future)).toBe(false);
    });
  });

  describe('groupByRegion', () => {
    it('groups correctly', () => {
      const result = groupByRegion([
        { id: '1', region: 'IDF' },
        { id: '2', region: 'IDF' },
        { id: '3', region: 'PACA' },
      ]);
      expect(result['IDF']).toEqual(['1', '2']);
      expect(result['PACA']).toEqual(['3']);
    });
    it('handles missing region', () => {
      const result = groupByRegion([{ id: '1', region: '' }]);
      expect(result['Non renseigné']).toEqual(['1']);
    });
  });

  describe('haversineDistance', () => {
    it('same point → 0', () => expect(haversineDistance(48.8, 2.3, 48.8, 2.3)).toBe(0));
    it('Paris-Lyon ~392km', () => {
      const d = haversineDistance(48.8566, 2.3522, 45.764, 4.8357);
      expect(d).toBeGreaterThan(380);
      expect(d).toBeLessThan(410);
    });
  });

  describe('calculateMonthlyRevenue', () => {
    it('mensuel statique', () => {
      expect(calculateMonthlyRevenue({ modele_economique: 'Statique', periodicite_paiement: 'mensuel', prix_licence_mensuel: 5000 })).toBe(5000);
    });
    it('annuel statique ÷ 12', () => {
      expect(calculateMonthlyRevenue({ modele_economique: 'Statique', periodicite_paiement: 'annuel', prix_licence_annuel: 60000 })).toBe(5000);
    });
    it('non-Statique → 0', () => {
      expect(calculateMonthlyRevenue({ modele_economique: 'Au succès', periodicite_paiement: 'mensuel' })).toBe(0);
    });
  });

  describe('formatForCSV', () => {
    it('formats headers and rows', () => {
      const csv = formatForCSV([{ nom: 'A', val: 1 }, { nom: 'B,C', val: 2 }]);
      expect(csv).toContain('nom,val');
      expect(csv).toContain('"B,C"');
    });
    it('empty → empty string', () => expect(formatForCSV([])).toBe(''));
  });

  describe('buildSearchQuery', () => {
    it('wraps in %', () => expect(buildSearchQuery('test')).toBe('%test%'));
    it('escapes %', () => expect(buildSearchQuery('50%')).toBe('%50\\%%'));
  });

  describe('filterEtablissements', () => {
    const etabs = [
      { nom: 'CHU Paris', region: 'IDF', statut: 'Production' },
      { nom: 'CH Lyon', region: 'ARA', statut: 'Prospect' },
    ];
    it('filters by search', () => expect(filterEtablissements(etabs, { search: 'paris' }).length).toBe(1));
    it('filters by region', () => expect(filterEtablissements(etabs, { region: 'ARA' }).length).toBe(1));
    it('filters by statut', () => expect(filterEtablissements(etabs, { statut: 'Production' }).length).toBe(1));
    it('no filters → all', () => expect(filterEtablissements(etabs, {}).length).toBe(2));
  });
});
