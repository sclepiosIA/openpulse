import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  state,
  builder,
  mockFrom,
  mockToast,
  mockRpc,
  rpcState,
  ROWS,
  DASH_ROWS,
} = vi.hoisted(() => {
  const state = {
    response: { data: null as unknown, error: null as unknown },
  }

  type Builder = Record<string, unknown>
  const builder: Builder = {}
  const chainMethods = [
    'select',
    'eq',
    'neq',
    'gte',
    'lte',
    'in',
    'order',
    'limit',
    'insert',
    'update',
    'delete',
    'upsert',
    'range',
  ]
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder)
  }
  builder.single = vi.fn(() => Promise.resolve(state.response))
  builder.maybeSingle = vi.fn(() => Promise.resolve(state.response))
  builder.then = (
    onFulfilled?: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown
  ) => Promise.resolve(state.response).then(onFulfilled, onRejected)
  builder.catch = (onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(state.response).catch(onRejected)

  const mockFrom = vi.fn(() => builder)
  const mockToast = vi.fn()

  const ROWS = [
    {
      id: 't1',
      titre: 'Tâche 1',
      statut: 'A faire',
      etablissement_id: 'e1',
      archive: false,
    },
    {
      id: 't2',
      titre: 'Tâche 2',
      statut: 'En cours',
      etablissement_id: 'e1',
      archive: false,
    },
  ]

  const DASH_ROWS = [
    {
      id: 'd1',
      titre: 'Dash 1',
      statut: null,
      echeance: '2025-01-15',
      responsable_id: null,
      etablissement_nom: 'Etab A',
    },
  ]

  const rpcState = { data: null as unknown, error: null as unknown }
  const mockRpc = vi.fn(() => Promise.resolve(rpcState))

  return { state, builder, mockFrom, mockToast, ROWS, DASH_ROWS, rpcState, mockRpc }
})

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
  },
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    standard: { staleTime: 0, retryDelay: 0 },
  },
}))

vi.mock('@/lib/validations', () => ({}))

import {
  tacheKeys,
  useTaches,
  useDashboardTaskSummaries,
  useTachesByEtablissement,
  useCreateTache,
  useUpdateTache,
  useArchiveTache,
} from './useTaches'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  state.response = { data: null, error: null }
})

describe('tacheKeys', () => {
  it('génère des clés de cache cohérentes', () => {
    expect(tacheKeys.all).toEqual(['taches'])
    expect(tacheKeys.lists()).toEqual(['taches', 'list'])
    expect(tacheKeys.detail('abc')).toEqual(['taches', 'detail', 'abc'])
    expect(tacheKeys.byEtablissement('e1')).toEqual(['taches', 'etablissement', 'e1'])
    expect(tacheKeys.stats()).toEqual(['taches', 'stats'])
  })
})

