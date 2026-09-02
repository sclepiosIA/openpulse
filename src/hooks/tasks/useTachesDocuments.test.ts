// @vitest-environment jsdom
import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useTachesDocuments,
  useUploadTacheDocument,
  useDeleteTacheDocument,
  useDocumentVersionHistory,
  getDocumentUrl,
} from './useTachesDocuments'

const {
  DOCS_ROWS,
  VERSION_ROWS,
  INSERTED_DOC,
  SIGNED_URL_DATA,
  stableToast,
  toastFn,
  debugMock,
  mockFrom,
  mockStorageFrom,
  mockInvoke,
  queryState,
  storageState,
  functionsState,
  fakeNow,
  fakeRandom,
} = vi.hoisted(() => {
  const DOCS_ROWS = [
    {
      id: 'doc-1',
      tache_id: 'task-1',
      nom_fichier: 'rapport.pdf',
      chemin_fichier: 'task-1/rapport.pdf',
      type_mime: 'application/pdf',
      taille_fichier: 123,
      document_type: 'rapport',
      version_number: 2,
      is_latest_version: true,
      previous_version_id: 'doc-0',
      source_type: 'manual',
      source_reference: 'src-1',
      auto_detected: false,
      detection_confidence: 0.9,
      metadata: { key: 'value' },
      uploaded_by: 'user-1',
      created_at: '2024-01-02T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
    },
    {
      id: 'doc-0',
      tache_id: 'task-1',
      nom_fichier: 'rapport-v1.pdf',
      chemin_fichier: 'task-1/rapport-v1.pdf',
      type_mime: 'application/pdf',
      taille_fichier: 120,
      document_type: 'rapport',
      version_number: 1,
      is_latest_version: false,
      previous_version_id: undefined,
      source_type: 'manual',
      source_reference: 'src-0',
      auto_detected: false,
      detection_confidence: 0.8,
      metadata: { old: true },
      uploaded_by: 'user-1',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    },
  ]

  const VERSION_ROWS = [
    {
      id: 'ver-2',
      tache_id: 'task-1',
      nom_fichier: 'eme-v2.pdf',
      chemin_fichier: 'task-1/eme-v2.pdf',
      type_mime: 'application/pdf',
      taille_fichier: 222,
      document_type: 'eme',
      version_number: 2,
      is_latest_version: true,
      previous_version_id: 'ver-1',
      source_type: 'manual',
      source_reference: 'x',
      auto_detected: false,
      detection_confidence: 0.99,
      metadata: { v: 2 },
      uploaded_by: 'user-1',
      created_at: '2024-02-02T00:00:00.000Z',
      updated_at: '2024-02-02T00:00:00.000Z',
    },
    {
      id: 'ver-1',
      tache_id: 'task-1',
      nom_fichier: 'eme-v1.pdf',
      chemin_fichier: 'task-1/eme-v1.pdf',
      type_mime: 'application/pdf',
      taille_fichier: 111,
      document_type: 'eme',
      version_number: 1,
      is_latest_version: false,
      previous_version_id: undefined,
      source_type: 'manual',
      source_reference: 'y',
      auto_detected: false,
      detection_confidence: 0.95,
      metadata: { v: 1 },
      uploaded_by: 'user-1',
      created_at: '2024-02-01T00:00:00.000Z',
      updated_at: '2024-02-01T00:00:00.000Z',
    },
  ]

  const INSERTED_DOC = {
    id: 'inserted-1',
    tache_id: 'task-1',
    nom_fichier: 'eme.pdf',
    chemin_fichier: 'task-1/1700000000000-4fzzzxjylrx.pdf',
    type_mime: 'application/pdf',
    taille_fichier: 456,
    uploaded_by: 'user-1',
    created_at: '2024-03-01T00:00:00.000Z',
    updated_at: '2024-03-01T00:00:00.000Z',
  }

  const SIGNED_URL_DATA = { signedUrl: 'https://example.test/signed/doc' }

  const toastFn = vi.fn()
  const stableToast = { toast: toastFn }

  const debugMock = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }

  const queryState = {
    data: DOCS_ROWS as unknown,
    error: null as unknown,
    singleData: INSERTED_DOC as unknown,
    maybeSingleData: null as unknown,
  }

  const storageState = {
    uploadError: null as unknown,
    removeError: null as unknown,
    signedUrlData: SIGNED_URL_DATA as unknown,
    signedUrlError: null as unknown,
  }

  const functionsState = {
    invokeResult: Promise.resolve({ data: { ok: true }, error: null }) as Promise<{ data: unknown; error: unknown }>,
  }

  const mockFrom = vi.fn()
  const mockStorageFrom = vi.fn()
  const mockInvoke = vi.fn()

  const fakeNow = 1700000000000
  const fakeRandom = 0.123456789

  return {
    DOCS_ROWS,
    VERSION_ROWS,
    INSERTED_DOC,
    SIGNED_URL_DATA,
    stableToast,
    toastFn,
    debugMock,
    mockFrom,
    mockStorageFrom,
    mockInvoke,
    queryState,
    storageState,
    functionsState,
    fakeNow,
    fakeRandom,
  }
})

function createBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: queryState.singleData, error: queryState.error })),
    maybeSingle: vi.fn(async () => ({ data: queryState.maybeSingleData, error: queryState.error })),
    then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: queryState.data, error: queryState.error }).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: queryState.data, error: queryState.error }).catch(onRejected),
  }
  return builder
}

function createStorageBucket() {
  return {
    upload: vi.fn(async () => ({ error: storageState.uploadError })),
    remove: vi.fn(async () => ({ error: storageState.removeError })),
    createSignedUrl: vi.fn(async () => ({ data: storageState.signedUrlData, error: storageState.signedUrlError })),
  }
}

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom.mockImplementation(() => createBuilder()),
    storage: {
      from: mockStorageFrom.mockImplementation(() => createStorageBucket()),
    },
    functions: {
      invoke: mockInvoke.mockImplementation((_name: string, _payload: unknown) => functionsState.invokeResult),
    },
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => stableToast,
}))

vi.mock('@/lib/debug', () => ({
  debug: debugMock,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useTachesDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryState.data = DOCS_ROWS
    queryState.error = null
    queryState.singleData = INSERTED_DOC
    queryState.maybeSingleData = null
    storageState.uploadError = null
    storageState.removeError = null
    storageState.signedUrlData = SIGNED_URL_DATA
    storageState.signedUrlError = null
    functionsState.invokeResult = Promise.resolve({ data: { ok: true }, error: null })
  })

  it('charge les documents d’une tâche et retourne les valeurs métier attendues', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useTachesDocuments('task-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('taches_documents')
    expect(result.current.data).toEqual(DOCS_ROWS)
    expect(result.current.data?.[0].nom_fichier).toBe('rapport.pdf')
    expect(result.current.data?.[0].version_number).toBe(2)
    expect(result.current.data?.[0].is_latest_version).toBe(true)
  })

  it('passe en erreur si la requête documents échoue et loggue un warning', async () => {
    const wrapper = createWrapper()
    queryState.error = { message: 'x' }
    queryState.data = null

    const { result } = renderHook(() => useTachesDocuments('task-1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual({ message: 'x' })
    expect(debugMock.warn).toHaveBeenCalled()
  })

  it('n’exécute pas la requête pour un id de tâche virtuel', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useTachesDocuments('portal-123'), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.isLoading).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('useUploadTacheDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryState.data = DOCS_ROWS
    queryState.error = null
    queryState.singleData = INSERTED_DOC
    storageState.uploadError = null
    functionsState.invokeResult = Promise.resolve({ data: { ok: true }, error: null })
    vi.spyOn(Date, 'now').mockReturnValue(fakeNow)
    vi.spyOn(Math, 'random').mockReturnValue(fakeRandom)
  })

  it('uploade un document, insère les métadonnées, invalide le cache et déclenche l’analyse EME', async () => {
    const wrapper = createWrapper()
    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')

    const file = new File(['pdf'], 'eme.pdf', { type: 'application/pdf' })

    const { result } = renderHook(() => useUploadTacheDocument(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        tacheId: 'task-1',
        file,
        currentUserId: 'user-1',
        tacheInfo: {
          titre: 'Étude médico économique 2024',
          etablissement_id: 'eta-1',
        },
      })
    })

    const expectedToken = Number(fakeRandom).toString(36).substring(2)
    const expectedPath = `task-1/${fakeNow}-${expectedToken}.pdf`

    expect(mockStorageFrom).toHaveBeenCalledWith('taches-documents')
    const storageBucket = mockStorageFrom.mock.results[0]?.value as ReturnType<typeof createStorageBucket>
    expect(storageBucket.upload).toHaveBeenCalledWith(
      expectedPath,
      file,
    )

    const insertBuilder = mockFrom.mock.results[mockFrom.mock.results.length - 1]?.value as ReturnType<typeof createBuilder>
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      tache_id: 'task-1',
      nom_fichier: 'eme.pdf',
      chemin_fichier: expectedPath,
      type_mime: 'application/pdf',
      taille_fichier: 3,
      uploaded_by: 'user-1',
    })

    expect(mockInvoke).toHaveBeenCalledWith('analyze-medical-economic-study', {
      body: {
        document_id: 'inserted-1',
        file_path: expectedPath,
        etablissement_id: 'eta-1',
      },
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['taches-documents', 'task-1'] })
    expect(toastFn).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Document uploadé avec succès',
    })
  })

  it('passe en erreur si l’upload échoue et affiche un toast destructif', async () => {
    const wrapper = createWrapper()
    storageState.uploadError = { message: 'x' }

    const file = new File(['abc'], 'err.pdf', { type: 'application/pdf' })

    const { result } = renderHook(() => useUploadTacheDocument(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          tacheId: 'task-1',
          file,
          currentUserId: 'user-1',
        }),
      ).rejects.toEqual({ message: 'x' })
    })

    expect(debugMock.error).toHaveBeenCalled()
    expect(toastFn).toHaveBeenCalledWith({
      title: 'Erreur',
      description: "Impossible d'uploader le document",
      variant: 'destructive',
    })
  })
})

