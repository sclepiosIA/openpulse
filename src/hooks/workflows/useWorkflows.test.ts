import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── données stables via vi.hoisted ──────────────────────────────────────────
const { workflows, newWorkflow, mockFrom, mockFunctionsInvoke, mockToast, mockUseAuth } =
  vi.hoisted(() => ({
    workflows: [
      {
        id: 'wf-1',
        nom: 'Relance prospects',
        description: 'Automatise les relances',
        trigger_type: 'manual',
        trigger_config: {},
        graph: { nodes: [], edges: [] },
        is_active: true,
        is_template: false,
        created_by: 'user-1',
        created_at: '2024-01-10T10:00:00Z',
        updated_at: '2024-01-15T08:00:00Z',
      },
      {
        id: 'wf-2',
        nom: 'Notification nouveau lead',
        description: null,
        trigger_type: 'webhook',
        trigger_config: {},
        graph: { nodes: [], edges: [] },
        is_active: false,
        is_template: false,
        created_by: 'user-1',
        created_at: '2024-01-09T12:00:00Z',
        updated_at: '2024-01-09T12:00:00Z',
      },
    ],
    newWorkflow: {
      id: 'wf-new',
      nom: 'Nouveau workflow',
      description: null,
      trigger_type: 'manual',
      trigger_config: {},
      graph: { nodes: [], edges: [] },
      is_active: false,
      is_template: false,
      created_by: 'user-1',
      created_at: '2024-01-16T00:00:00Z',
      updated_at: '2024-01-16T00:00:00Z',
    },
    mockFrom: vi.fn(),
    mockFunctionsInvoke: vi.fn(),
    mockToast: vi.fn(),
    mockUseAuth: vi.fn(),
  }))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockFunctionsInvoke },
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}))

// ── helpers ─────────────────────────────────────────────────────────────────
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

/**
 * Builder chaînable qui résout via then/catch (pattern "await q").
 * Chaque méthode chaînable retourne le même builder.
 * single() et maybeSingle() resolvent directement.
 */
function createChainableBuilder(response: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  }
  // toutes les méthodes de chaîne retournent le builder
  for (const k of ['select', 'eq', 'order', 'update', 'insert', 'delete']) {
    builder[k].mockReturnValue(builder)
  }
  // terminal: single / maybeSingle resolvent directement
  builder.single.mockResolvedValue(response)
  builder.maybeSingle.mockResolvedValue(response)
  // thenable pour `await q` (ex: .delete().eq() sans single)
  ;(builder as unknown as { then: (cb: (v: unknown) => unknown) => Promise<unknown> }).then = (
    cb
  ) => Promise.resolve(response).then(cb)
  ;(builder as unknown as { catch: (cb: (e: unknown) => unknown) => Promise<unknown> }).catch = (
    cb
  ) => Promise.resolve(response).catch(cb)
  return builder
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('useWorkflows', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

  it('passe de isLoading à succès et retourne les workflows', async () => {
    const { useWorkflows } = await import('./useWorkflows')
    const builder = createChainableBuilder({ data: workflows, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflows(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].nom).toBe('Relance prospects')
    expect(result.current.data?.[0].is_active).toBe(true)
    expect(result.current.data?.[1].trigger_type).toBe('webhook')
    expect(mockFrom).toHaveBeenCalledWith('workflows')
    expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false })
  })

  it('expose isError quand la requête échoue', async () => {
    const { useWorkflows } = await import('./useWorkflows')
    const err = new Error('connexion perdue')
    const builder = createChainableBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflows(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(err)
  })
})

