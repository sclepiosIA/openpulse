/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useNotificationTest } from './useNotificationTest'

const {
  USER,
  INSERTED_NOTIFICATION,
  SUCCESS_RESULT,
  ERROR_RESULT,
  mockFrom,
  mockUseAuth,
  toastSuccess,
  toastError,
  debugError,
} = vi.hoisted(() => {
  const USER = { id: 'user-1' }

  const INSERTED_NOTIFICATION = {
    id: 'notif-1',
    user_id: 'user-1',
    title: '🔔 Notification de test',
    message: 'created message',
    type: 'other',
    is_read: false,
  }

  const SUCCESS_RESULT = {
    data: INSERTED_NOTIFICATION,
    error: null,
  }

  const ERROR_RESULT = {
    data: null,
    error: { message: 'x' },
  }

  return {
    USER,
    INSERTED_NOTIFICATION,
    SUCCESS_RESULT,
    ERROR_RESULT,
    mockFrom: vi.fn(),
    mockUseAuth: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    debugError: vi.fn(),
  }
})

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: mockUseAuth,
}))

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

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

type SupabaseError = { message: string }
type SupabaseResult<T> = {
  data: T | null
  error: SupabaseError | null
}

type Builder<T> = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: Promise<SupabaseResult<T>>['then']
  catch: Promise<SupabaseResult<T>>['catch']
}

function createBuilder<T>(result: SupabaseResult<T>): Builder<T> {
  const builder = {} as Builder<T>

  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.update = vi.fn(() => builder)
  builder.delete = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  builder.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected)
  builder.catch = (onRejected) => Promise.resolve(result).catch(onRejected)

  return builder
}

function createDelayedBuilder<T>() {
  let resolveRequest: ((value: SupabaseResult<T>) => void) | undefined

  const promise = new Promise<SupabaseResult<T>>((resolve) => {
    resolveRequest = resolve
  })

  const builder = {} as Builder<T>

  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.update = vi.fn(() => builder)
  builder.delete = vi.fn(() => builder)
  builder.single = vi.fn(() => promise)
  builder.maybeSingle = vi.fn(() => promise)
  builder.then = (onFulfilled, onRejected) => promise.then(onFulfilled, onRejected)
  builder.catch = (onRejected) => promise.catch(onRejected)

  return { builder, promise, resolveRequest: () => resolveRequest }
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  })

  const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

  const wrapper = ({ children }: React.PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { wrapper, queryClient, invalidateQueriesSpy }
}

describe('useNotificationTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: USER })
  })

  it('expose isCreating à false au départ puis crée une notification avec les bonnes données et invalide la bonne query', async () => {
    const builder = createBuilder(SUCCESS_RESULT)
    mockFrom.mockReturnValue(builder)

    const { wrapper, invalidateQueriesSpy } = createWrapper()
    const { result } = renderHook(() => useNotificationTest(), { wrapper })

    expect(result.current.isCreating).toBe(false)

    await act(async () => {
      result.current.createTestNotification()
    })

    await waitFor(() => {
      expect(builder.insert).toHaveBeenCalledTimes(1)
    })

    expect(mockFrom).toHaveBeenCalledWith('in_app_notifications')
    expect(builder.select).toHaveBeenCalledTimes(1)
    expect(builder.single).toHaveBeenCalledTimes(1)

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER.id,
        title: '🔔 Notification de test',
        type: 'other',
        is_read: false,
      })
    )

    const insertArg = builder.insert.mock.calls[0]?.[0] as Record<string, unknown>
    expect(typeof insertArg.message).toBe('string')
    expect(String(insertArg.message)).toContain('Test créé le ')
    expect(String(insertArg.message)).toContain(
      'Cette notification confirme que le système fonctionne correctement.'
    )

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Notification de test créée !')
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['in-app-notifications', USER.id],
    })
    expect(toastError).not.toHaveBeenCalled()
    expect(debugError).not.toHaveBeenCalled()
  })

  it('passe par un état de chargement pendant la mutation', async () => {
    const { builder, promise, resolveRequest } =
      createDelayedBuilder<typeof INSERTED_NOTIFICATION>()
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useNotificationTest(), { wrapper })

    act(() => {
      result.current.createTestNotification()
    })

    await waitFor(() => {
      expect(result.current.isCreating).toBe(true)
    })

    await act(async () => {
      const resolve = resolveRequest()
      if (resolve) {
        resolve(SUCCESS_RESULT)
      }
      await promise
    })

    await waitFor(() => {
      expect(result.current.isCreating).toBe(false)
    })
  })

  it('gère une erreur supabase via onError et ne déclenche pas le succès', async () => {
    const builder = createBuilder(ERROR_RESULT)
    mockFrom.mockReturnValue(builder)

    const { wrapper, invalidateQueriesSpy } = createWrapper()
    const { result } = renderHook(() => useNotificationTest(), { wrapper })

    await act(async () => {
      result.current.createTestNotification()
    })

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Erreur lors de la création de la notification')
    })

    expect(debugError).toHaveBeenCalledTimes(1)
    expect(debugError).toHaveBeenCalledWith('Error creating test notification:', ERROR_RESULT.error)
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(invalidateQueriesSpy).not.toHaveBeenCalled()
  })

  it('gère le cas utilisateur non authentifié sans appeler supabase', async () => {
    mockUseAuth.mockReturnValue({ user: null })

    const builder = createBuilder(SUCCESS_RESULT)
    mockFrom.mockReturnValue(builder)

    const { wrapper, invalidateQueriesSpy } = createWrapper()
    const { result } = renderHook(() => useNotificationTest(), { wrapper })

    await act(async () => {
      result.current.createTestNotification()
    })

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Erreur lors de la création de la notification')
    })

    expect(mockFrom).not.toHaveBeenCalled()
    expect(debugError).toHaveBeenCalledTimes(1)

    const debugArgs = debugError.mock.calls[0]
    expect(debugArgs?.[0]).toBe('Error creating test notification:')
    expect(debugArgs?.[1]).toBeInstanceOf(Error)
    expect((debugArgs?.[1] as Error).message).toBe('User not authenticated')

    expect(invalidateQueriesSpy).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
  })
})
