// @vitest-environment jsdom
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  useCalendarEvents,
  useCalendarEvent,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useMoveEvent,
  useResizeEvent,
  useDeleteOccurrence,
  useDuplicateEvent,
} from './useCalendarEvents'

const {
  AUTH_STATE,
  QUERY_PRESETS,
  TOAST_SUCCESS,
  TOAST_ERROR,
  DEBUG_ERROR,
  EXPANDED_RECURRING,
  RAW_EVENTS,
  SINGLE_EVENT,
  CREATED_EVENT,
  UPDATED_EVENT,
  MOVED_EVENT,
  RESIZED_EVENT,
  PARENT_EVENT,
  ORIGINAL_EVENT,
  DUPLICATED_EVENT,
  mockFrom,
  mockExpandRecurringEvent,
  mockUseAuth,
  mockInvalidateQueries,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const QUERY_PRESETS = {
    frequent: { staleTime: 0, refetchOnWindowFocus: false as const },
  }

  const TOAST_SUCCESS = vi.fn()
  const TOAST_ERROR = vi.fn()
  const DEBUG_ERROR = vi.fn()
  const mockFrom = vi.fn()
  const mockExpandRecurringEvent = vi.fn()
  const mockUseAuth = vi.fn(() => AUTH_STATE)
  const mockInvalidateQueries = vi.fn()

  const RAW_EVENTS = [
    {
      id: 'ev-1',
      calendar_id: 'cal-1',
      title: 'Team sync',
      description: 'Weekly sync',
      location: 'Room A',
      video_conference_url: null,
      start_time: '2024-01-10T09:00:00.000Z',
      end_time: '2024-01-10T10:00:00.000Z',
      all_day: false,
      status: 'confirmed',
      visibility: 'public',
      recurrence_rule: null,
      recurrence_parent_id: null,
      recurrence_exception_dates: [],
      etablissement_id: null,
      tache_id: null,
      color: '#111111',
      display_as_banner: false,
      availability: 'busy',
      created_by: 'u1',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      calendar: { id: 'cal-1', name: 'Main', color: '#111111', type: 'personal' },
    },
    {
      id: 'ev-rec',
      calendar_id: 'cal-2',
      title: 'Yoga',
      description: null,
      location: null,
      video_conference_url: null,
      start_time: '2024-01-01T08:00:00.000Z',
      end_time: '2024-01-01T09:00:00.000Z',
      all_day: false,
      status: 'confirmed',
      visibility: 'private',
      recurrence_rule: 'FREQ=DAILY;COUNT=3',
      recurrence_parent_id: null,
      recurrence_exception_dates: [],
      etablissement_id: null,
      tache_id: null,
      color: '#222222',
      display_as_banner: false,
      availability: 'busy',
      created_by: 'u1',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      calendar: { id: 'cal-2', name: 'Wellness', color: '#222222', type: 'shared' },
    },
  ]

  const EXPANDED_RECURRING = [
    {
      ...RAW_EVENTS[1],
      id: 'ev-rec-occ-1',
      start_time: '2024-01-11T08:00:00.000Z',
      end_time: '2024-01-11T09:00:00.000Z',
    },
    {
      ...RAW_EVENTS[1],
      id: 'ev-rec-occ-2',
      start_time: '2024-01-11T08:00:00.000Z',
      end_time: '2024-01-11T09:00:00.000Z',
    },
    {
      ...RAW_EVENTS[1],
      id: 'ev-rec-occ-3',
      start_time: '2024-01-12T08:00:00.000Z',
      end_time: '2024-01-12T09:00:00.000Z',
    },
    {
      ...RAW_EVENTS[1],
      id: 'ev-rec-outside',
      start_time: '2024-02-01T08:00:00.000Z',
      end_time: '2024-02-01T09:00:00.000Z',
    },
  ]

  const SINGLE_EVENT = { ...RAW_EVENTS[0] }
  const CREATED_EVENT = { ...RAW_EVENTS[0], id: 'created-1', title: 'Created event' }
  const UPDATED_EVENT = { ...RAW_EVENTS[0], id: 'ev-1', title: 'Updated title' }
  const MOVED_EVENT = {
    ...RAW_EVENTS[0],
    id: 'ev-1',
    start_time: '2024-01-15T11:00:00.000Z',
    end_time: '2024-01-15T12:00:00.000Z',
  }
  const RESIZED_EVENT = {
    ...RAW_EVENTS[0],
    id: 'ev-1',
    end_time: '2024-01-10T10:30:00.000Z',
  }
  const PARENT_EVENT = { recurrence_exception_dates: ['2024-01-05'] }
  const ORIGINAL_EVENT = {
    calendar_id: 'cal-1',
    title: 'Source event',
    description: 'desc',
    location: 'Room B',
    video_conference_url: null,
    start_time: '2024-01-20T09:00:00.000Z',
    end_time: '2024-01-20T10:00:00.000Z',
    all_day: false,
    status: 'confirmed',
    visibility: 'public',
    recurrence_rule: null,
    etablissement_id: null,
    tache_id: null,
    color: '#333333',
  }
  const DUPLICATED_EVENT = {
    ...RAW_EVENTS[0],
    id: 'dup-1',
    title: 'Source event (copie)',
    created_by: 'u1',
  }

  return {
    AUTH_STATE,
    QUERY_PRESETS,
    TOAST_SUCCESS,
    TOAST_ERROR,
    DEBUG_ERROR,
    EXPANDED_RECURRING,
    RAW_EVENTS,
    SINGLE_EVENT,
    CREATED_EVENT,
    UPDATED_EVENT,
    MOVED_EVENT,
    RESIZED_EVENT,
    PARENT_EVENT,
    ORIGINAL_EVENT,
    DUPLICATED_EVENT,
    mockFrom,
    mockExpandRecurringEvent,
    mockUseAuth,
    mockInvalidateQueries,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: DEBUG_ERROR,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('sonner', () => ({
  toast: {
    success: TOAST_SUCCESS,
    error: TOAST_ERROR,
  },
}))

vi.mock('@/lib/recurrenceUtils', () => ({
  expandRecurringEvent: mockExpandRecurringEvent,
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: QUERY_PRESETS,
}))

function createBuilder(config?: {
  data?: unknown
  error?: { message: string } | null
  singleData?: unknown
  singleError?: { message: string } | null
  maybeSingleData?: unknown
  maybeSingleError?: { message: string } | null
}) {
  const state = {
    data: config?.data ?? null,
    error: config?.error ?? null,
    singleData: config?.singleData ?? config?.data ?? null,
    singleError: config?.singleError ?? config?.error ?? null,
    maybeSingleData: config?.maybeSingleData ?? config?.data ?? null,
    maybeSingleError: config?.maybeSingleError ?? config?.error ?? null,
  }

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(async () => ({ data: state.data, error: state.error })),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: state.singleData, error: state.singleError })),
    maybeSingle: vi.fn(async () => ({ data: state.maybeSingleData, error: state.maybeSingleError })),
    then: (
      onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve({ data: state.data, error: state.error }).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: state.data, error: state.error }).catch(onRejected),
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

  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(mockInvalidateQueries)

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return {
    queryClient,
    wrapper,
  }
}

