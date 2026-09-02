// @ts-nocheck
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { dryRunResult, mockFunctionsInvoke, toastError } = vi.hoisted(() => ({
  dryRunResult: {
    run_id: 'dry-run-123',
    status: 'success' as const,
    steps: 3,
    steps_log: [
      { node_id: 'n1', node_type: 'trigger', status: 'simulated' as const },
      { node_id: 'n2', node_type: 'action', status: 'success' as const },
      { node_id: 'n3', node_type: 'condition', status: 'skipped' as const },
    ],
    is_dry_run: true,
  },
  mockFunctionsInvoke: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: mockFunctionsInvoke },
  },
}))

vi.mock('sonner', () => ({
  toast: { error: toastError },
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

describe('useWorkflowDryRun', () => {
  beforeEach(() => {
    mockFunctionsInvoke.mockReset()
    toastError.mockReset()
  })

  it('invoque workflow-engine en mode dry_run=true et retourne le résultat', async () => {
    const { useWorkflowDryRun } = await import('./useWorkflowDryRun')
    mockFunctionsInvoke.mockResolvedValue({ data: dryRunResult, error: null })

    const { result } = renderHook(() => useWorkflowDryRun(), { wrapper: createWrapper() })

    let data: typeof dryRunResult | undefined
    await act(async () => {
      data = await result.current.mutateAsync({
        workflow_id: 'wf-1',
        trigger_payload: { source: 'test' },
      })
    })

    expect(mockFunctionsInvoke).toHaveBeenCalledWith(
      'workflow-engine',
      expect.objectContaining({
        body: expect.objectContaining({
          workflow_id: 'wf-1',
          dry_run: true,
          manual: true,
          trigger_payload: { source: 'test' },
        }),
      })
    )
    expect(data?.run_id).toBe('dry-run-123')
    expect(data?.is_dry_run).toBe(true)
    expect(data?.steps).toBe(3)
    expect(data?.steps_log).toHaveLength(3)
  })

  it('lance une erreur si la réponse contient data.error', async () => {
    const { useWorkflowDryRun } = await import('./useWorkflowDryRun')
    mockFunctionsInvoke.mockResolvedValue({
      data: { error: 'workflow introuvable' },
      error: null,
    })

    const { result } = renderHook(() => useWorkflowDryRun(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({ workflow_id: 'wf-inexistant', trigger_payload: {} })
      } catch {
        /* attendu */
      }
    })

    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('workflow introuvable'))
  })

  it('appelle toast.error si invoke retourne une erreur réseau', async () => {
    const { useWorkflowDryRun } = await import('./useWorkflowDryRun')
    const err = new Error('edge function down')
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: err })

    const { result } = renderHook(() => useWorkflowDryRun(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({ workflow_id: 'wf-1', trigger_payload: {} })
      } catch {
        /* attendu */
      }
    })

    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('edge function down'))
  })
})

