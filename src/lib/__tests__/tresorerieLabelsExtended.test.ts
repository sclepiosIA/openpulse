import { describe, it, expect } from 'vitest';
import {
  STATUT_FACTURE_LABELS,
  STATUT_FACTURE_COLORS,
  TYPE_OPERATION_LABELS,
  STATUT_OPERATION_LABELS,
} from '../tresorerie-labels';

describe('tresorerie-labels extended', () => {
  describe('STATUT_FACTURE_LABELS', () => {
    it('has expected keys', () => {
      expect(STATUT_FACTURE_LABELS.non_emise).toBe('Non émise');
      expect(STATUT_FACTURE_LABELS.emise).toBe('Émise');
      expect(STATUT_FACTURE_LABELS.payee).toBe('Payée');
      expect(STATUT_FACTURE_LABELS.annulee).toBe('Annulée');
      expect(STATUT_FACTURE_LABELS.encaissee).toBe('Encaissée');
    });
    it('has 9 entries', () => {
      expect(Object.keys(STATUT_FACTURE_LABELS)).toHaveLength(9);
    });
    it('all values are non-empty strings', () => {
      Object.values(STATUT_FACTURE_LABELS).forEach(v => {
        expect(typeof v).toBe('string');
        expect(v.length).toBeGreaterThan(0);
      });
    });
  });

  describe('STATUT_FACTURE_COLORS', () => {
    it('has same keys as labels', () => {
      const labelKeys = Object.keys(STATUT_FACTURE_LABELS).sort();
      const colorKeys = Object.keys(STATUT_FACTURE_COLORS).sort();
      expect(colorKeys).toEqual(labelKeys);
    });
    it('all values contain bg-', () => {
      Object.values(STATUT_FACTURE_COLORS).forEach(v => {
        expect(v).toContain('bg-');
      });
    });
    it('all values contain text-', () => {
      Object.values(STATUT_FACTURE_COLORS).forEach(v => {
        expect(v).toContain('text-');
      });
    });
  });

  describe('TYPE_OPERATION_LABELS', () => {
    it('has recette and depense', () => {
      expect(TYPE_OPERATION_LABELS.recette).toBe('Recette');
      expect(TYPE_OPERATION_LABELS.depense).toBe('Dépense');
    });
    it('has 2 entries', () => {
      expect(Object.keys(TYPE_OPERATION_LABELS)).toHaveLength(2);
    });
  });

  describe('STATUT_OPERATION_LABELS', () => {
    it('has prevu, realise, comptabilise', () => {
      expect(STATUT_OPERATION_LABELS.prevu).toBe('Prévu');
      expect(STATUT_OPERATION_LABELS.realise).toBe('Réalisé');
      expect(STATUT_OPERATION_LABELS.comptabilise).toBe('Comptabilisé');
    });
    it('has 3 entries', () => {
      expect(Object.keys(STATUT_OPERATION_LABELS)).toHaveLength(3);
    });
  });
});
