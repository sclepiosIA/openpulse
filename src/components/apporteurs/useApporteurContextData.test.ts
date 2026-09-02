import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { useApporteurContextData } from './useApporteurContextData'

const {
  APPORT_ID,
  EXCHANGE_ROWS,
  NEXT_STEP_ROWS,
  QUERY_ERROR,
  mockState,
  mockFrom,
  mockSelect,
  mockEq,
  mockOrder,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockChannel,
  mockOn,
  mockSubscribe,
  mockRemoveChannel,
  mockGetUser,
} = vi.hoisted(() => {
  type QueryResponse = { data: unknown; error: { message: string } | null }
  type OrderOptions = { ascending?: boolean }
  type Builder = {
    select: (columns?: string) => Builder
    eq: (column: string, value: unknown) => Builder
    gte: (column: string, value: unknown) => Builder
    lte: (column: string, value: unknown) => Builder
    in: (column: string, values: readonly unknown[]) => Builder
    order: (column: string, options?: OrderOptions) => Builder
    limit: (count: number) => Builder
    insert: (payload: unknown) => Builder
    update: (payload: unknown) => Builder
    delete: () => Builder
    upsert: (payload: unknown) => Builder
    range: (from: number, to: number) => Builder
    is: (column: string, value: unknown) => Builder
    not: (column: string, operator: string, value: unknown) => Builder
    match: (query: Record<string, unknown>) => Builder
    or: (filters: string) => Builder
    single: () => Promise<QueryResponse>
    maybeSingle: () => Promise<QueryResponse>
    then: <TResult1 = QueryResponse, TResult2 = never>(
      onFulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise<TResult1 | TResult2>
    catch: <TResult = never>(
      onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
    ) => Promise<QueryResponse | TResult>
  }

  const APPORT_ID = 'ap1'
  const EXCHANGE_ROWS = [
    {
      id: 'ex1',
      date_echange: '2025-01-10',
      canal: 'Email',
      resume: 'Premier échange qualifié',
    },
    {
      id: 'ex2',
      date_echange: '2025-01-08',
      canal: 'Visio',
      resume: 'Présentation du mandat',
    },
  ] as const
  const NEXT_STEP_ROWS = [
    {
      id: 'ns1',
      action: 'Envoyer le dossier',
      echeance: '2025-01-15',
      owner: 'Marie',
    },
    {
      id: 'ns2',
      action: 'Relancer le partenaire',
      echeance: '2025-01-20',
      owner: null,
    },
  ] as const

  const EMPTY_ROWS = [] as const
  const QUERY_ERROR = { message: 'x' }
  const MUTATION_ERROR = { message: 'm' }
  const USER_RESPONSE = { data: { user: { id: 'u1', email: 't@t.co' } }, error: null }

  const EXCHANGES_RESPONSE: QueryResponse = { data: EXCHANGE_ROWS, error: null }
  const NEXT_STEPS_RESPONSE: QueryResponse = { data: NEXT_STEP_ROWS, error: null }
  const EMPTY_RESPONSE: QueryResponse = { data: EMPTY_ROWS, error: null }
  const QUERY_ERROR_RESPONSE: QueryResponse = { data: null, error: QUERY_ERROR }
  const MUTATION_SUCCESS_RESPONSE: QueryResponse = { data: null, error: null }
  const MUTATION_ERROR_RESPONSE: QueryResponse = { data: null, error: MUTATION_ERROR }

  const mockState = {
    errorTables: new Set<string>(),
    mutationError: false,
  }

  const mockSelect = vi.fn()
  const mockEq = vi.fn()
  const mockGte = vi.fn()
  const mockLte = vi.fn()
  const mockIn = vi.fn()
  const mockOrder = vi.fn()
  const mockLimit = vi.fn()
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn()
  const mockDelete = vi.fn()
  const mockUpsert = vi.fn()
  const mockRange = vi.fn()
  const mockIs = vi.fn()
  const mockNot = vi.fn()
  const mockMatch = vi.fn()
  const mockOr = vi.fn()
  const mockSingle = vi.fn()
  const mockMaybeSingle = vi.fn()
  const mockGetUser = vi.fn(() => Promise.resolve(USER_RESPONSE))

  const createBuilder = (table: string): Builder => {
    let operation: 'query' | 'insert' | 'update' | 'delete' | 'upsert' = 'query'

    const responseFor = (): QueryResponse => {
      if (operation !== 'query') {
        return mockState.mutationError ? MUTATION_ERROR_RESPONSE : MUTATION_SUCCESS_RESPONSE
      }

      if (mockState.errorTables.has(table)) {
        return QUERY_ERROR_RESPONSE
      }

      if (table === 'apporteur_exchanges') {
        return EXCHANGES_RESPONSE
      }

      if (table === 'apporteur_next_steps') {
        return NEXT_STEPS_RESPONSE
      }

      return EMPTY_RESPONSE
    }

    const builder = {} as Builder

    builder.select = (columns?: string) => {
      mockSelect(columns)
      return builder
    }
    builder.eq = (column: string, value: unknown) => {
      mockEq(column, value)
      return builder
    }
    builder.gte = (column: string, value: unknown) => {
      mockGte(column, value)
      return builder
    }
    builder.lte = (column: string, value: unknown) => {
      mockLte(column, value)
      return builder
    }
    builder.in = (column: string, values: readonly unknown[]) => {
      mockIn(column, values)
      return builder
    }
    builder.order = (column: string, options?: OrderOptions) => {
      mockOrder(column, options)
      return builder
    }
    builder.limit = (count: number) => {
      mockLimit(count)
      return builder
    }
    builder.insert = (payload: unknown) => {
      operation = 'insert'
      mockInsert(payload)
      return builder
    }
    builder.update = (payload: unknown) => {
      operation = 'update'
      mockUpdate(payload)
      return builder
    }
    builder.delete = () => {
      operation = 'delete'
      mockDelete()
      return builder
    }
    builder.upsert = (payload: unknown) => {
      operation = 'upsert'
      mockUpsert(payload)
      return builder
    }
    builder.range = (from: number, to: number) => {
      mockRange(from, to)
      return builder
    }
    builder.is = (column: string, value: unknown) => {
      mockIs(column, value)
      return builder
    }
    builder.not = (column: string, operator: string, value: unknown) => {
      mockNot(column, operator, value)
      return builder
    }
    builder.match = (query: Record<string, unknown>) => {
      mockMatch(query)
      return builder
    }
    builder.or = (filters: string) => {
      mockOr(filters)
      return builder
    }
    builder.single = () => {
      mockSingle()
      return Promise.resolve(responseFor())
    }
    builder.maybeSingle = () => {
      mockMaybeSingle()
      return Promise.resolve(responseFor())
    }
    builder.then = (onFulfilled, onRejected) =>
      Promise.resolve(responseFor()).then(onFulfilled, onRejected)
    builder.catch = (onRejected) => Promise.resolve(responseFor()).catch(onRejected)

    return builder
  }

  type ChannelBuilder = {
    on: (event: string, config: Record<string, unknown>, callback: () => void) => ChannelBuilder
    subscribe: () => ChannelBuilder
  }

  const mockOn = vi.fn()
  const mockSubscribe = vi.fn()
  const mockChannel = vi.fn((name: string) => {
    const channel = {} as ChannelBuilder
    channel.on = (event: string, config: Record<string, unknown>, callback: () => void) => {
      mockOn(event, config, callback)
      return channel
    }
    channel.subscribe = () => {
      mockSubscribe(name)
      return channel
    }
    return channel
  })
  const mockRemoveChannel = vi.fn()
  const mockFrom = vi.fn((table: string) => createBuilder(table))

  return {
    APPORT_ID,
    EXCHANGE_ROWS,
    NEXT_STEP_ROWS,
    QUERY_ERROR,
    mockState,
    mockFrom,
    mockSelect,
    mockEq,
    mockOrder,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockChannel,
    mockOn,
    mockSubscribe,
    mockRemoveChannel,
    mockGetUser,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
    auth: {
      getUser: mockGetUser,
    },
  },
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)

  return { Wrapper, queryClient }
}

describe('useApporteurContextData', () => {
  beforeEach(() => {
    mockState.errorTables.clear()
    mockState.mutationError = false
    mockFrom.mockClear()
    mockSelect.mockClear()
    mockEq.mockClear()
    mockOrder.mockClear()
    mockInsert.mockClear()
    mockUpdate.mockClear()
    mockDelete.mockClear()
    mockChannel.mockClear()
    mockOn.mockClear()
    mockSubscribe.mockClear()
    mockRemoveChannel.mockClear()
    mockGetUser.mockClear()
  })

  it('ne lance aucune requête lorsque apporteurId est absent', () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useApporteurContextData(undefined), { wrapper: Wrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.exchanges).toEqual([])
    expect(result.current.nextSteps).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockChannel).not.toHaveBeenCalled()
  })

  it('expose le chargement puis mappe les échanges et prochaines étapes avec les valeurs métier', async () => {
    const { Wrapper } = createWrapper()

    const { result, unmount } = renderHook(() => useApporteurContextData(APPORT_ID), {
      wrapper: Wrapper,
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.exchanges).toEqual([
      {
        id: EXCHANGE_ROWS[0].id,
        date: EXCHANGE_ROWS[0].date_echange,
        canal: EXCHANGE_ROWS[0].canal,
        resume: EXCHANGE_ROWS[0].resume,
      },
      {
        id: EXCHANGE_ROWS[1].id,
        date: EXCHANGE_ROWS[1].date_echange,
        canal: EXCHANGE_ROWS[1].canal,
        resume: EXCHANGE_ROWS[1].resume,
      },
    ])
    expect(result.current.nextSteps).toEqual([
      {
        id: NEXT_STEP_ROWS[0].id,
        action: NEXT_STEP_ROWS[0].action,
        echeance: NEXT_STEP_ROWS[0].echeance,
        owner: NEXT_STEP_ROWS[0].owner,
      },
      {
        id: NEXT_STEP_ROWS[1].id,
        action: NEXT_STEP_ROWS[1].action,
        echeance: NEXT_STEP_ROWS[1].echeance,
        owner: '',
      },
    ])

    expect(mockFrom).toHaveBeenCalledWith('apporteur_exchanges')
    expect(mockFrom).toHaveBeenCalledWith('apporteur_next_steps')
    expect(mockSelect).toHaveBeenCalledWith('id, date_echange, canal, resume')
    expect(mockSelect).toHaveBeenCalledWith('id, action, echeance, owner')
    expect(mockEq).toHaveBeenCalledWith('apporteur_id', APPORT_ID)
    expect(mockOrder).toHaveBeenCalledWith('date_echange', { ascending: false })
    expect(mockOrder).toHaveBeenCalledWith('echeance', { ascending: true })
    expect(mockChannel).toHaveBeenCalledTimes(1)
    expect(mockOn).toHaveBeenCalledTimes(2)
    expect(mockSubscribe).toHaveBeenCalledTimes(1)

    unmount()

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
  })

  it('passe la requête en erreur lorsque Supabase renvoie data null et error', async () => {
    mockState.errorTables.add('apporteur_exchanges')
    const { Wrapper, queryClient } = createWrapper()

    const { result } = renderHook(() => useApporteurContextData(APPORT_ID), { wrapper: Wrapper })

    await waitFor(() =>
      expect(queryClient.getQueryState(['apporteur-exchanges', APPORT_ID])?.status).toBe('error')
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(queryClient.getQueryState(['apporteur-exchanges', APPORT_ID])?.error).toBe(QUERY_ERROR)
    expect(result.current.exchanges).toEqual([])
    expect(result.current.nextSteps).toEqual([
      {
        id: NEXT_STEP_ROWS[0].id,
        action: NEXT_STEP_ROWS[0].action,
        echeance: NEXT_STEP_ROWS[0].echeance,
        owner: NEXT_STEP_ROWS[0].owner,
      },
      {
        id: NEXT_STEP_ROWS[1].id,
        action: NEXT_STEP_ROWS[1].action,
        echeance: NEXT_STEP_ROWS[1].echeance,
        owner: '',
      },
    ])
  })

  it('déclenche les mutations avec les payloads Supabase attendus', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useApporteurContextData(APPORT_ID), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.addExchange.mutateAsync({
        date: '2025-02-01',
        canal: 'Téléphone',
        resume: 'Compte rendu téléphonique',
      })
    })

    expect(mockGetUser).toHaveBeenCalledTimes(1)
    expect(mockInsert).toHaveBeenCalledWith({
      apporteur_id: APPORT_ID,
      date_echange: '2025-02-01',
      canal: 'Téléphone',
      resume: 'Compte rendu téléphonique',
      created_by: 'u1',
    })

    await act(async () => {
      await result.current.updateExchange.mutateAsync({
        id: 'ex1',
        date: '2025-02-02',
        canal: 'RDV',
        resume: 'Compte rendu mis à jour',
      })
    })

    expect(mockUpdate).toHaveBeenCalledWith({
      date_echange: '2025-02-02',
      canal: 'RDV',
      resume: 'Compte rendu mis à jour',
    })
    expect(mockEq).toHaveBeenCalledWith('id', 'ex1')

    await act(async () => {
      await result.current.deleteExchange.mutateAsync('ex2')
    })

    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('id', 'ex2')

    await act(async () => {
      await result.current.addNextStep.mutateAsync({
        action: 'Planifier une visio',
        echeance: '2025-02-10',
        owner: '',
      })
    })

    expect(mockGetUser).toHaveBeenCalledTimes(2)
    expect(mockInsert).toHaveBeenCalledWith({
      apporteur_id: APPORT_ID,
      action: 'Planifier une visio',
      echeance: '2025-02-10',
      owner: null,
      created_by: 'u1',
    })

    await act(async () => {
      await result.current.updateNextStep.mutateAsync({
        id: 'ns1',
        action: 'Envoyer les pièces',
        echeance: '2025-02-12',
        owner: 'Paul',
      })
    })

    expect(mockUpdate).toHaveBeenCalledWith({
      action: 'Envoyer les pièces',
      echeance: '2025-02-12',
      owner: 'Paul',
    })
    expect(mockEq).toHaveBeenCalledWith('id', 'ns1')

    await act(async () => {
      await result.current.deleteNextStep.mutateAsync('ns2')
    })

    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('id', 'ns2')
  })
})