describe('useCalendarEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(AUTH_STATE)
  })

  it('charge les événements, applique les filtres date/calendriers, étend les récurrences et conserve les ids distincts', async () => {
    const builder = createBuilder({ data: RAW_EVENTS })
    mockFrom.mockReturnValue(builder)
    mockExpandRecurringEvent.mockImplementation((event: { id: string }) =>
      event.id === 'ev-rec' ? EXPANDED_RECURRING : [event]
    )

    const { wrapper } = createWrapper()
    const startDate = new Date('2024-01-10T00:00:00.000Z')
    const endDate = new Date('2024-01-12T23:59:59.000Z')

    const { result } = renderHook(
      () => useCalendarEvents({ calendarIds: ['cal-2', 'cal-1'], startDate, endDate }),
      { wrapper }
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('calendar_events')
    expect(builder.select).toHaveBeenCalled()
    expect(builder.in).toHaveBeenCalledWith('calendar_id', ['cal-2', 'cal-1'])
    expect(builder.neq).toHaveBeenCalledWith('status', 'cancelled')
    expect(builder.gte).toHaveBeenCalledWith('end_time', '2023-01-10T00:00:00.000Z')
    expect(builder.lte).toHaveBeenCalledWith('start_time', '2024-01-12T23:59:59.000Z')
    expect(builder.order).toHaveBeenCalledWith('start_time')
    expect(builder.limit).toHaveBeenCalledWith(1000)
    expect(mockExpandRecurringEvent).toHaveBeenCalledTimes(1)
    expect(mockExpandRecurringEvent).toHaveBeenCalledWith(RAW_EVENTS[1], startDate, endDate)

    expect(result.current.data).toEqual([
      RAW_EVENTS[0],
      EXPANDED_RECURRING[0],
      EXPANDED_RECURRING[1],
      EXPANDED_RECURRING[2],
    ])
    expect(result.current.data?.map((event) => event.title)).toEqual(['Team sync', 'Yoga', 'Yoga', 'Yoga'])
    expect(result.current.data?.map((event) => event.start_time)).toEqual([
      '2024-01-10T09:00:00.000Z',
      '2024-01-11T08:00:00.000Z',
      '2024-01-11T08:00:00.000Z',
      '2024-01-12T08:00:00.000Z',
    ])
  })

  it('remonte une erreur quand la requête échoue', async () => {
    const builder = createBuilder({ data: null, error: { message: 'x' } })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCalendarEvents(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('x')
  })
})

