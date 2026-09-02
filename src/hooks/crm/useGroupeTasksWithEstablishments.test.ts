// @vitest-environment jsdom

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import {
  useGroupeTasksWithEstablishments,
  useGroupeTaskStats,
} from './useGroupeTasksWithEstablishments'

const {
  AUTH_STATE,
  GROUPE_TASKS,
  ETABS_ROWS,
  ETAB_TASKS,
  builderState,
  mockFrom,
  mockUseTachesGroupe,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const GROUPE_TASKS = [
    {
      id: 'gt1',
      titre: 'Tâche groupe récente',
      description: 'desc groupe',
      statut: 'En cours',
      priorite: 'Haute',
      echeance: '2024-02-10',
      created_at: '2024-02-03T10:00:00.000Z',
      groupe_id: 'g1',
      categorie: { nom: 'Pilotage', couleur: 'blue' },
    },
    {
      id: 'gt2',
      titre: 'Tâche groupe terminée',
      description: null,
      statut: 'Terminé',
      priorite: 'Basse',
      echeance: null,
      created_at: '2024-01-15T09:00:00.000Z',
      groupe_id: 'g1',
      categorie: null,
    },
  ]

  const ETABS_ROWS = [
    {
      etablissement_id: 'e1',
      etablissement: { nom: 'Étab Alpha' },
    },
    {
      etablissement_id: 'e2',
      etablissement: [{ nom: 'Étab Beta' }],
    },
  ]

  const ETAB_TASKS = [
    {
      id: 'et1',
      titre: 'Tâche établissement plus récente',
      description: 'desc etab',
      statut: 'À faire',
      priorite: 'Moyenne',
      echeance: '2024-02-12',
      created_at: '2024-02-05T08:00:00.000Z',
      etablissement_id: 'e1',
      categorie: { nom: 'Maintenance', couleur: 'green' },
    },
    {
      id: 'et2',
      titre: 'Tâche établissement terminée',
      description: null,
      statut: 'Terminé',
      priorite: 'Haute',
      echeance: null,
      created_at: '2024-01-20T08:00:00.000Z',
      etablissement_id: 'e2',
      categorie: null,
    },
  ]

  const builderState = {
    groupeEtabsResult: { data: ETABS_ROWS, error: null },
    etabTasksResult: { data: ETAB_TASKS, error: null },
    selectCalls: [] as Array<{ table: string; columns: string }>,
    eqCalls: [] as Array<{ table: string; column: string; value: unknown }>,
    isCalls: [] as Array<{ table: string; column: string; value: unknown }>,
    inCalls: [] as Array<{ table: string; column: string; value: unknown[] }>,
    neqCalls: [] as Array<{ table: string; column: string; value: unknown }>,
    orderCalls: [] as Array<{ table: string; column: string; options: unknown }>,
    fromCalls: [] as string[],
  }

  const createBuilder = (table: string) => {
    const builder = {
      table,
      select(columns: string) {
        builderState.selectCalls.push({ table, columns })
        return builder
      },
      eq(column: string, value: unknown) {
        builderState.eqCalls.push({ table, column, value })
        return builder
      },
      is(column: string, value: unknown) {
        builderState.isCalls.push({ table, column, value })
        return builder
      },
      in(column: string, value: unknown[]) {
        builderState.inCalls.push({ table, column, value })
        return builder
      },
      neq(column: string, value: unknown) {
        builderState.neqCalls.push({ table, column, value })
        return builder
      },
      order(column: string, options?: unknown) {
        builderState.orderCalls.push({ table, column, options })
        return builder
      },
      gte() {
        return builder
      },
      lte() {
        return builder
      },
      limit() {
        return builder
      },
      insert() {
        return builder
      },
      update() {
        return builder
      },
      delete() {
        return builder
      },
      single() {
        return Promise.resolve({ data: null, error: null })
      },
      maybeSingle() {
        return Promise.resolve({ data: null, error: null })
      },
      catch(onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve().catch(onRejected)
      },
      then(
        onFulfilled?: (value: { data: unknown; error: unknown }) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) {
        let result: { data: unknown; error: unknown }
        if (table === 'etablissements_groupes') {
          result = builderState.groupeEtabsResult
        } else if (table === 'taches') {
          result = builderState.etabTasksResult
        } else {
          result = { data: null, error: null }
        }
        return Promise.resolve(result).then(onFulfilled, onRejected)
      },
    }
    return builder
  }

  const mockFrom = vi.fn((table: string) => {
    builderState.fromCalls.push(table)
    return createBuilder(table)
  })

  const mockUseTachesGroupe = vi.fn(() => ({
    data: GROUPE_TASKS,
    isLoading: false,
  }))

  return {
    AUTH_STATE,
    GROUPE_TASKS,
    ETABS_ROWS,
    ETAB_TASKS,
    builderState,
    mockFrom,
    mockUseTachesGroupe,
  }
})

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/tasks/useTachesGroupe', () => ({
  useTachesGroupe: mockUseTachesGroupe,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      props.children
    )
  }
}

