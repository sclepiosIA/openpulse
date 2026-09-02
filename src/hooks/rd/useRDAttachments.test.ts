import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  ROWS,
  INSERTED_ROW,
  LAST_INSERT,
  UPLOAD_CALLS,
  STORAGE_REMOVE_CALLS,
  SIGNED_URL,
  mockFrom,
  mockStorageFrom,
  mockDebugError,
  mockToastSuccess,
  mockToastError,
  mockUseAuthReturn,
} = vi.hoisted(() => {
  const ROWS = [
    {
      id: '1',
      entity_type: 'task',
      entity_id: 'e1',
      nom: 'file1.txt',
      taille: 123,
      type_mime: 'text/plain',
      storage_path: 'task/e1/file1.txt',
      uploaded_by: 'u1',
      created_at: '2020-01-01T00:00:00Z',
    },
    {
      id: '2',
      entity_type: 'task',
      entity_id: 'e1',
      nom: 'file2.png',
      taille: 456,
      type_mime: 'image/png',
      storage_path: 'task/e1/file2.png',
      uploaded_by: 'u2',
      created_at: '2020-01-02T00:00:00Z',
    },
  ]

  const INSERTED_ROW = {
    id: 'new',
    entity_type: 'task',
    entity_id: 'e1',
    nom: 'upload.txt',
    taille: 7,
    type_mime: 'text/plain',
    storage_path: 'task/e1/generated-upload-path.txt',
    uploaded_by: 'u1',
    created_at: '2025-01-01T00:00:00Z',
  }

  const LAST_INSERT = { value: null as any }
  const UPLOAD_CALLS: Array<any> = []
  const STORAGE_REMOVE_CALLS: Array<any> = []
  const SIGNED_URL = 'https://signed.example/abc123'
  const mockDebugError = vi.fn()
  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()
  const mockUseAuthReturn = { user: { id: 'u1' }, session: { user: { id: 'u1' } }, isLoading: false }

  const mockStorageFrom = vi.fn((bucket: string) => {
    return {
      upload: vi.fn(async (path: string, file: File) => {
        UPLOAD_CALLS.push({ bucket, path, file })
        return { error: null }
      }),
      remove: vi.fn(async (paths: string[]) => {
        STORAGE_REMOVE_CALLS.push({ bucket, paths })
        return { error: { message: 'delErr' } }
      }),
      createSignedUrl: vi.fn(async (path: string, _expiry: number) => {
        if (path === 'bad') return { data: null, error: { message: 'signed-bad' } }
        return { data: { signedUrl: SIGNED_URL }, error: null }
      }),
    }
  })

  const mockFrom = vi.fn((table: string) => {
    return (() => {
      const context: {
        table: string
        filters: Record<string, any>
        action?: 'select' | 'insert' | 'delete' | 'other'
        insertData?: any
      } = { table, filters: {} }

      const builder: any = {
        select: (..._args: any[]) => {
          context.action = 'select'
          return builder
        },
        eq: (col: string, val: any) => {
          context.filters[col] = val
          return builder
        },
        order: (..._args: any[]) => {
          return builder
        },
        insert: (data: any) => {
          context.action = 'insert'
          context.insertData = data
          LAST_INSERT.value = data
          return builder
        },
        delete: () => {
          context.action = 'delete'
          return builder
        },
        single: () => {
          return builder
        },
        maybeSingle: () => {
          return builder
        },
        then: (onFulfilled: any, onRejected: any) => {
          const p = (async () => {
            if (context.action === 'select') {
              if (context.filters['entity_id'] === 'bad') {
                return { data: null, error: { message: 'boom' } }
              }
              const data = ROWS.filter(
                (r) =>
                  (context.filters['entity_type'] ? r.entity_type === context.filters['entity_type'] : true) &&
                  (context.filters['entity_id'] ? r.entity_id === context.filters['entity_id'] : true)
              )
              return { data, error: null }
            }

            if (context.action === 'insert') {
              return { data: INSERTED_ROW, error: null }
            }

            if (context.action === 'delete') {
              return { data: null, error: null }
            }

            return { data: null, error: null }
          })()
          return p.then(onFulfilled, onRejected)
        },
        catch: (onRejected: any) => {
          return Promise.resolve().catch(onRejected)
        },
      }
      return builder
    })()
  })

  return {
    ROWS,
    INSERTED_ROW,
    LAST_INSERT,
    UPLOAD_CALLS,
    STORAGE_REMOVE_CALLS,
    SIGNED_URL,
    mockFrom,
    mockStorageFrom,
    mockDebugError,
    mockToastSuccess,
    mockToastError,
    mockUseAuthReturn,
  }
})

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
      storage: {
        from: mockStorageFrom,
      },
    },
  }
})

