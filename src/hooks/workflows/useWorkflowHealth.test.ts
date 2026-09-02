import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { healthData, mockRpc, mockMonitoring } = vi.hoisted(() => ({
  healthData: {
    window_days: 7,
    total_runs: 42,
    success: 38,
    failed: 4,
    paused: 0,
    success_rate: 90.48,
    avg_duration_ms: 1250,
    pending_scheduled: 3,
    top_failing: [{ id: 'wf-1', nom: 'Relance', failed: 3, total: 10 }],
    per_day: [{ day: '2024-01-15', success: 5, failed: 1 }],
  },
  mockRpc: vi.fn(),
  mockMonitoring: {
    captureException: vi.fn(),
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: mockRpc },
}))

vi.mock('@/lib/monitoring', () => ({
  monitoring: mockMonitoring,
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

describe('useWorkflowHealth', () => {
  beforeEach(() => {
    mockRpc.mockReset()
    mockMonitoring.captureException.mockReset()
  })

  it('passe de isLoading à succès et retourne les métriques de santé', async () => {
    const { useWorkflowHealth } = await import('./useWorkflowHealth')
    mockRpc.mockResolvedValue({ data: healthData, error: null })

    const { result } = renderHook(() => useWorkflowHealth(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.total_runs).toBe(42)
    expect(result.current.data?.success).toBe(38)
    expect(result.current.data?.failed).toBe(4)
    expect(result.current.data?.success_rate).toBeCloseTo(90.48)
    expect(result.current.data?.top_failing).toHaveLength(1)
    expect(mockRpc).toHaveBeenCalledWith('get_workflow_health', { p_days: 7 })
  })

  it('utilise un window custom (30 jours)', async () => {
    const { useWorkflowHealth } = await import('./useWorkflowHealth')
    mockRpc.mockResolvedValue({ data: { ...healthData, window_days: 30 }, error: null })

    const { result } = renderHook(() => useWorkflowHealth(30), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockRpc).toHaveBeenCalledWith('get_workflow_health', { p_days: 30 })
  })

  it('retourne un succès dégradé vide et capture l’exception quand rpc échoue', async () => {
    const { useWorkflowHealth } = await import('./useWorkflowHealth')
    const err = new Error('RPC indisponible')
    mockRpc.mockResolvedValue({ data: null, error: err })

    const { result } = renderHook(() => useWorkflowHealth(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toEqual({
      window_days: 7,
      total_runs: 0,
      success: 0,
      failed: 0,
      paused: 0,
      success_rate: 0,
      avg_duration_ms: 0,
      pending_scheduled: 0,
      top_failing: [],
      per_day: [],
    })
    expect(mockMonitoring.captureException).toHaveBeenCalledTimes(1)
    expect(mockMonitoring.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        hook: 'useWorkflowHealth',
        rpc: 'get_workflow_health',
        p_days: 7,
        code: 'unknown',
      })
    )
  })
})
