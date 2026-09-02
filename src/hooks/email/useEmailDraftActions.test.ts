// @vitest-environment jsdom

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { useEmailDraftActions } from './useEmailDraftActions'

const {
  AUTH_STATE,
  debugError,
  mockFrom,
  selectMock,
  eqMock,
  gteMock,
  lteMock,
  inMock,
  orderMock,
  limitMock,
  insertMock,
  updateMock,
  deleteMock,
  singleMock,
  maybeSingleMock,
  thenMock,
  catchMock,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const debugError = vi.fn()
  const mockFrom = vi.fn()
  const selectMock = vi.fn()
  const eqMock = vi.fn()
  const gteMock = vi.fn()
  const lteMock = vi.fn()
  const inMock = vi.fn()
  const orderMock = vi.fn()
  const limitMock = vi.fn()
  const insertMock = vi.fn()
  const updateMock = vi.fn()
  const deleteMock = vi.fn()
  const singleMock = vi.fn()
  const maybeSingleMock = vi.fn()
  const thenMock = vi.fn()
  const catchMock = vi.fn()

  return {
    AUTH_STATE,
    debugError,
    mockFrom,
    selectMock,
    eqMock,
    gteMock,
    lteMock,
    inMock,
    orderMock,
    limitMock,
    insertMock,
    updateMock,
    deleteMock,
    singleMock,
    maybeSingleMock,
    thenMock,
    catchMock,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
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

function createBuilder() {
  const builder = {
    select: selectMock,
    eq: eqMock,
    gte: gteMock,
    lte: lteMock,
    in: inMock,
    order: orderMock,
    limit: limitMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    single: singleMock,
    maybeSingle: maybeSingleMock,
    then: thenMock,
    catch: catchMock,
  }

  selectMock.mockImplementation(() => builder)
  eqMock.mockImplementation(() => builder)
  gteMock.mockImplementation(() => builder)
  lteMock.mockImplementation(() => builder)
  inMock.mockImplementation(() => builder)
  orderMock.mockImplementation(() => builder)
  limitMock.mockImplementation(() => builder)
  insertMock.mockImplementation(() => builder)
  updateMock.mockImplementation(() => builder)
  deleteMock.mockImplementation(() => builder)
  maybeSingleMock.mockImplementation(() => Promise.resolve({ data: null, error: null }))
  catchMock.mockImplementation(() => builder)
  thenMock.mockImplementation((onFulfilled?: (value: { data: null; error: null }) => unknown) => {
    const value = { data: null, error: null }
    return Promise.resolve(onFulfilled ? onFulfilled(value) : value)
  })

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

describe('useEmailDraftActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createBuilder()
  })

  it('expose les actions attendues', () => {
    mockFrom.mockReturnValue(createBuilder())

    const { result } = renderHook(() => useEmailDraftActions(), {
      wrapper: createWrapper(),
    })

    expect(typeof result.current.saveDraft).toBe('function')
    expect(typeof result.current.deleteDraft).toBe('function')
    expect(typeof result.current.createOutboundThread).toBe('function')
    expect(typeof result.current.deleteOrphanThread).toBe('function')
    expect(typeof result.current.deleteThread).toBe('function')
  })

  it('ne sauvegarde pas un brouillon vide et retourne le draftId existant sans appel Supabase', async () => {
    mockFrom.mockReturnValue(createBuilder())

    const { result } = renderHook(() => useEmailDraftActions(), {
      wrapper: createWrapper(),
    })

    const draftData = {
      user_id: 'u1',
      account_id: 'acc1',
      to_addresses: '   ',
      cc_addresses: '',
      bcc_addresses: '',
      subject: '   ',
      body: '<p></p>',
      attachments: [],
    }

    let returned: string | null = null

    await act(async () => {
      returned = await result.current.saveDraft('draft-existing', draftData)
    })

    expect(returned).toBe('draft-existing')
    expect(mockFrom).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('met à jour un brouillon existant avec les valeurs métier attendues', async () => {
    mockFrom.mockReturnValue(createBuilder())

    const { result } = renderHook(() => useEmailDraftActions(), {
      wrapper: createWrapper(),
    })

    const draftData = {
      user_id: 'u1',
      account_id: 'acc1',
      to_addresses: 'alice@example.com',
      cc_addresses: 'bob@example.com',
      bcc_addresses: '',
      subject: 'Sujet test',
      body: '<p>Bonjour</p>',
      attachments: [{ name: 'file.pdf', size: 12, type: 'application/pdf' }],
    }

    let returned: string | null = null

    await act(async () => {
      returned = await result.current.saveDraft('draft-42', draftData)
    })

    expect(returned).toBe('draft-42')
    expect(mockFrom).toHaveBeenCalledWith('email_drafts')
    expect(updateMock).toHaveBeenCalledWith(draftData)
    expect(eqMock).toHaveBeenCalledWith('id', 'draft-42')
  })

  it('crée un nouveau brouillon et retourne son id en cas de succès', async () => {
    mockFrom.mockReturnValue(createBuilder())
    singleMock.mockResolvedValue({ data: { id: 'new-draft-1' }, error: null })

    const { result } = renderHook(() => useEmailDraftActions(), {
      wrapper: createWrapper(),
    })

    const draftData = {
      user_id: 'u1',
      account_id: 'acc1',
      to_addresses: 'alice@example.com',
      cc_addresses: '',
      bcc_addresses: '',
      subject: 'Nouveau brouillon',
      body: '<p>Contenu</p>',
      attachments: [{ name: 'img.png', size: 5, type: 'image/png' }],
    }

    let returned: string | null = null

    await act(async () => {
      returned = await result.current.saveDraft(null, draftData)
    })

    expect(mockFrom).toHaveBeenCalledWith('email_drafts')
    expect(insertMock).toHaveBeenCalledWith(draftData)
    expect(selectMock).toHaveBeenCalledWith()
    expect(singleMock).toHaveBeenCalledTimes(1)
    expect(returned).toBe('new-draft-1')
  })

  it('retourne null quand la création de brouillon échoue', async () => {
    mockFrom.mockReturnValue(createBuilder())
    singleMock.mockResolvedValue({ data: null, error: { message: 'x' } })

    const { result } = renderHook(() => useEmailDraftActions(), {
      wrapper: createWrapper(),
    })

    const draftData = {
      user_id: 'u1',
      account_id: 'acc1',
      to_addresses: 'alice@example.com',
      cc_addresses: '',
      bcc_addresses: '',
      subject: 'Brouillon erreur',
      body: '<p>Contenu</p>',
      attachments: [],
    }

    let returned: string | null = 'initial'

    await act(async () => {
      returned = await result.current.saveDraft(null, draftData)
    })

    expect(returned).toBeNull()
    expect(insertMock).toHaveBeenCalledWith(draftData)
    expect(singleMock).toHaveBeenCalledTimes(1)
  })

  it('supprime un brouillon par id', async () => {
    mockFrom.mockReturnValue(createBuilder())

    const { result } = renderHook(() => useEmailDraftActions(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await result.current.deleteDraft('draft-del-1')
    })

    expect(mockFrom).toHaveBeenCalledWith('email_drafts')
    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(eqMock).toHaveBeenCalledWith('id', 'draft-del-1')
  })

  it('crée un fil outbound avec les champs métier attendus', async () => {
    mockFrom.mockReturnValue(createBuilder())
    singleMock.mockResolvedValue({ data: { id: 'thread-row-1' }, error: null })

    const { result } = renderHook(() => useEmailDraftActions(), {
      wrapper: createWrapper(),
    })

    const params = {
      threadId: 'thread-ext-1',
      accountId: 'acc1',
      subject: 'Sujet outbound',
      participants: [
        { email: 'alice@example.com', name: 'Alice', type: 'to' },
        { email: 'bob@example.com', name: null, type: 'cc' },
      ],
    }

    let returned: { id: string } | null = null

    await act(async () => {
      returned = await result.current.createOutboundThread(params)
    })

    expect(mockFrom).toHaveBeenCalledWith('email_threads')
    expect(insertMock).toHaveBeenCalledTimes(1)

    const inserted = insertMock.mock.calls[0][0] as {
      thread_id: string
      user_email_account_id: string
      subject: string
      participants: Array<{ email: string; name: string | null; type: string }>
      last_message_date: string
      message_count: number
      unread_count: number
      has_sent_messages: boolean
      is_outbound: boolean
    }

    expect(inserted.thread_id).toBe('thread-ext-1')
    expect(inserted.user_email_account_id).toBe('acc1')
    expect(inserted.subject).toBe('Sujet outbound')
    expect(inserted.participants).toEqual(params.participants)
    expect(inserted.message_count).toBe(0)
    expect(inserted.unread_count).toBe(0)
    expect(inserted.has_sent_messages).toBe(true)
    expect(inserted.is_outbound).toBe(true)
    expect(typeof inserted.last_message_date).toBe('string')
    expect(selectMock).toHaveBeenCalledWith('id')
    expect(returned).toEqual({ id: 'thread-row-1' })
  })

  it('propage une erreur métier si la création du fil échoue et loggue le debug', async () => {
    mockFrom.mockReturnValue(createBuilder())
    const supabaseError = { message: 'x' }
    singleMock.mockResolvedValue({ data: null, error: supabaseError })

    const { result } = renderHook(() => useEmailDraftActions(), {
      wrapper: createWrapper(),
    })

    const params = {
      threadId: 'thread-ext-err',
      accountId: 'acc1',
      subject: 'Sujet erreur',
      participants: [{ email: 'alice@example.com', name: 'Alice', type: 'to' }],
    }

    let caught: unknown = null

    await act(async () => {
      try {
        await result.current.createOutboundThread(params)
      } catch (error) {
        caught = error
      }
    })

    expect(debugError).toHaveBeenCalledTimes(1)
    expect(debugError).toHaveBeenCalledWith('Failed to create thread:', supabaseError)
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toBe('Impossible de créer le fil de discussion')
  })

  it('supprime un fil orphelin seulement si message_count vaut 0 dans la requête', async () => {
    mockFrom.mockReturnValue(createBuilder())

    const { result } = renderHook(() => useEmailDraftActions(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await result.current.deleteOrphanThread('thread-orp-1')
    })

    expect(mockFrom).toHaveBeenCalledWith('email_threads')
    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(eqMock.mock.calls).toEqual([
      ['id', 'thread-orp-1'],
      ['message_count', 0],
    ])
  })

  it('supprime un fil par id', async () => {
    mockFrom.mockReturnValue(createBuilder())

    const { result } = renderHook(() => useEmailDraftActions(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await result.current.deleteThread('thread-del-1')
    })

    expect(mockFrom).toHaveBeenCalledWith('email_threads')
    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(eqMock).toHaveBeenCalledWith('id', 'thread-del-1')
  })
})