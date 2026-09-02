import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  USER,
  BASE64_DATA,
  DOCUMENT,
  invokes,
  mockFrom,
  storageCreateSignedUrlMock,
  insertSpies,
  toastFns,
  debugError,
  randomUUIDMock,
  fileReaderResult,
  createObjectUrlMock,
  revokeObjectUrlMock,
} = vi.hoisted(() => {
  const USER = { id: 'user-1', email: 'test@example.com' }
  const BASE64_DATA = 'QmFzZTY0VGVzdERhdGE' // "Base64TestData"
  const DOCUMENT = {
    id: 'doc-1',
    name: 'test.pdf',
    file_size_bytes: 1234,
    mime_type: 'application/pdf',
    storage_path: '/2026-06/doc-1.pdf',
    storage_bucket: 'nextcloud',
    created_by: USER.id,
  }

  const insertSpies: Record<string, ReturnType<typeof vi.fn>> = {
    documents: vi.fn(),
    document_relations: vi.fn(),
    document_audit_log: vi.fn(),
  }

  const mockFrom = vi.fn((table: string) => {
    const builder: any = {
      _table: table,
      _lastInsert: null,
      insert(payload: unknown) {
        insertSpies[table]?.(payload)
        builder._lastInsert = payload
        return builder
      },
      select() {
        return builder
      },
      single() {
        if (table === 'documents') {
          return Promise.resolve({ data: DOCUMENT, error: null })
        }
        return Promise.resolve({ data: { success: true }, error: null })
      },
      then(onFulfilled: any, onRejected: any) {
        return Promise.resolve({ data: DOCUMENT, error: null }).then(onFulfilled, onRejected)
      },
      catch(onRejected: any) {
        return Promise.resolve({ data: DOCUMENT, error: null }).catch(onRejected)
      },
    }
    return builder
  })

  const invokes = vi.fn(async (name: string, opts: any) => {
    if (name === 'nextcloud-files') {
      const action = opts?.body?.action
      if (action === 'upload') {
        return { data: { ok: true }, error: null }
      }
      if (action === 'download') {
        return {
          data: { content: BASE64_DATA, mimeType: 'text/plain' },
          error: null,
        }
      }
      if (action === 'delete') {
        return { data: { deleted: true }, error: null }
      }
      return { data: null, error: null }
    }
    return { data: null, error: null }
  })

  const storageCreateSignedUrlMock = vi.fn(async (path: string, expires: number) => {
    return { data: { signedUrl: `https://signed.example.com/${path}` }, error: null }
  })

  const toastFns = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }

  const debugError = vi.fn()

  const randomUUIDMock = vi.fn(() => 'uuid-1234')

  const fileReaderResult = 'data:application/pdf;base64,' + BASE64_DATA

  const createObjectUrlMock = vi.fn((blob: Blob) => 'blob:http://localhost/fake-url')
  const revokeObjectUrlMock = vi.fn()

  return {
    USER,
    BASE64_DATA,
    DOCUMENT,
    invokes,
    mockFrom,
    storageCreateSignedUrlMock,
    insertSpies,
    toastFns,
    debugError,
    randomUUIDMock,
    fileReaderResult,
    createObjectUrlMock,
    revokeObjectUrlMock,
  }
})

// Mock supabase client and related storage/functions
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
      functions: {
        invoke: invokes,
      },
      storage: {
        from: (bucket: string) => ({
          createSignedUrl: (path: string, expires: number) =>
            storageCreateSignedUrlMock(path, expires),
        }),
      },
    },
  }
})

// Mock auth to return a stable authenticated user
vi.mock('@/components/AuthProvider', () => {
  return {
    useAuth: () => ({ user: USER, session: { user: USER }, isLoading: false }),
  }
})

// Mock sonner to capture toasts
vi.mock('sonner', () => {
  return { toast: toastFns }
})

// Mock debug logger
vi.mock('@/lib/debug', () => {
  return { debug: { error: debugError } }
})

// Stub global crypto.randomUUID
vi.stubGlobal('crypto', {
  ...(globalThis.crypto as unknown as object),
  randomUUID: randomUUIDMock,
})

// Mock FileReader globally
class FileReaderMock {
  onload: (() => void) | null = null
  onerror: ((e: any) => void) | null = null
  result: string | null = null
  readAsDataURL(_: Blob) {
    this.result = fileReaderResult
    setTimeout(() => {
      if (this.onload) this.onload()
    }, 0)
  }
}
vi.stubGlobal('FileReader', FileReaderMock)

