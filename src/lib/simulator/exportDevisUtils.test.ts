/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { act } from '@testing-library/react';
import * as exportDevisUtils from './exportDevisUtils';

const {
  LOGO_TEXT,
  FETCH_OK,
  FETCH_FAIL,
  mockLoadPdfLibs,
  mockLoadExcelLibs,
  createdDocs,
  autoTableCalls,
  docMethodCalls,
  FIXED_DATE,
  RESULTS,
  PARAMS,
} = vi.hoisted(() => {
  const createdDocsStore: Array<Record<string, unknown>> = [];
  const autoTableCallsStore: Array<Record<string, unknown>> = [];
  const docMethodCallsStore: Record<string, Array<unknown[]>> = {
    text: [],
    addImage: [],
    save: [],
    setTextColor: [],
    setFontSize: [],
    setFont: [],
    rect: [],
    roundedRect: [],
    line: [],
    setFillColor: [],
    setDrawColor: [],
    setLineWidth: [],
  };

  const createDoc = () => {
    const doc = {
      internal: {
        pageSize: {
          getWidth: () => 297,
          getHeight: () => 210,
        },
      },
      lastAutoTable: { finalY: 120 },
      setTextColor: vi.fn((...args: unknown[]) => {
        docMethodCallsStore.setTextColor.push(args);
        return doc;
      }),
      setFontSize: vi.fn((...args: unknown[]) => {
        docMethodCallsStore.setFontSize.push(args);
        return doc;
      }),
      setFont: vi.fn((...args: unknown[]) => {
        docMethodCallsStore.setFont.push(args);
        return doc;
      }),
      text: vi.fn((...args: unknown[]) => {
        docMethodCallsStore.text.push(args);
        return doc;
      }),
      setFillColor: vi.fn((...args: unknown[]) => {
        docMethodCallsStore.setFillColor.push(args);
        return doc;
      }),
      rect: vi.fn((...args: unknown[]) => {
        docMethodCallsStore.rect.push(args);
        return doc;
      }),
      addImage: vi.fn((...args: unknown[]) => {
        docMethodCallsStore.addImage.push(args);
        return doc;
      }),
      roundedRect: vi.fn((...args: unknown[]) => {
        docMethodCallsStore.roundedRect.push(args);
        return doc;
      }),
      setDrawColor: vi.fn((...args: unknown[]) => {
        docMethodCallsStore.setDrawColor.push(args);
        return doc;
      }),
      setLineWidth: vi.fn((...args: unknown[]) => {
        docMethodCallsStore.setLineWidth.push(args);
        return doc;
      }),
      line: vi.fn((...args: unknown[]) => {
        docMethodCallsStore.line.push(args);
        return doc;
      }),
      save: vi.fn((...args: unknown[]) => {
        docMethodCallsStore.save.push(args);
        return doc;
      }),
    };
    createdDocsStore.push(doc as unknown as Record<string, unknown>);
    return doc;
  };

  const mockAutoTableFn = vi.fn((doc: Record<string, unknown>, options: Record<string, unknown>) => {
    autoTableCallsStore.push({ doc, options });
    doc.lastAutoTable = { finalY: 140 };
    return doc;
  });

  const mockLoadPdfLibsFn = vi.fn(async () => ({
    jsPDF: class MockJsPDF {
      constructor() {
        return createDoc();
      }
    },
    autoTable: mockAutoTableFn,
  }));

  const mockLoadExcelLibsFn = vi.fn(async () => ({
    ExcelJS: {
      Workbook: class MockWorkbook {},
    },
    saveAs: vi.fn(),
  }));

  const fetchOk = vi.fn(async () => ({
    text: async () => LOGO_TEXT,
  }));

  const fetchFail = vi.fn(async () => {
    throw new Error('logo fail');
  });

  return {
    LOGO_TEXT: '<svg><text>logo</text></svg>',
    FETCH_OK: fetchOk,
    FETCH_FAIL: fetchFail,
    mockLoadPdfLibs: mockLoadPdfLibsFn,
    mockLoadExcelLibs: mockLoadExcelLibsFn,
    createdDocs: createdDocsStore,
    autoTableCalls: autoTableCallsStore,
    docMethodCalls: docMethodCallsStore,
    FIXED_DATE: new Date('2024-03-12T10:00:00.000Z'),
    RESULTS: {
      passagesAnnuels: 12345,
      configuration: {
        centerType: { name: 'Centre Hospitalier Universitaire' },
        dpiType: { name: 'Maincare' },
      },
      paliers: [
        {
          tauxObjectif: 10.5,
          uhcdObjectif: 100,
          uhcdSupplementaires: 12,
          roiUhcd: 1000,
          roiAvisSpec: 200,
          roiCcmu2: 300,
          roiCcmu3: 400,
          roiMonoUhcdBonus: 50,
          roiTotal: 1950,
          roiNet: 1500,
        },
        {
          tauxObjectif: 12.5,
          uhcdObjectif: 120,
          uhcdSupplementaires: 20,
          roiUhcd: 2000,
          roiAvisSpec: 250,
          roiCcmu2: 350,
          roiCcmu3: 450,
          roiMonoUhcdBonus: 60,
          roiTotal: 3110,
          roiNet: 2600,
        },
        {
          tauxObjectif: 15.5,
          uhcdObjectif: 150,
          uhcdSupplementaires: 30,
          roiUhcd: 3000,
          roiAvisSpec: 300,
          roiCcmu2: 400,
          roiCcmu3: 500,
          roiMonoUhcdBonus: 70,
          roiTotal: 4270,
          roiNet: 3700,
        },
        {
          tauxObjectif: 18.5,
          uhcdObjectif: 180,
          uhcdSupplementaires: 40,
          roiUhcd: 4000,
          roiAvisSpec: 350,
          roiCcmu2: 450,
          roiCcmu3: 550,
          roiMonoUhcdBonus: 80,
          roiTotal: 5430,
          roiNet: 4800,
        },
      ],
    },
    PARAMS: {
      baseline: 8.3,
    },
  };
});

