import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  usePulseTodoList,
  useCreatePulseTodoList,
  useToggleTodoItem,
  useAddTodoItem,
  useDeleteTodoItem,
  useUpdateTodoListMessage,
  pulseTodoKeys,
} from './usePulseTodos'

const {
  AUTH_STATE,
  TOAST_FN,
  DEBUG,
  mockFrom,
  LIST_ROW,
  ITEMS_ROWS,
  PROFILE_ROW,
  CREATED_LIST_ROW,
  INSERTED_ITEM_ROW,
  UPDATED_MESSAGE_ROW,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  TOAST_FN: vi.fn(),
  DEBUG: { error: vi.fn() },
  mockFrom: vi.fn(),
  LIST_ROW: {
    id: 't1',
    conversation_id: 'c1',
    message_id: null,
    title: 'Liste test',
    created_by: 'p1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  ITEMS_ROWS: [
    {
      id: 'i1',
      todo_list_id: 't1',
      content: 'Acheter du pain',
      is_done: false,
      done_at: null,
      done_by: null,
      position: 0,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'i2',
      todo_list_id: 't1',
      content: 'Envoyer le mail',
      is_done: true,
      done_at: '2024-01-01T10:00:00Z',
      done_by: 'u1',
      position: 1,
      created_at: '2024-01-01T00:00:00Z',
    },
  ],
  PROFILE_ROW: { id: 'p1' },
  CREATED_LIST_ROW: {
    id: 't-new',
    conversation_id: 'c1',
    message_id: 'm1',
    title: 'Nouvelle todo',
    created_by: 'p1',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
  INSERTED_ITEM_ROW: {
    id: 'i-new',
    todo_list_id: 't1',
    content: 'Nouvel item',
    position: 2,
    is_done: false,
    done_at: null,
    done_by: null,
    created_at: '2024-01-02T00:00:00Z',
  },
  UPDATED_MESSAGE_ROW: {
    id: 't1',
    conversation_id: 'c1',
    message_id: 'm9',
    title: 'Liste test',
    created_by: 'p1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
  },
}))

type SupabaseResponse = {
  data?: unknown
  error?: { message: string } | null
}

const state = vi.hoisted(() => ({
  queue: [] as SupabaseResponse[],
  operations: [] as Array<{
    table: string
    action: string
    args: unknown[]
  }>,
}))

function shiftResponse(): SupabaseResponse {
  return state.queue.shift() ?? { data: null, error: null }
}

function createBuilder(table: string) {
  let action = 'select'

  const builder = {
    select: vi.fn((...args: unknown[]) => {
      state.operations.push({ table, action: 'select', args })
      action = 'select'
      return builder
    }),
    eq: vi.fn((...args: unknown[]) => {
      state.operations.push({ table, action: 'eq', args })
      return builder
    }),
    gte: vi.fn((...args: unknown[]) => {
      state.operations.push({ table, action: 'gte', args })
      return builder
    }),
    lte: vi.fn((...args: unknown[]) => {
      state.operations.push({ table, action: 'lte', args })
      return builder
    }),
    in: vi.fn((...args: unknown[]) => {
      state.operations.push({ table, action: 'in', args })
      return builder
    }),
    order: vi.fn((...args: unknown[]) => {
      state.operations.push({ table, action: 'order', args })
      return builder
    }),
    limit: vi.fn((...args: unknown[]) => {
      state.operations.push({ table, action: 'limit', args })
      return builder
    }),
    insert: vi.fn((...args: unknown[]) => {
      state.operations.push({ table, action: 'insert', args })
      action = 'insert'
      return builder
    }),
    update: vi.fn((...args: unknown[]) => {
      state.operations.push({ table, action: 'update', args })
      action = 'update'
      return builder
    }),
    delete: vi.fn((...args: unknown[]) => {
      state.operations.push({ table, action: 'delete', args })
      action = 'delete'
      return builder
    }),
    single: vi.fn(async () => shiftResponse()),
    maybeSingle: vi.fn(async () => shiftResponse()),
    then: (onFulfilled: (value: SupabaseResponse) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(shiftResponse()).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(shiftResponse()).catch(onRejected),
  }

  return builder
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}))

