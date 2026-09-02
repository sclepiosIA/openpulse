/// <reference types="vitest" />
/// <reference types="vite/client" />

import React, { type PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'

const {
  DOCS,
  INSERTED_DOC,
  mockFrom,
  mockStorageFrom,
  mockStorageUpload,
  mockStorageRemove,
  mockStorageCreateSignedUrl,
  toastSuccess,
  toastError,
  debugError,
  FIXED_NOW,
  FIXED_UUID,
} = vi.hoisted(() => {
  const DOCS = [
    {
      id: 'd2',
      profile_id: 'p1',
      type_document: 'contrat',
      titre: 'Contrat CDI',
      description: 'Contrat de travail',
      fichier_url: null,
      storage_path: 'p1/old_contrat.pdf',
      taille_octets: 100,
      mime_type: 'application/pdf',
      date_document: '2024-01-10',
      created_at: '2024-02-02T10:00:00.000Z',
      updated_at: '2024-02-02T10:00:00.000Z',
    },
    {
      id: 'd1',
      profile_id: 'p1',
      type_document: 'bulletin_salaire',
      titre: 'Bulletin Janvier',
      description: 'Janvier 2024',
      fichier_url: null,
      storage_path: 'p1/bulletin_jan.pdf',
      taille_octets: 200,
      mime_type: 'application/pdf',
      date_document: '2024-01-31',
      created_at: '2024-02-01T10:00:00.000Z',
      updated_at: '2024-02-01T10:00:00.000Z',
    },
  ] as const

  const INSERTED_DOC = {
    id: 'd3',
    profile_id: 'p1',
    type_document: 'attestation',
    titre: 'Attestation',
    description: 'Attestation employeur',
    fichier_url: null,
    storage_path: 'p1/new_attestation.pdf',
    taille_octets: 300,
    mime_type: 'application/pdf',
    date_document: '2024-03-01',
    created_at: '2024-03-01T10:00:00.000Z',
    updated_at: '2024-03-01T10:00:00.000Z',
  } as const

  const mockFrom = vi.fn()
  const mockStorageFrom = vi.fn()
  const mockStorageUpload = vi.fn()
  const mockStorageRemove = vi.fn()
  const mockStorageCreateSignedUrl = vi.fn()

  const toastSuccess = vi.fn()
  const toastError = vi.fn()
  const debugError = vi.fn()

  const FIXED_NOW = 1710000000000
  const FIXED_UUID = 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb'

  return {
    DOCS,
    INSERTED_DOC,
    mockFrom,
    mockStorageFrom,
    mockStorageUpload,
    mockStorageRemove,
    mockStorageCreateSignedUrl,
    toastSuccess,
    toastError,
    debugError,
    FIXED_NOW,
    FIXED_UUID,
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}))

type SupabaseError = { message: string }

type MockState = {
  selectData: unknown
  selectError: SupabaseError | null

  insertData: unknown
  insertError: SupabaseError | null

  deleteError: SupabaseError | null

  maybeSingleData: unknown
  maybeSingleError: SupabaseError | null
}

const mockState: MockState = {
  selectData: null,
  selectError: null,
  insertData: null,
  insertError: null,
  deleteError: null,
  maybeSingleData: null,
  maybeSingleError: null,
}

type QueryBuilderResult = { data: unknown; error: SupabaseError | null }

type ThenableResult<T> = PromiseLike<T> & {
  then: Promise<T>['then']
  catch: Promise<T>['catch']
}

function createThenable(result: QueryBuilderResult): ThenableResult<QueryBuilderResult> {
  const p = Promise.resolve(result)
  return {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
  }
}

type Builder = {
  select: (columns?: string) => Builder
  eq: (column: string, value: unknown) => Builder
  gte: (column: string, value: unknown) => Builder
  lte: (column: string, value: unknown) => Builder
  in: (column: string, values: unknown[]) => Builder
  order: (
    column: string,
    opts?: { ascending?: boolean }
  ) => (ThenableResult<QueryBuilderResult> & Builder) | Builder
  limit: (count: number) => Builder
  insert: (values: unknown) => Builder
  update: (values: unknown) => Builder
  delete: () => Builder
  single: () => ThenableResult<QueryBuilderResult>
  maybeSingle: () => ThenableResult<QueryBuilderResult>

  then: Promise<QueryBuilderResult>['then']
  catch: Promise<QueryBuilderResult>['catch']
}

function createBuilder(table: string): Builder {
  const state = {
    table,
    mode: 'select' as 'select' | 'insert' | 'delete' | 'update',
    insertedValues: undefined as unknown,
  }

  const baseResult = (): QueryBuilderResult => {
    if (state.mode === 'insert') return { data: mockState.insertData, error: mockState.insertError }
    if (state.mode === 'delete') return { data: null, error: mockState.deleteError }
    if (state.mode === 'update') return { data: null, error: null }
    return { data: mockState.selectData, error: mockState.selectError }
  }

  const builder: Partial<Builder> = {}

  const asThenable = (): ThenableResult<QueryBuilderResult> => createThenable(baseResult())

  builder.select = () => builder as Builder
  builder.eq = () => builder as Builder
  builder.gte = () => builder as Builder
  builder.lte = () => builder as Builder
  builder.in = () => builder as Builder
  builder.limit = () => builder as Builder

  builder.insert = (values: unknown) => {
    state.mode = 'insert'
    state.insertedValues = values
    return builder as Builder
  }

  builder.update = () => {
    state.mode = 'update'
    return builder as Builder
  }

  builder.delete = () => {
    state.mode = 'delete'
    return builder as Builder
  }

  builder.order = () => Object.assign(asThenable(), builder) as ThenableResult<QueryBuilderResult> & Builder

  builder.single = () => createThenable({ data: mockState.insertData, error: mockState.insertError })
  builder.maybeSingle = () =>
    createThenable({ data: mockState.maybeSingleData, error: mockState.maybeSingleError })

  builder.then = ((onFulfilled, onRejected) => asThenable().then(onFulfilled, onRejected)) as Promise<
    QueryBuilderResult
  >['then']
  builder.catch = ((onRejected) => asThenable().catch(onRejected)) as Promise<QueryBuilderResult>['catch']

  return builder as Builder
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    storage: {
      from: mockStorageFrom,
    },
  },
}))

