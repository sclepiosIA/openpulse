import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockRpc, mockFunctionsInvoke, toastSuccess, toastError } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFunctionsInvoke: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
    functions: { invoke: mockFunctionsInvoke },
  },
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

describe('useWorkflowReplay', () => {
  beforeEach(() => {
    mockRpc.mockReset()
    mockFunctionsInvoke.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  it('rejoue un run : appelle rpc puis functions.invoke et affiche toast succès', async () => {
    const { useWorkflowReplay } = await import('./useWorkflowReplay')
    mockRpc.mockResolvedValue({
      data: { workflow_id: 'wf-1', trigger_payload: { source: 'manual' } },
      error: null,
    })
    mockFunctionsInvoke.mockResolvedValue({ data: { run_id: 'run-new' }, error: null })

    const { result } = renderHook(() => useWorkflowReplay(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('run-old-1')
    })

    expect(mockRpc).toHaveBeenCalledWith('replay_workflow_run', { p_run_id: 'run-old-1' })
    expect(mockFunctionsInvoke).toHaveBeenCalledWith(
      'workflow-engine',
      expect.objectContaining({
        body: expect.objectContaining({
          workflow_id: 'wf-1',
          manual: true,
        }),
      })
    )
    // trigger_payload doit inclure _replayed_from
    const callBody = mockFunctionsInvoke.mock.calls[0][1].body
    expect(callBody.trigger_payload._replayed_from).toBe('run-old-1')

    expect(toastSuccess).toHaveBeenCalledWith("Run rejoué — voir l'historique")
  })

  it('lance une erreur si rpc retourne data.error', async () => {
    const { useWorkflowReplay } = await import('./useWorkflowReplay')
    mockRpc.mockResolvedValue({
      data: { error: 'run introuvable' },
      error: null,
    })

    const { result } = renderHook(() => useWorkflowReplay(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync('run-inexistant')
      } catch {
        /* attendu */
      }
    })

    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('run introuvable'))
    expect(mockFunctionsInvoke).not.toHaveBeenCalled()
  })

  it('appelle toast.error si rpc échoue', async () => {
    const { useWorkflowReplay } = await import('./useWorkflowReplay')
    const err = new Error('RPC indisponible')
    mockRpc.mockResolvedValue({ data: null, error: err })

    const { result } = renderHook(() => useWorkflowReplay(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync('run-1')
      } catch {
        /* attendu */
      }
    })

    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('RPC indisponible'))
  })
})
