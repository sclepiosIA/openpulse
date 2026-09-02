// @vitest-environment jsdom

const {
  mockLoadPdfLibs,
  mockLoadExcelLibs,
  jsPdfInstances,
  autoTableMock,
  jsonToSheetMock,
  aoaToSheetMock,
  bookNewMock,
  bookAppendSheetMock,
  writeFileMock,
} = vi.hoisted(() => {
  const jsPdfInstances: Array<{
    setFontSize: ReturnType<typeof vi.fn>;
    text: ReturnType<typeof vi.fn>;
    setFont: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    lastAutoTable: { finalY: number };
  }> = [];

  const JsPDFMock = vi.fn(() => {
    const instance = {
      setFontSize: vi.fn(),
      text: vi.fn(),
      setFont: vi.fn(),
      save: vi.fn(),
      lastAutoTable: { finalY: 72 },
    };
    jsPdfInstances.push(instance);
    return instance;
  });

  const autoTableMock = vi.fn((doc: { lastAutoTable: { finalY: number } }) => {
    doc.lastAutoTable = { finalY: 72 };
  });

  const jsonToSheetMock = vi.fn((data: unknown) => ({ data }));
  const aoaToSheetMock = vi.fn((data: unknown) => ({ data }));
  const bookNewMock = vi.fn(() => ({ sheets: [] }));
  const bookAppendSheetMock = vi.fn();
  const writeFileMock = vi.fn();

  const mockLoadPdfLibs = vi.fn(async () => ({
    jsPDF: JsPDFMock,
    autoTable: autoTableMock,
  }));

  const mockLoadExcelLibs = vi.fn(async () => ({
    XLSX: {
      utils: {
        json_to_sheet: jsonToSheetMock,
        aoa_to_sheet: aoaToSheetMock,
        book_new: bookNewMock,
        book_append_sheet: bookAppendSheetMock,
      },
      writeFile: writeFileMock,
    },
  }));

  return {
    mockLoadPdfLibs,
    mockLoadExcelLibs,
    jsPdfInstances,
    autoTableMock,
    jsonToSheetMock,
    aoaToSheetMock,
    bookNewMock,
    bookAppendSheetMock,
    writeFileMock,
  };
});

vi.mock("@/lib/export/dynamicPdfImport", () => ({
  loadPdfLibs: mockLoadPdfLibs,
  loadExcelLibs: mockLoadExcelLibs,
}));

import { exportRecettesPDF, exportRecettesExcel } from "./exportRecettes";

