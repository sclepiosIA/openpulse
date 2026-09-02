import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToCSV, prepareEtablissementsForExport } from '@/lib/rapportExportUtils';

// Mock document methods for CSV download
const mockClick = vi.fn();
const mockSetAttribute = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock'),
  revokeObjectURL: vi.fn(),
});

describe('exportToCSV', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(document, 'createElement').mockReturnValue({
      click: mockClick,
      setAttribute: mockSetAttribute,
      style: {},
    } as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
    vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
  });

  it('creates and triggers download for valid data', () => {
    const data = [
      {
        id: '1',
        nom: 'CHU Test',
        ville: 'Lyon',
        region: 'Auvergne-Rhône-Alpes',
        type: 'CHU',
        statut: 'Production',
        valeur: 50000,
        created_at: '2024-01-15T00:00:00Z',
      },
    ];

    exportToCSV(data, 'test-export');

    expect(mockSetAttribute).toHaveBeenCalledWith('href', 'blob:mock');
    expect(mockClick).toHaveBeenCalled();
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
  });

  it('does not download for empty data', () => {
    exportToCSV([], 'empty');
    expect(mockClick).not.toHaveBeenCalled();
  });

  it('does not download for null data', () => {
    exportToCSV(null as any, 'null');
    expect(mockClick).not.toHaveBeenCalled();
  });
});

describe('prepareEtablissementsForExport', () => {
  it('maps etablissement data with profile names', () => {
    const etablissements = [
      {
        id: 'e1',
        nom: 'CHU Lyon',
        ville: 'Lyon',
        region: 'ARA',
        type: 'CHU',
        statut: 'Production',
        commercial_id: 'p1',
        csm_id: 'p2',
        chef_projet_id: null,
        type_offre: 'Premium',
        pallier_vise: '3',
        nombre_passages_urgences_annuel: 80000,
        progression: 75,
        date_signature: '2024-01-01',
        date_fin_contrat: '2026-01-01',
        created_at: '2023-06-15T00:00:00Z',
      },
    ];

    const profiles = [
      { id: 'p1', prenom: 'Jean', nom: 'Dupont' },
      { id: 'p2', prenom: 'Marie', nom: 'Martin' },
    ];

    const result = prepareEtablissementsForExport(etablissements, profiles);

    expect(result).toHaveLength(1);
    expect(result[0].nom).toBe('CHU Lyon');
    expect(result[0].commercial).toBe('Jean Dupont');
    expect(result[0].csm).toBe('Marie Martin');
    expect(result[0].chef_projet).toBeUndefined();
    expect(result[0].statut).toBe('Production');
    expect(typeof result[0].valeur).toBe('number');
  });

  it('handles empty arrays', () => {
    expect(prepareEtablissementsForExport([], [])).toEqual([]);
  });

  it('handles missing profile references', () => {
    const etablissements = [
      {
        id: 'e1',
        nom: 'Test',
        statut: 'Prospect',
        commercial_id: 'nonexistent',
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const result = prepareEtablissementsForExport(etablissements, []);
    expect(result[0].commercial).toBeUndefined();
  });
});
