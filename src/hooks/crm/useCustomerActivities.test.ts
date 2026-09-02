/* @vitest-environment jsdom */

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  useCustomerActivities,
  useCreateActivity,
  type CustomerActivity,
} from './useCustomerActivities'

const {
  ACTIVITIES,
  CREATED_ACTIVITY,
  AUTH_STATE,
  mockFrom,
  mockToastSuccess,
  mockToastError,
  mockSanitizeSupabaseError,
} = vi.hoisted(() => {
  const ACTIVITIES_DATA: CustomerActivity[] = [
    {
      id: 'act-1',
      etablissement_id: 'eta-1',
      activity_type: 'meeting',
      title: 'Quarterly review',
      description: 'Review with stakeholders',
      activity_date: '2024-05-10T10:00:00.000Z',
      scheduled_date: '2024-05-10T10:00:00.000Z',
      completed_date: null,
      metadata: {
        notes: 'Bring KPI deck',
        attendees: ['Alice', 'Bob'],
        duration_minutes: 45,
      },
      created_by: 'user-1',
      assigned_to: 'user-2',
      status: 'scheduled',
      created_at: '2024-05-01T08:00:00.000Z',
      updated_at: '2024-05-01T08:00:00.000Z',
    },
    {
      id: 'act-2',
      etablissement_id: 'eta-1',
      activity_type: 'call',
      title: 'Follow-up call',
      description: null,
      activity_date: '2024-05-09T09:00:00.000Z',
      scheduled_date: null,
      completed_date: '2024-05-09T09:30:00.000Z',
      metadata: {
        outcome: 'positive',
        generated: true,
      },
      created_by: 'user-1',
      assigned_to: null,
      status: 'completed',
      created_at: '2024-05-09T09:00:00.000Z',
      updated_at: '2024-05-09T09:30:00.000Z',
    },
  ]

  const CREATED: CustomerActivity = {
    id: 'act-3',
    etablissement_id: 'eta-1',
    activity_type: 'demo',
    title: 'Product demo',
    description: 'Demo for procurement team',
    activity_date: '2024-06-01T14:00:00.000Z',
    scheduled_date: '2024-06-01T14:00:00.000Z',
    completed_date: null,
    metadata: {
      notes: 'Focus on workflow automation',
      attendees: ['Chloe'],
    },
    created_by: 'user-1',
    assigned_to: 'user-3',
    status: 'scheduled',
    created_at: '2024-05-20T12:00:00.000Z',
    updated_at: '2024-05-20T12:00:00.000Z',
  }

  return {
    ACTIVITIES: ACTIVITIES_DATA,
    CREATED_ACTIVITY: CREATED,
    AUTH_STATE: {
      user: { id: 'user-1', email: 't@t.co' },
      session: { user: { id: 'user-1' } },
      isLoading: false,
    },
    mockFrom: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockSanitizeSupabaseError: vi.fn(),
  }
})

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper() {
  const queryClient = createQueryClient()
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

type BuilderResult = {
  data: unknown
  error: { message: string } | null
}

function createSupabaseBuilder(result: BuilderResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (
      onFulfilled?: (value: BuilderResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected),
  }

  return builder
}

describe('useCustomerActivities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSanitizeSupabaseError.mockReturnValue('Erreur lisible')
  })

  it('charge puis retourne les activités client avec les filtres attendus', async () => {
    const builder = createSupabaseBuilder({ data: ACTIVITIES, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(
      () =>
        useCustomerActivities('eta-1', {
          type: 'meeting',
          status: 'scheduled',
          limit: 10,
        }),
      { wrapper: createWrapper() },
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('customer_activities')
    expect(builder.select).toHaveBeenCalledWith(
      'id, etablissement_id, activity_type, title, description, activity_date, scheduled_date, completed_date, metadata, created_by, assigned_to, status, created_at, updated_at',
    )
    expect(builder.order).toHaveBeenCalledWith('activity_date', { ascending: false })
    expect(builder.eq).toHaveBeenCalledWith('etablissement_id', 'eta-1')
    expect(builder.eq).toHaveBeenCalledWith('activity_type', 'meeting')
    expect(builder.eq).toHaveBeenCalledWith('status', 'scheduled')
    expect(builder.limit).toHaveBeenCalledWith(10)

    expect(result.current.data).toEqual(ACTIVITIES)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].title).toBe('Quarterly review')
    expect(result.current.data?.[0].metadata.duration_minutes).toBe(45)
    expect(result.current.data?.[1].activity_type).toBe('call')
    expect(result.current.data?.[1].metadata.generated).toBe(true)
  })

  it('utilise la limite par défaut et remonte une erreur supabase', async () => {
    const builder = createSupabaseBuilder({
      data: null,
      error: { message: 'x' },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCustomerActivities('eta-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(builder.eq).toHaveBeenCalledWith('etablissement_id', 'eta-1')
    expect(builder.limit).toHaveBeenCalledWith(500)
    expect(result.current.error).toBeDefined()
    expect(result.current.error?.message).toBe('x')
  })

  it('ne lance pas la requête quand etablissementId est une chaîne vide', async () => {
    const { result } = renderHook(() => useCustomerActivities(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.isPending).toBe(true)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('useCreateActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSanitizeSupabaseError.mockReturnValue('Erreur lisible')
  })

  it('crée une activité, invalide le cache et affiche un toast de succès', async () => {
    const builder = createSupabaseBuilder({ data: CREATED_ACTIVITY, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCreateActivity(), {
      wrapper: createWrapper(),
    })

    const payload: Omit<CustomerActivity, 'id' | 'created_at' | 'updated_at'> = {
      etablissement_id: 'eta-1',
      activity_type: 'demo',
      title: 'Product demo',
      description: 'Demo for procurement team',
      activity_date: '2024-06-01T14:00:00.000Z',
      scheduled_date: '2024-06-01T14:00:00.000Z',
      completed_date: null,
      metadata: {
        notes: 'Focus on workflow automation',
        attendees: ['Chloe'],
      },
      created_by: 'user-1',
      assigned_to: 'user-3',
      status: 'scheduled',
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('customer_activities')
    expect(builder.insert).toHaveBeenCalledWith(payload)
    expect(builder.select).toHaveBeenCalledWith(
      'id, etablissement_id, activity_type, title, description, activity_date, scheduled_date, completed_date, metadata, created_by, assigned_to, status, created_at, updated_at',
    )
    expect(builder.single).toHaveBeenCalled()
    expect(result.current.data).toEqual(CREATED_ACTIVITY)
    expect(result.current.data?.id).toBe('act-3')
    expect(result.current.data?.activity_type).toBe('demo')
    expect(mockToastSuccess).toHaveBeenCalledWith('Activité créée')
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('gère l’erreur de création et affiche le message sanitizé', async () => {
    const builder = createSupabaseBuilder({
      data: null,
      error: { message: 'x' },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCreateActivity(), {
      wrapper: createWrapper(),
    })

    const payload: Omit<CustomerActivity, 'id' | 'created_at' | 'updated_at'> = {
      etablissement_id: 'eta-1',
      activity_type: 'meeting',
      title: 'Kickoff',
      description: null,
      activity_date: '2024-06-02T09:00:00.000Z',
      scheduled_date: null,
      completed_date: null,
      metadata: {
        notes: 'Initial sync',
      },
      created_by: 'user-1',
      assigned_to: null,
      status: 'scheduled',
    }

    await act(async () => {
      await expect(result.current.mutateAsync(payload)).rejects.toMatchObject({ message: 'x' })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(builder.insert).toHaveBeenCalledWith(payload)
    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'x' }),
    )
    expect(mockToastError).toHaveBeenCalledWith('Erreur lisible')
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })
})