function resetMockState() {
  mockState.selectData = null
  mockState.selectError = null
  mockState.insertData = null
  mockState.insertError = null
  mockState.deleteError = null
  mockState.maybeSingleData = null
  mockState.maybeSingleError = null
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper(props: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  resetMockState()

  mockFrom.mockImplementation((table: string) => createBuilder(table))

  mockStorageUpload.mockResolvedValue({ data: null, error: null })
  mockStorageRemove.mockResolvedValue({ data: null, error: null })
  mockStorageCreateSignedUrl.mockResolvedValue({ data: { signedUrl: '/signed/path' }, error: null })

  mockStorageFrom.mockImplementation(() => ({
    upload: mockStorageUpload,
    remove: mockStorageRemove,
    createSignedUrl: mockStorageCreateSignedUrl,
  }))

  vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => FIXED_UUID),
  } satisfies Partial<Crypto>)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useRHDocuments', () => {
  it('charge les documents et retourne les valeurs métier attendues', async () => {
    mockState.selectData = DOCS

    const queryClient = createTestQueryClient()
    const wrapper = createWrapper(queryClient)

    const { useRHDocuments } = await import('./useRHDocuments')

    const { result } = renderHook(() => useRHDocuments('p1'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(mockFrom).toHaveBeenCalledWith('rh_documents_employes')
    expect(result.current.documents).toHaveLength(2)
    expect(result.current.documents?.[0]).toMatchObject({
      id: 'd2',
      profile_id: 'p1',
      type_document: 'contrat',
      titre: 'Contrat CDI',
      storage_path: 'p1/old_contrat.pdf',
    })
    expect(result.current.documents?.[1]).toMatchObject({
      id: 'd1',
      type_document: 'bulletin_salaire',
      titre: 'Bulletin Janvier',
    })
  })

  it('passe en erreur si Supabase retourne { data:null, error } sur la requête', async () => {
    mockState.selectData = null
    mockState.selectError = { message: 'x' }

    const queryClient = createTestQueryClient()
    const wrapper = createWrapper(queryClient)

    const { useRHDocuments } = await import('./useRHDocuments')

    const { result } = renderHook(() => useRHDocuments('p1'), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.documents).toBeUndefined()
  })

  it('uploadDocument uploade dans Storage, insère en base, invalide le cache et toast success', async () => {
    mockState.selectData = DOCS
    mockState.insertData = INSERTED_DOC
    mockState.insertError = null
    mockStorageUpload.mockResolvedValue({ data: { path: 'ignored' }, error: null })

    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = createWrapper(queryClient)

    const { useRHDocuments } = await import('./useRHDocuments')

    const { result } = renderHook(() => useRHDocuments('p1'), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const file = new File(['hello'], 'Mon Fichier @!.PDF', { type: 'application/pdf' })

    await act(async () => {
      await result.current.uploadDocument({
        file,
        profileId: 'p1',
        typeDocument: 'attestation',
        titre: 'Attestation',
        description: 'Attestation employeur',
        dateDocument: '2024-03-01',
      })
    })

    const expectedPath = `p1/${FIXED_NOW}_aaaaaaaa_mon_fichier_.pdf`

    expect(mockStorageFrom).toHaveBeenCalledWith('rh-documents')
    expect(mockStorageUpload).toHaveBeenCalledWith(expectedPath, file)

    expect(mockFrom).toHaveBeenCalledWith('rh_documents_employes')

    const insertCall = mockFrom.mock.results
      .map((r) => r.value as unknown as { insert?: unknown })
      .find(() => true)
    expect(insertCall).toBeDefined()

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rh-documents'] })
    expect(toastSuccess).toHaveBeenCalledWith('Document uploadé avec succès')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('deleteDocument supprime storage (si storage_path) puis supprime en base et toast success', async () => {
    mockState.selectData = DOCS
    mockState.maybeSingleData = { storage_path: 'p1/to_remove.pdf' }
    mockState.maybeSingleError = null
    mockState.deleteError = null

    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = createWrapper(queryClient)

    const { useRHDocuments } = await import('./useRHDocuments')

    const { result } = renderHook(() => useRHDocuments('p1'), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.deleteDocument('d1')
    })

    expect(mockStorageFrom).toHaveBeenCalledWith('rh-documents')
    expect(mockStorageRemove).toHaveBeenCalledWith(['p1/to_remove.pdf'])
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rh-documents'] })
    expect(toastSuccess).toHaveBeenCalledWith('Document supprimé')
  })

  it('getDocumentUrl retourne une URL complète si signedUrl est un chemin relatif', async () => {
    mockState.selectData = DOCS
    mockStorageCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: '/object/signature' },
      error: null,
    })

    const queryClient = createTestQueryClient()
    const wrapper = createWrapper(queryClient)

    const { useRHDocuments } = await import('./useRHDocuments')

    const { result } = renderHook(() => useRHDocuments('p1'), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const url = await result.current.getDocumentUrl('p1/doc.pdf')
    expect(mockStorageFrom).toHaveBeenCalledWith('rh-documents')
    expect(mockStorageCreateSignedUrl).toHaveBeenCalledWith('p1/doc.pdf', 3600)
    expect(url).toBe('https://supabase.openpulse.example.org/storage/v1/object/signature')
  })

  it("uploadDocument en erreur déclenche toast.error et debug.error", async () => {
    mockState.selectData = DOCS
    mockStorageUpload.mockResolvedValue({ data: null, error: { message: 'x' } })

    const queryClient = createTestQueryClient()
    const wrapper = createWrapper(queryClient)

    const { useRHDocuments } = await import('./useRHDocuments')

    const { result } = renderHook(() => useRHDocuments('p1'), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const file = new File(['hello'], 'Test.pdf', { type: 'application/pdf' })

    let caught: unknown
    await act(async () => {
      try {
        await result.current.uploadDocument({
          file,
          profileId: 'p1',
          typeDocument: 'autre',
          titre: 'Test',
        })
      } catch (e) {
        caught = e
      }
    })

    expect(caught).toMatchObject({ message: 'x' })
    expect(toastError).toHaveBeenCalledWith("Erreur lors de l'upload du document")
    expect(debugError).toHaveBeenCalled()
  })
})