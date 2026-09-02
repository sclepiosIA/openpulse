import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prepareEtablissementsForExport, prepareUsersFormationForExport } from '../exportUtils';

describe('exportUtils', () => {
  describe('prepareEtablissementsForExport', () => {
    it('maps fields correctly', () => {
      const result = prepareEtablissementsForExport([
        { nom: 'CH Test', ville: 'Paris', region: 'IDF', type: 'CH', statut: 'Production', nombre_passages_urgences_annuel: 50000, dpi: 'DxCare', date_signature: '2024-01-01', progression: 75 },
      ]);
      expect(result[0]).toEqual({
        Nom: 'CH Test', Ville: 'Paris', Région: 'IDF', Type: 'CH',
        Statut: 'Production', 'Passages Urgences': 50000, DPI: 'DxCare',
        'Date Signature': '2024-01-01', Progression: 75,
      });
    });

    it('handles null fields', () => {
      const result = prepareEtablissementsForExport([{ nom: 'CH Test' }]);
      expect(result[0]['Passages Urgences']).toBe(0);
      expect(result[0].DPI).toBe('');
    });
  });

  describe('prepareUsersFormationForExport', () => {
    it('maps and formats fields', () => {
      const result = prepareUsersFormationForExport([{
        nom: 'Dupont', prenom: 'Alice', email: 'a@b.com',
        fonction: 'IDE', statut_formation: 'forme',
        nombre_sessions_suivies: 3, actif: true,
      }]);
      expect(result[0]['Statut Formation']).toBe('Formé');
      expect(result[0].Actif).toBe('Oui');
      expect(result[0]['Sessions Suivies']).toBe(3);
    });

    it('formats non_forme status', () => {
      const result = prepareUsersFormationForExport([{
        nom: 'Test', prenom: 'User', email: 'u@b.com',
        fonction: 'IDE', statut_formation: 'non_forme',
      }]);
      expect(result[0]['Statut Formation']).toBe('Non formé');
    });
  });
});
