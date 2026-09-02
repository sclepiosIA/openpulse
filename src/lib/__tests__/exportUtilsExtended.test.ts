import { describe, it, expect } from 'vitest';
import { prepareEtablissementsForExport } from '../exportUtils';

describe('exportUtils - extended', () => {
  describe('prepareEtablissementsForExport', () => {
    it('maps fields correctly', () => {
      const result = prepareEtablissementsForExport([{
        nom: 'CHU Test',
        ville: 'Paris',
        region: 'Île-de-France',
        type: 'CHU',
        statut: 'Production',
        nombre_passages_urgences_annuel: 50000,
        dpi: 'DxCare',
        date_signature: '2025-01-15',
        progression: 85,
      }]);
      expect(result.length).toBe(1);
      expect(result[0].Nom).toBe('CHU Test');
      expect(result[0].Ville).toBe('Paris');
      expect(result[0]['Passages Urgences']).toBe(50000);
      expect(result[0].DPI).toBe('DxCare');
      expect(result[0].Progression).toBe(85);
    });

    it('handles null fields', () => {
      const result = prepareEtablissementsForExport([{
        nom: 'Test',
        ville: null,
        region: null,
        type: null,
        statut: null,
        nombre_passages_urgences_annuel: null,
        dpi: null,
        date_signature: null,
        progression: null,
      }]);
      expect(result[0]['Passages Urgences']).toBe(0);
      expect(result[0].DPI).toBe('');
      expect(result[0].Progression).toBe(0);
    });

    it('handles empty array', () => {
      expect(prepareEtablissementsForExport([])).toEqual([]);
    });
  });
});
