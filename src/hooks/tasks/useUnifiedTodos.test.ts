import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useUnifiedTodos,
  useUnifiedTodoStats,
  formatDueDate,
  getDueDateColor,
  unifiedTodoKeys,
} from './useUnifiedTodos'

const h = vi.hoisted(() => {
  const TODAY_ISO = new Date().toISOString()

  const PERSONAL_ROWS = [
    {
      id: 'p1',
      title: 'Acheter du café',
      description: 'desc perso',
      is_done: false,
      done_at: null,
      priority: 'high',
      due_date: TODAY_ISO,
      created_at: '2024-01-02T00:00:00Z',
      etablissement_id: 'e1',
      etablissement: { id: 'e1', nom: 'Lycée A' },
      project_id: 'pr1',
      project: { id: 'pr1', name: 'Projet X', color: '#FF0000' },
      assigned_to: 'u2',
      assigned: { id: 'u2', prenom: 'Jean', nom: 'Dupont' },
      rd_user_story_id: null,
      rd_user_story: null,
      support_ticket_id: null,
      support_ticket: null,
      visibility: 'team',
    },
  ]

  const TACHES_ROWS = [
    {
      id: 't1',
      titre: 'Tâche établissement',
      description: null,
      statut: 'A faire',
      priorite: 'high',
      echeance: null,
      created_at: '2024-01-01T00:00:00Z',
      etablissement: { id: 'e1', nom: 'Lycée A' },
    },
  ]

  const MEMBERS_ROWS = [{ conversation_id: 'c1', pulse_conversations: { name: 'Conv 1' } }]

  const PULSE_LISTS = [
    {
      id: 'l1',
      title: 'Liste Pulse',
      conversation_id: 'c1',
      pulse_todo_items: [
        {
          id: 'i1',
          content: 'Item pulse',
          is_done: false,
          done_at: null,
          position: 0,
          created_at: '2024-01-03T00:00:00Z',
        },
      ],
    },
  ]

  const STATS_PERSONAL = [
    { id: 'p1', due_date: TODAY_ISO, is_done: false },
    { id: 'p2', due_date: null, is_done: false },
  ]

  const STATS_TACHES = [{ id: 't1', echeance: TODAY_ISO, statut: 'A faire' }]

  type TableResult = { data?: unknown; error?: unknown; reject?: boolean }

  const defaults = (): Record<string, TableResult> => ({
    personal_todos: { data: PERSONAL_ROWS, error: null },
    taches: { data: TACHES_ROWS, error: null },
    pulse_conversation_members: { data: MEMBERS_ROWS, error: null },
    pulse_todo_lists: { data: PULSE_LISTS, error: null },
  })

  const state = { results: defaults() }

  const resolveFor = (table: string): Promise<unknown> => {
    const r = state.results[table]
    if (r?.reject) return Promise.reject(new Error('boom'))
    return Promise.resolve(r ?? { data: [], error: null })
  }

  const makeBuilder = (table: string) => {
    const b: Record<string, unknown> = {}
    const methods = [
      'select',
      'eq',
      'neq',
      'gte',
      'lte',
      'in',
      'is',
      'order',
      'limit',
      'insert',
      'update',
      'delete',
      'upsert',
    ]
    for (const m of methods) {
      b[m] = vi.fn(() => b)
    }
    b.single = vi.fn(() => resolveFor(table))
    b.maybeSingle = vi.fn(() => resolveFor(table))
    b.then = (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      resolveFor(table).then(onF, onR)
    b.catch = (onR?: (e: unknown) => unknown) => resolveFor(table).catch(onR)
    return b
  }

  const mockFrom = vi.fn((table: string) => makeBuilder(table))

  const PROFILE = { data: { id: 'u1' } }

  const mockDebug = { error: vi.fn(), warn: vi.fn(), log: vi.fn(), info: vi.fn() }

  return { state, defaults, mockFrom, PROFILE, mockDebug, TODAY_ISO, STATS_PERSONAL, STATS_TACHES }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: h.mockFrom },
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => h.PROFILE,
}))