describe('useGroupeTasksWithEstablishments', () => {
  beforeEach(() => {
    builderState.groupeEtabsResult = { data: ETABS_ROWS, error: null }
    builderState.etabTasksResult = { data: ETAB_TASKS, error: null }
    builderState.selectCalls.length = 0
    builderState.eqCalls.length = 0
    builderState.isCalls.length = 0
    builderState.inCalls.length = 0
    builderState.neqCalls.length = 0
    builderState.orderCalls.length = 0
    builderState.fromCalls.length = 0
    mockFrom.mockClear()
    mockUseTachesGroupe.mockReset()
    mockUseTachesGroupe.mockReturnValue({
      data: GROUPE_TASKS,
      isLoading: false,
    })
  })

  it('attend la fin du chargement des tâches groupe avant de lancer la requête, puis combine et transforme les données métier', async () => {
    mockUseTachesGroupe
      .mockReturnValueOnce({
        data: undefined,
        isLoading: true,
      })
      .mockReturnValue({
        data: GROUPE_TASKS,
        isLoading: false,
      })

    const { result, rerender } = renderHook(
      () => useGroupeTasksWithEstablishments('g1'),
      { wrapper: createWrapper() }
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()

    rerender()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledTimes(2)
    expect(builderState.fromCalls).toEqual(['etablissements_groupes', 'taches'])

    expect(result.current.data).toEqual({
      groupeTasks: [
        {
          id: 'gt1',
          titre: 'Tâche groupe récente',
          description: 'desc groupe',
          statut: 'En cours',
          priorite: 'Haute',
          echeance: '2024-02-10',
          created_at: '2024-02-03T10:00:00.000Z',
          etablissement_id: null,
          groupe_id: 'g1',
          niveau_tache: 'groupe',
          source: 'groupe',
          categorie: { nom: 'Pilotage', couleur: 'blue' },
        },
        {
          id: 'gt2',
          titre: 'Tâche groupe terminée',
          description: null,
          statut: 'Terminé',
          priorite: 'Basse',
          echeance: null,
          created_at: '2024-01-15T09:00:00.000Z',
          etablissement_id: null,
          groupe_id: 'g1',
          niveau_tache: 'groupe',
          source: 'groupe',
          categorie: null,
        },
      ],
      etablissementTasks: [
        {
          id: 'et1',
          titre: 'Tâche établissement plus récente',
          description: 'desc etab',
          statut: 'À faire',
          priorite: 'Moyenne',
          echeance: '2024-02-12',
          created_at: '2024-02-05T08:00:00.000Z',
          etablissement_id: 'e1',
          groupe_id: null,
          niveau_tache: 'etablissement',
          source: 'etablissement',
          etablissement_nom: 'Étab Alpha',
          categorie: { nom: 'Maintenance', couleur: 'green' },
        },
        {
          id: 'et2',
          titre: 'Tâche établissement terminée',
          description: null,
          statut: 'Terminé',
          priorite: 'Haute',
          echeance: null,
          created_at: '2024-01-20T08:00:00.000Z',
          etablissement_id: 'e2',
          groupe_id: null,
          niveau_tache: 'etablissement',
          source: 'etablissement',
          etablissement_nom: 'Étab Beta',
          categorie: null,
        },
      ],
      allTasks: [
        {
          id: 'et1',
          titre: 'Tâche établissement plus récente',
          description: 'desc etab',
          statut: 'À faire',
          priorite: 'Moyenne',
          echeance: '2024-02-12',
          created_at: '2024-02-05T08:00:00.000Z',
          etablissement_id: 'e1',
          groupe_id: null,
          niveau_tache: 'etablissement',
          source: 'etablissement',
          etablissement_nom: 'Étab Alpha',
          categorie: { nom: 'Maintenance', couleur: 'green' },
        },
        {
          id: 'gt1',
          titre: 'Tâche groupe récente',
          description: 'desc groupe',
          statut: 'En cours',
          priorite: 'Haute',
          echeance: '2024-02-10',
          created_at: '2024-02-03T10:00:00.000Z',
          etablissement_id: null,
          groupe_id: 'g1',
          niveau_tache: 'groupe',
          source: 'groupe',
          categorie: { nom: 'Pilotage', couleur: 'blue' },
        },
        {
          id: 'et2',
          titre: 'Tâche établissement terminée',
          description: null,
          statut: 'Terminé',
          priorite: 'Haute',
          echeance: null,
          created_at: '2024-01-20T08:00:00.000Z',
          etablissement_id: 'e2',
          groupe_id: null,
          niveau_tache: 'etablissement',
          source: 'etablissement',
          etablissement_nom: 'Étab Beta',
          categorie: null,
        },
        {
          id: 'gt2',
          titre: 'Tâche groupe terminée',
          description: null,
          statut: 'Terminé',
          priorite: 'Basse',
          echeance: null,
          created_at: '2024-01-15T09:00:00.000Z',
          etablissement_id: null,
          groupe_id: 'g1',
          niveau_tache: 'groupe',
          source: 'groupe',
          categorie: null,
        },
      ],
    })

    expect(builderState.eqCalls).toEqual(
      expect.arrayContaining([
        { table: 'etablissements_groupes', column: 'groupe_id', value: 'g1' },
        { table: 'taches', column: 'archive', value: false },
      ])
    )
    expect(builderState.isCalls).toEqual([
      { table: 'etablissements_groupes', column: 'date_sortie', value: null },
    ])
    expect(builderState.inCalls).toEqual([
      { table: 'taches', column: 'etablissement_id', value: ['e1', 'e2'] },
    ])
    expect(builderState.orderCalls).toEqual([
      { table: 'taches', column: 'created_at', options: { ascending: false } },
    ])
  })

  it('applique les options status et hideCompleted à la requête des tâches établissement', async () => {
    const { result } = renderHook(
      () =>
        useGroupeTasksWithEstablishments('g1', {
          includeEstablishmentTasks: true,
          status: 'En cours',
          hideCompleted: true,
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(builderState.eqCalls).toEqual(
      expect.arrayContaining([
        { table: 'taches', column: 'statut', value: 'En cours' },
      ])
    )
    expect(builderState.neqCalls).toEqual([
      { table: 'taches', column: 'statut', value: 'Terminé' },
    ])
  })

  it('n interroge pas la table taches quand includeEstablishmentTasks vaut false', async () => {
    const { result } = renderHook(
      () =>
        useGroupeTasksWithEstablishments('g1', {
          includeEstablishmentTasks: false,
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(builderState.fromCalls).toEqual(['etablissements_groupes'])
    expect(result.current.data?.etablissementTasks).toEqual([])
    expect(result.current.data?.allTasks.map((task) => task.id)).toEqual(['gt1', 'gt2'])
  })

  it('retourne un état d’erreur quand la récupération des tâches établissement échoue', async () => {
    builderState.etabTasksResult = {
      data: null,
      error: { message: 'x' },
    }

    const { result } = renderHook(
      () => useGroupeTasksWithEstablishments('g1'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual({ message: 'x' })
  })
})

describe('useGroupeTaskStats', () => {
  beforeEach(() => {
    builderState.groupeEtabsResult = { data: ETABS_ROWS, error: null }
    builderState.etabTasksResult = { data: ETAB_TASKS, error: null }
    builderState.selectCalls.length = 0
    builderState.eqCalls.length = 0
    builderState.isCalls.length = 0
    builderState.inCalls.length = 0
    builderState.neqCalls.length = 0
    builderState.orderCalls.length = 0
    builderState.fromCalls.length = 0
    mockFrom.mockClear()
    mockUseTachesGroupe.mockReset()
    mockUseTachesGroupe.mockReturnValue({
      data: GROUPE_TASKS,
      isLoading: false,
    })
  })

  it('calcule les statistiques réelles sur les tâches groupe et établissement', async () => {
    const { result } = renderHook(() => useGroupeTaskStats('g1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.stats.total).toBe(4)
    })

    expect(result.current.stats).toEqual({
      groupeTotal: 2,
      groupeCompleted: 1,
      etablissementTotal: 2,
      etablissementCompleted: 1,
      total: 4,
      completed: 2,
      inProgress: 1,
      todo: 1,
    })
  })
})