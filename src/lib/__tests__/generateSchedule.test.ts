import { describe, it, expect } from 'vitest';
import { generatePaymentSchedule, generateAllPaymentSchedules, getNextPaymentDate } from '../tresorerie/generateSchedule';

const makeEtab = (overrides: Record<string, unknown> = {}) => ({
  id: 'etab-1',
  nom: 'Test CH',
  statut: 'Production',
  date_signature: '2024-01-15',
  date_premier_paiement: null,
  periodicite_paiement: 'mensuel',
  type_offre: null,
  pallier_vise: null,
  tarifs_palliers: null,
  modele_statique_succes: null,
  modele_detaille: null,
  nombre_passages_urgences_annuel: 12000,
  paiement_initial: null,
  ...overrides,
} as any);

describe('generateSchedule', () => {
  describe('generatePaymentSchedule', () => {
    it('generates monthly schedule', () => {
      const etab = makeEtab();
      const schedules = generatePaymentSchedule(
        etab, new Date('2024-01-01'), new Date('2024-03-31')
      );
      expect(schedules.length).toBe(3);
      schedules.forEach(s => {
        expect(s.montant).toBe(2000);
        expect(s.etablissement_id).toBe('etab-1');
        expect(s.statut).toBe('prevue');
      });
    });

    it('generates quarterly schedule', () => {
      const etab = makeEtab({ periodicite_paiement: 'trimestriel' });
      const schedules = generatePaymentSchedule(
        etab, new Date('2024-01-01'), new Date('2024-12-31')
      );
      expect(schedules.length).toBe(4);
      expect(schedules[0].montant).toBe(6000); // 12000*2/4
    });
  });

  describe('generateAllPaymentSchedules', () => {
    it('filters production only', () => {
      const etabs = [
        makeEtab({ id: 'prod', statut: 'Production' }),
        makeEtab({ id: 'prospect', statut: 'Prospect' }),
      ];
      const schedules = generateAllPaymentSchedules(
        etabs, new Date('2024-01-01'), new Date('2024-01-31')
      );
      expect(schedules.every(s => s.etablissement_id === 'prod')).toBe(true);
    });
  });

  describe('getNextPaymentDate', () => {
    it('returns future date for monthly', () => {
      const etab = makeEtab();
      const next = getNextPaymentDate(etab);
      expect(next).not.toBeNull();
      expect(next!.getTime()).toBeGreaterThan(Date.now());
    });
    it('returns null without dates', () => {
      const etab = makeEtab({ date_signature: null, date_premier_paiement: null });
      expect(getNextPaymentDate(etab)).toBeNull();
    });
  });
});