describe('useTaches', () => {
  it('passe par isLoading puis retourne les tâches non archivées triées', async () => {
    state.response = { data: ROWS, error: null }

    const { result } = renderHook(() => useTaches(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].titre).toBe('Tâche 1')
    expect(result.current.data?.[1].statut).toBe('En cours')

    expect(mockFrom).toHaveBeenCalledWith('taches')
    expect(builder.eq).toHaveBeenCalledWith('archive', false)
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('expose isError lorsque supabase renvoie une erreur', async () => {
    state.response = { data: null, error: { message: 'x' } }

    const { result } = renderHook(() => useTaches(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })

    expect((result.current.error as { message: string }).message).toBe('x')
  })
})

describe('useDashboardTaskSummaries', () => {
  it('mappe les lignes de la RPC vers le résumé dashboard', async () => {
    rpcState.data = DASH_ROWS
    rpcState.error = null

    const { result } = renderHook(() => useDashboardTaskSummaries(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const summary = result.current.data?.[0]
    expect(summary?.id).toBe('d1')
    expect(summary?.titre).toBe('Dash 1')
    expect(summary?.statut).toBeUndefined()
    expect(summary?.echeance).toBe('2025-01-15')
    expect(summary?.etablissement).toEqual({ nom: 'Etab A' })

    expect(mockRpc).toHaveBeenCalledWith('get_dashboard_task_summaries')
  })
})

describe('useTachesByEtablissement', () => {
  it('ne déclenche aucun fetch quand etablissementId est vide', async () => {
    const { result } = renderHook(() => useTachesByEtablissement(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('charge les tâches filtrées par établissement et triées par ordre', async () => {
    state.response = { data: ROWS, error: null }

    const { result } = renderHook(() => useTachesByEtablissement('e1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.[0].id).toBe('t1')
    expect(builder.eq).toHaveBeenCalledWith('etablissement_id', 'e1')
    expect(builder.eq).toHaveBeenCalledWith('archive', false)
    expect(builder.order).toHaveBeenCalledWith('ordre', { ascending: true })
  })
})

describe('useCreateTache', () => {
  it('insère la tâche et affiche un toast de succès', async () => {
    state.response = {
      data: { id: 'new1', titre: 'Nouvelle', etablissement_id: 'e1' },
      error: null,
    }

    const { result } = renderHook(() => useCreateTache(), { wrapper: createWrapper() })

    const payload = { titre: 'Nouvelle', etablissement_id: 'e1' }

    await act(async () => {
      const created = await result.current.mutateAsync(
        payload as Parameters<typeof result.current.mutateAsync>[0]
      )
      expect(created.id).toBe('new1')
    })

    expect(mockFrom).toHaveBeenCalledWith('taches')
    expect(builder.insert).toHaveBeenCalledWith([payload])
    expect(builder.single).toHaveBeenCalled()
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Succès', description: 'Tâche créée avec succès' })
    )
  })

  it('affiche un toast destructif en cas d’erreur', async () => {
    state.response = { data: null, error: { message: 'x' } }

    const { result } = renderHook(() => useCreateTache(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current
        .mutateAsync({ titre: 'KO', etablissement_id: 'e1' } as Parameters<
          typeof result.current.mutateAsync
        >[0])
        .catch(() => undefined)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: 'Erreur' })
    )
  })
})

describe('useUpdateTache', () => {
  it('route les ids "portal-" vers client_portal_tasks avec mapping de statut', async () => {
    state.response = {
      data: { id: 'raw-1', etablissement_id: 'e2' },
      error: null,
    }

    const { result } = renderHook(() => useUpdateTache(), { wrapper: createWrapper() })

    await act(async () => {
      const updated = await result.current.mutateAsync({
        id: 'portal-raw-1',
        data: { statut: 'Terminé' } as Parameters<
          typeof result.current.mutateAsync
        >[0]['data'],
      })
      expect(updated.id).toBe('portal-raw-1')
      expect(updated.statut).toBe('Terminé')
    })

    expect(mockFrom).toHaveBeenCalledWith('client_portal_tasks')
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ statut: 'done', done_at: expect.any(String) })
    )
    expect(builder.eq).toHaveBeenCalledWith('id', 'raw-1')
  })

  it('met à jour la table taches pour un id standard', async () => {
    state.response = {
      data: { id: 't1', titre: 'Modifiée', etablissement_id: 'e1' },
      error: null,
    }

    const { result } = renderHook(() => useUpdateTache(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        id: 't1',
        data: { titre: 'Modifiée' } as Parameters<
          typeof result.current.mutateAsync
        >[0]['data'],
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('taches')
    expect(builder.update).toHaveBeenCalledWith({ titre: 'Modifiée' })
    expect(builder.eq).toHaveBeenCalledWith('id', 't1')
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Succès', description: 'Tâche mise à jour' })
    )
  })
})

describe('useArchiveTache', () => {
  it('archive une tâche standard et affiche le toast adapté', async () => {
    state.response = {
      data: { id: 't1', archive: true, etablissement_id: 'e1' },
      error: null,
    }

    const { result } = renderHook(() => useArchiveTache(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 't1', archive: true })
    })

    expect(mockFrom).toHaveBeenCalledWith('taches')
    expect(builder.update).toHaveBeenCalledWith({ archive: true })
    expect(builder.eq).toHaveBeenCalledWith('id', 't1')
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Succès', description: 'Tâche archivée' })
    )
  })

  it('supprime la tâche portail côté client_portal_tasks', async () => {
    state.response = { data: null, error: null }

    const { result } = renderHook(() => useArchiveTache(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'portal-raw-9', archive: true })
    })

    expect(mockFrom).toHaveBeenCalledWith('client_portal_tasks')
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'raw-9')
  })
})