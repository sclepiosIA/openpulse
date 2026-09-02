import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import {
  useCustomDashboards,
  useCustomDashboard,
  useCreateDashboard,
  useUpdateDashboard,
  useDeleteDashboard,
  useDuplicateDashboard,
} from './useCustomDashboards'

const { ROWS, SINGLE_ROW, USER, mockFrom, makeBuilder } = vi.hoisted(() => {
  const ROWS = [
    {
      id: 'd1',
      nom: 'Tableau A',
      description: 'desc A',
      owner_id: 'u1',
      layout: [{ i: 'w1', x: 0, y: 0, w: 4, h: 2 }],
      widgets: [{ id: 'w1', type: 'kpi' }],
      filters_schema: null,
      shared_with: null,
      is_template: false,
      updated_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 'd2',
      nom: 'Tableau B',
      description: null,
      owner_id: 'u1',
      layout: 'invalid',
      widgets: null,
      filters_schema: { period: 'month' },
      shared_with: ['u2'],
      is_template: false,
      updated_at: '2024-01-01T00:00:00Z',
    },
  ]
  const SINGLE_ROW = {
    id: 'd3',
    nom: 'Nouveau rapport',
    description: null,
    owner_id: 'u1',
    layout: [],
    widgets: [],
    filters_schema: {},
    shared_with: [],
    is_template: false,
  }
  const USER = { id: 'u1', email: 't@t.co' }

  type Result = { data: unknown; error: { message: string } | null }

  function makeBuilder(result: Result) {
    const builder: Record<string, unknown> = {}
    const chain = [
      'select',
      'insert',
      'update',
      'delete',
      'eq',
      'gte',
      'lte',
      'in',
      'order',
      'limit',
    ]
    for (const m of chain) {
      builder[m] = vi.fn(() => builder)
    }
    builder.single = vi.fn(() => Promise.resolve(result))
    builder.maybeSingle = vi.fn(() => Promise.resolve(result))
    builder.then = (
      onFulfilled?: (v: Result) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected)
    builder.catch = (onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected)
    return builder
  }

  return { ROWS, SINGLE_ROW, USER, mockFrom: vi.fn(), makeBuilder }
})

const { AUTH } = vi.hoisted(() => ({
  AUTH: { user: { id: 'u1', email: 't@t.co' }, session: { user: { id: 'u1' } }, isLoading: false },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { toast } from 'sonner'

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
})

describe('useCustomDashboards', () => {
  it('passe par isLoading puis renvoie les dashboards normalisés', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: ROWS, error: null }))
    const { result } = renderHook(() => useCustomDashboards(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('custom_dashboards')
    const data = result.current.data
    expect(data).toHaveLength(2)
    expect(data?.[0].id).toBe('d1')
    expect(data?.[0].nom).toBe('Tableau A')
    expect(data?.[0].layout).toEqual([{ i: 'w1', x: 0, y: 0, w: 4, h: 2 }])
    expect(data?.[0].widgets).toEqual([{ id: 'w1', type: 'kpi' }])
    expect(data?.[0].filters_schema).toEqual({})
    expect(data?.[0].shared_with).toEqual([])
    // normalisation des valeurs invalides
    expect(data?.[1].layout).toEqual([])
    expect(data?.[1].widgets).toEqual([])
    expect(data?.[1].filters_schema).toEqual({ period: 'month' })
    expect(data?.[1].shared_with).toEqual(['u2'])
  })

  it('passe en erreur si supabase renvoie une erreur', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'x' } }))
    const { result } = renderHook(() => useCustomDashboards(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual({ message: 'x' })
  })
})

