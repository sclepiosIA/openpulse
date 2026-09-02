import { describe, it, expect } from 'vitest';
import {
  isPaymentMonth, calculatePaymentForMonth,
  isInitialPaymentMonth, getInitialPayment,
  calculateTotalPaymentForMonth, getModeleDetaille,
} from '../tresorerie/calculateRevenues';

// Minimal mock of Etablissement type
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
  nombre_passages_urgences_annuel: null,
  paiement_initial: null,
  ...overrides,
} as any);

describe('calculateRevenues', () => {
  describe('isPaymentMonth', () => {
    it('returns true for mensuel', () => {
      expect(isPaymentMonth(makeEtab(), new Date('2024-06-01'))).toBe(true);
    });
    it('returns false without date_signature', () => {
      expect(isPaymentMonth(makeEtab({ date_signature: null }), new Date('2024-06-01'))).toBe(false);
    });
    it('handles trimestriel', () => {
      const etab = makeEtab({ periodicite_paiement: 'trimestriel' });
      expect(isPaymentMonth(etab, new Date('2024-01-01'))).toBe(true); // same month
      expect(isPaymentMonth(etab, new Date('2024-04-01'))).toBe(true); // +3 months
      expect(isPaymentMonth(etab, new Date('2024-02-01'))).toBe(false);
    });
    it('handles annuel', () => {
      const etab = makeEtab({ periodicite_paiement: 'annuel' });
      expect(isPaymentMonth(etab, new Date('2024-01-01'))).toBe(true);
      expect(isPaymentMonth(etab, new Date('2024-06-01'))).toBe(false);
    });
  });

  describe('calculatePaymentForMonth', () => {
    it('returns 0 if not payment month', () => {
      const etab = makeEtab({ date_signature: null });
      expect(calculatePaymentForMonth(etab, new Date('2024-06-01'))).toBe(0);
    });
    it('calculates from passages urgences', () => {
      const etab = makeEtab({ nombre_passages_urgences_annuel: 12000 });
      const montant = calculatePaymentForMonth(etab, new Date('2024-06-01'));
      expect(montant).toBe(2000); // 12000 * 2 / 12
    });
    it('calculates from modele_statique_succes', () => {
      const etab = makeEtab({ modele_statique_succes: '120000' });
      expect(calculatePaymentForMonth(etab, new Date('2024-06-01'))).toBe(10000);
    });
  });

  describe('isInitialPaymentMonth', () => {
    it('returns true for signature month', () => {
      const etab = makeEtab({ paiement_initial: 5000, date_signature: '2024-06-15' });
      expect(isInitialPaymentMonth(etab, new Date('2024-06-01'))).toBe(true);
    });
    it('returns false for other months', () => {
      const etab = makeEtab({ paiement_initial: 5000, date_signature: '2024-06-15' });
      expect(isInitialPaymentMonth(etab, new Date('2024-07-01'))).toBe(false);
    });
    it('returns false without paiement_initial', () => {
      expect(isInitialPaymentMonth(makeEtab(), new Date('2024-01-01'))).toBe(false);
    });
  });

  describe('getInitialPayment', () => {
    it('returns amount for signature month', () => {
      const etab = makeEtab({ paiement_initial: 5000, date_signature: '2024-06-15' });
      expect(getInitialPayment(etab, new Date('2024-06-01'))).toBe(5000);
    });
    it('returns 0 otherwise', () => {
      expect(getInitialPayment(makeEtab(), new Date('2024-06-01'))).toBe(0);
    });
  });

  describe('calculateTotalPaymentForMonth', () => {
    it('sums initial + recurring', () => {
      const etab = makeEtab({
        paiement_initial: 5000,
        date_signature: '2024-06-15',
        nombre_passages_urgences_annuel: 12000,
      });
      const total = calculateTotalPaymentForMonth(etab, new Date('2024-06-01'));
      expect(total).toBe(7000); // 5000 + 2000
    });
  });

  describe('getModeleDetaille', () => {
    it('returns existing modele_detaille', () => {
      expect(getModeleDetaille(makeEtab({ modele_detaille: 'Custom' }))).toBe('Custom');
    });
    it('returns Statique for modele_statique_succes', () => {
      expect(getModeleDetaille(makeEtab({ modele_statique_succes: '100000' }))).toBe('Statique');
    });
    it('returns Indéterminé for unknown', () => {
      expect(getModeleDetaille(makeEtab())).toBe('Indéterminé');
    });
  });
});