vi.mock('sonner', () => {
  return {
    toast: {
      success: mockToastSuccess,
      error: mockToastError,
    },
  }
})

vi.mock('@/lib/debug', () => {
  return {
    debug: {
      error: mockDebugError,
    },
  }
})

vi.mock('@/components/AuthProvider', () => {
  return {
    useAuth: () => mockUseAuthReturn,
  }
})

import {
  useRDAttachments,
  useUploadRDAttachment,
  useDeleteRDAttachment,
  useGetAttachmentUrl,
} from './useRDAttachments'

describe('useRDAttachments module', () => {
  const createClient = () =>
    new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })

  beforeEach(() => {
    vi.clearAllMocks()
    LAST_INSERT.value = null
    UPLOAD_CALLS.length = 0
    STORAGE_REMOVE_CALLS.length = 0
  })

  it('loads attachments successfully when entityId provided', async () => {
    const queryClient = createClient()
    const wrapper = ({ children }: { children: any }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useRDAttachments('task', 'e1'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(Array.isArray(result.current.data)).toBe(true)
    expect(result.current.data.length).toBe(2)
    expect(result.current.data[0].entity_type).toBe('task')
    expect(result.current.data[0].entity_id).toBe('e1')

    expect(mockFrom).toHaveBeenCalled()
    const firstCallArg = mockFrom.mock.calls[0][0]
    expect(firstCallArg).toBe('rd_attachments')
  })

  it('reports error state when DB returns an error', async () => {
    const queryClient = createClient()
    const wrapper = ({ children }: { children: any }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useRDAttachments('task', 'bad'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
    expect((result.current.error as any).message).toBe('boom')
  })

  it('uploads a file: calls storage.upload and inserts DB record, invalidates query and shows toast', async () => {
    const queryClient = createClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: any }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useUploadRDAttachment(), { wrapper })

    const file = new File(['hello'], 'upload.txt', { type: 'text/plain' })
    const variables = { entityType: 'task', entityId: 'e1', file }

    await act(async () => {
      await result.current.mutateAsync(variables)
    })

    expect(UPLOAD_CALLS.length).toBe(1)
    const uploadCall = UPLOAD_CALLS[0]
    expect(uploadCall.bucket).toBe('rd-attachments')
    expect(uploadCall.path).toEqual(expect.stringContaining(`${variables.entityType}/${variables.entityId}/`))
    expect(uploadCall.file).toBe(file)

    expect(LAST_INSERT.value).not.toBeNull()
    expect(LAST_INSERT.value.entity_type).toBe(variables.entityType)
    expect(LAST_INSERT.value.entity_id).toBe(variables.entityId)
    expect(LAST_INSERT.value.nom).toBe(file.name)
    expect(LAST_INSERT.value.taille).toBe(file.size)
    expect(LAST_INSERT.value.type_mime).toBe(file.type)
    expect(LAST_INSERT.value.uploaded_by).toBe('u1')

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['rd-attachments', variables.entityType, variables.entityId],
    })

    expect(mockToastSuccess).toHaveBeenCalledWith('Fichier ajouté')
  })

  it('deletes an attachment: attempts storage removal, deletes DB record, invalidates and shows toast', async () => {
    const queryClient = createClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: any }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useDeleteRDAttachment(), { wrapper })

    const attachment = {
      id: '1',
      entity_type: 'task',
      entity_id: 'e1',
      nom: 'file1.txt',
      taille: 123,
      type_mime: 'text/plain',
      storage_path: 'task/e1/file1.txt',
      uploaded_by: 'u1',
      created_at: '2020-01-01T00:00:00Z',
    }

    await act(async () => {
      await result.current.mutateAsync(attachment)
    })

    expect(STORAGE_REMOVE_CALLS.length).toBe(1)
    const removeCall = STORAGE_REMOVE_CALLS[0]
    expect(removeCall.bucket).toBe('rd-attachments')
    expect(removeCall.paths).toEqual([attachment.storage_path])

    expect(mockDebugError).toHaveBeenCalled()
    expect(mockDebugError.mock.calls[0][0]).toBe('Storage deletion error:')

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['rd-attachments', attachment.entity_type, attachment.entity_id],
    })

    expect(mockToastSuccess).toHaveBeenCalledWith('Fichier supprimé')
  })

  it('getAttachmentUrl returns signed URL on success and null on error (and logs debug)', async () => {
    const getUrl = useGetAttachmentUrl()

    const signed = await getUrl('some/path')
    expect(signed).toBe(SIGNED_URL)

    const signedBad = await getUrl('bad')
    expect(signedBad).toBeNull()
    expect(mockDebugError).toHaveBeenCalledWith('Error getting signed URL:', { message: 'signed-bad' })
  })
})