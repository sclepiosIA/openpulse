const { USER, RESPONSES, mockFrom, toastSuccess, toastError, debugError } = vi.hoisted(() => {
  const USER = { id: 'u1', email: 't@t.co' }

  // FIFO response queue for supabase calls in tests
  const RESPONSES: Array<any> = []

  const mockFrom = vi.fn((table: string) => {
    const builder: any = {
      _table: table,
      _payload: undefined,
      _chain: [] as string[],
      select(arg?: any) {
        this._chain.push(`select:${String(arg ?? '')}`)
        return this
      },
      eq() {
        this._chain.push('eq')
        return this
      },
      gte() {
        this._chain.push('gte')
        return this
      },
      lte() {
        this._chain.push('lte')
        return this
      },
      order() {
        this._chain.push('order')
        return this
      },
      limit() {
        this._chain.push('limit')
        return this
      },
      insert(payload: any) {
        this._chain.push('insert')
        this._payload = payload
        return this
      },
      delete() {
        this._chain.push('delete')
        return this
      },
      single() {
        this._chain.push('single')
        return this
      },
      maybeSingle() {
        this._chain.push('maybeSingle')
        return this
      },
      then(onFulfilled: any, onRejected: any) {
        const res = RESPONSES.length ? RESPONSES.shift() : { data: [], error: null }
        return Promise.resolve(res).then(onFulfilled, onRejected)
      },
      catch(onRejected: any) {
        // allow chaining .catch without affecting then
        return Promise.resolve().catch(onRejected)
      },
    }
    return builder
  })

  const toastSuccess = vi.fn()
  const toastError = vi.fn()
  const debugError = vi.fn()

  return { USER, RESPONSES, mockFrom, toastSuccess, toastError, debugError }
})

vi.mock('@/integrations/supabase/client', () => {
  return { supabase: { from: mockFrom } }
})

vi.mock('@/components/AuthProvider', () => {
  return { useAuth: () => ({ user: USER }) }
})

vi.mock('sonner', () => {
  return { toast: { success: toastSuccess, error: toastError } }
})

vi.mock('@/lib/debug', () => {
  return { debug: { error: debugError } }
})

import { renderHook, act, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useEventReminders,
  useAddReminder,
  useAddMultipleReminders,
  useRemoveReminder,
  useUpdateEventReminders,
  usePendingReminders,
} from './useEventReminders'

