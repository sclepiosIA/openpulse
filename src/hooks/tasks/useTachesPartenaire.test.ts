// @vitest-environment jsdom
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  useArchiveTachePartenaire,
  useCreateTachePartenaire,
  useTachesPartenaire,
  useUpdateTachePartenaire,
} from './useTachesPartenaire'

const {
  AUTH_STATE,
  TOAST_FN,
  DEBUG_ERROR,
  TASK_ROWS,
  UPDATED_ROW,
  CREATED_ROW,
  mockFrom,
  mockChannelFactory,
  mockRemoveChannel,
  state,
} = vi.hoisted(() => {
  const TASK_ROWS = [
    {
      id: 't1',
      titre: 'Préparer le dossier',
      description: 'Assembler les éléments',
      statut: 'A faire' as const,
      priorite: 'high' as const,
      partenaire_id: 'p1',
      categorie_id: 'c1',
      archive: false,
      created_at: '2024-01-02',
      updated_at: '2024-01-03',
      categories_taches: { id: 'c1', nom: 'Admin', couleur: 'blue' },
      partenaires: { id: 'p1', nom: 'Partenaire A', type_partenaire: 'association' },
      responsable_profile: { id: 'r1', prenom: 'Ada', nom: 'Lovelace', email: 'ada@example.test' },
    },
    {
      id: 't2',
      titre: 'Relancer le partenaire',
      statut: 'En cours' as const,
      priorite: 'medium' as const,
      partenaire_id: 'p1',
      categorie_id: 'c2',
      archive: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-04',
      categories_taches: { id: 'c2', nom: 'Suivi', couleur: 'green' },
      partenaires: { id: 'p1', nom: 'Partenaire A', type_partenaire: 'association' },
      responsable_profile: { id: 'r2', prenom: 'Grace', nom: 'Hopper', email: 'grace@example.test' },
    },
  ]

  const UPDATED_ROW = {
    id: 't1',
    titre: 'Préparer le dossier - modifié',
    statut: 'Terminé' as const,
    priorite: 'high' as const,
    partenaire_id: 'p1',
    categorie_id: 'c1',
    archive: false,
    created_at: '2024-01-02',
    updated_at: '2024-01-05',
  }

  const CREATED_ROW = {
    id: 't3',
    titre: 'Nouvelle tâche',
    statut: 'A faire' as const,
    priorite: 'low' as const,
    partenaire_id: 'p1',
    categorie_id: 'c3',
    archive: false,
    ordre: 999,
    created_at: '2024-01-06',
    updated_at: '2024-01-06',
  }

  const AUTH_STATE = {
    loading: false,
    user: { id: 'u1', email: 'user@example.test' },
  }

  const TOAST_FN = vi.fn()
  const DEBUG_ERROR = vi.fn()
  const mockFrom = vi.fn()
  const mockRemoveChannel = vi.fn()
  const mockChannelFactory = vi.fn()

  const state = {
    selectResult: { data: TASK_ROWS, error: null as { message: string } | null },
    singleResult: { data: UPDATED_ROW, error: null as { message: string } | null },
    table: '',
    selectArg: '' as string,
    updateArg: undefined as unknown,
    insertArg: undefined as unknown,
    eqCalls: [] as Array<[string, unknown]>,
    orderCalls: [] as Array<[string, unknown]>,
    channelName: '',
    channelOnArgs: [] as unknown[],
    invalidateQueries: vi.fn(),
  }

  return {
    AUTH_STATE,
    TOAST_FN,
    DEBUG_ERROR,
    TASK_ROWS,
    UPDATED_ROW,
    CREATED_ROW,
    mockFrom,
    mockChannelFactory,
    mockRemoveChannel,
    state,
  }
})

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: TOAST_FN }),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: DEBUG_ERROR,
  },
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannelFactory,
    removeChannel: mockRemoveChannel,
  },
}))

