import { describe, expect, it } from 'vitest';
import {
  STATUT_FACTURE_COLORS,
  STATUT_FACTURE_LABELS,
  STATUT_OPERATION_LABELS,
  TYPE_OPERATION_LABELS,
} from '../tresorerie-labels';

describe('tresorerie-labels', () => {
  it('expose les libellés attendus pour les statuts de facture', () => {
    expect(STATUT_FACTURE_LABELS.non_emise).toBe('Non émise');
    expect(STATUT_FACTURE_LABELS.negociation_avancee).toBe('Nég. avancée');
    expect(STATUT_FACTURE_LABELS.encaissee).toBe('Encaissée');
  });

  it('chaque statut de facture a une couleur associée', () => {
    for (const statut of Object.keys(STATUT_FACTURE_LABELS)) {
      expect(STATUT_FACTURE_COLORS[statut]).toBeTruthy();
      expect(STATUT_FACTURE_COLORS[statut]).toMatch(/bg-/);
      expect(STATUT_FACTURE_COLORS[statut]).toMatch(/text-/);
    }
  });

  it('ne définit pas de couleur pour un statut sans libellé', () => {
    expect(STATUT_FACTURE_COLORS.statut_inconnu).toBeUndefined();
  });

  it('mappe les types opération recette et dépense', () => {
    expect(TYPE_OPERATION_LABELS.recette).toBe('Recette');
    expect(TYPE_OPERATION_LABELS.depense).toBe('Dépense');
    expect(Object.keys(TYPE_OPERATION_LABELS).sort()).toEqual(['depense', 'recette']);
  });

  it('mappe les statuts opération dans l’ordre métier attendu', () => {
    expect(Object.keys(STATUT_OPERATION_LABELS)).toEqual(['prevu', 'realise', 'comptabilise']);
    expect(STATUT_OPERATION_LABELS.prevu).toBe('Prévu');
    expect(STATUT_OPERATION_LABELS.realise).toBe('Réalisé');
    expect(STATUT_OPERATION_LABELS.comptabilise).toBe('Comptabilisé');
  });
});