describe('useDeleteTacheDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storageState.removeError = null
    queryState.error = null
  })

  it('supprime le fichier et la ligne, puis invalide les requêtes concernées', async () => {
    const wrapper = createWrapper()
    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteTacheDocument('eta-1'), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        documentId: 'doc-1',
        filePath: 'task-1/rapport.pdf',
      })
    })

    const storageBucket = mockStorageFrom.mock.results[0]?.value as ReturnType<typeof createStorageBucket>
    expect(storageBucket.remove).toHaveBeenCalledWith(['task-1/rapport.pdf'])

    const deleteBuilder = mockFrom.mock.results[0]?.value as ReturnType<typeof createBuilder>
    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'doc-1')

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['taches-documents'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['etablissement-documents', 'eta-1'] })
    expect(toastFn).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Document supprimé avec succès',
    })
  })

  it('passe en erreur si la suppression storage échoue', async () => {
    const wrapper = createWrapper()
    storageState.removeError = { message: 'x' }

    const { result } = renderHook(() => useDeleteTacheDocument('eta-1'), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          documentId: 'doc-1',
          filePath: 'task-1/rapport.pdf',
        }),
      ).rejects.toEqual({ message: 'x' })
    })

    expect(debugMock.error).toHaveBeenCalled()
    expect(toastFn).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de supprimer le document',
      variant: 'destructive',
    })
  })
})

describe('useDocumentVersionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryState.data = VERSION_ROWS
    queryState.error = null
  })

  it('charge l’historique de versions filtré par type de document', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useDocumentVersionHistory('task-1', 'eme'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const builder = mockFrom.mock.results[0]?.value as ReturnType<typeof createBuilder>
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'tache_id', 'task-1')
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'document_type', 'eme')
    expect(builder.order).toHaveBeenCalledWith('version_number', { ascending: false })
    expect(result.current.data).toEqual(VERSION_ROWS)
    expect(result.current.data?.[0].version_number).toBe(2)
  })

  it('passe en erreur et affiche un toast si le chargement de l’historique échoue', async () => {
    const wrapper = createWrapper()
    queryState.error = { message: 'x' }
    queryState.data = null

    const { result } = renderHook(() => useDocumentVersionHistory('task-1', 'eme'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual({ message: 'x' })
    expect(toastFn).toHaveBeenCalledWith({
      title: 'Erreur',
      description: "Impossible de charger l'historique",
      variant: 'destructive',
    })
  })
})

describe('getDocumentUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storageState.signedUrlData = SIGNED_URL_DATA
    storageState.signedUrlError = null
  })

  it('retourne l’URL signée du document', async () => {
    const url = await getDocumentUrl('task-1/rapport.pdf')

    expect(mockStorageFrom).toHaveBeenCalledWith('taches-documents')
    const storageBucket = mockStorageFrom.mock.results[0]?.value as ReturnType<typeof createStorageBucket>
    expect(storageBucket.createSignedUrl).toHaveBeenCalledWith('task-1/rapport.pdf', 3600)
    expect(url).toBe('https://example.test/signed/doc')
  })

  it('retourne null si la création d’URL signée échoue', async () => {
    storageState.signedUrlError = { message: 'x' }
    storageState.signedUrlData = null

    const url = await getDocumentUrl('task-1/rapport.pdf')

    expect(url).toBeNull()
    expect(debugMock.error).toHaveBeenCalled()
  })
})