describe('useCalendarEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('récupère un événement par id avec maybeSingle', async () => {
    const builder = createBuilder({ maybeSingleData: SINGLE_EVENT })
    mockFrom.mockReturnValue(builder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useCalendarEvent('ev-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('id', 'ev-1')
    expect(builder.maybeSingle).toHaveBeenCalled()
    expect(result.current.data).toEqual(SINGLE_EVENT)
    expect(result.current.data?.title).toBe('Team sync')
  })

  it('passe en erreur si maybeSingle renvoie une erreur', async () => {
    const builder = createBuilder({ maybeSingleData: null, maybeSingleError: { message: 'x' } })
    mockFrom.mockReturnValue(builder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useCalendarEvent('ev-1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('x')
  })
})

describe('useCreateEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(AUTH_STATE)
  })

  it('crée un événement avec created_by puis invalide et affiche un toast', async () => {
    const builder = createBuilder({ singleData: CREATED_EVENT })
    mockFrom.mockReturnValue(builder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useCreateEvent(), { wrapper })

    const input = {
      calendar_id: 'cal-1',
      title: 'Created event',
      description: 'desc',
      location: 'Room C',
      video_conference_url: null,
      start_time: '2024-01-21T09:00:00.000Z',
      end_time: '2024-01-21T10:00:00.000Z',
      all_day: false,
      status: 'confirmed',
      visibility: 'public',
      recurrence_rule: null,
      etablissement_id: null,
      tache_id: null,
      color: '#444444',
      display_as_banner: true,
      availability: 'free',
    }

    await act(async () => {
      await result.current.mutateAsync(input)
    })

    expect(builder.insert).toHaveBeenCalledWith({
      ...input,
      created_by: 'u1',
    })
    expect(builder.single).toHaveBeenCalled()
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['calendar-events'],
      refetchType: 'all',
    })
    expect(TOAST_SUCCESS).toHaveBeenCalledWith('Événement créé')
  })

  it('passe en erreur et loggue si la création échoue', async () => {
    const builder = createBuilder({ singleData: null, singleError: { message: 'x' } })
    mockFrom.mockReturnValue(builder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useCreateEvent(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          calendar_id: 'cal-1',
          title: 'Broken',
          description: null,
          location: null,
          video_conference_url: null,
          start_time: '2024-01-21T09:00:00.000Z',
          end_time: '2024-01-21T10:00:00.000Z',
          all_day: false,
          status: 'confirmed',
          visibility: 'public',
          recurrence_rule: null,
          etablissement_id: null,
          tache_id: null,
          color: null,
        })
      ).rejects.toMatchObject({ message: 'x' })
    })

    expect(TOAST_ERROR).toHaveBeenCalledWith('Erreur lors de la création')
    expect(DEBUG_ERROR).toHaveBeenCalledWith('Create event error:', expect.objectContaining({ message: 'x' }))
  })
})

