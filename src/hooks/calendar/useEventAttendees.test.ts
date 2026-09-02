// @vitest-environment jsdom
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  useEventAttendees,
  useAddAttendee,
  useAddMultipleAttendees,
  useUpdateAttendee,
  useRespondToInvitation,
  useRemoveAttendee,
  useMyInvitations,
} from './useEventAttendees'

const {
  AUTH_STATE,
  toastSuccess,
  toastError,
  debugError,
  mockFrom,
  ATTENDEES,
  INSERTED_ATTENDEE,
  INSERTED_ATTENDEES,
  UPDATED_ATTENDEE,
  RESPONDED_ATTENDEE,
  INVITATIONS,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'u1@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  debugError: vi.fn(),
  mockFrom: vi.fn(),
  ATTENDEES: [
    {
      id: 'a1',
      event_id: 'e1',
      email: 'one@t.co',
      display_name: 'Alice',
      role: 'host',
      status: 'accepted',
      user_id: 'u1',
      responded_at: '2024-01-01T10:00:00.000Z',
      created_at: '2024-01-01T09:00:00.000Z',
    },
    {
      id: 'a2',
      event_id: 'e1',
      email: 'two@t.co',
      display_name: 'Bob',
      role: 'guest',
      status: 'pending',
      user_id: 'u2',
      responded_at: null,
      created_at: '2024-01-01T09:05:00.000Z',
    },
  ],
  INSERTED_ATTENDEE: {
    id: 'a3',
    event_id: 'e1',
    email: 'new@t.co',
    display_name: 'Charlie',
    role: 'guest',
    status: 'pending',
    user_id: 'u3',
    responded_at: null,
    created_at: '2024-01-01T11:00:00.000Z',
  },
  INSERTED_ATTENDEES: [
    {
      id: 'a4',
      event_id: 'e2',
      email: 'x@t.co',
      display_name: 'X',
      role: 'guest',
      status: 'pending',
      user_id: 'u4',
      responded_at: null,
      created_at: '2024-01-01T11:10:00.000Z',
    },
    {
      id: 'a5',
      event_id: 'e2',
      email: 'y@t.co',
      display_name: 'Y',
      role: 'guest',
      status: 'pending',
      user_id: 'u5',
      responded_at: null,
      created_at: '2024-01-01T11:11:00.000Z',
    },
  ],
  UPDATED_ATTENDEE: {
    id: 'a1',
    event_id: 'e1',
    email: 'one@t.co',
    display_name: 'Alice Updated',
    role: 'host',
    status: 'accepted',
    user_id: 'u1',
    responded_at: '2024-01-02T10:00:00.000Z',
    created_at: '2024-01-01T09:00:00.000Z',
  },
  RESPONDED_ATTENDEE: {
    id: 'a1',
    event_id: 'e1',
    email: 'one@t.co',
    display_name: 'Alice',
    role: 'host',
    status: 'accepted',
    user_id: 'u1',
    responded_at: '2024-01-03T10:00:00.000Z',
    created_at: '2024-01-01T09:00:00.000Z',
  },
  INVITATIONS: [
    {
      id: 'a6',
      event_id: 'e3',
      email: 'u1@t.co',
      display_name: 'Alice',
      role: 'guest',
      status: 'pending',
      user_id: 'u1',
      responded_at: null,
      created_at: '2024-01-04T09:00:00.000Z',
      event: {
        id: 'e3',
        title: 'Planning',
        calendar: { id: 'c1', name: 'Work' },
      },
    },
  ],
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}))

type QueueItem = {
  data?: unknown
  error?: { message: string } | null
}

const queryQueue: QueueItem[] = []
const builderState = {
  table: '',
  insertArg: undefined as unknown,
  updateArg: undefined as unknown,
  deleteCalled: false,
  selectArg: undefined as unknown,
  eqArgs: [] as Array<[string, unknown]>,
  orderArgs: [] as Array<[string, unknown?]>,
}

function resetBuilderState() {
  builderState.table = ''
  builderState.insertArg = undefined
  builderState.updateArg = undefined
  builderState.deleteCalled = false
  builderState.selectArg = undefined
  builderState.eqArgs = []
  builderState.orderArgs = []
}

function enqueueResponse(item: QueueItem) {
  queryQueue.push(item)
}

function shiftResponse(): QueueItem {
  const next = queryQueue.shift()
  return next ?? { data: null, error: null }
}

function createBuilder() {
  const builder = {
    select: vi.fn((arg?: unknown) => {
      builderState.selectArg = arg
      return builder
    }),
    eq: vi.fn((column: string, value: unknown) => {
      builderState.eqArgs.push([column, value])
      return builder
    }),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn((column: string, options?: unknown) => {
      builderState.orderArgs.push([column, options])
      return builder
    }),
    limit: vi.fn(() => builder),
    insert: vi.fn((arg: unknown) => {
      builderState.insertArg = arg
      return builder
    }),
    update: vi.fn((arg: unknown) => {
      builderState.updateArg = arg
      return builder
    }),
    delete: vi.fn(() => {
      builderState.deleteCalled = true
      return builder
    }),
    single: vi.fn(async () => shiftResponse()),
    maybeSingle: vi.fn(async () => shiftResponse()),
    then: (
      onFulfilled: (value: QueueItem) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(shiftResponse()).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(shiftResponse()).catch(onRejected),
  }
  return builder
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

function createWrapper(client: QueryClient) {
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, props.children)
  }
}

