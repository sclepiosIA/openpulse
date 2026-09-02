import { describe, it, expect } from 'vitest';
import {
  isPaymentMonth,
  calculatePaymentForMonth,
  isInitialPaymentMonth,
  getInitialPayment,
  calculateTotalPaymentForMonth,
  getModeleDetaille,
} from '../tresorerie/calculateRevenues';

// Minimal mock of Etablissement
const makeEtab = (overrides: Record<string, any> = {}) => ({
  id: 'etab-1',
  nom: 'Test',
  statut: 'Production',
  date_premier_paiement: null,
  date_signature: '2025-01-15',
  periodicite_paiement: 'mensuel',
  type_offre: null,
  pallier_vise: null,
  tarifs_palliers: null,
  modele_statique_succes: null,
  nombre_passages_urgences_annuel: null,
  paiement_initial: null,
  modele_detaille: null,
  ...overrides,
} as any);

describe('calculateRevenues', () => {
  describe('isPaymentMonth', () => {
    it('mensuel → always true', () => {
      expect(isPaymentMonth(makeEtab(), new Date(2025, 5, 1))).toBe(true);
    });

    it('trimestriel → every 3 months from ref', () => {
      const etab = makeEtab({ periodicite_paiement: 'trimestriel' });
      expect(isPaymentMonth(etab, new Date(2025, 0, 1))).toBe(true);  // same month as signature
      expect(isPaymentMonth(etab, new Date(2025, 3, 1))).toBe(true);  // +3 months
      expect(isPaymentMonth(etab, new Date(2025, 1, 1))).toBe(false); // +1 month
    });

    it('annuel → same month only', () => {
      const etab = makeEtab({ periodicite_paiement: 'annuel' });
      expect(isPaymentMonth(etab, new Date(2026, 0, 1))).toBe(true);
      expect(isPaymentMonth(etab, new Date(2026, 3, 1))).toBe(false);
    });

    it('no date → false', () => {
      const etab = makeEtab({ date_signature: null, date_premier_paiement: null });
      expect(isPaymentMonth(etab, new Date(2025, 0, 1))).toBe(false);
    });

    it('uses date_premier_paiement over date_signature', () => {
      const etab = makeEtab({ 
        date_premier_paiement: '2025-03-01', 
        periodicite_paiement: 'trimestriel' 
      });
      expect(isPaymentMonth(etab, new Date(2025, 2, 1))).toBe(true);  // March
      expect(isPaymentMonth(etab, new Date(2025, 0, 1))).toBe(false); // January
    });
  });

  describe('calculatePaymentForMonth', () => {
    it('modele_statique_succes mensuel', () => {
      const etab = makeEtab({ modele_statique_succes: '12000' });
      expect(calculatePaymentForMonth(etab, new Date(2025, 5, 1))).toBe(1000);
    });

    it('nombre_passages_urgences_annuel', () => {
      const etab = makeEtab({ nombre_passages_urgences_annuel: 6000 });
      expect(calculatePaymentForMonth(etab, new Date(2025, 5, 1))).toBe(1000); // 6000*2/12
    });

    it('no model → 0', () => {
      expect(calculatePaymentForMonth(makeEtab(), new Date(2025, 5, 1))).toBe(0);
    });

    it('non-payment month → 0', () => {
      const etab = makeEtab({ modele_statique_succes: '12000', periodicite_paiement: 'annuel' });
      expect(calculatePaymentForMonth(etab, new Date(2025, 5, 1))).toBe(0); // not January
    });
  });

  describe('isInitialPaymentMonth', () => {
    it('signature month → true', () => {
      const etab = makeEtab({ paiement_initial: 5000 });
      expect(isInitialPaymentMonth(etab, new Date(2025, 0, 20))).toBe(true);
    });

    it('other month → false', () => {
      const etab = makeEtab({ paiement_initial: 5000 });
      expect(isInitialPaymentMonth(etab, new Date(2025, 3, 1))).toBe(false);
    });

    it('no paiement_initial → false', () => {
      expect(isInitialPaymentMonth(makeEtab(), new Date(2025, 0, 1))).toBe(false);
    });

    it('no date_signature → false', () => {
      const etab = makeEtab({ paiement_initial: 5000, date_signature: null });
      expect(isInitialPaymentMonth(etab, new Date(2025, 0, 1))).toBe(false);
    });
  });

  describe('getInitialPayment', () => {
    it('returns initial on signature month', () => {
      const etab = makeEtab({ paiement_initial: 5000 });
      expect(getInitialPayment(etab, new Date(2025, 0, 1))).toBe(5000);
    });

    it('returns 0 on other months', () => {
      const etab = makeEtab({ paiement_initial: 5000 });
      expect(getInitialPayment(etab, new Date(2025, 5, 1))).toBe(0);
    });
  });

  describe('calculateTotalPaymentForMonth', () => {
    it('sums initial + recurring', () => {
      const etab = makeEtab({ paiement_initial: 5000, modele_statique_succes: '12000' });
      expect(calculateTotalPaymentForMonth(etab, new Date(2025, 0, 1))).toBe(6000); // 5000 + 1000
    });
  });

  describe('getModeleDetaille', () => {
    it('returns modele_detaille if set', () => {
      expect(getModeleDetaille(makeEtab({ modele_detaille: 'Custom' }))).toBe('Custom');
    });

    it('Au succès with palier', () => {
      expect(getModeleDetaille(makeEtab({ type_offre: 'Au succès', pallier_vise: 'Palier 3' }))).toBe('Succès+3');
    });

    it('Au succès without palier', () => {
      expect(getModeleDetaille(makeEtab({ type_offre: 'Au succès' }))).toBe('Au succès');
    });

    it('modele_statique_succes', () => {
      expect(getModeleDetaille(makeEtab({ modele_statique_succes: '12000' }))).toBe('Statique');
    });

    it('no model → Indéterminé', () => {
      expect(getModeleDetaille(makeEtab())).toBe('Indéterminé');
    });
  });
});
