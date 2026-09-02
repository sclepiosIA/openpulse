import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { configs, mockFrom, toastSuccess, toastError } = vi.hoisted(() => ({
  configs: [
    {
      id: 'cfg-1',
      workflow_id: 'wf-1',
      failure_rate_threshold: 0.5,
      min_runs: 10,
      window_minutes: 60,
      scheduled_backlog_threshold: 100,
      notify_user_ids: ['user-1'],
      is_active: true,
      last_triggered_at: null,
      created_at: '2024-01-10T00:00:00Z',
      updated_at: '2024-01-10T00:00:00Z',
    },
  ],
  mockFrom: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
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
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
  }
  for (const k of ['select', 'order', 'update', 'insert', 'delete', 'eq']) {
    builder[k].mockReturnValue(builder)
  }
  ;(builder as unknown as { then: (cb: (v: unknown) => unknown) => Promise<unknown> }).then = (
    cb
  ) => Promise.resolve(response).then(cb)
  ;(builder as unknown as { catch: (cb: (e: unknown) => unknown) => Promise<unknown> }).catch = (
    cb
  ) => Promise.resolve(response).catch(cb)
  return builder
}

describe('useWorkflowAlertConfigs', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('passe de isLoading à succès et retourne les configs', async () => {
    const { useWorkflowAlertConfigs } = await import('./useWorkflowAlertConfig')
    const builder = createChainableBuilder({ data: configs, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflowAlertConfigs(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].failure_rate_threshold).toBe(0.5)
    expect(result.current.data?.[0].is_active).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('workflow_alert_config')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('expose isError quand la requête échoue', async () => {
    const { useWorkflowAlertConfigs } = await import('./useWorkflowAlertConfig')
    const err = new Error('accès refusé')
    const builder = createChainableBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflowAlertConfigs(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(err)
  })
})

describe('useUpsertAlertConfig', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  it('met à jour une config existante (avec id) et appelle toast success', async () => {
    const { useUpsertAlertConfig } = await import('./useWorkflowAlertConfig')
    const builder = createChainableBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useUpsertAlertConfig(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'cfg-1', failure_rate_threshold: 0.3 })
    })

    expect(mockFrom).toHaveBeenCalledWith('workflow_alert_config')
    expect(builder.update).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'cfg-1')
    expect(toastSuccess).toHaveBeenCalledWith('Configuration enregistrée')
  })

  it('insère une nouvelle config (sans id) et appelle toast success', async () => {
    const { useUpsertAlertConfig } = await import('./useWorkflowAlertConfig')
    const builder = createChainableBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useUpsertAlertConfig(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        workflow_id: 'wf-2',
        failure_rate_threshold: 0.2,
        min_runs: 5,
        window_minutes: 30,
        scheduled_backlog_threshold: 50,
        notify_user_ids: [],
        is_active: true,
      })
    })

    expect(builder.insert).toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('Configuration enregistrée')
  })

  it('appelle toast.error si upsert échoue', async () => {
    const { useUpsertAlertConfig } = await import('./useWorkflowAlertConfig')
    const err = new Error('contrainte violée')
    const builder = createChainableBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useUpsertAlertConfig(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 'cfg-1', failure_rate_threshold: 0.1 })
      } catch {
        /* attendu */
      }
    })

    expect(toastError).toHaveBeenCalled()
  })
})

describe('useDeleteAlertConfig', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  it('supprime une config et appelle toast success', async () => {
    const { useDeleteAlertConfig } = await import('./useWorkflowAlertConfig')
    const builder = createChainableBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useDeleteAlertConfig(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('cfg-1')
    })

    expect(mockFrom).toHaveBeenCalledWith('workflow_alert_config')
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'cfg-1')
    expect(toastSuccess).toHaveBeenCalledWith('Configuration supprimée')
  })

  it('appelle toast.error si delete échoue', async () => {
    const { useDeleteAlertConfig } = await import('./useWorkflowAlertConfig')
    const err = new Error('forbidden')
    const builder = createChainableBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useDeleteAlertConfig(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync('cfg-1')
      } catch {
        /* attendu */
      }
    })

    expect(toastError).toHaveBeenCalled()
  })
})
