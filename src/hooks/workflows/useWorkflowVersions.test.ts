import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { versions, mockFrom, toastSuccess, toastError } = vi.hoisted(() => ({
  versions: [
    {
      id: 'v-2',
      workflow_id: 'wf-1',
      version_number: 2,
      graph: { nodes: [{ id: 'n1' }], edges: [] },
      trigger_type: 'manual',
      trigger_config: {},
      nom: 'Relance v2',
      description: 'Version 2',
      comment: 'Ajout nœud condition',
      created_at: '2024-01-15T08:00:00Z',
      created_by: 'user-1',
    },
    {
      id: 'v-1',
      workflow_id: 'wf-1',
      version_number: 1,
      graph: { nodes: [], edges: [] },
      trigger_type: 'manual',
      trigger_config: {},
      nom: 'Relance v1',
      description: 'Version initiale',
      comment: null,
      created_at: '2024-01-10T08:00:00Z',
      created_by: 'user-1',
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
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    update: vi.fn(),
    single: vi.fn(),
  }
  for (const k of ['select', 'eq', 'order', 'limit', 'update']) {
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

describe('useWorkflowVersions', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('ne fait aucun appel si workflow_id est undefined (query disabled)', async () => {
    const { useWorkflowVersions } = await import('./useWorkflowVersions')
    const { result } = renderHook(() => useWorkflowVersions(undefined), {
      wrapper: createWrapper(),
    })

    expect(result.current.data).toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('passe de isLoading à succès et retourne les versions triées', async () => {
    const { useWorkflowVersions } = await import('./useWorkflowVersions')
    const builder = createChainableBuilder({ data: versions, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflowVersions('wf-1'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].version_number).toBe(2)
    expect(result.current.data?.[1].version_number).toBe(1)
    expect(mockFrom).toHaveBeenCalledWith('workflow_versions')
    expect(builder.eq).toHaveBeenCalledWith('workflow_id', 'wf-1')
    expect(builder.order).toHaveBeenCalledWith('version_number', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(50)
  })

  it('expose isError quand la requête échoue', async () => {
    const { useWorkflowVersions } = await import('./useWorkflowVersions')
    const err = new Error('table introuvable')
    const builder = createChainableBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflowVersions('wf-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useRestoreWorkflowVersion', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  it('restaure une version et affiche toast succès', async () => {
    const { useRestoreWorkflowVersion } = await import('./useWorkflowVersions')
    const builder = createChainableBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useRestoreWorkflowVersion(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await result.current.mutateAsync(versions[0])
    })

    expect(mockFrom).toHaveBeenCalledWith('workflows')
    expect(builder.update).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'wf-1')
    expect(toastSuccess).toHaveBeenCalledWith('Version v2 restaurée')
  })

  it('appelle toast.error si la restauration échoue', async () => {
    const { useRestoreWorkflowVersion } = await import('./useWorkflowVersions')
    const err = new Error('conflit de version')
    const builder = createChainableBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useRestoreWorkflowVersion(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      try {
        await result.current.mutateAsync(versions[1])
      } catch {
        /* attendu */
      }
    })

    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('conflit de version'))
  })
})
