import { describe, it, expect } from 'vitest';
import {
  generatePaymentSchedule,
  generateAllPaymentSchedules,
} from '../tresorerie/generateSchedule';

// Minimal mock
const makeEtab = (overrides: Record<string, any> = {}) => ({
  id: 'etab-1',
  nom: 'Hôpital Test',
  statut: 'Production',
  date_premier_paiement: null,
  date_signature: '2025-01-15',
  periodicite_paiement: 'mensuel',
  type_offre: null,
  pallier_vise: null,
  tarifs_palliers: null,
  modele_statique_succes: '12000',
  nombre_passages_urgences_annuel: null,
  paiement_initial: null,
  modele_detaille: null,
  ...overrides,
} as any);

describe('generateSchedule', () => {
  describe('generatePaymentSchedule', () => {
    it('generates monthly payments', () => {
      const schedules = generatePaymentSchedule(
        makeEtab(),
        new Date(2025, 0, 1),
        new Date(2025, 5, 30),
      );
      expect(schedules.length).toBe(6);
      schedules.forEach(s => {
        expect(s.montant).toBe(1000); // 12000/12
        expect(s.etablissement_id).toBe('etab-1');
        expect(s.statut).toBe('prevue');
      });
    });

    it('generates quarterly payments', () => {
      const schedules = generatePaymentSchedule(
        makeEtab({ periodicite_paiement: 'trimestriel', modele_statique_succes: '12000' }),
        new Date(2025, 0, 1),
        new Date(2025, 11, 31),
      );
      // Quarterly from January: Jan, Apr, Jul, Oct → 4 payments
      expect(schedules.length).toBe(4);
      schedules.forEach(s => expect(s.montant).toBe(3000)); // 12000/4
    });

    it('no revenue model → empty', () => {
      const schedules = generatePaymentSchedule(
        makeEtab({ modele_statique_succes: null }),
        new Date(2025, 0, 1),
        new Date(2025, 5, 30),
      );
      expect(schedules.length).toBe(0);
    });

    it('includes initial payment', () => {
      const schedules = generatePaymentSchedule(
        makeEtab({ paiement_initial: 5000 }),
        new Date(2025, 0, 1),
        new Date(2025, 2, 31),
      );
      // January: 5000 + 1000 = 6000, Feb: 1000, Mar: 1000
      expect(schedules[0].montant).toBe(6000);
      expect(schedules[1].montant).toBe(1000);
    });
  });

  describe('generateAllPaymentSchedules', () => {
    it('aggregates multiple establishments', () => {
      const etabs = [
        makeEtab({ id: 'e1', nom: 'H1', modele_statique_succes: '12000' }),
        makeEtab({ id: 'e2', nom: 'H2', modele_statique_succes: '24000' }),
      ];
      const schedules = generateAllPaymentSchedules(
        etabs,
        new Date(2025, 0, 1),
        new Date(2025, 0, 31),
      );
      expect(schedules.length).toBe(2);
      const total = schedules.reduce((s, p) => s + p.montant, 0);
      expect(total).toBe(3000); // 1000 + 2000
    });

    it('empty array → empty', () => {
      expect(generateAllPaymentSchedules([], new Date(), new Date()).length).toBe(0);
    });
  });
});
