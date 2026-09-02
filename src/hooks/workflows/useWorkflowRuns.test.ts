import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { runs, mockFrom, mockChannel, mockRemoveChannel } = vi.hoisted(() => {
  const mockChannelObj = {
    on: vi.fn(),
    subscribe: vi.fn(),
  }
  mockChannelObj.on.mockReturnValue(mockChannelObj)
  mockChannelObj.subscribe.mockReturnValue({ unsubscribe: vi.fn() })

  return {
    runs: [
      {
        id: 'run-1',
        workflow_id: 'wf-1',
        status: 'success',
        started_at: '2024-01-15T10:00:00Z',
        finished_at: '2024-01-15T10:00:05Z',
        trigger_payload: {},
      },
      {
        id: 'run-2',
        workflow_id: 'wf-1',
        status: 'failed',
        started_at: '2024-01-14T09:00:00Z',
        finished_at: '2024-01-14T09:00:02Z',
        trigger_payload: {},
      },
    ],
    mockFrom: vi.fn(),
    mockChannel: vi.fn().mockReturnValue(mockChannelObj),
    mockRemoveChannel: vi.fn(),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
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

function createBuilder(response: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    eq: vi.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.limit.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  // thenable final — le hook fait `const { data, error } = await q`
  ;(builder as unknown as { then: (cb: (v: unknown) => unknown) => Promise<unknown> }).then = (
    cb
  ) => Promise.resolve(response).then(cb)
  ;(builder as unknown as { catch: (cb: (e: unknown) => unknown) => Promise<unknown> }).catch = (
    cb
  ) => Promise.resolve(response).catch(cb)
  return builder
}

describe('useWorkflowRuns', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockChannel.mockClear()
    mockRemoveChannel.mockClear()
  })

  it('passe de isLoading à succès et retourne les runs', async () => {
    const { useWorkflowRuns } = await import('./useWorkflowRuns')
    const builder = createBuilder({ data: runs, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflowRuns(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].status).toBe('success')
    expect(result.current.data?.[1].status).toBe('failed')
    expect(mockFrom).toHaveBeenCalledWith('workflow_runs')
    expect(builder.order).toHaveBeenCalledWith('started_at', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(50)
  })

  it('filtre par workflow_id quand fourni', async () => {
    const { useWorkflowRuns } = await import('./useWorkflowRuns')
    const builder = createBuilder({ data: [runs[0]], error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflowRuns('wf-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(builder.eq).toHaveBeenCalledWith('workflow_id', 'wf-1')
    expect(result.current.data?.[0].workflow_id).toBe('wf-1')
  })

  it('expose isError quand la requête échoue', async () => {
    const { useWorkflowRuns } = await import('./useWorkflowRuns')
    const err = new Error('timeout')
    const builder = createBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflowRuns(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(err)
  })

  it('utilise un limit custom (10)', async () => {
    const { useWorkflowRuns } = await import('./useWorkflowRuns')
    const builder = createBuilder({ data: runs, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflowRuns(undefined, 10), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.limit).toHaveBeenCalledWith(10)
  })

  it('souscrit au canal realtime et appelle removeChannel au démontage', async () => {
    const { useWorkflowRuns } = await import('./useWorkflowRuns')
    const builder = createBuilder({ data: runs, error: null })
    mockFrom.mockReturnValue(builder)

    const { unmount } = renderHook(() => useWorkflowRuns('wf-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(mockChannel).toHaveBeenCalled())
    expect(mockChannel).toHaveBeenCalledWith('workflow_runs_wf-1')

    unmount()
    expect(mockRemoveChannel).toHaveBeenCalled()
  })
})
