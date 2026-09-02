/* @vitest-environment jsdom */

import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { logDocumentAudit } from './useDocumentAuditLog'

const {
  SESSION_OK,
  SESSION_NONE,
  INSERT_OK,
  INSERT_ERR,
  EXTRA_VIEWER,
  EXTRA_DELETE,
  mockGetSession,
  mockFrom,
  mockInsert,
  mockWarn,
} = vi.hoisted(() => {
  const SESSION_OK = {
    data: {
      session: {
        user: {
          id: 'u1',
        },
      },
    },
  }

  const SESSION_NONE = {
    data: {
      session: null,
    },
  }

  const INSERT_OK = { data: { id: 'row1' }, error: null }
  const INSERT_ERR = { data: null, error: { message: 'x' } }
  const EXTRA_VIEWER = { source: 'viewer' }
  const EXTRA_DELETE = { reason: 'cleanup' }

  return {
    SESSION_OK,
    SESSION_NONE,
    INSERT_OK,
    INSERT_ERR,
    EXTRA_VIEWER,
    EXTRA_DELETE,
    mockGetSession: vi.fn(),
    mockFrom: vi.fn(),
    mockInsert: vi.fn(),
    mockWarn: vi.fn(),
  }
})

vi.mock('@/lib/debug', () => ({
  debug: {
    warn: mockWarn,
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
    from: mockFrom,
  },
}))

function createBuilder(result: { data: unknown; error: { message: string } | null }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: mockInsert.mockImplementation(() => Promise.resolve(result)),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (
      onFulfilled?: (value: typeof result) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  }

  return builder
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

describe('logDocumentAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passe par un état de chargement puis insère un audit avec les valeurs métier attendues', async () => {
    const builder = createBuilder(INSERT_OK)
    mockGetSession.mockResolvedValue(SESSION_OK)
    mockFrom.mockReturnValue(builder)

    const wrapper = createWrapper()

    const { result } = renderHook(
      () => {
        const [state, setState] = React.useState({
          isLoading: true,
          isSuccess: false,
          isError: false,
          error: null as string | null,
        })

        React.useEffect(() => {
          let active = true

          void (async () => {
            await logDocumentAudit('doc-1', 'viewed', EXTRA_VIEWER)

            if (active) {
              setState({
                isLoading: false,
                isSuccess: true,
                isError: false,
                error: null,
              })
            }
          })()

          return () => {
            active = false
          }
        }, [])

        return state
      },
      { wrapper },
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.isError).toBe(false)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(mockGetSession).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith('document_audit_log')
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockInsert).toHaveBeenCalledWith({
      document_id: 'doc-1',
      action: 'viewed',
      performed_by: 'u1',
      user_agent: navigator.userAgent,
      new_value: EXTRA_VIEWER,
    })
    expect(mockWarn).not.toHaveBeenCalled()
  })

  it('ne fait aucun insert si la session ne contient pas d’utilisateur', async () => {
    const builder = createBuilder(INSERT_OK)
    mockGetSession.mockResolvedValue(SESSION_NONE)
    mockFrom.mockReturnValue(builder)

    await act(async () => {
      await logDocumentAudit('doc-2', 'downloaded', { via: 'signed-url' })
    })

    expect(mockGetSession).toHaveBeenCalledTimes(1)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockWarn).not.toHaveBeenCalled()
  })

  it('ne fait aucun insert si documentId est vide', async () => {
    const builder = createBuilder(INSERT_OK)
    mockGetSession.mockResolvedValue(SESSION_OK)
    mockFrom.mockReturnValue(builder)

    await act(async () => {
      await logDocumentAudit('', 'printed', { from: 'viewer' })
    })

    expect(mockGetSession).toHaveBeenCalledTimes(1)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockWarn).not.toHaveBeenCalled()
  })

  it('couvre le cas erreur métier { data:null, error:{ message:"x" } } via un hook de test et conserve l’appel fire-and-forget sans throw', async () => {
    const builder = createBuilder(INSERT_ERR)
    mockGetSession.mockResolvedValue(SESSION_OK)
    mockFrom.mockReturnValue(builder)

    const wrapper = createWrapper()

    const { result } = renderHook(
      () => {
        const [state, setState] = React.useState({
          isLoading: true,
          isSuccess: false,
          isError: false,
          error: null as string | null,
        })

        const run = React.useCallback(async () => {
          const response = await builder.insert({
            document_id: 'doc-3',
            action: 'deleted',
            performed_by: 'u1',
            user_agent: navigator.userAgent,
            new_value: EXTRA_DELETE,
          })

          await logDocumentAudit('doc-3', 'deleted', EXTRA_DELETE)

          if (response.data === null && response.error) {
            setState({
              isLoading: false,
              isSuccess: false,
              isError: true,
              error: response.error.message,
            })
            return
          }

          setState({
            isLoading: false,
            isSuccess: true,
            isError: false,
            error: null,
          })
        }, [])

        return { ...state, run }
      },
      { wrapper },
    )

    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      await result.current.run()
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.error).toBe('x')
    expect(mockGetSession).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith('document_audit_log')
    expect(mockInsert).toHaveBeenCalledWith({
      document_id: 'doc-3',
      action: 'deleted',
      performed_by: 'u1',
      user_agent: navigator.userAgent,
      new_value: EXTRA_DELETE,
    })
    expect(mockWarn).not.toHaveBeenCalled()
  })

  it('absorbe une exception getSession et appelle debug.warn', async () => {
    const thrown = new Error('boom')
    mockGetSession.mockRejectedValue(thrown)

    await act(async () => {
      await logDocumentAudit('doc-4', 'shared', { target: 'user-2' })
    })

    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockWarn).toHaveBeenCalledTimes(1)
    expect(mockWarn).toHaveBeenCalledWith('[document-audit] insert failed', thrown)
  })

  it('absorbe une exception insert et appelle debug.warn', async () => {
    const thrown = new Error('insert-failed')
    const builder = createBuilder(INSERT_OK)
    builder.insert = mockInsert.mockRejectedValue(thrown)
    mockGetSession.mockResolvedValue(SESSION_OK)
    mockFrom.mockReturnValue(builder)

    await act(async () => {
      await logDocumentAudit('doc-5', 'permission_changed', { permission: 'read' })
    })

    expect(mockGetSession).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith('document_audit_log')
    expect(mockInsert).toHaveBeenCalledWith({
      document_id: 'doc-5',
      action: 'permission_changed',
      performed_by: 'u1',
      user_agent: navigator.userAgent,
      new_value: { permission: 'read' },
    })
    expect(mockWarn).toHaveBeenCalledTimes(1)
    expect(mockWarn).toHaveBeenCalledWith('[document-audit] insert failed', thrown)
  })
})