import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/export/dynamicPdfImport', () => ({
  loadPdfLibs: vi.fn(),
  loadExcelLibs: vi.fn(),
}));

describe('exportPartenairesUtils', () => {
  let exportPartenairesToCSV: typeof import('../exportPartenairesUtils').exportPartenairesToCSV;

  const mockPartenaire = {
    id: 'p1',
    nom: 'Partenaire Test',
    type_partenaire: 'industriel',
    sous_type: 'éditeur',
    statut_relation: 'actif',
    ville: 'Lyon',
    region: 'ARA',
    pays: 'France',
    email: 'contact@partenaire.com',
    telephone: '0456789000',
    site_web: 'https://partenaire.com',
    responsable: { prenom: 'Alice', nom: 'Dupont' },
    dernier_contact: '2024-06-01',
    prochaine_action: 'Réunion Q3',
    valeur_partenariat: 50000,
    engagement_score: 85,
    created_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    vi.resetModules();
    const mockLink = { setAttribute: vi.fn(), click: vi.fn(), href: '', download: '' };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    if (!URL.createObjectURL) {
      (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:test');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    }

    const mod = await import('../exportPartenairesUtils');
    exportPartenairesToCSV = mod.exportPartenairesToCSV;
  });

  it('generates CSV and triggers download', () => {
    exportPartenairesToCSV([mockPartenaire as any]);
    const link = document.createElement('a');
    expect(link.click).toHaveBeenCalled();
  });

  it('handles empty array', () => {
    expect(() => exportPartenairesToCSV([])).not.toThrow();
  });

  it('handles null responsable', () => {
    const p = { ...mockPartenaire, responsable: null };
    expect(() => exportPartenairesToCSV([p as any])).not.toThrow();
  });
});
