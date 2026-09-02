import * as offlineOutbox from './offlineOutbox'

const {
  invokeResponse,
  getUserResponse,
  builderState,
  mockInvoke,
  mockGetUser,
  mockFrom,
  mockInsert,
  mockGet,
  mockSet,
  mockDel,
  mockKeys,
  stores,
} = vi.hoisted(() => {
  const stores = new Map<string, Map<string, unknown>>()

  const getStoreKey = (store: unknown) => {
    const s = store as { dbName?: string; storeName?: string } | undefined
    return `${s?.dbName ?? 'default'}::${s?.storeName ?? 'default'}`
  }

  const ensureStore = (store: unknown) => {
    const key = getStoreKey(store)
    let map = stores.get(key)
    if (!map) {
      map = new Map<string, unknown>()
      stores.set(key, map)
    }
    return map
  }

  const builderState = {
    table: '',
    insertResult: { data: null as unknown, error: null as { message?: string } | null },
  }

  const invokeResponse = {
    value: { data: null as unknown, error: null as { message?: string } | null },
  }

  const getUserResponse = {
    value: { data: { user: { id: 'user-1' } }, error: null as { message?: string } | null },
  }

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    insert: vi.fn(async () => builderState.insertResult),
    single: vi.fn(async () => builderState.insertResult),
    maybeSingle: vi.fn(async () => builderState.insertResult),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(builderState.insertResult).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(builderState.insertResult).catch(onRejected),
  }

  const mockFrom = vi.fn((table: string) => {
    builderState.table = table
    return builder
  })

  const mockInsert = builder.insert
  const mockInvoke = vi.fn(async () => invokeResponse.value)
  const mockGetUser = vi.fn(async () => getUserResponse.value)

  const mockGet = vi.fn(async (key: string, store: unknown) => ensureStore(store).get(key))
  const mockSet = vi.fn(async (key: string, value: unknown, store: unknown) => {
    ensureStore(store).set(key, value)
  })
  const mockDel = vi.fn(async (key: string, store: unknown) => {
    ensureStore(store).delete(key)
  })
  const mockKeys = vi.fn(async (store: unknown) => Array.from(ensureStore(store).keys()))
  return {
    invokeResponse,
    getUserResponse,
    builderState,
    mockInvoke,
    mockGetUser,
    mockFrom,
    mockInsert,
    mockGet,
    mockSet,
    mockDel,
    mockKeys,
    stores,
  }
})

vi.mock('idb-keyval', () => ({
  createStore: (dbName: string, storeName: string) => ({ dbName, storeName }),
  get: mockGet,
  set: mockSet,
  del: mockDel,
  keys: mockKeys,
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    auth: {
      getUser: mockGetUser,
      getSession: vi.fn(async () => ({
        data: {
          session: getUserResponse.value.data.user
            ? { user: getUserResponse.value.data.user }
            : null,
        },
        error: getUserResponse.value.error,
      })),
    },
    from: mockFrom,
  },
}))

