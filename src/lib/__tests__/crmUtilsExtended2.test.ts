import { describe, it, expect } from 'vitest';
import {
  calculateMonthlyRevenue,
  formatForCSV,
  buildSearchQuery,
  filterEtablissements,
  calculatePriorityScore,
  haversineDistance,
} from '../crmUtils';

describe('crmUtils (extended2)', () => {
  describe('calculateMonthlyRevenue', () => {
    it('mensuel statique', () => {
      expect(calculateMonthlyRevenue({ modele_economique: 'Statique', periodicite_paiement: 'mensuel', prix_licence_mensuel: 500 })).toBe(500);
    });
    it('annuel statique', () => {
      expect(calculateMonthlyRevenue({ modele_economique: 'Statique', periodicite_paiement: 'annuel', prix_licence_annuel: 12000 })).toBe(1000);
    });
    it('non-statique → 0', () => {
      expect(calculateMonthlyRevenue({ modele_economique: 'Dynamique', periodicite_paiement: 'mensuel' })).toBe(0);
    });
  });

  describe('formatForCSV', () => {
    it('empty → empty', () => expect(formatForCSV([])).toBe(''));
    it('headers + rows', () => {
      const csv = formatForCSV([{ a: 1, b: 'hi' }]);
      expect(csv).toContain('a,b');
      expect(csv).toContain('1,hi');
    });
    it('escapes commas', () => {
      const csv = formatForCSV([{ name: 'Hello, World' }]);
      expect(csv).toContain('"Hello, World"');
    });
    it('handles null values', () => {
      const csv = formatForCSV([{ a: null }]);
      expect(csv).toContain('a\n');
    });
  });

  describe('buildSearchQuery', () => {
    it('wraps in %', () => expect(buildSearchQuery('test')).toBe('%test%'));
    it('escapes %', () => expect(buildSearchQuery('50%')).toBe('%50\\%%'));
    it('escapes _', () => expect(buildSearchQuery('a_b')).toBe('%a\\_b%'));
  });

  describe('filterEtablissements', () => {
    const data = [
      { nom: 'Hôpital Paris', region: 'Île-de-France', statut: 'Production' },
      { nom: 'Clinique Lyon', region: 'Auvergne-Rhône-Alpes', statut: 'Prospect' },
      { nom: 'CHU Rennes', region: 'Bretagne', statut: 'Production' },
    ];
    it('no filters → all', () => expect(filterEtablissements(data, {}).length).toBe(3));
    it('search filter', () => expect(filterEtablissements(data, { search: 'paris' }).length).toBe(1));
    it('region filter', () => expect(filterEtablissements(data, { region: 'Bretagne' }).length).toBe(1));
    it('statut filter', () => expect(filterEtablissements(data, { statut: 'Production' }).length).toBe(2));
    it('combined filters', () => expect(filterEtablissements(data, { statut: 'Production', region: 'Bretagne' }).length).toBe(1));
  });

  describe('calculatePriorityScore', () => {
    it('overdue critique → high score', () => {
      const past = new Date();
      past.setDate(past.getDate() - 5);
      const score = calculatePriorityScore({ priorite: 'critique', echeance: past });
      expect(score).toBeGreaterThanOrEqual(150);
    });
    it('future basse → low score', () => {
      const future = new Date();
      future.setDate(future.getDate() + 30);
      expect(calculatePriorityScore({ priorite: 'basse', echeance: future })).toBe(25);
    });
    it('due in 2 days → +40', () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 2);
      const score = calculatePriorityScore({ priorite: 'moyenne', echeance: soon });
      expect(score).toBe(90); // 50 + 40
    });
  });

  describe('haversineDistance', () => {
    it('same point → 0', () => expect(haversineDistance(48.8566, 2.3522, 48.8566, 2.3522)).toBe(0));
    it('Paris-Lyon ≈ 392km', () => {
      const d = haversineDistance(48.8566, 2.3522, 45.764, 4.8357);
      expect(d).toBeGreaterThan(380);
      expect(d).toBeLessThan(400);
    });
  });
});