function createThenableBuilder() {
  const builder = {
    select: vi.fn((arg?: unknown) => {
      state.selectArg = String(arg ?? '')
      return builder
    }),
    eq: vi.fn((field: string, value: unknown) => {
      state.eqCalls.push([field, value])
      return builder
    }),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn((field: string, options?: unknown) => {
      state.orderCalls.push([field, options])
      return Promise.resolve(state.selectResult)
    }),
    limit: vi.fn(() => builder),
    insert: vi.fn((arg: unknown) => {
      state.insertArg = arg
      return builder
    }),
    update: vi.fn((arg: unknown) => {
      state.updateArg = arg
      return builder
    }),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(state.singleResult)),
    maybeSingle: vi.fn(() => Promise.resolve(state.singleResult)),
    then: (
      onFulfilled?: (value: typeof state.selectResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(state.selectResult).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(state.selectResult).catch(onRejected),
  }

  return builder
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  state.invalidateQueries = vi.fn()
  queryClient.invalidateQueries = state.invalidateQueries

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  AUTH_STATE.loading = false
  AUTH_STATE.user = { id: 'u1', email: 'user@example.test' }
  state.selectResult = { data: TASK_ROWS, error: null }
  state.singleResult = { data: UPDATED_ROW, error: null }
  state.table = ''
  state.selectArg = ''
  state.updateArg = undefined
  state.insertArg = undefined
  state.eqCalls = []
  state.orderCalls = []
  state.channelName = ''
  state.channelOnArgs = []

  mockFrom.mockImplementation((table: string) => {
    state.table = table
    return createThenableBuilder()
  })

  mockChannelFactory.mockImplementation((name: string) => {
    state.channelName = name
    const subscribedChannel = { id: 'channel-1' }
    const channel = {
      on: vi.fn((...args: unknown[]) => {
        state.channelOnArgs = args
        return channel
      }),
      subscribe: vi.fn(() => subscribedChannel),
    }
    return channel
  })
})

describe('useTachesPartenaire', () => {
  it('charge les tâches du partenaire, filtre les non archivées et configure l’abonnement temps réel', async () => {
    const wrapper = createWrapper()

    const { result, unmount } = renderHook(() => useTachesPartenaire('p1', false), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('taches')
    expect(state.table).toBe('taches')
    expect(state.selectArg).toContain('categories_taches')
    expect(state.selectArg).toContain('partenaires')
    expect(state.selectArg).toContain('responsable_profile')
    expect(state.eqCalls).toContainEqual(['partenaire_id', 'p1'])
    expect(state.eqCalls).toContainEqual(['archive', false])
    expect(state.orderCalls).toContainEqual(['created_at', { ascending: false }])

    expect(result.current.data).toEqual(TASK_ROWS)
    expect(result.current.data?.[0].titre).toBe('Préparer le dossier')
    expect(result.current.data?.[0].categories_taches?.nom).toBe('Admin')
    expect(result.current.data?.[0].responsable_profile?.prenom).toBe('Ada')
    expect(result.current.data?.[1].partenaires?.type_partenaire).toBe('association')

    expect(mockChannelFactory).toHaveBeenCalledWith('taches-partenaire-p1')
    expect(state.channelName).toBe('taches-partenaire-p1')
    expect(state.channelOnArgs[0]).toBe('postgres_changes')
    expect(state.channelOnArgs[1]).toEqual({
      event: '*',
      schema: 'public',
      table: 'taches',
      filter: 'partenaire_id=eq.p1',
    })
    expect(typeof state.channelOnArgs[2]).toBe('function')

    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledWith({ id: 'channel-1' })
  })

  it('remonte une erreur et affiche un toast destructif si le chargement échoue', async () => {
    state.selectResult = { data: null, error: { message: 'x' } }

    const wrapper = createWrapper()
    const { result } = renderHook(() => useTachesPartenaire('p1', true), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(state.eqCalls).toContainEqual(['partenaire_id', 'p1'])
    expect(state.eqCalls.find(([field]) => field === 'archive')).toBeUndefined()
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger les tâches du partenaire',
      variant: 'destructive',
    })
    expect(result.current.error).toEqual({ message: 'x' })
  })
})

