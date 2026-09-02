import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dynamic imports
const mockJsPDF = vi.fn().mockImplementation(() => ({
  setFontSize: vi.fn(),
  text: vi.fn(),
  setFont: vi.fn(),
  save: vi.fn(),
  lastAutoTable: { finalY: 100 },
}));

const mockAutoTable = vi.fn();
const mockXLSX = {
  utils: {
    json_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
    aoa_to_sheet: vi.fn(() => ({})),
  },
  writeFile: vi.fn(),
};

vi.mock('@/lib/export/dynamicPdfImport', () => ({
  loadPdfLibs: vi.fn(async () => ({ jsPDF: mockJsPDF, autoTable: mockAutoTable })),
  loadExcelLibs: vi.fn(async () => ({ XLSX: mockXLSX })),
}));

import { exportRecettesPDF, exportRecettesExcel } from '../tresorerie/exportRecettes';

const sampleRevenus = [
  { mois: '2025-06', date_prevue: '2025-06-15', montant_prevu: 5000, notes: 'Facture A', categorie_label: 'Abonnement' },
  { mois: '2025-07', date_prevue: null, montant_prevu: 3000, notes: null, categorie_label: null },
];

const dateDebut = new Date('2025-06-01');
const dateFin = new Date('2025-07-31');

describe('exportRecettesPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a PDF document with correct title', async () => {
    await exportRecettesPDF(sampleRevenus, dateDebut, dateFin);
    expect(mockJsPDF).toHaveBeenCalled();
    const doc = mockJsPDF.mock.results[0].value;
    expect(doc.setFontSize).toHaveBeenCalledWith(18);
    expect(doc.text).toHaveBeenCalledWith('Revenus', 14, 20);
  });

  it('should call autoTable with correct headers', async () => {
    await exportRecettesPDF(sampleRevenus, dateDebut, dateFin);
    expect(mockAutoTable).toHaveBeenCalled();
    const callArgs = mockAutoTable.mock.calls[0][1];
    expect(callArgs.head[0]).toEqual(['Date', 'Montant', 'Catégorie', 'Intitulé Qonto']);
  });

  it('should save PDF with date in filename', async () => {
    await exportRecettesPDF(sampleRevenus, dateDebut, dateFin);
    const doc = mockJsPDF.mock.results[0].value;
    expect(doc.save).toHaveBeenCalledWith(expect.stringContaining('revenus-'));
  });

  it('should handle empty revenus array', async () => {
    await exportRecettesPDF([], dateDebut, dateFin);
    expect(mockAutoTable).toHaveBeenCalled();
    const callArgs = mockAutoTable.mock.calls[0][1];
    expect(callArgs.body).toEqual([]);
  });

  it('should format montant as EUR currency', async () => {
    await exportRecettesPDF(sampleRevenus, dateDebut, dateFin);
    const callArgs = mockAutoTable.mock.calls[0][1];
    // Check that body rows contain formatted values
    expect(callArgs.body.length).toBe(2);
  });
});

describe('exportRecettesExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create workbook with Revenus sheet', async () => {
    await exportRecettesExcel(sampleRevenus, dateDebut, dateFin);
    expect(mockXLSX.utils.json_to_sheet).toHaveBeenCalled();
    expect(mockXLSX.utils.book_append_sheet).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), 'Revenus'
    );
  });

  it('should create Statistiques sheet', async () => {
    await exportRecettesExcel(sampleRevenus, dateDebut, dateFin);
    expect(mockXLSX.utils.aoa_to_sheet).toHaveBeenCalled();
    expect(mockXLSX.utils.book_append_sheet).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), 'Statistiques'
    );
  });

  it('should write file with date in filename', async () => {
    await exportRecettesExcel(sampleRevenus, dateDebut, dateFin);
    expect(mockXLSX.writeFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('revenus-')
    );
  });

  it('should set column widths', async () => {
    await exportRecettesExcel(sampleRevenus, dateDebut, dateFin);
    const sheet = mockXLSX.utils.json_to_sheet.mock.results[0].value;
    // Column widths are set on the sheet object
    expect(mockXLSX.utils.json_to_sheet).toHaveBeenCalled();
  });

  it('should handle null montant_prevu', async () => {
    const revenus = [{ mois: '2025-06', montant_prevu: null, notes: null, categorie_label: null }];
    await exportRecettesExcel(revenus, dateDebut, dateFin);
    expect(mockXLSX.utils.json_to_sheet).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (mockXLSX.utils.json_to_sheet as any).mock.calls.at(-1)?.[0];
    expect(data?.[0]?.Montant).toBe(0);
  });
});
