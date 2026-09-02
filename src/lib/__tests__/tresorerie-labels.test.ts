import { describe, it, expect } from 'vitest';
import {
  STATUT_FACTURE_LABELS,
  STATUT_FACTURE_COLORS,
  TYPE_OPERATION_LABELS,
  STATUT_OPERATION_LABELS,
} from '../tresorerie-labels';

describe('tresorerie-labels', () => {
  it('expose tous les statuts de facture avec un libellé', () => {
    const keys = [
      'non_emise', 'emise', 'en_attente', 'negociation',
      'negociation_avancee', 'payee', 'encaissee', 'annulee', 'ok',
    ];
    for (const k of keys) {
      expect(STATUT_FACTURE_LABELS[k]).toBeTruthy();
      expect(STATUT_FACTURE_COLORS[k]).toMatch(/bg-/);
      expect(STATUT_FACTURE_COLORS[k]).toMatch(/text-/);
    }
  });

  it('libellés métier corrects', () => {
    expect(STATUT_FACTURE_LABELS.payee).toBe('Payée');
    expect(STATUT_FACTURE_LABELS.encaissee).toBe('Encaissée');
    expect(STATUT_FACTURE_LABELS.negociation_avancee).toBe('Nég. avancée');
  });

  it('opérations: recette/dépense et statuts', () => {
    expect(TYPE_OPERATION_LABELS.recette).toBe('Recette');
    expect(TYPE_OPERATION_LABELS.depense).toBe('Dépense');
    expect(STATUT_OPERATION_LABELS.prevu).toBe('Prévu');
    expect(STATUT_OPERATION_LABELS.realise).toBe('Réalisé');
    expect(STATUT_OPERATION_LABELS.comptabilise).toBe('Comptabilisé');
  });

  it('valeur inconnue retourne undefined sans crasher', () => {
    expect(STATUT_FACTURE_LABELS['inconnu']).toBeUndefined();
    expect(TYPE_OPERATION_LABELS['inconnu']).toBeUndefined();
  });
});