describe('useEventAttendees hooks', () => {
  beforeEach(() => {
    queryQueue.length = 0
    resetBuilderState()
    mockFrom.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    debugError.mockReset()
    AUTH_STATE.user = { id: 'u1', email: 'u1@t.co' }
    AUTH_STATE.session = { user: { id: 'u1' } }
    AUTH_STATE.isLoading = false
    mockFrom.mockImplementation((table: string) => {
      builderState.table = table
      return createBuilder()
    })
  })

  it('useEventAttendees charge puis retourne les participants triés pour un event', async () => {
    enqueueResponse({ data: ATTENDEES, error: null })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })

    const { result } = renderHook(() => useEventAttendees('e1'), {
      wrapper: createWrapper(client),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('event_attendees')
    expect(builderState.table).toBe('event_attendees')
    expect(builderState.eqArgs).toContainEqual(['event_id', 'e1'])
    expect(builderState.orderArgs).toEqual([['role', undefined], ['display_name', undefined]])
    expect(result.current.data).toEqual(ATTENDEES)
    expect(result.current.data?.[0].display_name).toBe('Alice')
    expect(result.current.data?.[1].status).toBe('pending')
  })

  it('useEventAttendees ne lance pas la query quand eventId est undefined', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })

    const { result } = renderHook(() => useEventAttendees(undefined), {
      wrapper: createWrapper(client),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.isLoading).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('useEventAttendees passe en erreur si supabase renvoie une erreur', async () => {
    enqueueResponse({ data: null, error: { message: 'load failed' } })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })

    const { result } = renderHook(() => useEventAttendees('e1'), {
      wrapper: createWrapper(client),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('load failed')
  })

  it('useAddAttendee insère un participant, invalide les queries et affiche un toast de succès', async () => {
    enqueueResponse({ data: INSERTED_ATTENDEE, error: null })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries')

    const input = {
      event_id: 'e1',
      email: 'new@t.co',
      display_name: 'Charlie',
      role: 'guest',
      status: 'pending',
      user_id: 'u3',
    }

    const { result } = renderHook(() => useAddAttendee(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync(input)
    })

    expect(builderState.table).toBe('event_attendees')
    expect(builderState.insertArg).toEqual(input)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['event-attendees', 'e1'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendar-event', 'e1'] })
    expect(toastSuccess).toHaveBeenCalledWith('Participant ajouté')
  })

  it('useAddAttendee gère une erreur avec toast et debug', async () => {
    enqueueResponse({ data: null, error: { message: 'insert failed' } })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })

    const { result } = renderHook(() => useAddAttendee(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          event_id: 'e1',
          email: 'new@t.co',
          display_name: 'Charlie',
          role: 'guest',
          status: 'pending',
          user_id: 'u3',
        })
      ).rejects.toMatchObject({ message: 'insert failed' })
    })

    expect(toastError).toHaveBeenCalledWith("Erreur lors de l'ajout du participant")
    expect(debugError).toHaveBeenCalledWith(
      'Add attendee error:',
      expect.objectContaining({ message: 'insert failed' })
    )
  })

  it('useAddMultipleAttendees insère plusieurs participants et invalide avec le premier event_id', async () => {
    enqueueResponse({ data: INSERTED_ATTENDEES, error: null })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries')

    const inputs = [
      {
        event_id: 'e2',
        email: 'x@t.co',
        display_name: 'X',
        role: 'guest',
        status: 'pending',
        user_id: 'u4',
      },
      {
        event_id: 'e2',
        email: 'y@t.co',
        display_name: 'Y',
        role: 'guest',
        status: 'pending',
        user_id: 'u5',
      },
    ]

    const { result } = renderHook(() => useAddMultipleAttendees(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      const data = await result.current.mutateAsync(inputs)
      expect(data).toEqual(INSERTED_ATTENDEES)
    })

    expect(builderState.insertArg).toEqual(inputs)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['event-attendees', 'e2'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendar-event', 'e2'] })
    expect(toastSuccess).toHaveBeenCalledWith('2 participant(s) ajouté(s)')
  })

  it('useAddMultipleAttendees retourne [] immédiatement si la liste est vide', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })

    const { result } = renderHook(() => useAddMultipleAttendees(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      const data = await result.current.mutateAsync([])
      expect(data).toEqual([])
    })

    expect(mockFrom).not.toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('0 participant(s) ajouté(s)')
  })

  it('useAddMultipleAttendees log l’erreur sans toast', async () => {
    enqueueResponse({ data: null, error: { message: 'bulk failed' } })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })

    const { result } = renderHook(() => useAddMultipleAttendees(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync([
          {
            event_id: 'e2',
            email: 'x@t.co',
            display_name: 'X',
            role: 'guest',
            status: 'pending',
            user_id: 'u4',
          },
        ])
      ).rejects.toMatchObject({ message: 'bulk failed' })
    })

    expect(toastError).not.toHaveBeenCalled()
    expect(debugError).toHaveBeenCalledWith(
      'Add attendees error:',
      expect.objectContaining({ message: 'bulk failed' })
    )
  })

  it('useUpdateAttendee ajoute responded_at quand status est fourni puis invalide', async () => {
    enqueueResponse({ data: UPDATED_ATTENDEE, error: null })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateAttendee(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'a1',
        eventId: 'e1',
        display_name: 'Alice Updated',
        status: 'accepted',
      })
    })

    expect(builderState.updateArg).toEqual(
      expect.objectContaining({
        display_name: 'Alice Updated',
        status: 'accepted',
        responded_at: expect.any(String),
      })
    )
    expect(builderState.eqArgs).toContainEqual(['id', 'a1'])
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['event-attendees', 'e1'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendar-event', 'e1'] })
  })

  it('useRespondToInvitation met à jour la réponse de l’utilisateur connecté et affiche le bon toast', async () => {
    enqueueResponse({ data: RESPONDED_ATTENDEE, error: null })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useRespondToInvitation(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync({
        eventId: 'e1',
        status: 'accepted',
      })
    })

    expect(builderState.updateArg).toEqual(
      expect.objectContaining({
        status: 'accepted',
        responded_at: expect.any(String),
      })
    )
    expect(builderState.eqArgs).toContainEqual(['event_id', 'e1'])
    expect(builderState.eqArgs).toContainEqual(['user_id', 'u1'])
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['event-attendees', 'e1'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendar-event', 'e1'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendar-events'] })
    expect(toastSuccess).toHaveBeenCalledWith('Invitation acceptée')
  })

  it('useRespondToInvitation échoue si non authentifié', async () => {
    AUTH_STATE.user = null
    AUTH_STATE.session = null

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })

    const { result } = renderHook(() => useRespondToInvitation(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          eventId: 'e1',
          status: 'declined',
        })
      ).rejects.toThrow('Non authentifié')
    })

    expect(mockFrom).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la réponse')
    expect(debugError).toHaveBeenCalledWith(
      'Respond to invitation error:',
      expect.objectContaining({ message: 'Non authentifié' })
    )
  })

  it('useRespondToInvitation échoue si aucune invitation trouvée', async () => {
    enqueueResponse({ data: null, error: null })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })

    const { result } = renderHook(() => useRespondToInvitation(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          eventId: 'e1',
          status: 'declined',
        })
      ).rejects.toThrow('Invitation introuvable')
    })

    expect(toastError).toHaveBeenCalledWith('Erreur lors de la réponse')
  })

  it('useRemoveAttendee supprime un participant et invalide les queries', async () => {
    enqueueResponse({ data: null, error: null })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useRemoveAttendee(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync({ id: 'a2', eventId: 'e1' })
    })

    expect(builderState.deleteCalled).toBe(true)
    expect(builderState.eqArgs).toContainEqual(['id', 'a2'])
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['event-attendees', 'e1'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendar-event', 'e1'] })
    expect(toastSuccess).toHaveBeenCalledWith('Participant retiré')
  })

  it('useRemoveAttendee gère une erreur avec toast et debug', async () => {
    enqueueResponse({ data: null, error: { message: 'delete failed' } })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })

    const { result } = renderHook(() => useRemoveAttendee(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'a2', eventId: 'e1' })).rejects.toMatchObject({
        message: 'delete failed',
      })
    })

    expect(toastError).toHaveBeenCalledWith('Erreur lors de la suppression')
    expect(debugError).toHaveBeenCalledWith(
      'Remove attendee error:',
      expect.objectContaining({ message: 'delete failed' })
    )
  })

  it('useMyInvitations charge les invitations pending de l’utilisateur connecté', async () => {
    enqueueResponse({ data: INVITATIONS, error: null })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })

    const { result } = renderHook(() => useMyInvitations(), {
      wrapper: createWrapper(client),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(builderState.eqArgs).toContainEqual(['user_id', 'u1'])
    expect(builderState.eqArgs).toContainEqual(['status', 'pending'])
    expect(builderState.orderArgs).toEqual([['created_at', { ascending: false }]])
    expect(result.current.data).toEqual(INVITATIONS)
    expect(result.current.data?.[0].event.title).toBe('Planning')
  })

  it('useMyInvitations retourne [] si aucun utilisateur connecté', async () => {
    AUTH_STATE.user = null
    AUTH_STATE.session = null

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })

    const { result } = renderHook(() => useMyInvitations(), {
      wrapper: createWrapper(client),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('useMyInvitations passe en erreur si supabase renvoie une erreur', async () => {
    enqueueResponse({ data: null, error: { message: 'invites failed' } })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })

    const { result } = renderHook(() => useMyInvitations(), {
      wrapper: createWrapper(client),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('invites failed')
  })
})