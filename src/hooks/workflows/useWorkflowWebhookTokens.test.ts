import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { webhookTokens, newWebhookToken, mockFrom, mockUseAuth, toastSuccess, toastError } =
  vi.hoisted(() => ({
    webhookTokens: [
      {
        id: 'tok-1',
        workflow_id: 'wf-1',
        webhook_hex: 'fake_hex_value_aaa',
        label: 'Integration CRM',
        is_active: true,
        created_by: 'user-1',
        created_at: '2024-01-10T00:00:00Z',
        last_used_at: '2024-01-14T10:00:00Z',
        total_calls: 42,
      },
      {
        id: 'tok-2',
        workflow_id: 'wf-1',
        webhook_hex: 'fake_hex_value_bbb',
        label: null,
        is_active: false,
        created_by: 'user-1',
        created_at: '2024-01-09T00:00:00Z',
        last_used_at: null,
        total_calls: 0,
      },
    ],
    newWebhookToken: {
      id: 'tok-new',
      workflow_id: 'wf-1',
      webhook_hex: 'fake_hex_value_new',
      label: 'Nouveau',
      is_active: true,
      created_by: 'user-1',
      created_at: '2024-01-16T00:00:00Z',
      last_used_at: null,
      total_calls: 0,
    },
    mockFrom: vi.fn(),
    mockUseAuth: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  }))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function createChainableBuilder(response: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
  }
  for (const k of ['select', 'order', 'eq', 'insert', 'update', 'delete']) {
    builder[k].mockReturnValue(builder)
  }
  builder.single.mockResolvedValue(response)
  ;(builder as unknown as { then: (cb: (v: unknown) => unknown) => Promise<unknown> }).then = (
    cb
  ) => Promise.resolve(response).then(cb)
  ;(builder as unknown as { catch: (cb: (e: unknown) => unknown) => Promise<unknown> }).catch = (
    cb
  ) => Promise.resolve(response).catch(cb)
  return builder
}

describe('useWorkflowWebhookTokens', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

  it('passe de isLoading à succès et retourne les entrées webhook', async () => {
    const { useWorkflowWebhookTokens } = await import('./useWorkflowWebhookTokens')
    const builder = createChainableBuilder({ data: webhookTokens, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflowWebhookTokens(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].label).toBe('Integration CRM')
    expect(result.current.data?.[0].is_active).toBe(true)
    expect(result.current.data?.[1].total_calls).toBe(0)
    expect(mockFrom).toHaveBeenCalledWith('workflow_webhook_tokens')
  })

  it('filtre par workflow_id quand fourni', async () => {
    const { useWorkflowWebhookTokens } = await import('./useWorkflowWebhookTokens')
    const builder = createChainableBuilder({ data: webhookTokens, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflowWebhookTokens('wf-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('workflow_id', 'wf-1')
  })

  it('expose isError quand la requête échoue', async () => {
    const { useWorkflowWebhookTokens } = await import('./useWorkflowWebhookTokens')
    const err = new Error('accès refusé')
    const builder = createChainableBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflowWebhookTokens(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCreateWebhookToken', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

  it('génère un nouveau token webhook et appelle toast success', async () => {
    const { useCreateWebhookToken } = await import('./useWorkflowWebhookTokens')
    const builder = createChainableBuilder({ data: newWebhookToken, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCreateWebhookToken(), { wrapper: createWrapper() })

    await act(async () => {
      const data = await result.current.mutateAsync({ workflow_id: 'wf-1', label: 'Nouveau' })
      expect(data.id).toBe('tok-new')
    })

    expect(mockFrom).toHaveBeenCalledWith('workflow_webhook_tokens')
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ workflow_id: 'wf-1', label: 'Nouveau', created_by: 'user-1' })
    )
    expect(toastSuccess).toHaveBeenCalledWith('Token webhook généré')
  })

  it('appelle toast.error si insert échoue', async () => {
    const { useCreateWebhookToken } = await import('./useWorkflowWebhookTokens')
    const err = new Error('contrainte unique')
    const builder = createChainableBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCreateWebhookToken(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({ workflow_id: 'wf-1' })
      } catch {
        /* attendu */
      }
    })

    expect(toastError).toHaveBeenCalled()
  })
})

describe('useToggleWebhookToken', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

  it('active un token désactivé', async () => {
    const { useToggleWebhookToken } = await import('./useWorkflowWebhookTokens')
    const builder = createChainableBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useToggleWebhookToken(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'tok-2', is_active: true })
    })

    expect(builder.update).toHaveBeenCalledWith({ is_active: true })
    expect(builder.eq).toHaveBeenCalledWith('id', 'tok-2')
  })
})

describe('useDeleteWebhookToken', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

  it('supprime un token webhook et affiche toast success', async () => {
    const { useDeleteWebhookToken } = await import('./useWorkflowWebhookTokens')
    const builder = createChainableBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useDeleteWebhookToken(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('tok-1')
    })

    expect(mockFrom).toHaveBeenCalledWith('workflow_webhook_tokens')
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'tok-1')
    expect(toastSuccess).toHaveBeenCalledWith('Token supprimé')
  })
})
