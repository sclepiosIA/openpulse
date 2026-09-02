import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/export/dynamicPdfImport', () => ({
  loadPdfLibs: vi.fn(),
  loadExcelLibs: vi.fn(),
}));

describe('exportGroupesUtils', () => {
  let exportGroupesToCSV: typeof import('../exportGroupesUtils').exportGroupesToCSV;

  const mockGroupe = {
    id: 'g1',
    nom: 'Groupe Test',
    type: 'GHT',
    region: 'IDF',
    ville_siege: 'Paris',
    nombre_etablissements: 5,
    progression_moyenne: 72.3,
    total_passages_urgences_annuel: 150000,
    modules_deployes: ['Urgences', 'MCO'],
    email: 'contact@test.com',
    telephone: '0145678900',
    created_at: '2024-01-15T00:00:00Z',
  };

  beforeEach(async () => {
    vi.resetModules();

    const mockLink = { setAttribute: vi.fn(), click: vi.fn(), href: '', download: '' };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    // Define URL.createObjectURL if missing (jsdom)
    if (!URL.createObjectURL) {
      (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:test');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    }

    const mod = await import('../exportGroupesUtils');
    exportGroupesToCSV = mod.exportGroupesToCSV;
  });

  it('generates CSV and triggers download', () => {
    exportGroupesToCSV([mockGroupe as any]);
    const link = document.createElement('a');
    expect(link.click).toHaveBeenCalled();
  });

  it('handles empty array', () => {
    expect(() => exportGroupesToCSV([])).not.toThrow();
  });

  it('handles null optional fields', () => {
    const g = { ...mockGroupe, region: null, ville_siege: null, total_passages_urgences_annuel: null, modules_deployes: null, email: null, telephone: null };
    expect(() => exportGroupesToCSV([g as any])).not.toThrow();
  });
});
