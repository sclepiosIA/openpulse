/* @vitest-environment jsdom */

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useGroupeActivities, useGroupeActivityStats } from './useGroupeActivities'

const {
  GROUPE_ID,
  GROUPE_ETABS,
  ACTIVITIES_ROWS,
  AUTH_STATE,
  mockFrom,
  mockEq,
  mockIs,
  mockSelect,
  mockOrder,
  mockIn,
  mockLimit,
} = vi.hoisted(() => {
  const GROUPE_ID = 'grp-1'

  const GROUPE_ETABS = [
    {
      etablissement_id: 'etab-1',
      etablissement: { nom: 'Clinique Alpha' },
    },
    {
      etablissement_id: 'etab-2',
      etablissement: { nom: 'Centre Beta' },
    },
  ]

  const now = new Date()
  const recent = new Date(now)
  recent.setDate(now.getDate() - 5)
  const old = new Date(now)
  old.setDate(now.getDate() - 45)

  const ACTIVITIES_ROWS = [
    {
      id: 'act-1',
      etablissement_id: 'etab-1',
      activity_type: 'call',
      title: 'Appel de suivi',
      description: 'Premier contact',
      activity_date: recent.toISOString(),
      scheduled_date: null,
      completed_date: null,
      metadata: {
        notes: 'RAS',
        attendees: ['Alice', 'Bob'],
        duration_minutes: 25,
      },
      created_by: 'user-1',
      assigned_to: 'user-2',
      status: 'scheduled',
      created_at: recent.toISOString(),
      updated_at: recent.toISOString(),
    },
    {
      id: 'act-2',
      etablissement_id: 'etab-2',
      activity_type: 'meeting',
      title: 'Réunion trimestrielle',
      description: null,
      activity_date: old.toISOString(),
      scheduled_date: old.toISOString(),
      completed_date: old.toISOString(),
      metadata: ['invalid-metadata-shape'],
      created_by: null,
      assigned_to: null,
      status: 'completed',
      created_at: old.toISOString(),
      updated_at: old.toISOString(),
    },
  ]

  const AUTH_STATE = {
    user: { id: 'user-1', email: 'test@local.dev' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  }

  return {
    GROUPE_ID,
    GROUPE_ETABS,
    ACTIVITIES_ROWS,
    AUTH_STATE,
    mockFrom: vi.fn(),
    mockEq: vi.fn(),
    mockIs: vi.fn(),
    mockSelect: vi.fn(),
    mockOrder: vi.fn(),
    mockIn: vi.fn(),
    mockLimit: vi.fn(),
  }
})

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

function createThenableBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: mockSelect.mockImplementation(() => builder),
    eq: mockEq.mockImplementation(() => builder),
    is: mockIs.mockImplementation(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: mockIn.mockImplementation(() => builder),
    order: mockOrder.mockImplementation(() => builder),
    limit: mockLimit.mockImplementation(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
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

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useGroupeActivities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('charge puis retourne les activités enrichies avec le nom d’établissement et filtre les metadata invalides', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'etablissements_groupes') {
        return createThenableBuilder({ data: GROUPE_ETABS, error: null })
      }

      if (table === 'customer_activities') {
        return createThenableBuilder({ data: ACTIVITIES_ROWS, error: null })
      }

      return createThenableBuilder({ data: [], error: null })
    })

    const { result } = renderHook(() => useGroupeActivities(GROUPE_ID), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('etablissements_groupes')
    expect(mockFrom).toHaveBeenCalledWith('customer_activities')
    expect(mockEq).toHaveBeenCalledWith('groupe_id', GROUPE_ID)
    expect(mockIs).toHaveBeenCalledWith('date_sortie', null)
    expect(mockIn).toHaveBeenCalledWith('etablissement_id', ['etab-1', 'etab-2'])
    expect(mockOrder).toHaveBeenCalledWith('activity_date', { ascending: false })

    expect(result.current.data).toHaveLength(2)

    expect(result.current.data?.[0]).toMatchObject({
      id: 'act-1',
      etablissement_id: 'etab-1',
      activity_type: 'call',
      title: 'Appel de suivi',
      description: 'Premier contact',
      status: 'scheduled',
      etablissement_nom: 'Clinique Alpha',
      source: 'etablissement',
    })
    expect(result.current.data?.[0]?.metadata).toEqual({
      notes: 'RAS',
      attendees: ['Alice', 'Bob'],
      duration_minutes: 25,
    })

    expect(result.current.data?.[1]).toMatchObject({
      id: 'act-2',
      etablissement_id: 'etab-2',
      activity_type: 'meeting',
      title: 'Réunion trimestrielle',
      description: null,
      status: 'completed',
      etablissement_nom: 'Centre Beta',
      source: 'etablissement',
      metadata: null,
    })
  })

  it('applique les options type, status et limit à la requête', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'etablissements_groupes') {
        return createThenableBuilder({ data: GROUPE_ETABS, error: null })
      }

      if (table === 'customer_activities') {
        return createThenableBuilder({ data: [ACTIVITIES_ROWS[0]], error: null })
      }

      return createThenableBuilder({ data: [], error: null })
    })

    const { result } = renderHook(
      () =>
        useGroupeActivities(GROUPE_ID, {
          type: 'call',
          status: 'scheduled',
          limit: 1,
        }),
      {
        wrapper: createWrapper(),
      },
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockEq).toHaveBeenCalledWith('activity_type', 'call')
    expect(mockEq).toHaveBeenCalledWith('status', 'scheduled')
    expect(mockLimit).toHaveBeenCalledWith(1)
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]?.title).toBe('Appel de suivi')
  })

  it('retourne une erreur quand la requête activités échoue', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'etablissements_groupes') {
        return createThenableBuilder({ data: GROUPE_ETABS, error: null })
      }

      if (table === 'customer_activities') {
        return createThenableBuilder({ data: null, error: { message: 'x' } })
      }

      return createThenableBuilder({ data: [], error: null })
    })

    const { result } = renderHook(() => useGroupeActivities(GROUPE_ID), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeTruthy()
    expect((result.current.error as Error).message).toBe('x')
  })

  it('ne lance pas la requête si groupeId est absent', () => {
    const { result } = renderHook(() => useGroupeActivities(undefined), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.isLoading).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('useGroupeActivityStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calcule les statistiques métier réelles à partir des activités du groupe', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'etablissements_groupes') {
        return createThenableBuilder({ data: GROUPE_ETABS, error: null })
      }

      if (table === 'customer_activities') {
        return createThenableBuilder({ data: ACTIVITIES_ROWS, error: null })
      }

      return createThenableBuilder({ data: [], error: null })
    })

    const { result } = renderHook(() => useGroupeActivityStats(GROUPE_ID), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.stats.total).toBe(2)
    expect(result.current.stats.byType.call).toBe(1)
    expect(result.current.stats.byType.meeting).toBe(1)
    expect(result.current.stats.byStatus.scheduled).toBe(1)
    expect(result.current.stats.byStatus.completed).toBe(1)
    expect(result.current.stats.byStatus.in_progress).toBe(0)
    expect(result.current.stats.byStatus.cancelled).toBe(0)
    expect(result.current.stats.recentCount).toBe(1)
  })
})