describe('offlineOutbox', () => {
  beforeEach(() => {
    stores.clear()
    vi.clearAllMocks()
    invokeResponse.value = { data: null, error: null }
    getUserResponse.value = { data: { user: { id: 'user-1' } }, error: null }
    builderState.insertResult = { data: null, error: null }
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    })
  })

  it('enqueue/list/delete emails and notes, aggregate and count pending with real business values', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
    const email = await offlineOutbox.enqueueEmail({
      function_name: 'send-email-reply',
      payload: { threadId: 't1', message: 'bonjour' },
      display: {
        to: ['a@example.test', 'b@example.test'],
        subject: 'Sujet A',
        excerpt: 'Extrait',
      },
    })

    vi.setSystemTime(new Date('2024-01-01T00:00:01.000Z'))
    const note = await offlineOutbox.enqueueDashboardNote({
      dashboard_id: 'dash-1',
      content: 'Note hors ligne',
      title: 'Suivi',
    })

    expect(email.kind).toBe('email')
    expect(email.status).toBe('pending')
    expect(email.attempts).toBe(0)
    expect(email.function_name).toBe('send-email-reply')
    expect(email.display.subject).toBe('Sujet A')
    expect(email.id.startsWith('email_')).toBe(true)

    expect(note.kind).toBe('dashboard_note')
    expect(note.status).toBe('pending')
    expect(note.attempts).toBe(0)
    expect(note.title).toBe('Suivi')
    expect(note.id.startsWith('note_')).toBe(true)

    const emails = await offlineOutbox.listEmailDrafts()
    expect(emails).toHaveLength(1)
    expect(emails[0].id).toBe(email.id)
    expect(emails[0].payload).toEqual({ threadId: 't1', message: 'bonjour' })

    const notes = await offlineOutbox.listDashboardNotes()
    expect(notes).toHaveLength(1)
    expect(notes[0].id).toBe(note.id)
    expect(notes[0].dashboard_id).toBe('dash-1')
    expect(notes[0].content).toBe('Note hors ligne')

    const all = await offlineOutbox.listAllOutbox()
    expect(all).toHaveLength(2)
    expect(all[0].id).toBe(email.id)
    expect(all[1].id).toBe(note.id)

    const pending = await offlineOutbox.countPending()
    expect(pending).toBe(2)

    await offlineOutbox.deleteEmailDraft(email.id)
    expect(await offlineOutbox.listEmailDrafts()).toEqual([])
    expect(await offlineOutbox.countPending()).toBe(1)

    await offlineOutbox.deleteDashboardNote(note.id)
    expect(await offlineOutbox.listDashboardNotes()).toEqual([])
    expect(await offlineOutbox.countPending()).toBe(0)

    vi.useRealTimers()
  })

  it('dispatches and unsubscribes outbox change events', async () => {
    const handler = vi.fn()
    const unsubscribe = offlineOutbox.onOutboxChange(handler)

    offlineOutbox.notifyChange()
    expect(handler).toHaveBeenCalledTimes(1)

    unsubscribe()
    offlineOutbox.notifyChange()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('flushOutbox sends email via edge function and dashboard note via supabase insert, then removes items', async () => {
    const email = await offlineOutbox.enqueueEmail({
      function_name: 'send-email-reply',
      payload: { foo: 'bar', count: 2 },
      display: {
        to: ['dest@example.test'],
        subject: 'Réponse',
      },
    })
    const note = await offlineOutbox.enqueueDashboardNote({
      content: 'Ma note offline',
      title: 'default',
    })

    const result = await offlineOutbox.flushOutbox()

    expect(result).toEqual({ sent: 2, failed: 0 })

    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(mockInvoke).toHaveBeenCalledWith('send-email-reply', {
      body: { foo: 'bar', count: 2 },
    })

    expect(mockFrom).toHaveBeenCalledWith('dashboard_notes')
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      content: 'Ma note offline',
      tab_name: 'default',
    })

    expect(await offlineOutbox.listEmailDrafts()).toEqual([])
    expect(await offlineOutbox.listDashboardNotes()).toEqual([])
    expect(await offlineOutbox.countPending()).toBe(0)

    expect(email.id).not.toBe(note.id)
  })

  it('flushOutbox marks failures with attempts and last_error for email function errors and unauthenticated notes', async () => {
    const email = await offlineOutbox.enqueueEmail({
      function_name: 'send-email-reply',
      payload: { answer: 'nope' },
      display: {
        to: ['fail@example.test'],
        subject: 'Erreur email',
      },
    })
    const note = await offlineOutbox.enqueueDashboardNote({
      content: 'Note en erreur',
      title: 'Blocage',
    })

    invokeResponse.value = { data: null, error: { message: 'edge failed' } }
    getUserResponse.value = { data: { user: null }, error: null }

    const result = await offlineOutbox.flushOutbox()

    expect(result).toEqual({ sent: 0, failed: 2 })

    const emails = await offlineOutbox.listEmailDrafts()
    expect(emails).toHaveLength(1)
    expect(emails[0].id).toBe(email.id)
    expect(emails[0].status).toBe('failed')
    expect(emails[0].attempts).toBe(1)
    expect(emails[0].last_error).toBe('edge failed')

    const notes = await offlineOutbox.listDashboardNotes()
    expect(notes).toHaveLength(1)
    expect(notes[0].id).toBe(note.id)
    expect(notes[0].status).toBe('failed')
    expect(notes[0].attempts).toBe(1)
    expect(notes[0].last_error).toBe('Utilisateur non authentifié')
  })

  it('flushOutbox returns zero when offline and does not call remote services', async () => {
    await offlineOutbox.enqueueEmail({
      function_name: 'send-email-reply',
      payload: { foo: 'bar' },
      display: {
        to: ['offline@example.test'],
        subject: 'Offline',
      },
    })

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    })

    const result = await offlineOutbox.flushOutbox()

    expect(result).toEqual({ sent: 0, failed: 0 })
    expect(mockInvoke).not.toHaveBeenCalled()
    expect(mockGetUser).not.toHaveBeenCalled()

    const emails = await offlineOutbox.listEmailDrafts()
    expect(emails).toHaveLength(1)
    expect(emails[0].status).toBe('pending')
  })

  it('countPending excludes items in sending status', async () => {
    await offlineOutbox.enqueueEmail({
      function_name: 'send-email-reply',
      payload: { one: 1 },
      display: {
        to: ['a@example.test'],
        subject: 'A',
      },
    })

    await offlineOutbox.enqueueDashboardNote({
      content: 'Une note',
      title: 'T',
    })

    const emailStoreKey = 'marque-outbox::email-drafts'
    const emailMap = stores.get(emailStoreKey)
    if (emailMap) {
      const firstEntry = Array.from(emailMap.entries())[0]
      const current = firstEntry[1] as offlineOutbox.OutboxEmailDraft
      emailMap.set(firstEntry[0], { ...current, status: 'sending' })
    }

    const count = await offlineOutbox.countPending()
    expect(count).toBe(1)
  })
})