describe('useEventReminders + mutations', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: any }) => any

  beforeEach(() => {
    // clear queued supabase responses
    RESPONSES.length = 0
    mockFrom.mockClear()
    toastSuccess.mockClear()
    toastError.mockClear()
    debugError.mockClear()

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    // spy on invalidateQueries to assert calls
    vi.spyOn(queryClient, 'invalidateQueries')
    wrapper = ({ children }: { children: any }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  })

  it('useEventReminders - loading -> success returns reminders for event and user', async () => {
    const now = new Date().toISOString()
    const reminder = {
      id: 'r1',
      event_id: 'e1',
      user_id: USER.id,
      minutes_before: 10,
      type: 'email',
      is_sent: false,
      sent_at: null,
      created_at: now,
    }
    RESPONSES.push({ data: [reminder], error: null })

    const { result } = renderHook(() => useEventReminders('e1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(Array.isArray(result.current.data)).toBe(true)
    expect(result.current.data.length).toBe(1)
    expect(result.current.data[0].id).toBe('r1')
    expect(mockFrom).toHaveBeenCalled()
    expect(mockFrom.mock.calls[0][0]).toBe('event_reminders')
    expect(result.current.isFetched).toBe(true)
  })

  it('useEventReminders - error from supabase results in query error state', async () => {
    RESPONSES.push({ data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useEventReminders('eX'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
    expect((result.current.error as any).message).toBe('boom')
    expect(mockFrom).toHaveBeenCalledWith('event_reminders')
  })

  it('useAddReminder - inserts reminder with user_id and triggers invalidations and toast', async () => {
    const input = { event_id: 'e2', minutes_before: 5, type: 'popup' }
    const returned = {
      id: 'nr1',
      event_id: 'e2',
      user_id: USER.id,
      minutes_before: 5,
      type: 'popup',
      is_sent: false,
      sent_at: null,
      created_at: new Date().toISOString(),
    }

    RESPONSES.push({ data: returned, error: null })

    const { result } = renderHook(() => useAddReminder(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(input)
    })

    const insertCall = mockFrom.mock.results.find((r: any) => r.value && r.value._payload !== undefined)
    expect(insertCall).toBeDefined()
    expect(insertCall.value._payload).toEqual({ ...input, user_id: USER.id })

    expect(toastSuccess).toHaveBeenCalledWith('Rappel ajouté')

    expect((queryClient.invalidateQueries as any).mock.calls.some((c: any) => {
      return c[0] && c[0].queryKey && Array.isArray(c[0].queryKey) && c[0].queryKey[0] === 'event-reminders' && c[0].queryKey[1] === 'e2'
    })).toBe(true)
    expect((queryClient.invalidateQueries as any).mock.calls.some((c: any) => {
      return c[0] && c[0].queryKey && Array.isArray(c[0].queryKey) && c[0].queryKey[0] === 'calendar-event' && c[0].queryKey[1] === 'e2'
    })).toBe(true)
  })

  it('useAddReminder - supabase error triggers toast.error and debug.error', async () => {
    const input = { event_id: 'e3', minutes_before: 2, type: 'email' }
    const supError = { message: 'insert failed' }
    RESPONSES.push({ data: null, error: supError })

    const { result } = renderHook(() => useAddReminder(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toBeDefined()
    })

    expect(toastError).toHaveBeenCalledWith("Erreur lors de l'ajout du rappel")
    expect(debugError).toHaveBeenCalled()
    const lastCall = debugError.mock.calls[0]
    expect(lastCall[0]).toBe('Add reminder error:')
    expect(lastCall[1]).toEqual(supError)
  })

  it('useAddMultipleReminders - inserts multiple and invalidates when non-empty', async () => {
    const inputs = [
      { event_id: 'e4', minutes_before: 15, type: 'popup' },
      { event_id: 'e4', minutes_before: 30, type: 'email' },
    ]
    const returned = inputs.map((inp, idx) => ({
      id: `m${idx + 1}`,
      event_id: inp.event_id,
      user_id: USER.id,
      minutes_before: inp.minutes_before,
      type: inp.type,
      is_sent: false,
      sent_at: null,
      created_at: new Date().toISOString(),
    }))

    RESPONSES.push({ data: returned, error: null })

    const { result } = renderHook(() => useAddMultipleReminders(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(inputs)
    })

    const insertCall = mockFrom.mock.results.find((r: any) => r.value && Array.isArray(r.value._payload))
    expect(insertCall).toBeDefined()
    expect(Array.isArray(insertCall.value._payload)).toBe(true)
    expect(insertCall.value._payload[0].user_id).toBe(USER.id)

    expect((queryClient.invalidateQueries as any).mock.calls.some((c: any) => {
      return c[0] && c[0].queryKey && c[0].queryKey[0] === 'event-reminders' && c[0].queryKey[1] === 'e4'
    })).toBe(true)
  })

  it('useRemoveReminder - calls delete and triggers invalidation and success toast', async () => {
    RESPONSES.push({ data: null, error: null })

    const { result } = renderHook(() => useRemoveReminder(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ id: 'del1', eventId: 'evDel' })
    })

    expect(mockFrom).toHaveBeenCalledWith('event_reminders')
    expect(toastSuccess).toHaveBeenCalledWith('Rappel supprimé')

    expect((queryClient.invalidateQueries as any).mock.calls.some((c: any) => {
      return c[0] && c[0].queryKey && c[0].queryKey[0] === 'event-reminders' && c[0].queryKey[1] === 'evDel'
    })).toBe(true)
  })

  it('useUpdateEventReminders - deletes existing then inserts new reminders and invalidates', async () => {
    RESPONSES.push({ data: null, error: null })
    const returned = [
      {
        id: 'u1',
        event_id: 'eUpd',
        user_id: USER.id,
        minutes_before: 10,
        type: 'popup',
        is_sent: false,
        sent_at: null,
        created_at: new Date().toISOString(),
      },
    ]
    RESPONSES.push({ data: returned, error: null })

    const { result } = renderHook(() => useUpdateEventReminders(), { wrapper })

    const newReminders = [{ minutes_before: 10, type: 'popup' }]

    await act(async () => {
      await result.current.mutateAsync({ eventId: 'eUpd', reminders: newReminders })
    })

    expect(mockFrom.mock.calls.length).toBeGreaterThanOrEqual(2)
    const insertCall = mockFrom.mock.results.find((r: any) => r.value && Array.isArray(r.value._payload))
    expect(insertCall).toBeDefined()
    expect(insertCall.value._payload[0].user_id).toBe(USER.id)
    expect(insertCall.value._payload[0].event_id).toBe('eUpd')

    expect((queryClient.invalidateQueries as any).mock.calls.some((c: any) => {
      return c[0] && c[0].queryKey && c[0].queryKey[0] === 'event-reminders' && c[0].queryKey[1] === 'eUpd'
    })).toBe(true)
  })

  it('usePendingReminders - filters reminders to those occurring within next hour', async () => {
    const now = Date.now()
    const minutesBefore = 20
    const eventStart = new Date(now + 30 * 60 * 1000).toISOString()
    const included = {
      id: 'p1',
      event_id: 'pe1',
      user_id: USER.id,
      minutes_before: minutesBefore,
      type: 'popup',
      is_sent: false,
      sent_at: null,
      created_at: new Date().toISOString(),
      event: {
        id: 'pe1',
        title: 'Soon event',
        start_time: eventStart,
        location: null,
      },
    }
    const excluded = {
      id: 'p2',
      event_id: 'pe2',
      user_id: USER.id,
      minutes_before: 5,
      type: 'email',
      is_sent: false,
      sent_at: null,
      created_at: new Date().toISOString(),
      event: {
        id: 'pe2',
        title: 'No time',
        start_time: null,
        location: null,
      },
    }

    RESPONSES.push({ data: [included, excluded], error: null })

    const { result } = renderHook(() => usePendingReminders(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(Array.isArray(result.current.data)).toBe(true)
    expect(result.current.data.length).toBe(1)
    expect(result.current.data[0].id).toBe('p1')
  })
})