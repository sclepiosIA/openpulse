// @vitest-environment jsdom

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  useSignatureRequest,
  useSendSignature,
  useRemindSignature,
  useCancelSignature,
} from './useSignatureRequest'

const {
  SIGNATURE_REQUEST,
  SEND_RESULT,
  REMIND_RESULT,
  CANCEL_RESULT,
  TOAST_API,
  sanitizeSpy,
  mockFrom,
  mockInvoke,
  mockChannel,
  mockOn,
  mockSubscribe,
  mockRemoveChannel,
} = vi.hoisted(() => {
  const SIGNATURE_REQUEST = {
    id: 'sr-1',
    contrat_id: 'c-1',
    status: 'sent',
    created_at: '2024-01-01T10:00:00.000Z',
  }

  const SEND_RESULT = { ok: true, requestId: 'sr-1' }
  const REMIND_RESULT = { ok: true }
  const CANCEL_RESULT = { ok: true }

  const toast = vi.fn()
  const TOAST_API = { toast }

  const sanitizeSpy = vi.fn((e: Error | { message?: string }) => e.message ?? 'sanitized')

  const mockOn = vi.fn()
  const mockSubscribe = vi.fn()
  const mockRemoveChannel = vi.fn()

  const mockChannel = vi.fn(() => {
    const channel = {
      on: mockOn,
      subscribe: mockSubscribe,
    }
    mockOn.mockReturnValue(channel)
    mockSubscribe.mockReturnValue(channel)
    return channel
  })

  const mockFrom = vi.fn()
  const mockInvoke = vi.fn()

  return {
    SIGNATURE_REQUEST,
    SEND_RESULT,
    REMIND_RESULT,
    CANCEL_RESULT,
    TOAST_API,
    sanitizeSpy,
    mockFrom,
    mockInvoke,
    mockChannel,
    mockOn,
    mockSubscribe,
    mockRemoveChannel,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => TOAST_API,
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSpy,
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper(client: QueryClient) {
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, props.children)
  }
}

function createSupabaseBuilder(response: { data: unknown; error: { message: string } | null }) {
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
    single: vi.fn(() => Promise.resolve(response)),
    maybeSingle: vi.fn(() => Promise.resolve(response)),
    then: (
      onFulfilled?: (value: { data: unknown; error: { message: string } | null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(response).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(response).catch(onRejected),
  }

  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useSignatureRequest', () => {
  it('ne lance pas la query si contratId est undefined', async () => {
    const client = createQueryClient()
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useSignatureRequest(undefined), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.status).toBe('pending')
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockChannel).not.toHaveBeenCalled()
  })

  it('charge puis retourne la demande de signature et souscrit au realtime', async () => {
    const builder = createSupabaseBuilder({ data: SIGNATURE_REQUEST, error: null })
    mockFrom.mockReturnValue(builder)

    const client = createQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const wrapper = createWrapper(client)

    const { result, unmount } = renderHook(() => useSignatureRequest('c-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('signature_requests')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.eq).toHaveBeenCalledWith('contrat_id', 'c-1')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(1)
    expect(builder.maybeSingle).toHaveBeenCalled()
    expect(result.current.data).toEqual(SIGNATURE_REQUEST)

    expect(mockChannel).toHaveBeenCalledWith('signature_request_c-1')
    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'signature_requests',
        filter: 'contrat_id=eq.c-1',
      },
      expect.any(Function)
    )
    expect(mockSubscribe).toHaveBeenCalled()

    const realtimeCallback = mockOn.mock.calls[0][2] as () => void
    realtimeCallback()

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['signature-request', 'c-1'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contrat', 'c-1'] })

    unmount()

    const subscribedChannel = mockSubscribe.mock.results[0]?.value
    expect(mockRemoveChannel).toHaveBeenCalledWith(subscribedChannel)
  })

  it('passe en erreur si supabase retourne une erreur', async () => {
    const builder = createSupabaseBuilder({
      data: null,
      error: { message: 'x' },
    })
    mockFrom.mockReturnValue(builder)

    const client = createQueryClient()
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useSignatureRequest('c-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toMatchObject({ message: 'x' })
    expect(result.current.data).toBeUndefined()
  })
})

describe('useSendSignature', () => {
  it('appelle la fonction edge, invalide les queries et affiche un toast de succès', async () => {
    mockInvoke.mockResolvedValue({ data: SEND_RESULT, error: null })

    const client = createQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useSendSignature(), { wrapper })

    const params = {
      contratId: 'c-1',
      signers: [{ name: 'Alice', email: 'alice@example.com', role: 'client' }],
      message: 'Merci de signer',
      expireDays: 7,
    }

    await act(async () => {
      await result.current.mutateAsync(params)
    })

    expect(mockInvoke).toHaveBeenCalledWith('signature-send', {
      body: params,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['signature-request', 'c-1'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contrat', 'c-1'] })
    expect(TOAST_API.toast).toHaveBeenCalledWith({ title: 'Demande de signature envoyée' })
  })

  it('affiche un toast d’erreur si l’envoi échoue', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'x' } })

    const client = createQueryClient()
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useSendSignature(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          contratId: 'c-1',
          signers: [{ name: 'Bob', email: 'bob@example.com' }],
        })
      ).rejects.toMatchObject({ message: 'x' })
    })

    expect(sanitizeSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'x' }))
    expect(TOAST_API.toast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'x',
      variant: 'destructive',
    })
  })
})

describe('useRemindSignature', () => {
  it('appelle la relance, invalide la query et affiche un toast de succès', async () => {
    mockInvoke.mockResolvedValue({ data: REMIND_RESULT, error: null })

    const client = createQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useRemindSignature(), { wrapper })

    const params = { requestId: 'sr-1', signerEmail: 'alice@example.com' }

    await act(async () => {
      await result.current.mutateAsync(params)
    })

    expect(mockInvoke).toHaveBeenCalledWith('signature-remind', { body: params })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['signature-request'] })
    expect(TOAST_API.toast).toHaveBeenCalledWith({ title: 'Relance envoyée' })
  })

  it('affiche un toast d’erreur si la relance échoue', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'x' } })

    const client = createQueryClient()
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useRemindSignature(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync({ requestId: 'sr-1' })).rejects.toMatchObject({
        message: 'x',
      })
    })

    expect(sanitizeSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'x' }))
    expect(TOAST_API.toast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'x',
      variant: 'destructive',
    })
  })
})

describe('useCancelSignature', () => {
  it('appelle l’annulation, invalide la query et affiche un toast de succès', async () => {
    mockInvoke.mockResolvedValue({ data: CANCEL_RESULT, error: null })

    const client = createQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useCancelSignature(), { wrapper })

    const params = { requestId: 'sr-1', reason: 'changement' }

    await act(async () => {
      await result.current.mutateAsync(params)
    })

    expect(mockInvoke).toHaveBeenCalledWith('signature-cancel', { body: params })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['signature-request'] })
    expect(TOAST_API.toast).toHaveBeenCalledWith({ title: 'Demande annulée' })
  })

  it('affiche un toast d’erreur si l’annulation échoue', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'x' } })

    const client = createQueryClient()
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useCancelSignature(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync({ requestId: 'sr-1' })).rejects.toMatchObject({
        message: 'x',
      })
    })

    expect(sanitizeSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'x' }))
    expect(TOAST_API.toast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'x',
      variant: 'destructive',
    })
  })
})