describe('useUpdateTachePartenaire', () => {
  it('met à jour une tâche, invalide les requêtes et affiche un toast de succès', async () => {
    state.singleResult = { data: UPDATED_ROW, error: null }

    const wrapper = createWrapper()
    const { result } = renderHook(() => useUpdateTachePartenaire(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: 't1',
        data: { statut: 'Terminé', titre: 'Préparer le dossier - modifié' },
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('taches')
    expect(state.updateArg).toEqual({ statut: 'Terminé', titre: 'Préparer le dossier - modifié' })
    expect(state.eqCalls).toContainEqual(['id', 't1'])
    expect(state.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['taches'] })
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Tâche mise à jour avec succès',
    })
  })

  it('gère une erreur de mise à jour avec debug et toast destructif', async () => {
    state.singleResult = { data: null, error: { message: 'x' } }

    const wrapper = createWrapper()
    const { result } = renderHook(() => useUpdateTachePartenaire(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 't1',
          data: { statut: 'Bloqué' },
        }),
      ).rejects.toEqual({ message: 'x' })
    })

    expect(state.updateArg).toEqual({ statut: 'Bloqué' })
    expect(state.eqCalls).toContainEqual(['id', 't1'])
    expect(DEBUG_ERROR).toHaveBeenCalledWith('Error updating tache:', { message: 'x' })
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de mettre à jour la tâche',
      variant: 'destructive',
    })
  })
})

describe('useArchiveTachePartenaire', () => {
  it('archive une tâche et affiche le message métier attendu', async () => {
    state.singleResult = { data: UPDATED_ROW, error: null }

    const wrapper = createWrapper()
    const { result } = renderHook(() => useArchiveTachePartenaire(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ id: 't1', archive: true })
    })

    expect(state.updateArg).toEqual({ archive: true })
    expect(state.eqCalls).toContainEqual(['id', 't1'])
    expect(state.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['taches'] })
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Tâche archivée',
    })
  })

  it('gère une erreur d’archivage avec debug et toast destructif', async () => {
    state.singleResult = { data: null, error: { message: 'x' } }

    const wrapper = createWrapper()
    const { result } = renderHook(() => useArchiveTachePartenaire(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 't1', archive: false })).rejects.toEqual({ message: 'x' })
    })

    expect(state.updateArg).toEqual({ archive: false })
    expect(state.eqCalls).toContainEqual(['id', 't1'])
    expect(DEBUG_ERROR).toHaveBeenCalledWith('Error archiving tache:', { message: 'x' })
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: "Impossible de modifier l'archivage de la tâche",
      variant: 'destructive',
    })
  })
})

describe('useCreateTachePartenaire', () => {
  it('crée une tâche avec les champs métier par défaut puis invalide et notifie', async () => {
    state.singleResult = { data: CREATED_ROW, error: null }

    const wrapper = createWrapper()
    const { result } = renderHook(() => useCreateTachePartenaire(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        titre: 'Nouvelle tâche',
        description: 'Description',
        partenaire_id: 'p1',
        categorie_id: 'c3',
        priorite: 'low',
        echeance: '2024-02-01',
        responsable_id: 'r3',
      })
    })

    expect(state.insertArg).toEqual({
      titre: 'Nouvelle tâche',
      description: 'Description',
      partenaire_id: 'p1',
      categorie_id: 'c3',
      priorite: 'low',
      echeance: '2024-02-01',
      responsable_id: 'r3',
      statut: 'A faire',
      niveau_tache: 'partenaire',
      archive: false,
      ordre: 999,
    })
    expect(state.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['taches'] })
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Tâche créée avec succès',
    })
  })

  it('gère une erreur de création avec debug et toast destructif', async () => {
    state.singleResult = { data: null, error: { message: 'x' } }

    const wrapper = createWrapper()
    const { result } = renderHook(() => useCreateTachePartenaire(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          titre: 'Nouvelle tâche',
          partenaire_id: 'p1',
          categorie_id: 'c3',
          priorite: 'medium',
        }),
      ).rejects.toEqual({ message: 'x' })
    })

    expect(state.insertArg).toEqual({
      titre: 'Nouvelle tâche',
      partenaire_id: 'p1',
      categorie_id: 'c3',
      priorite: 'medium',
      statut: 'A faire',
      niveau_tache: 'partenaire',
      archive: false,
      ordre: 999,
    })
    expect(DEBUG_ERROR).toHaveBeenCalledWith('Error creating tache:', { message: 'x' })
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de créer la tâche',
      variant: 'destructive',
    })
  })
})