vi.mock('@/lib/export/dynamicPdfImport', () => ({
  loadPdfLibs: mockLoadPdfLibs,
  loadExcelLibs: mockLoadExcelLibs,
}));

vi.mock('@/assets/marque/logo.svg', () => ({
  default: '/mocked-logo.svg',
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  return Wrapper;
}

describe('exportDevisUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdDocs.length = 0;
    autoTableCalls.length = 0;
    Object.values(docMethodCalls).forEach((calls) => {
      calls.length = 0;
    });
    vi.stubGlobal('fetch', FETCH_OK);
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('charge les libs PDF et génère un document avec les valeurs métier attendues', async () => {
    expect(typeof exportDevisUtils.exportDevisPDF).toBe('function');

    await exportDevisUtils.exportDevisPDF({
      results: RESULTS,
      params: PARAMS,
      etablissementNom: 'CHU Test',
      isPremierNiveau: false,
      isPartnerExport: true,
    });

    expect(mockLoadPdfLibs).toHaveBeenCalledTimes(1);
    expect(FETCH_OK).toHaveBeenCalledWith('/mocked-logo.svg');
    expect(createdDocs.length).toBeGreaterThan(0);
    expect(autoTableCalls.length).toBeGreaterThan(0);

    const allTexts = docMethodCalls.text.map((args) => String(args[0]));
    expect(allTexts.some((t) => t.includes('12/03/2024'))).toBe(true);
    expect(allTexts.some((t) => t.includes('DOC PARTENAIRE'))).toBe(true);
    expect(allTexts.some((t) => t.includes('MODELE AU SUCCES - PROJECTIONS PAR PALIER'))).toBe(true);
    expect(allTexts.some((t) => t.includes('12 345'))).toBe(true);
    expect(allTexts.some((t) => t.includes('8,3%'))).toBe(true);
    expect(allTexts.some((t) => t.includes('Centre Hospitalier'))).toBe(true);
    expect(allTexts.some((t) => t.includes('Maincare'))).toBe(true);
    expect(allTexts.some((t) => t.includes('4 800 €')) || allTexts.some((t) => t.includes('4 800 EUR'))).toBe(true);

    const firstImageArg = docMethodCalls.addImage[0]?.[0];
    expect(String(firstImageArg)).toContain('data:image/svg+xml;base64,');

    const body = autoTableCalls[0]?.options?.body as Array<Array<string | { content: string; styles?: object }>>;
    expect(body).toBeTruthy();

    const flatten = body.flat().map((cell) => (typeof cell === 'string' ? cell : cell.content));
    expect(flatten).toContain('Taux UHCD objectif');
    expect(flatten).toContain('10,5%');
    expect(flatten).toContain('18,5%');
    expect(flatten).toContain('UHCD supplementaires');
    expect(flatten).toContain('+12');
    expect(flatten).toContain('+40');
    expect(flatten).toContain('Gains Avis spe.');
    expect(flatten).toContain('Gains CCMU 2+');
    expect(flatten).toContain('Gains CCMU 3+');
    expect(flatten).toContain('Bonus Mono-RUM');
    expect(flatten).toContain('GAINS TOTAUX');
    expect(flatten).toContain('5 430 EUR');

    expect(docMethodCalls.save.length).toBe(1);
  });

  it('bascule en fallback texte si le chargement du logo échoue', async () => {
    vi.stubGlobal('fetch', FETCH_FAIL);

    await exportDevisUtils.exportDevisPDF({
      results: RESULTS,
      params: PARAMS,
      etablissementNom: 'CHU Test',
      isPremierNiveau: true,
      isPartnerExport: false,
    });

    const allTexts = docMethodCalls.text.map((args) => String(args[0]));
    expect(docMethodCalls.addImage.length).toBe(0);
    expect(allTexts).toContain('MARQUE');
    expect(allTexts).toContain('I.A');

    const body = autoTableCalls[0]?.options?.body as Array<Array<string | { content: string; styles?: object }>>;
    const flatten = body.flat().map((cell) => (typeof cell === 'string' ? cell : cell.content));

    expect(flatten).toContain('GAINS ETABLISSEMENT');
    expect(flatten).not.toContain('Gains Avis spe.');
    expect(flatten).not.toContain('Gains CCMU 2+');
    expect(flatten).not.toContain('Gains CCMU 3+');
    expect(flatten).not.toContain('Bonus Mono-RUM');
  });

  it('permet un appel via hook wrapper sans erreur de chargement et reste stable', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => exportDevisUtils.exportDevisPDF, { wrapper });

    expect(result.current).toBe(exportDevisUtils.exportDevisPDF);

    await act(async () => {
      await result.current({
        results: RESULTS,
        params: PARAMS,
        etablissementNom: 'CHU Hook',
        isPremierNiveau: false,
        isPartnerExport: false,
      });
    });

    expect(mockLoadPdfLibs).toHaveBeenCalledTimes(1);
    expect(createdDocs.length).toBe(1);
    expect(autoTableCalls.length).toBeGreaterThan(0);
    expect(docMethodCalls.save.length).toBe(1);
  });
});