describe('useCustomDashboard', () => {
  it('charge un dashboard par id et le normalise', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: ROWS[1], error: null }))
    const { result } = renderHook(() => useCustomDashboard('d2'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('d2')
    expect(result.current.data?.nom).toBe('Tableau B')
    expect(result.current.data?.layout).toEqual([])
    expect(result.current.data?.shared_with).toEqual(['u2'])
  })

  it('est désactivé sans id (pas de requête)', () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: null }))
    const { result } = renderHook(() => useCustomDashboard(undefined), {
      wrapper: createWrapper(),
    })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('passe en erreur sur échec supabase', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'x' } }))
    const { result } = renderHook(() => useCustomDashboard('d2'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCreateDashboard', () => {
  it('insère un dashboard avec owner_id de l’utilisateur et affiche un toast succès', async () => {
    const builder = makeBuilder({ data: SINGLE_ROW, error: null })
    mockFrom.mockReturnValue(builder)
    const { result } = renderHook(() => useCreateDashboard(), { wrapper: createWrapper() })

    let returned: { id?: string } | undefined
    await act(async () => {
      returned = await result.current.mutateAsync({ nom: 'Nouveau rapport', description: 'd' })
    })

    expect(mockFrom).toHaveBeenCalledWith('custom_dashboards')
    expect(builder.insert).toHaveBeenCalledWith({
      nom: 'Nouveau rapport',
      description: 'd',
      owner_id: USER.id,
      widgets: [],
      layout: [],
      is_template: false,
    })
    expect(toast.success).toHaveBeenCalledWith('Rapport créé')
    expect(returned?.id).toBe('d3')
  })

  it('affiche un toast erreur si l’insertion échoue', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'x' } }))
    const { result } = renderHook(() => useCreateDashboard(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ nom: 'KO' }).catch(() => undefined)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('Erreur lors de la création')
  })
})

describe('useUpdateDashboard', () => {
  it('met à jour le dashboard avec le patch fourni', async () => {
    const builder = makeBuilder({ data: { ...SINGLE_ROW, nom: 'Renommé' }, error: null })
    mockFrom.mockReturnValue(builder)
    const { result } = renderHook(() => useUpdateDashboard(), { wrapper: createWrapper() })

    let returned: { nom?: string; id?: string } | undefined
    await act(async () => {
      returned = await result.current.mutateAsync({ id: 'd3', patch: { nom: 'Renommé' } })
    })

    expect(builder.update).toHaveBeenCalledWith({ nom: 'Renommé' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'd3')
    expect(returned?.nom).toBe('Renommé')
    expect(returned?.id).toBe('d3')
  })

  it('affiche un toast erreur en cas d’échec', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'x' } }))
    const { result } = renderHook(() => useUpdateDashboard(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'd3', patch: { nom: 'KO' } }).catch(() => undefined)
    })

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erreur lors de la sauvegarde'))
  })
})

describe('useDeleteDashboard', () => {
  it('supprime le dashboard par id et affiche un toast succès', async () => {
    const builder = makeBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)
    const { result } = renderHook(() => useDeleteDashboard(), { wrapper: createWrapper() })

    let returned: string | undefined
    await act(async () => {
      returned = await result.current.mutateAsync('d1')
    })

    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'd1')
    expect(returned).toBe('d1')
    expect(toast.success).toHaveBeenCalledWith('Rapport supprimé')
  })

  it('affiche un toast erreur générique en cas d’échec', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'x' } }))
    const { result } = renderHook(() => useDeleteDashboard(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('d1').catch(() => undefined)
    })

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erreur'))
  })
})

describe('useDuplicateDashboard', () => {
  it('duplique le dashboard avec le suffixe (copie)', async () => {
    const builder = makeBuilder({
      data: { ...SINGLE_ROW, id: 'd4', nom: 'Tableau A (copie)' },
      error: null,
    })
    mockFrom.mockReturnValue(builder)
    const { result } = renderHook(() => useDuplicateDashboard(), { wrapper: createWrapper() })

    const source = {
      id: 'd1',
      nom: 'Tableau A',
      description: 'desc A',
      owner_id: 'u1',
      widgets: [{ id: 'w1', type: 'kpi' }],
      layout: [{ i: 'w1', x: 0, y: 0, w: 4, h: 2 }],
      filters_schema: { period: 'month' },
      shared_with: [],
      is_template: false,
    }

    let returned: { id?: string; nom?: string } | undefined
    await act(async () => {
      returned = await result.current.mutateAsync(source as never)
    })

    expect(builder.insert).toHaveBeenCalledWith({
      nom: 'Tableau A (copie)',
      description: 'desc A',
      owner_id: USER.id,
      widgets: source.widgets,
      layout: source.layout,
      filters_schema: source.filters_schema,
      is_template: false,
    })
    expect(toast.success).toHaveBeenCalledWith('Rapport dupliqué')
    expect(returned?.id).toBe('d4')
    expect(returned?.nom).toBe('Tableau A (copie)')
  })

  it('affiche un toast erreur en cas d’échec', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'x' } }))
    const { result } = renderHook(() => useDuplicateDashboard(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current
        .mutateAsync({
          id: 'd1',
          nom: 'A',
          description: null,
          widgets: [],
          layout: [],
          filters_schema: {},
        } as never)
        .catch(() => undefined)
    })

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erreur'))
  })
})