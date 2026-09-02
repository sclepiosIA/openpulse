/* @vitest-environment jsdom */
/**
 * Tests useDriveUpload — upload UI → Azure Blob (intent → PUT SAS →
 * complete) avec invalidation de l'arborescence de l'espace.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useDriveUpload,
  uploadFileToDrive,
  driveUploadErrorMessage,
  DRIVE_MAX_UPLOAD_BYTES,
} from './useDriveUpload';
import { DriveApiError } from '@/lib/drive/types';
import { webcrypto } from 'node:crypto';

// jsdom expose un SubtleCrypto incomplet → on force l'implémentation Node
// pour tester le calcul sha256 réel du flux d'upload.
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

// jsdom : File/Blob sans arrayBuffer() → polyfill FileReader + copie dans
// un ArrayBuffer du realm courant (webcrypto Node rejette le cross-realm).
if (typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = reader.result as ArrayBuffer;
        const copy = new Uint8Array(raw.byteLength);
        copy.set(new Uint8Array(raw));
        resolve(copy.buffer);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

const { requestDriveUploadIntentMock, completeDriveUploadMock } = vi.hoisted(() => ({
  requestDriveUploadIntentMock: vi.fn(),
  completeDriveUploadMock: vi.fn(),
}));

vi.mock('@/lib/drive/driveClient', () => ({
  requestDriveUploadIntent: requestDriveUploadIntentMock,
  completeDriveUpload: completeDriveUploadMock,
}));

const INTENT = {
  action: 'upload' as const,
  upload_url: 'https://blob.azure.test/container/file?sig=abc',
  upload_token: 'token-1',
  file_id: 'file-1',
  version: 2,
  blob_container: 'drive',
  blob_name: 'file-1/v2',
  conflict: false,
};

function makeFile(name = 'note.pdf', content = 'hello', type = 'application/pdf') {
  return new File([content], name, { type });
}

function stubFetchOk(etag: string | null = '"etag-1"') {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 201,
    headers: { get: (h: string) => (h.toLowerCase() === 'etag' ? etag : null) },
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('uploadFileToDrive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestDriveUploadIntentMock.mockResolvedValue(INTENT);
    completeDriveUploadMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('flux nominal : intent → PUT Azure Blob → complete', async () => {
    const fetchMock = stubFetchOk();
    const file = makeFile();

    const result = await uploadFileToDrive({ spaceId: 'space-1', file });

    expect(result).toEqual({ fileId: 'file-1', version: 2, path: '/note.pdf', action: 'upload' });

    // Intent : espace + path + taille + sha256 + content-type.
    const intentReq = requestDriveUploadIntentMock.mock.calls[0][0];
    expect(intentReq.space_id).toBe('space-1');
    expect(intentReq.path).toBe('/note.pdf');
    expect(intentReq.size_bytes).toBe(file.size);
    expect(intentReq.content_type).toBe('application/pdf');
    expect(intentReq.sha256).toMatch(/^[0-9a-f]{64}$/);

    // PUT direct sur l'URL SAS avec les en-têtes BlockBlob.
    expect(fetchMock).toHaveBeenCalledWith(
      INTENT.upload_url,
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'x-ms-blob-type': 'BlockBlob' }),
      }),
    );

    // Complete : commit de la version avec etag remonté par Azure.
    expect(completeDriveUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        upload_token: 'token-1',
        file_id: 'file-1',
        version: 2,
        etag: '"etag-1"',
        size_bytes: file.size,
      }),
    );
  });

  it('respecte un path explicite', async () => {
    stubFetchOk();
    await uploadFileToDrive({ spaceId: 'space-1', file: makeFile(), path: '/Contrats/note.pdf' });
    expect(requestDriveUploadIntentMock.mock.calls[0][0].path).toBe('/Contrats/note.pdf');
  });

  it('action noop → aucune requête blob ni complete', async () => {
    const fetchMock = stubFetchOk();
    requestDriveUploadIntentMock.mockResolvedValue({
      ...INTENT,
      action: 'noop',
      upload_url: null,
      upload_token: null,
    });

    const result = await uploadFileToDrive({ spaceId: 'space-1', file: makeFile() });

    expect(result.action).toBe('noop');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(completeDriveUploadMock).not.toHaveBeenCalled();
  });

  it('action conflict → erreur lisible avec la raison', async () => {
    requestDriveUploadIntentMock.mockResolvedValue({
      ...INTENT,
      action: 'conflict',
      conflict: true,
      conflict_reason: 'version 3 déjà présente',
    });

    await expect(uploadFileToDrive({ spaceId: 'space-1', file: makeFile() })).rejects.toThrow(
      /conflit de version.*version 3 déjà présente/i,
    );
  });

  it('intent incomplet (pas de SAS) → erreur explicite', async () => {
    requestDriveUploadIntentMock.mockResolvedValue({ ...INTENT, upload_url: null });

    await expect(uploadFileToDrive({ spaceId: 'space-1', file: makeFile() })).rejects.toThrow(
      /incomplète/i,
    );
  });

  it('PUT Azure non-2xx → erreur avec status, pas de complete', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 403, headers: { get: () => null } })),
    );

    await expect(uploadFileToDrive({ spaceId: 'space-1', file: makeFile() })).rejects.toThrow(
      /HTTP 403/,
    );
    expect(completeDriveUploadMock).not.toHaveBeenCalled();
  });

  it('échec réseau du PUT → message réseau clair', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))));

    await expect(uploadFileToDrive({ spaceId: 'space-1', file: makeFile() })).rejects.toThrow(
      /stockage Azure impossible/i,
    );
  });

  it('fichier > 200 Mo → refus immédiat sans appel API', async () => {
    const bigFile = makeFile();
    Object.defineProperty(bigFile, 'size', { value: DRIVE_MAX_UPLOAD_BYTES + 1 });

    await expect(uploadFileToDrive({ spaceId: 'space-1', file: bigFile })).rejects.toThrow(
      /trop volumineux/i,
    );
    expect(requestDriveUploadIntentMock).not.toHaveBeenCalled();
  });
});

describe('useDriveUpload (mutation React Query)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestDriveUploadIntentMock.mockResolvedValue(INTENT);
    completeDriveUploadMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("invalide l'arborescence de l'espace après succès", async () => {
    stubFetchOk();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDriveUpload(), { wrapper });

    result.current.mutate({ spaceId: 'space-1', file: makeFile() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['drive', 'tree', 'space-1'] });
  });
});

describe('driveUploadErrorMessage', () => {
  it('traduit une DriveApiError 403 en message droits', () => {
    expect(
      driveUploadErrorMessage(new DriveApiError('HTTP 403', '/api/drive/upload-intent', 403)),
    ).toMatch(/droits/i);
  });

  it('fallback dédié upload pour erreur inconnue', () => {
    expect(driveUploadErrorMessage(null)).toMatch(/téléversement/i);
  });
});