describe('useUpdateEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('met à jour un événement et invalide les bonnes clés', async () => {
    const builder = createBuilder({ singleData: UPDATED_EVENT })
    mockFrom.mockReturnValue(builder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useUpdateEvent(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ id: 'ev-1', title: 'Updated title' })
    })

    expect(builder.update).toHaveBeenCalledWith({ title: 'Updated title' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'ev-1')
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['calendar-events'],
      refetchType: 'all',
    })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['calendar-event', 'ev-1'],
    })
    expect(TOAST_SUCCESS).toHaveBeenCalledWith('Événement mis à jour')
  })

  it('passe en erreur si la mise à jour échoue', async () => {
    const builder = createBuilder({ singleData: null, singleError: { message: 'x' } })
    mockFrom.mockReturnValue(builder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useUpdateEvent(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'ev-1', title: 'Nope' })).rejects.toMatchObject({
        message: 'x',
      })
    })

    expect(TOAST_ERROR).toHaveBeenCalledWith('Erreur lors de la mise à jour')
    expect(DEBUG_ERROR).toHaveBeenCalledWith('Update event error:', expect.objectContaining({ message: 'x' }))
  })
})

describe('useDeleteEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('supprime un événement puis invalide et toast', async () => {
    const builder = createBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDeleteEvent(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('ev-1')
    })

    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'ev-1')
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['calendar-events'],
      refetchType: 'all',
    })
    expect(TOAST_SUCCESS).toHaveBeenCalledWith('Événement supprimé')
  })

  it('passe en erreur si la suppression échoue', async () => {
    const builder = createBuilder({ data: null, error: { message: 'x' } })
    mockFrom.mockReturnValue(builder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDeleteEvent(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync('ev-1')).rejects.toMatchObject({ message: 'x' })
    })

    expect(TOAST_ERROR).toHaveBeenCalledWith('Erreur lors de la suppression')
    expect(DEBUG_ERROR).toHaveBeenCalledWith('Delete event error:', expect.objectContaining({ message: 'x' }))
  })
})

describe('useMoveEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('déplace un événement en mettant à jour start_time et end_time', async () => {
    const builder = createBuilder({ singleData: MOVED_EVENT })
    mockFrom.mockReturnValue(builder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useMoveEvent(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'ev-1',
        start_time: '2024-01-15T11:00:00.000Z',
        end_time: '2024-01-15T12:00:00.000Z',
      })
    })

    expect(builder.update).toHaveBeenCalledWith({
      start_time: '2024-01-15T11:00:00.000Z',
      end_time: '2024-01-15T12:00:00.000Z',
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 'ev-1')
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendar-events'] })
  })

  it('passe en erreur si le déplacement échoue', async () => {
    const builder = createBuilder({ singleData: null, singleError: { message: 'x' } })
    mockFrom.mockReturnValue(builder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useMoveEvent(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'ev-1',
          start_time: '2024-01-15T11:00:00.000Z',
          end_time: '2024-01-15T12:00:00.000Z',
        })
      ).rejects.toMatchObject({ message: 'x' })
    })
  })
})