describe('useWorkflow (par id)', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

  it('ne fait aucun appel si id est undefined (query disabled)', async () => {
    const { useWorkflow } = await import('./useWorkflows')
    const { result } = renderHook(() => useWorkflow(undefined), { wrapper: createWrapper() })

    expect(result.current.data).toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('charge le workflow quand id est fourni', async () => {
    const { useWorkflow } = await import('./useWorkflows')
    const builder = createChainableBuilder({ data: workflows[0], error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflow('wf-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('wf-1')
    expect(builder.eq).toHaveBeenCalledWith('id', 'wf-1')
  })
})

describe('useCreateWorkflow', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockToast.mockReset()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

  it('crée un workflow sans template et appelle toast', async () => {
    const { useCreateWorkflow } = await import('./useWorkflows')
    const builder = createChainableBuilder({ data: newWorkflow, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCreateWorkflow(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        nom: 'Nouveau workflow',
        trigger_type: 'manual',
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('workflows')
    expect(builder.insert).toHaveBeenCalled()
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Workflow créé' }))
  })

  it("lance une erreur 'Non authentifié' si user est null", async () => {
    const { useCreateWorkflow } = await import('./useWorkflows')
    mockUseAuth.mockReturnValue({ user: null })

    const { result } = renderHook(() => useCreateWorkflow(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ nom: 'test', trigger_type: 'manual' })
      ).rejects.toThrow('Non authentifié')
    })
  })

  it('appelle toast erreur si insert échoue', async () => {
    const { useCreateWorkflow } = await import('./useWorkflows')
    const err = new Error('violation de contrainte')
    const builder = createChainableBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCreateWorkflow(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({ nom: 'wf', trigger_type: 'manual' })
      } catch {
        /* attendu */
      }
    })

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
  })
})

describe('useUpdateWorkflow', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockToast.mockReset()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

  it('met à jour un workflow et invalide les queries', async () => {
    const { useUpdateWorkflow } = await import('./useWorkflows')
    const updated = { ...workflows[0], nom: 'Relance v2' }
    const builder = createChainableBuilder({ data: updated, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useUpdateWorkflow(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'wf-1', nom: 'Relance v2' })
    })

    expect(mockFrom).toHaveBeenCalledWith('workflows')
    expect(builder.update).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'wf-1')
  })

  it('appelle toast erreur si update échoue', async () => {
    const { useUpdateWorkflow } = await import('./useWorkflows')
    const err = new Error('not found')
    const builder = createChainableBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useUpdateWorkflow(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 'wf-1', nom: 'x' })
      } catch {
        /* attendu */
      }
    })

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
  })
})

describe('useDeleteWorkflow', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockToast.mockReset()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

  it('supprime un workflow et appelle toast succès', async () => {
    const { useDeleteWorkflow } = await import('./useWorkflows')
    const builder = createChainableBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useDeleteWorkflow(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('wf-1')
    })

    expect(mockFrom).toHaveBeenCalledWith('workflows')
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'wf-1')
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Workflow supprimé' }))
  })
})

describe('useToggleWorkflowActive', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockToast.mockReset()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

  it("affiche 'Workflow activé' quand is_active=true", async () => {
    const { useToggleWorkflowActive } = await import('./useWorkflows')
    const builder = createChainableBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useToggleWorkflowActive(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'wf-1', is_active: true })
    })

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Workflow activé' }))
  })

  it("affiche 'Workflow mis en pause' quand is_active=false", async () => {
    const { useToggleWorkflowActive } = await import('./useWorkflows')
    const builder = createChainableBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useToggleWorkflowActive(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'wf-1', is_active: false })
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Workflow mis en pause' })
    )
  })
})

describe('useTriggerWorkflowManual', () => {
  beforeEach(() => {
    mockFunctionsInvoke.mockReset()
    mockToast.mockReset()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

  it('invoque la fonction workflow-engine et affiche toast succès', async () => {
    const { useTriggerWorkflowManual } = await import('./useWorkflows')
    mockFunctionsInvoke.mockResolvedValue({ data: { run_id: 'run-123' }, error: null })

    const { result } = renderHook(() => useTriggerWorkflowManual(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ workflow_id: 'wf-1', payload: { key: 'value' } })
    })

    expect(mockFunctionsInvoke).toHaveBeenCalledWith(
      'workflow-engine',
      expect.objectContaining({
        body: expect.objectContaining({ workflow_id: 'wf-1', manual: true }),
      })
    )
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Workflow lancé' }))
  })

  it('affiche toast erreur si invoke échoue', async () => {
    const { useTriggerWorkflowManual } = await import('./useWorkflows')
    const err = new Error('edge function timeout')
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: err })

    const { result } = renderHook(() => useTriggerWorkflowManual(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({ workflow_id: 'wf-1' })
      } catch {
        /* attendu */
      }
    })

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
  })
})
