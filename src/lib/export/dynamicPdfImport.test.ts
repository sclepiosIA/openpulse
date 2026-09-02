import { waitFor } from '@testing-library/react';

type SubjectModule = typeof import('./dynamicPdfImport');

const {
  JSPDF_MODULE,
  FAILING_JSPDF_MODULE,
  AUTOTABLE_MODULE,
  XLSX_MODULE,
  HTML2CANVAS_MODULE,
  DEBUG_MODULE,
  JsPdfConstructor,
  AutoTable,
  XlsxUtils,
  XlsxWriteFile,
  Html2Canvas,
  DebugWarn,
  PdfImportError,
} = vi.hoisted(() => {
  const PdfImportError = new Error('pdf load failed');
  const JsPdfConstructor = vi.fn(() => ({ documentType: 'pdf' }));
  const AutoTable = vi.fn(() => undefined);
  const XlsxUtils = {
    book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
    json_to_sheet: vi.fn((rows: readonly unknown[]) => ({ rows })),
  };
  const XlsxWriteFile = vi.fn(() => undefined);
  const Html2Canvas = vi.fn(async () => ({ rendered: true }));
  const DebugWarn = vi.fn(() => undefined);
  const DebugLog = vi.fn(() => undefined);
  const DebugError = vi.fn(() => undefined);

  const FAILING_JSPDF_MODULE = Object.defineProperty({}, 'default', {
    enumerable: true,
    get: () => {
      throw PdfImportError;
    },
  });

  return {
    JSPDF_MODULE: { default: JsPdfConstructor },
    FAILING_JSPDF_MODULE,
    AUTOTABLE_MODULE: { default: AutoTable },
    XLSX_MODULE: {
      utils: XlsxUtils,
      writeFile: XlsxWriteFile,
      version: 'v1',
    },
    HTML2CANVAS_MODULE: { default: Html2Canvas },
    DEBUG_MODULE: {
      warn: DebugWarn,
      log: DebugLog,
      error: DebugError,
    },
    JsPdfConstructor,
    AutoTable,
    XlsxUtils,
    XlsxWriteFile,
    Html2Canvas,
    DebugWarn,
    PdfImportError,
  };
});

vi.mock('@/lib/debug', () => ({ debug: DEBUG_MODULE }));

function mockSuccessfulHeavyLibs(): void {
  vi.doMock('jspdf', () => JSPDF_MODULE);
  vi.doMock('jspdf-autotable', () => AUTOTABLE_MODULE);
  vi.doMock('xlsx-js-style', () => XLSX_MODULE);
  vi.doMock('html2canvas', () => HTML2CANVAS_MODULE);
}

function mockFailingPdfLib(): void {
  vi.doMock('jspdf', () => FAILING_JSPDF_MODULE);
  vi.doMock('jspdf-autotable', () => AUTOTABLE_MODULE);
  vi.doMock('xlsx-js-style', () => XLSX_MODULE);
  vi.doMock('html2canvas', () => HTML2CANVAS_MODULE);
}

async function importSubject(): Promise<SubjectModule> {
  return await import('./dynamicPdfImport');
}

function isPdfImportFailure(value: unknown): boolean {
  if (value === PdfImportError) {
    return true;
  }

  if (value instanceof Error && 'cause' in value) {
    return (value as { cause?: unknown }).cause === PdfImportError;
  }

  return false;
}

describe('dynamicPdfImport', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockSuccessfulHeavyLibs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('loadPdfLibs charge jsPDF et autoTable puis réutilise la même référence en cache', async () => {
    const { loadPdfLibs } = await importSubject();

    const first = await loadPdfLibs();
    const second = await loadPdfLibs();

    expect(first).toBe(second);
    expect(first.jsPDF).toBe(JsPdfConstructor);
    expect(first.autoTable).toBe(AutoTable);
    expect(Object.keys(first).sort()).toEqual(['autoTable', 'jsPDF']);
  });

  it('loadExcelLibs charge xlsx-js-style et réutilise la même référence en cache', async () => {
    const { loadExcelLibs } = await importSubject();

    const first = await loadExcelLibs();
    const second = await loadExcelLibs();

    expect(first).toBe(second);
    expect(first.XLSX).toMatchObject({
      utils: XlsxUtils,
      writeFile: XlsxWriteFile,
      version: 'v1',
    });
    expect(first.XLSX.utils.book_new()).toEqual({ SheetNames: [], Sheets: {} });
    expect(first.XLSX.utils.json_to_sheet([{ id: '1' }])).toEqual({ rows: [{ id: '1' }] });
  });

  it('loadHtml2Canvas charge html2canvas et réutilise la même référence en cache', async () => {
    const { loadHtml2Canvas } = await importSubject();

    const first = await loadHtml2Canvas();
    const second = await loadHtml2Canvas();

    expect(first).toBe(second);
    expect(first.html2canvas).toBe(Html2Canvas);
    expect(Object.keys(first)).toEqual(['html2canvas']);
  });

  it('loadExportLibs combine les bibliothèques PDF et Excel avec les références métier attendues', async () => {
    const { loadExportLibs } = await importSubject();

    const libs = await loadExportLibs();

    expect(libs.jsPDF).toBe(JsPdfConstructor);
    expect(libs.autoTable).toBe(AutoTable);
    expect(libs.XLSX).toMatchObject({
      utils: XlsxUtils,
      writeFile: XlsxWriteFile,
      version: 'v1',
    });
    expect(Object.keys(libs).sort()).toEqual(['XLSX', 'autoTable', 'jsPDF']);
  });

  it('propage une erreur de chargement PDF sans journaliser directement', async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFailingPdfLib();

    const { loadPdfLibs } = await importSubject();

    await expect(loadPdfLibs()).rejects.toSatisfy(isPdfImportFailure);
    expect(DebugWarn).not.toHaveBeenCalled();
  });

  it('preloadExportLibs lance le préchargement sans throw et journalise un échec PDF en mode DEV', async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('DEV', true);
    mockFailingPdfLib();

    const { preloadExportLibs } = await importSubject();

    expect(() => preloadExportLibs()).not.toThrow();

    await waitFor(() => {
      expect(DebugWarn).toHaveBeenCalledTimes(1);
    });

    const [message, error] = DebugWarn.mock.calls[0] ?? [];

    expect(message).toBe('[ExportLibs] PDF preload failed:');
    expect(isPdfImportFailure(error)).toBe(true);
  });

  it('preloadExportLibs ignore silencieusement les échecs PDF hors mode DEV', async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('DEV', false);
    mockFailingPdfLib();

    const { preloadExportLibs } = await importSubject();

    expect(() => preloadExportLibs()).not.toThrow();

    await waitFor(() => {
      expect(DebugWarn).not.toHaveBeenCalled();
    });
  });
});