describe('useResizeEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redimensionne un événement en mettant à jour end_time', async () => {
    const builder = createBuilder({ singleData: RESIZED_EVENT })
    mockFrom.mockReturnValue(builder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useResizeEvent(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'ev-1',
        end_time: '2024-01-10T10:30:00.000Z',
      })
    })

    expect(builder.update).toHaveBeenCalledWith({
      end_time: '2024-01-10T10:30:00.000Z',
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 'ev-1')
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendar-events'] })
  })

  it('passe en erreur si le redimensionnement échoue', async () => {
    const builder = createBuilder({ singleData: null, singleError: { message: 'x' } })
    mockFrom.mockReturnValue(builder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useResizeEvent(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'ev-1',
          end_time: '2024-01-10T10:30:00.000Z',
        })
      ).rejects.toMatchObject({ message: 'x' })
    })
  })
})

describe('useDeleteOccurrence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("ajoute la date d'occurrence aux exceptions puis invalide", async () => {
    const fetchBuilder = createBuilder({ maybeSingleData: PARENT_EVENT })
    const updateBuilder = createBuilder({ data: null, error: null })
    mockFrom.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDeleteOccurrence(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        parentId: 'ev-rec',
        occurrenceDate: '2024-01-11',
      })
    })

    expect(fetchBuilder.eq).toHaveBeenCalledWith('id', 'ev-rec')
    expect(updateBuilder.update).toHaveBeenCalledWith({
      recurrence_exception_dates: ['2024-01-05', '2024-01-11'],
    })
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'ev-rec')
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendar-events'] })
    expect(TOAST_SUCCESS).toHaveBeenCalledWith('Occurrence supprimée')
  })

  it('passe en erreur si le parent est introuvable', async () => {
    const fetchBuilder = createBuilder({ maybeSingleData: null })
    mockFrom.mockReturnValue(fetchBuilder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDeleteOccurrence(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          parentId: 'missing',
          occurrenceDate: '2024-01-11',
        })
      ).rejects.toThrow('Événement parent introuvable')
    })

    expect(TOAST_ERROR).toHaveBeenCalledWith("Erreur lors de la suppression de l'occurrence")
    expect(DEBUG_ERROR).toHaveBeenCalledWith('Delete occurrence error:', expect.any(Error))
  })
})

describe('useDuplicateEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(AUTH_STATE)
  })

  it('duplique un événement en suffixant le titre et en ajoutant created_by', async () => {
    const fetchBuilder = createBuilder({ maybeSingleData: ORIGINAL_EVENT })
    const insertBuilder = createBuilder({ singleData: DUPLICATED_EVENT })
    mockFrom.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(insertBuilder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDuplicateEvent(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('source-1')
    })

    expect(fetchBuilder.eq).toHaveBeenCalledWith('id', 'source-1')
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      calendar_id: 'cal-1',
      title: 'Source event (copie)',
      description: 'desc',
      location: 'Room B',
      video_conference_url: null,
      start_time: '2024-01-20T09:00:00.000Z',
      end_time: '2024-01-20T10:00:00.000Z',
      all_day: false,
      status: 'confirmed',
      visibility: 'public',
      recurrence_rule: null,
      etablissement_id: null,
      tache_id: null,
      color: '#333333',
      created_by: 'u1',
    })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendar-events'] })
    expect(TOAST_SUCCESS).toHaveBeenCalledWith('Événement dupliqué')
  })

  it('passe en erreur si la duplication échoue', async () => {
    const fetchBuilder = createBuilder({ maybeSingleData: ORIGINAL_EVENT })
    const insertBuilder = createBuilder({ singleData: null, singleError: { message: 'x' } })
    mockFrom.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(insertBuilder)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDuplicateEvent(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync('source-1')).rejects.toMatchObject({ message: 'x' })
    })

    expect(TOAST_ERROR).toHaveBeenCalledWith('Erreur lors de la duplication')
    expect(DEBUG_ERROR).toHaveBeenCalledWith('Duplicate event error:', expect.objectContaining({ message: 'x' }))
  })
})