vi.mock('@/lib/debug', () => ({
  debug: DEBUG,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

describe('usePulseTodos', () => {
  beforeEach(() => {
    state.queue = []
    state.operations = []
    TOAST_FN.mockReset()
    DEBUG.error.mockReset()
    mockFrom.mockReset()
    mockFrom.mockImplementation((table: string) => createBuilder(table))
  })

  it('charge une todo list avec ses items puis expose les données métier attendues', async () => {
    state.queue = [
      { data: LIST_ROW, error: null },
      { data: ITEMS_ROWS, error: null },
    ]

    const wrapper = createWrapper()
    const { result } = renderHook(() => usePulseTodoList('t1'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('pulse_todo_lists')
    expect(mockFrom).toHaveBeenCalledWith('pulse_todo_items')
    expect(result.current.data).toEqual({
      ...LIST_ROW,
      items: ITEMS_ROWS,
    })
    expect(result.current.data?.title).toBe('Liste test')
    expect(result.current.data?.items?.map((item) => item.content)).toEqual([
      'Acheter du pain',
      'Envoyer le mail',
    ])
    expect(result.current.data?.items?.[0]?.position).toBe(0)
  })

  it('passe en erreur quand la récupération de la liste échoue', async () => {
    state.queue = [{ data: null, error: { message: 'boom' } }]

    const wrapper = createWrapper()
    const { result } = renderHook(() => usePulseTodoList('t1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeTruthy()
    expect(result.current.data).toBeUndefined()
  })

  it('crée une todo list avec items, invalide la bonne query et affiche un toast de succès', async () => {
    state.queue = [
      { data: PROFILE_ROW, error: null },
      { data: CREATED_LIST_ROW, error: null },
      { data: null, error: null },
    ]

    const wrapper = createWrapper()
    const { result } = renderHook(() => useCreatePulseTodoList(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        conversationId: 'c1',
        title: 'Nouvelle todo',
        items: ['A', 'B'],
        messageId: 'm1',
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockFrom).toHaveBeenCalledWith('pulse_todo_lists')
    expect(mockFrom).toHaveBeenCalledWith('pulse_todo_items')

    const listInsertOp = state.operations.find(
      (op) => op.table === 'pulse_todo_lists' && op.action === 'insert',
    )
    expect(listInsertOp?.args[0]).toEqual({
      conversation_id: 'c1',
      message_id: 'm1',
      title: 'Nouvelle todo',
      created_by: 'p1',
    })

    const itemsInsertOp = state.operations.find(
      (op) => op.table === 'pulse_todo_items' && op.action === 'insert',
    )
    expect(itemsInsertOp?.args[0]).toEqual([
      { todo_list_id: 't-new', content: 'A', position: 0 },
      { todo_list_id: 't-new', content: 'B', position: 1 },
    ])

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Todo créée',
      description: 'La liste de tâches a été créée',
    })
  })

  it('passe en erreur sur création et affiche un toast destructif', async () => {
    state.queue = [{ data: null, error: { message: 'profil err' } }]

    const wrapper = createWrapper()
    const { result } = renderHook(() => useCreatePulseTodoList(), { wrapper })

    await act(async () => {
      try {
        await result.current.mutateAsync({
          conversationId: 'c1',
          title: 'Nouvelle todo',
          items: ['A'],
          messageId: 'm1',
        })
      } catch {}
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(DEBUG.error).toHaveBeenCalled()
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de créer la todo',
      variant: 'destructive',
    })
  })

  it('toggle un item en done avec user id et invalide la query de la liste', async () => {
    state.queue = [{ data: { todo_list_id: 't1' }, error: null }]

    const wrapper = createWrapper()
    const { result } = renderHook(() => useToggleTodoItem(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ itemId: 'i1', isDone: true })
    })

    const updateOp = state.operations.find(
      (op) => op.table === 'pulse_todo_items' && op.action === 'update',
    )
    expect(updateOp?.args[0]).toMatchObject({
      is_done: true,
      done_by: 'u1',
    })

    const eqOp = state.operations.find(
      (op) => op.table === 'pulse_todo_items' && op.action === 'eq',
    )
    expect(eqOp?.args).toEqual(['id', 'i1'])
  })

  it('ajoute un item à la position suivante calculée depuis le max existant', async () => {
    state.queue = [
      { data: [{ position: 1 }], error: null },
      { data: INSERTED_ITEM_ROW, error: null },
    ]

    const wrapper = createWrapper()
    const { result } = renderHook(() => useAddTodoItem(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ todoListId: 't1', content: 'Nouvel item' })
    })

    const insertOp = state.operations.filter(
      (op) => op.table === 'pulse_todo_items' && op.action === 'insert',
    )[0]

    expect(insertOp?.args[0]).toEqual({
      todo_list_id: 't1',
      content: 'Nouvel item',
      position: 2,
    })
  })

  it('supprime un item avec le bon filtre id', async () => {
    state.queue = [{ data: null, error: null }]

    const wrapper = createWrapper()
    const { result } = renderHook(() => useDeleteTodoItem(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ itemId: 'i2', todoListId: 't1' })
    })

    const deleteOp = state.operations.find(
      (op) => op.table === 'pulse_todo_items' && op.action === 'delete',
    )
    expect(deleteOp).toBeTruthy()

    const eqOp = state.operations.find(
      (op) => op.table === 'pulse_todo_items' && op.action === 'eq',
    )
    expect(eqOp?.args).toEqual(['id', 'i2'])
  })

  it('met à jour le message_id de la liste', async () => {
    state.queue = [{ data: UPDATED_MESSAGE_ROW, error: null }]

    const wrapper = createWrapper()
    const { result } = renderHook(() => useUpdateTodoListMessage(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ todoListId: 't1', messageId: 'm9' })
    })

    const updateOp = state.operations.find(
      (op) => op.table === 'pulse_todo_lists' && op.action === 'update',
    )
    expect(updateOp?.args[0]).toEqual({ message_id: 'm9' })

    const eqOp = state.operations.find(
      (op) => op.table === 'pulse_todo_lists' && op.action === 'eq',
    )
    expect(eqOp?.args).toEqual(['id', 't1'])
  })

  it('expose des query keys cohérentes', () => {
    expect(pulseTodoKeys.all).toEqual(['pulse-todos'])
    expect(pulseTodoKeys.byConversation('c1')).toEqual(['pulse-todos', 'conversation', 'c1'])
    expect(pulseTodoKeys.byMessage('m1')).toEqual(['pulse-todos', 'message', 'm1'])
    expect(pulseTodoKeys.single('t1')).toEqual(['pulse-todos', 'single', 't1'])
  })
})