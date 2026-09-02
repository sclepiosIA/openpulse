import type { SpyInstance } from 'vitest';

const { MOCK_VERSION, PDF_WORKER_SRC, pdfjsMock } = vi.hoisted(() => ({
  MOCK_VERSION: '9.9.9+esm',
  PDF_WORKER_SRC: { value: 'https://cdn.example.com/pdf.worker.min.mjs?url' },
  pdfjsMock: {
    version: '9.9.9+esm',
    GlobalWorkerOptions: { workerSrc: '' as string },
  },
}));

vi.mock('react-pdf', () => ({
  pdfjs: pdfjsMock,
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: PDF_WORKER_SRC.value,
}));

describe('pdfjs worker configuration', () => {
  let infoSpy: SpyInstance;

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    // reset workerSrc between tests to ensure assertions rely on module side effects
    pdfjsMock.GlobalWorkerOptions.workerSrc = '';
  });

  it('appends &v=version when workerSrc already has a query string and logs in DEV', async () => {
    PDF_WORKER_SRC.value = 'https://cdn.example.com/pdf.worker.min.mjs?url';
    // re-define the module mock to reflect the updated value
    vi.doMock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
      default: PDF_WORKER_SRC.value,
    }));

    vi.stubEnv('DEV', 'true');

    const mod = await import('./pdfjs');

    expect(mod.pdfjs).toBe(pdfjsMock);

    const expected = `${PDF_WORKER_SRC.value}&v=${encodeURIComponent(MOCK_VERSION)}`;
    expect(pdfjsMock.GlobalWorkerOptions.workerSrc).toBe(expected);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [msg, payload] = infoSpy.mock.calls[0];
    expect(msg).toBe('[pdfjs] Configured');
    expect(payload).toMatchObject({
      apiVersion: MOCK_VERSION,
      workerSrc: expected,
    });
  });

  it('appends ?v=version when workerSrc has no query string and logs in DEV', async () => {
    PDF_WORKER_SRC.value = 'https://cdn.example.com/pdf.worker.min.mjs';
    vi.doMock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
      default: PDF_WORKER_SRC.value,
    }));

    vi.stubEnv('DEV', 'true');

    const mod = await import('./pdfjs');

    expect(mod.pdfjs).toBe(pdfjsMock);

    const expected = `${PDF_WORKER_SRC.value}?v=${encodeURIComponent(MOCK_VERSION)}`;
    expect(pdfjsMock.GlobalWorkerOptions.workerSrc).toBe(expected);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [msg, payload] = infoSpy.mock.calls[0];
    expect(msg).toBe('[pdfjs] Configured');
    expect(payload).toMatchObject({
      apiVersion: MOCK_VERSION,
      workerSrc: expected,
    });
  });

  it('does not log when not in DEV', async () => {
    PDF_WORKER_SRC.value = 'https://cdn.example.com/pdf.worker.min.mjs?url';
    vi.doMock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
      default: PDF_WORKER_SRC.value,
    }));

    vi.stubEnv('DEV', '');

    const mod = await import('./pdfjs');

    expect(mod.pdfjs).toBe(pdfjsMock);

    const expected = `${PDF_WORKER_SRC.value}&v=${encodeURIComponent(MOCK_VERSION)}`;
    expect(pdfjsMock.GlobalWorkerOptions.workerSrc).toBe(expected);

    expect(infoSpy).not.toHaveBeenCalled();
  });
});