describe("exportRecettes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jsPdfInstances.length = 0;
  });

  describe("exportRecettesPDF", () => {
    it("exporte un PDF avec les données métier formatées, la période et le total", async () => {
      const revenus = [
        {
          mois: "2024-01",
          montant_prevu: 1200.5,
          notes: "Virement client",
          categorie_label: "Prestations",
        },
        {
          mois: "2024-01",
          date_prevue: "2024-01-15",
          montant_prevu: null,
          notes: null,
          categorie_label: null,
        },
      ];

      const dateDebut = new Date("2024-01-01T00:00:00.000Z");
      const dateFin = new Date("2024-01-31T00:00:00.000Z");

      await exportRecettesPDF(revenus, dateDebut, dateFin);

      expect(mockLoadPdfLibs).toHaveBeenCalledTimes(1);
      expect(jsPdfInstances).toHaveLength(1);

      const doc = jsPdfInstances[0];

      expect(doc.setFontSize).toHaveBeenNthCalledWith(1, 18);
      expect(doc.text).toHaveBeenNthCalledWith(1, "Revenus", 14, 20);
      expect(doc.setFontSize).toHaveBeenNthCalledWith(2, 11);
      expect(doc.text).toHaveBeenNthCalledWith(2, "Période: 01/01/2024 - 31/01/2024", 14, 28);

      expect(autoTableMock).toHaveBeenCalledTimes(1);
      expect(autoTableMock).toHaveBeenCalledWith(
        doc,
        expect.objectContaining({
          startY: 35,
          head: [["Date", "Montant", "Catégorie", "Intitulé Qonto"]],
          body: [
            ["01/01/2024", "1 200,50 €", "Prestations", "Virement client"],
            ["15/01/2024", "0,00 €", "-", "-"],
          ],
          theme: "striped",
          styles: { fontSize: 9 },
          headStyles: { fillColor: [59, 130, 246] },
        })
      );

      expect(doc.setFontSize).toHaveBeenLastCalledWith(12);
      expect(doc.setFont).toHaveBeenCalledWith("helvetica", "bold");
      expect(doc.text).toHaveBeenLastCalledWith("Total: 1 200,50 €", 14, 82);
      expect(doc.save).toHaveBeenCalledTimes(1);
      expect(doc.save.mock.calls[0][0]).toMatch(/^revenus-\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it("utilise la chaîne de date brute si le format de date est invalide", async () => {
      const revenus = [
        {
          mois: "not-a-date",
          montant_prevu: 10,
          notes: "Note",
          categorie_label: "Autre",
        },
      ];

      await exportRecettesPDF(
        revenus,
        new Date("2024-02-01T00:00:00.000Z"),
        new Date("2024-02-29T00:00:00.000Z")
      );

      const doc = jsPdfInstances[0];

      expect(autoTableMock).toHaveBeenCalledWith(
        doc,
        expect.objectContaining({
          body: [["not-a-date", "10,00 €", "Autre", "Note"]],
        })
      );
      expect(doc.text).toHaveBeenLastCalledWith("Total: 10,00 €", 14, 82);
    });

    it("propage l'erreur si le chargement des libs PDF échoue", async () => {
      const error = new Error("pdf failed");
      mockLoadPdfLibs.mockRejectedValueOnce(error);

      await expect(
        exportRecettesPDF([], new Date("2024-01-01T00:00:00.000Z"), new Date("2024-01-31T00:00:00.000Z"))
      ).rejects.toThrow("pdf failed");
    });
  });

  describe("exportRecettesExcel", () => {
    it("exporte un fichier Excel avec les feuilles Revenus et Statistiques", async () => {
      const revenus = [
        {
          mois: "2024-03",
          montant_prevu: 2500,
          notes: "Paiement mission",
          categorie_label: "Conseil",
        },
        {
          mois: "2024-03",
          date_prevue: "2024-03-20",
          montant_prevu: 99.99,
          notes: null,
          categorie_label: null,
        },
      ];

      const dateDebut = new Date("2024-03-01T00:00:00.000Z");
      const dateFin = new Date("2024-03-31T00:00:00.000Z");

      await exportRecettesExcel(revenus, dateDebut, dateFin);

      expect(mockLoadExcelLibs).toHaveBeenCalledTimes(1);

      expect(jsonToSheetMock).toHaveBeenCalledTimes(1);
      expect(jsonToSheetMock).toHaveBeenCalledWith([
        {
          Date: "01/03/2024",
          Montant: 2500,
          Catégorie: "Conseil",
          "Intitulé Qonto": "Paiement mission",
        },
        {
          Date: "20/03/2024",
          Montant: 99.99,
          Catégorie: "-",
          "Intitulé Qonto": "",
        },
      ]);

      const ws = jsonToSheetMock.mock.results[0].value as { ["!cols"]?: Array<{ wch: number }> };
      expect(ws["!cols"]).toEqual([
        { wch: 12 },
        { wch: 15 },
        { wch: 30 },
        { wch: 40 },
      ]);

      expect(bookNewMock).toHaveBeenCalledTimes(1);
      const wb = bookNewMock.mock.results[0].value;

      expect(bookAppendSheetMock).toHaveBeenNthCalledWith(1, wb, ws, "Revenus");

      expect(aoaToSheetMock).toHaveBeenCalledTimes(1);
      expect(aoaToSheetMock).toHaveBeenCalledWith([
        ["Statistiques"],
        [""],
        ["Période", "01/03/2024 - 31/03/2024"],
        ["Nombre de revenus", 2],
        ["Total prévu", 2599.99],
      ]);

      const wsStats = aoaToSheetMock.mock.results[0].value;
      expect(bookAppendSheetMock).toHaveBeenNthCalledWith(2, wb, wsStats, "Statistiques");

      expect(writeFileMock).toHaveBeenCalledTimes(1);
      expect(writeFileMock).toHaveBeenCalledWith(
        wb,
        expect.stringMatching(/^revenus-\d{4}-\d{2}-\d{2}\.xlsx$/)
      );
    });

    it("gère les valeurs nulles avec les valeurs par défaut attendues", async () => {
      const revenus = [
        {
          mois: "2024-04",
          montant_prevu: null,
          notes: null,
          categorie_label: null,
        },
      ];

      await exportRecettesExcel(
        revenus,
        new Date("2024-04-01T00:00:00.000Z"),
        new Date("2024-04-30T00:00:00.000Z")
      );

      expect(jsonToSheetMock).toHaveBeenCalledWith([
        {
          Date: "01/04/2024",
          Montant: 0,
          Catégorie: "-",
          "Intitulé Qonto": "",
        },
      ]);

      expect(aoaToSheetMock).toHaveBeenCalledWith([
        ["Statistiques"],
        [""],
        ["Période", "01/04/2024 - 30/04/2024"],
        ["Nombre de revenus", 1],
        ["Total prévu", 0],
      ]);
    });

    it("propage l'erreur si le chargement des libs Excel échoue", async () => {
      const error = new Error("excel failed");
      mockLoadExcelLibs.mockRejectedValueOnce(error);

      await expect(
        exportRecettesExcel([], new Date("2024-05-01T00:00:00.000Z"), new Date("2024-05-31T00:00:00.000Z"))
      ).rejects.toThrow("excel failed");
    });
  });
});