vi.mock('@/lib/debug', () => ({
  debug: h.mockDebug,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

beforeEach(() => {
  h.state.results = h.defaults()
  vi.clearAllMocks()
})

describe('unifiedTodoKeys', () => {
  it('génère des clés stables et hiérarchiques', () => {
    expect(unifiedTodoKeys.all).toEqual(['unified-todos'])
    expect(unifiedTodoKeys.stats()).toEqual(['unified-todos', 'stats'])
    expect(unifiedTodoKeys.list({ filter: 'today' })).toEqual([
      'unified-todos',
      'list',
      { filter: 'today' },
    ])
  })
})

describe('useUnifiedTodos', () => {
  it('charge puis agrège les todos des 3 sources, triés par priorité', async () => {
    const { result } = renderHook(() => useUnifiedTodos(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const todos = result.current.data ?? []
    expect(todos).toHaveLength(3)

    expect(todos[0].id).toBe('p1')
    expect(todos[0].source).toBe('personal')
    expect(todos[0].title).toBe('Acheter du café')
    expect(todos[0].etablissement_name).toBe('Lycée A')
    expect(todos[0].project_name).toBe('Projet X')
    expect(todos[0].project_color).toBe('#FF0000')
    expect(todos[0].assigned_to_name).toBe('Jean Dupont')
    expect(todos[0].visibility).toBe('team')

    expect(todos[1].id).toBe('t1')
    expect(todos[1].source).toBe('etablissement')
    expect(todos[1].title).toBe('Tâche établissement')
    expect(todos[1].priority).toBe('high')
    expect(todos[1].etablissement_id).toBe('e1')
    expect(todos[1].is_done).toBe(false)

    expect(todos[2].id).toBe('pulse-l1-i1')
    expect(todos[2].source).toBe('pulse')
    expect(todos[2].title).toBe('Item pulse')
    expect(todos[2].project_name).toBe('Liste Pulse')
    expect(todos[2].project_color).toBe('#8B5CF6')
    expect(todos[2].conversation_id).toBe('c1')
    expect(todos[2].conversation_name).toBe('Conv 1')
    expect(todos[2].pulse_list_id).toBe('l1')
    expect(todos[2].pulse_item_id).toBe('i1')

    expect(h.mockFrom).toHaveBeenCalledWith('personal_todos')
    expect(h.mockFrom).toHaveBeenCalledWith('taches')
    expect(h.mockFrom).toHaveBeenCalledWith('pulse_conversation_members')
    expect(h.mockFrom).toHaveBeenCalledWith('pulse_todo_lists')
  })

  it('applique le filtre de recherche sur le titre', async () => {
    const { result } = renderHook(() => useUnifiedTodos({ search: 'pulse' }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const todos = result.current.data ?? []
    expect(todos).toHaveLength(1)
    expect(todos[0].id).toBe('pulse-l1-i1')
    expect(todos[0].title).toBe('Item pulse')
  })

  it("applique le filtre 'etablissement' (uniquement les taches)", async () => {
    const { result } = renderHook(() => useUnifiedTodos({ filter: 'etablissement' }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const todos = result.current.data ?? []
    expect(todos).toHaveLength(1)
    expect(todos[0].id).toBe('t1')
    expect(todos[0].source).toBe('etablissement')
  })

  it('passe en erreur si la requête personal_todos rejette', async () => {
    h.state.results.personal_todos = { reject: true }

    const { result } = renderHook(() => useUnifiedTodos({ filter: 'all' }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('boom')
  })
})

describe('useUnifiedTodoStats', () => {
  it('calcule les compteurs today, week, overdue et total', async () => {
    h.state.results.personal_todos = { data: h.STATS_PERSONAL, error: null }
    h.state.results.taches = { data: h.STATS_TACHES, error: null }

    const { result } = renderHook(() => useUnifiedTodoStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({
      today: 2,
      week: 2,
      overdue: 0,
      total: 3,
    })
  })

  it('compte les tâches en retard (overdue)', async () => {
    h.state.results.personal_todos = {
      data: [{ id: 'p9', due_date: '2000-01-01T00:00:00Z', is_done: false }],
      error: null,
    }
    h.state.results.taches = { data: [], error: null }

    const { result } = renderHook(() => useUnifiedTodoStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.overdue).toBe(1)
    expect(result.current.data?.today).toBe(0)
    expect(result.current.data?.total).toBe(1)
  })
})

describe('formatDueDate', () => {
  it("retourne une chaîne vide si null", () => {
    expect(formatDueDate(null)).toBe('')
  })

  it("retourne Aujourd'hui pour la date du jour", () => {
    expect(formatDueDate(new Date().toISOString())).toBe("Aujourd'hui")
  })

  it('retourne Demain pour la date de demain', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(formatDueDate(tomorrow.toISOString())).toBe('Demain')
  })

  it('formate les dates passées en jour + mois abrégé', () => {
    const out = formatDueDate('2020-01-15T12:00:00Z')
    expect(out).toMatch(/15/)
    expect(out.length).toBeGreaterThan(2)
  })
})

describe('getDueDateColor', () => {
  it('retourne text-muted-foreground si done ou sans date', () => {
    expect(getDueDateColor(null, false)).toBe('text-muted-foreground')
    expect(getDueDateColor(new Date().toISOString(), true)).toBe('text-muted-foreground')
  })

  it('retourne text-destructive pour une date passée', () => {
    expect(getDueDateColor('2000-01-01T00:00:00Z', false)).toBe('text-destructive')
  })

  it("retourne text-orange-500 pour aujourd'hui", () => {
    expect(getDueDateColor(new Date().toISOString(), false)).toBe('text-orange-500')
  })

  it('retourne text-amber-500 pour demain', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(getDueDateColor(tomorrow.toISOString(), false)).toBe('text-amber-500')
  })

  it('retourne text-muted-foreground pour une date lointaine', () => {
    const far = new Date()
    far.setDate(far.getDate() + 30)
    expect(getDueDateColor(far.toISOString(), false)).toBe('text-muted-foreground')
  })
})