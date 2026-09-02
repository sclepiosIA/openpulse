import { describe, it, expect, vi } from 'vitest';
import { prepareEtablissementsForExport, exportToCSV } from '../rapportExportUtils';

// Mock debug
vi.mock('../debug', () => ({ debug: { warn: vi.fn(), error: vi.fn(), log: vi.fn() } }));

describe('rapportExportUtils extended', () => {
  describe('prepareEtablissementsForExport', () => {
    const profiles = [
      { id: 'p1', prenom: 'Jean', nom: 'Dupont' },
      { id: 'p2', prenom: 'Marie', nom: 'Martin' },
    ];

    it('maps etablissements with profile names', () => {
      const etabs = [{
        id: 'e1', nom: 'CHU Test', ville: 'Paris', region: 'IDF',
        type: 'CHU', statut: 'Production', commercial_id: 'p1',
        csm_id: 'p2', chef_projet_id: null, type_offre: 'Standard',
        pallier_vise: 'P2', nombre_passages_urgences_annuel: 50000,
        progression: 80, date_signature: '2024-01-01',
        date_fin_contrat: null, created_at: '2023-06-01',
      }];

      const result = prepareEtablissementsForExport(etabs, profiles);
      expect(result).toHaveLength(1);
      expect(result[0].nom).toBe('CHU Test');
      expect(result[0].commercial).toBe('Jean Dupont');
      expect(result[0].csm).toBe('Marie Martin');
      expect(result[0].chef_projet).toBeUndefined();
      expect(result[0].valeur).toBeGreaterThanOrEqual(0);
    });

    it('handles empty array', () => {
      expect(prepareEtablissementsForExport([], [])).toEqual([]);
    });

    it('handles missing profiles gracefully', () => {
      const etabs = [{
        id: 'e1', nom: 'Test', statut: 'Prospect',
        commercial_id: 'unknown', csm_id: null, chef_projet_id: null,
        created_at: '2023-01-01',
      }];
      const result = prepareEtablissementsForExport(etabs, profiles);
      expect(result[0].commercial).toBeUndefined();
    });
  });

  describe('exportToCSV', () => {
    it('handles empty data', () => {
      // Should not throw, just warn
      expect(() => exportToCSV([], 'test')).not.toThrow();
    });

    it('handles null data', () => {
      expect(() => exportToCSV(null as any, 'test')).not.toThrow();
    });
  });
});
