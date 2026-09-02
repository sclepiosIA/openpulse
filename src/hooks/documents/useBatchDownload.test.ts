import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useBatchDownload } from './useBatchDownload';
import { toast } from 'sonner';
import type { DocumentWithRelations } from '@/types/documents';

const {
  mockInvoke,
  mockStorageDownload,
  mockStorageFrom,
  mockFrom,
  mockZipFile,
  mockGenerateAsync,
} = vi.hoisted(() => {
  const mockStorageDownload = vi.fn();
  return {
    mockInvoke: vi.fn(),
    mockStorageDownload,
    mockStorageFrom: vi.fn(() => ({ download: mockStorageDownload })),
    mockFrom: vi.fn(),
    mockZipFile: vi.fn(),
    mockGenerateAsync: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockInvoke },
    storage: { from: mockStorageFrom },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock('jszip', () => ({
  default: class MockJSZip {
    file = mockZipFile;
    generateAsync = mockGenerateAsync;
  },
}));

function makeDoc(overrides: Partial<DocumentWithRelations>): DocumentWithRelations {
  return {
    id: 'doc-1',
    name: 'fichier.pdf',
    storage_bucket: 'documents',
    storage_path: 'path/fichier.pdf',
    ...overrides,
  } as unknown as DocumentWithRelations;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useBatchDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    mockGenerateAsync.mockResolvedValue(new Blob(['zipcontent']));
  });

  it('expose un état initial inactif', () => {
    const { result } = renderHook(() => useBatchDownload(), { wrapper: createWrapper() });
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.total).toBe(0);
    expect(result.current.current).toBe(0);
    expect(typeof result.current.downloadBatch).toBe('function');
  });

  it('ne fait rien avec un tableau vide', async () => {
    const { result } = renderHook(() => useBatchDownload(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.downloadBatch([]);
    });
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockStorageFrom).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('télécharge directement un fichier unique depuis le storage supabase', async () => {
    mockStorageDownload.mockResolvedValue({ data: new Blob(['contenu']), error: null });
    const { result } = renderHook(() => useBatchDownload(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.downloadBatch([
        makeDoc({ name: 'rapport.pdf', storage_bucket: 'documents', storage_path: 'dir/rapport.pdf' }),
      ]);
    });

    expect(mockStorageFrom).toHaveBeenCalledWith('documents');
    expect(mockStorageDownload).toHaveBeenCalledWith('dir/rapport.pdf');
    expect(toast.success).toHaveBeenCalledWith('Téléchargement lancé');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(result.current.isDownloading).toBe(false);
  });

  it('télécharge un fichier unique nextcloud via la edge function', async () => {
    mockInvoke.mockResolvedValue({
      data: { content: btoa('hello'), mimeType: 'text/plain' },
      error: null,
    });
    const { result } = renderHook(() => useBatchDownload(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.downloadBatch([
        makeDoc({ name: 'note.txt', storage_bucket: 'nextcloud', storage_path: '/nc/note.txt' }),
      ]);
    });

    expect(mockInvoke).toHaveBeenCalledWith('nextcloud-files', {
      body: { action: 'download', path: '/nc/note.txt' },
    });
    expect(mockStorageFrom).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Téléchargement lancé');
  });

  it('affiche une erreur si le téléchargement unique échoue', async () => {
    mockStorageDownload.mockResolvedValue({ data: null, error: { message: 'x' } });
    const { result } = renderHook(() => useBatchDownload(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.downloadBatch([makeDoc({ name: 'ko.pdf' })]);
    });

    expect(toast.error).toHaveBeenCalledWith('Erreur lors du téléchargement');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('crée un ZIP pour plusieurs fichiers et gère les doublons de noms', async () => {
    mockStorageDownload.mockResolvedValue({ data: new Blob(['data']), error: null });
    const { result } = renderHook(() => useBatchDownload(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.downloadBatch([
        makeDoc({ id: 'a', name: 'doc.pdf', storage_path: 'p/a.pdf' }),
        makeDoc({ id: 'b', name: 'doc.pdf', storage_path: 'p/b.pdf' }),
        makeDoc({ id: 'c', name: 'autre.txt', storage_path: 'p/c.txt' }),
      ]);
    });

    expect(mockZipFile).toHaveBeenCalledTimes(3);
    expect(mockZipFile).toHaveBeenNthCalledWith(1, 'doc.pdf', expect.any(Blob));
    expect(mockZipFile).toHaveBeenNthCalledWith(2, 'doc (1).pdf', expect.any(Blob));
    expect(mockZipFile).toHaveBeenNthCalledWith(3, 'autre.txt', expect.any(Blob));
    expect(mockGenerateAsync).toHaveBeenCalledWith({ type: 'blob' });
    expect(toast.success).toHaveBeenCalledWith('3 fichier(s) téléchargé(s) en ZIP');
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it('affiche un avertissement quand certains fichiers échouent en mode ZIP', async () => {
    mockStorageDownload
      .mockResolvedValueOnce({ data: new Blob(['ok']), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    const { result } = renderHook(() => useBatchDownload(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.downloadBatch([
        makeDoc({ id: 'a', name: 'ok.pdf', storage_path: 'p/ok.pdf' }),
        makeDoc({ id: 'b', name: 'ko.pdf', storage_path: 'p/ko.pdf' }),
      ]);
    });

    expect(mockZipFile).toHaveBeenCalledTimes(1);
    expect(mockZipFile).toHaveBeenCalledWith('ok.pdf', expect.any(Blob));
    expect(toast.warning).toHaveBeenCalledWith('1 fichier(s) téléchargé(s), 1 erreur(s)');
  });

  it("affiche une erreur quand aucun fichier n'a pu être téléchargé en mode ZIP", async () => {
    mockStorageDownload.mockResolvedValue({ data: null, error: { message: 'x' } });
    const { result } = renderHook(() => useBatchDownload(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.downloadBatch([
        makeDoc({ id: 'a', name: 'a.pdf' }),
        makeDoc({ id: 'b', name: 'b.pdf' }),
      ]);
    });

    expect(toast.error).toHaveBeenCalledWith("Aucun fichier n'a pu être téléchargé");
    expect(mockGenerateAsync).not.toHaveBeenCalled();
    expect(result.current.isDownloading).toBe(false);
  });

  it('affiche une erreur si la génération du ZIP échoue', async () => {
    mockStorageDownload.mockResolvedValue({ data: new Blob(['ok']), error: null });
    mockGenerateAsync.mockRejectedValue(new Error('zip fail'));
    const { result } = renderHook(() => useBatchDownload(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.downloadBatch([
        makeDoc({ id: 'a', name: 'a.pdf' }),
        makeDoc({ id: 'b', name: 'b.pdf' }),
      ]);
    });

    expect(toast.error).toHaveBeenCalledWith('Erreur lors de la création du ZIP');
    expect(result.current.isDownloading).toBe(false);
  });
});