// Mock URL.createObjectURL & revokeObjectURL
vi.stubGlobal('URL', {
  ...(globalThis.URL as unknown as object),
  createObjectURL: createObjectUrlMock,
  revokeObjectURL: revokeObjectUrlMock,
})

import { useDocumentUpload, useDocumentDownload, useDocumentPreviewUrl } from './useDocumentUpload'

describe('useDocumentUpload / download / preview', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    invokes.mockImplementation(async (name: string, opts: any) => {
      if (name === 'nextcloud-files') {
        const action = opts?.body?.action
        if (action === 'upload') {
          return { data: { ok: true }, error: null }
        }
        if (action === 'download') {
          return { data: { content: BASE64_DATA, mimeType: 'text/plain' }, error: null }
        }
        if (action === 'delete') {
          return { data: { deleted: true }, error: null }
        }
        return { data: null, error: null }
      }
      return { data: null, error: null }
    })
    storageCreateSignedUrlMock.mockImplementation(async (path: string, expires: number) => {
      return { data: { signedUrl: `https://signed.example.com/${path}` }, error: null }
    })
  })

  it('isUploading becomes true during upload and false after, and upload succeeds', async () => {
    const { result } = renderHook(() => useDocumentUpload(), { wrapper })

    const file = new File(['hello'], 'test.pdf', { type: 'application/pdf' })

    let promise: Promise<any>
    act(() => {
      // start upload but do not await yet
      promise = result.current.uploadFile(file, { description: 't' }) as Promise<any>
    })

    // Immediately after starting, mutation should be pending
    expect(result.current.isUploading).toBe(true)

    // await completion
    await act(async () => {
      await promise
    })

    expect(result.current.isUploading).toBe(false)
    // Ensure returned document was inserted and matches mocked DOCUMENT
    expect(insertSpies.documents).toHaveBeenCalled()
    const docsPayload = insertSpies.documents.mock.calls[0][0] as Record<string, unknown>
    expect(docsPayload.name).toBe('test.pdf')
    expect(docsPayload.created_by).toBe(USER.id)
  })

  it('uploadFile handles Nextcloud error and marks upload as error in uploads list', async () => {
    // Make nextcloud upload fail
    invokes.mockImplementationOnce(async (name: string, opts: any) => {
      if (name === 'nextcloud-files' && opts?.body?.action === 'upload') {
        return { data: null, error: { message: 'Nextcloud failure' } }
      }
      return { data: null, error: null }
    })

    const { result } = renderHook(() => useDocumentUpload(), { wrapper })
    const file = new File(['bad'], 'bad.pdf', { type: 'application/pdf' })

    await act(async () => {
      try {
        await result.current.uploadFile(file, {})
      } catch (e) {
        // expected to throw
      }
    })

    // Upload state should reflect the error
    expect(result.current.uploads).toHaveLength(1)
    const uploadState = result.current.uploads[0]
    expect(uploadState.status).toBe('error')
    expect(typeof uploadState.error).toBe('string')
    expect(uploadState.error).toContain('Erreur upload Nextcloud')
  })

  it('uploads a file to Nextcloud and creates DB entries and relations', async () => {
    const { result } = renderHook(() => useDocumentUpload(), { wrapper })

    const file = new File(['hello'], 'test.pdf', { type: 'application/pdf' })

    const options = {
      description: 'desc',
      tags: ['t1'],
      relationType: 'attachment',
      relatedEtablissementId: 'eta-1',
    }

    let returned: any = null
    await act(async () => {
      returned = await result.current.uploadFile(file, options as any)
    })

    expect(returned).toEqual(DOCUMENT)

    // Assert supabase.from was used and payload contains expected fields
    expect(mockFrom).toHaveBeenCalled()
    expect(insertSpies.documents).toHaveBeenCalled()
    const docsPayload = insertSpies.documents.mock.calls[0][0] as Record<string, unknown>
    expect(docsPayload.name).toBe('test.pdf')
    expect(docsPayload.file_size_bytes).toBe(file.size)
    expect(docsPayload.mime_type).toBe('application/pdf')
    expect(docsPayload.storage_bucket).toBe('nextcloud')
    expect(docsPayload.created_by).toBe(USER.id)

    // relations created with provided relatedEtablissementId
    expect(insertSpies.document_relations).toHaveBeenCalled()
    const relPayload = insertSpies.document_relations.mock.calls[0][0] as Record<string, unknown>
    expect(relPayload.document_id).toBe(DOCUMENT.id)
    expect(relPayload.relation_type).toBe('attachment')
    expect(relPayload.related_etablissement_id).toBe('eta-1')
    expect(relPayload.created_by).toBe(USER.id)

    // audit log inserted
    expect(insertSpies.document_audit_log).toHaveBeenCalled()
    const auditPayload = insertSpies.document_audit_log.mock.calls[0][0] as Record<string, unknown>
    expect(auditPayload.document_id).toBe(DOCUMENT.id)
    expect(auditPayload.action).toBe('created')
    expect(auditPayload.performed_by).toBe(USER.id)
  })

  it('uploadFiles shows success toast when all uploads succeed', async () => {
    const { result } = renderHook(() => useDocumentUpload(), { wrapper })
    const file = new File(['a'], 'one.pdf', { type: 'application/pdf' })

    await act(async () => {
      const res = await result.current.uploadFiles([file], {})
      expect(res[0]).toEqual(DOCUMENT)
    })

    expect(toastFns.success).toHaveBeenCalledTimes(1)
    expect(toastFns.success).toHaveBeenCalledWith('1 document uploadé')
  })

  it('uploadFiles shows error toast when all uploads fail', async () => {
    invokes.mockImplementationOnce(async (name: string, opts: any) => {
      if (name === 'nextcloud-files' && opts?.body?.action === 'upload') {
        return { data: null, error: { message: 'Nextcloud failure' } }
      }
      return { data: null, error: null }
    })

    const { result } = renderHook(() => useDocumentUpload(), { wrapper })
    const file = new File(['b'], 'fail.pdf', { type: 'application/pdf' })

    await act(async () => {
      const res = await result.current.uploadFiles([file], {})
      expect(res).toHaveLength(0)
    })

    expect(toastFns.error).toHaveBeenCalledTimes(1)
    expect(toastFns.error).toHaveBeenCalledWith("Échec de l'upload de 1 fichier")
  })

  it('downloads a Nextcloud document and logs audit, returning a blob URL', async () => {
    const { result } = renderHook(() => useDocumentDownload(), { wrapper })

    const doc = {
      id: 'doc-1',
      storage_path: '/2026-06/doc-1.pdf',
      storage_bucket: 'nextcloud',
      name: 'doc.pdf',
    }

    let signedUrl: string | undefined
    await act(async () => {
      signedUrl = await result.current.mutateAsync(doc as any)
    })

    expect(invokes).toHaveBeenCalledWith(
      'nextcloud-files',
      expect.objectContaining({ body: expect.objectContaining({ action: 'download', path: doc.storage_path }) })
    )

    expect(signedUrl).toBe('blob:http://localhost/fake-url')

    expect(insertSpies.document_audit_log).toHaveBeenCalled()
    const auditArg = insertSpies.document_audit_log.mock.calls[0][0] as Record<string, unknown>
    expect(auditArg.document_id).toBe(doc.id)
    expect(auditArg.action).toBe('downloaded')
    expect(auditArg.performed_by).toBe(USER.id)
  })

  it('preview URL for Nextcloud returns a blob URL and sets url state', async () => {
    const document = { storage_path: '/2026-06/doc-1.pdf', storage_bucket: 'nextcloud' }
    const { result } = renderHook(() => useDocumentPreviewUrl(document), { wrapper })

    let gotUrl: string | null = null
    await act(async () => {
      gotUrl = await result.current.getUrl()
    })

    expect(gotUrl).toBe('blob:http://localhost/fake-url')
    expect(result.current.url).toBe('blob:http://localhost/fake-url')
    expect(invokes).toHaveBeenCalledWith(
      'nextcloud-files',
      expect.objectContaining({ body: expect.objectContaining({ action: 'download', path: document.storage_path }) })
    )
  })

  it('preview URL for Supabase storage returns signed URL', async () => {
    const document = { storage_path: 'folder/file.png', storage_bucket: 'public_bucket' }
    const { result } = renderHook(() => useDocumentPreviewUrl(document), { wrapper })

    storageCreateSignedUrlMock.mockImplementationOnce(async (path: string, expires: number) => {
      return { data: { signedUrl: 'https://signed.example.com/folder/file.png' }, error: null }
    })

    let gotUrl: string | null = null
    await act(async () => {
      gotUrl = await result.current.getUrl()
    })

    expect(gotUrl).toBe('https://signed.example.com/folder/file.png')
    expect(result.current.url).toBe('https://signed.example.com/folder/file.png')
    expect(storageCreateSignedUrlMock).toHaveBeenCalled()
  })
})