import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { DEFAULT_MANUAL_SCORES, useApporteurManualScores } from './useApporteurManualScores'

const supabaseMocks = vi.hoisted(() => {
  type SupabaseResponse = {
    data: unknown
    error: null | { message: string }
  }

  type Builder = {
    select: (columns?: unknown) => Builder
    eq: (column: string, value: unknown) => Builder
    gte: (column: string, value: unknown) => Builder
    lte: (column: string, value: unknown) => Builder
    in: (column: string, values: unknown) => Builder
    order: (column: string, options?: unknown) => Builder
    limit: (count: number) => Builder
    insert: (payload: unknown, options?: unknown) => Builder
    update: (payload: unknown, options?: unknown) => Builder
    delete: (options?: unknown) => Builder
    upsert: (payload: unknown, options?: unknown) => Builder
    single: () => Promise<unknown>
    maybeSingle: () => Promise<unknown>
    then: Promise<unknown>['then']
    catch: Promise<unknown>['catch']
  }

  type Channel = {
    on: (event: string, config: unknown, callback: () => void) => Channel
    subscribe: () => Channel
  }

  type ThenOnFulfilled = Parameters<Promise<unknown>['then']>[0]
  type ThenOnRejected = Parameters<Promise<unknown>['then']>[1]
  type CatchOnRejected = Parameters<Promise<unknown>['catch']>[0]

  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const SUCCESS_ROW = {
    organisation_score: 82,
    organisation_comment: 'Score org vérifié',
    relation_score: 91,
    relation_comment: 'Relation suivie',
    updated_at: '2024-01-02T03:04:05.000Z',
  }

  const SELECT_SUCCESS: SupabaseResponse = { data: SUCCESS_ROW, error: null }
  const QUERY_ERROR: SupabaseResponse = { data: null, error: { message: 'x' } }
  const UPSERT_SUCCESS: SupabaseResponse = { data: null, error: null }

  const fromCalls: string[] = []
  const selectCalls: unknown[] = []
  const eqCalls: Array<{ column: string; value: unknown }> = []
  const upsertCalls: Array<{ payload: unknown; options: unknown }> = []
  const channelNames: string[] = []
  const onCalls: Array<{ event: string; config: unknown; callback: () => void }> = []

  let selectResult: unknown = SELECT_SUCCESS
  let upsertResult: unknown = UPSERT_SUCCESS

  function createBuilder(): Builder {
    let activeResult: unknown = selectResult

    const builder: Builder = {
      select: vi.fn((columns?: unknown) => {
        selectCalls.push(columns)
        activeResult = selectResult
        return builder
      }),
      eq: vi.fn((column: string, value: unknown) => {
        eqCalls.push({ column, value })
        return builder
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => {
        activeResult = upsertResult
        return builder
      }),
      update: vi.fn(() => {
        activeResult = upsertResult
        return builder
      }),
      delete: vi.fn(() => {
        activeResult = upsertResult
        return builder
      }),
      upsert: vi.fn((payload: unknown, options?: unknown) => {
        upsertCalls.push({ payload, options })
        activeResult = upsertResult
        return builder
      }),
      single: vi.fn(() => Promise.resolve(selectResult)),
      maybeSingle: vi.fn(() => Promise.resolve(selectResult)),
      then: vi.fn((onfulfilled: ThenOnFulfilled, onrejected: ThenOnRejected) =>
        Promise.resolve(activeResult).then(onfulfilled, onrejected)
      ) as Promise<unknown>['then'],
      catch: vi.fn((onrejected: CatchOnRejected) =>
        Promise.resolve(activeResult).catch(onrejected)
      ) as Promise<unknown>['catch'],
    }

    return builder
  }

  const mockFrom = vi.fn((table: string) => {
    fromCalls.push(table)
    return createBuilder()
  })

  const realtimeChannel: Channel = {
    on: vi.fn((event: string, config: unknown, callback: () => void) => {
      onCalls.push({ event, config, callback })
      return realtimeChannel
    }),
    subscribe: vi.fn(() => realtimeChannel),
  }

  const mockChannel = vi.fn((name: string) => {
    channelNames.push(name)
    return realtimeChannel
  })

  const mockRemoveChannel = vi.fn()
  const mockUseAuthSafe = vi.fn(() => AUTH_STATE)

  function reset() {
    selectResult = SELECT_SUCCESS
    upsertResult = UPSERT_SUCCESS
    fromCalls.length = 0
    selectCalls.length = 0
    eqCalls.length = 0
    upsertCalls.length = 0
    channelNames.length = 0
    onCalls.length = 0
    mockFrom.mockClear()
    mockChannel.mockClear()
    mockRemoveChannel.mockClear()
    realtimeChannel.on = vi.fn((event: string, config: unknown, callback: () => void) => {
      onCalls.push({ event, config, callback })
      return realtimeChannel
    })
    realtimeChannel.subscribe = vi.fn(() => realtimeChannel)
    mockUseAuthSafe.mockClear()
    mockUseAuthSafe.mockReturnValue(AUTH_STATE)
  }

  return {
    AUTH_STATE,
    SELECT_SUCCESS,
    QUERY_ERROR,
    UPSERT_SUCCESS,
    mockFrom,
    mockChannel,
    mockRemoveChannel,
    mockUseAuthSafe,
    realtimeChannel,
    fromCalls,
    selectCalls,
    eqCalls,
    upsertCalls,
    channelNames,
    onCalls,
    setSelectResult: (result: unknown) => {
      selectResult = result
    },
    setUpsertResult: (result: unknown) => {
      upsertResult = result
    },
    reset,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: supabaseMocks.mockFrom,
    channel: supabaseMocks.mockChannel,
    removeChannel: supabaseMocks.mockRemoveChannel,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuthSafe: supabaseMocks.mockUseAuthSafe,
  useAuth: supabaseMocks.mockUseAuthSafe,
  AuthProvider: (props: { children: unknown }) => props.children,
}))

function createWrapper() {
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

function createDeferred<T>() {
  let resolveValue: ((value: T) => void) | undefined

  const promise = new Promise<T>((resolve) => {
    resolveValue = resolve
  })

  return {
    promise,
    resolve: (value: T) => {
      if (resolveValue) {
        resolveValue(value)
      }
    },
  }
}

describe('useApporteurManualScores', () => {
  beforeEach(() => {
    supabaseMocks.reset()
  })

  it('expose les scores par défaut pendant le chargement puis les scores Supabase', async () => {
    const deferred = createDeferred<unknown>()
    supabaseMocks.setSelectResult(deferred.promise)
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useApporteurManualScores('ap-1'), { wrapper: Wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.scores.organisation.value).toBe(DEFAULT_MANUAL_SCORES.organisation.value)
    expect(result.current.scores.organisation.comment).toBe(
      DEFAULT_MANUAL_SCORES.organisation.comment
    )
    expect(result.current.scores.relation.value).toBe(DEFAULT_MANUAL_SCORES.relation.value)
    expect(result.current.scores.relation.comment).toBe(DEFAULT_MANUAL_SCORES.relation.comment)

    await act(async () => {
      deferred.resolve(supabaseMocks.SELECT_SUCCESS)
      await deferred.promise
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.scores).toEqual({
      organisation: {
        value: 82,
        comment: 'Score org vérifié',
        updatedAt: '2024-01-02T03:04:05.000Z',
      },
      relation: {
        value: 91,
        comment: 'Relation suivie',
        updatedAt: '2024-01-02T03:04:05.000Z',
      },
    })
  })

  it('lit les scores, configure la requête Supabase et abonne le canal realtime', async () => {
    const { Wrapper } = createWrapper()

    const { result, unmount } = renderHook(() => useApporteurManualScores('ap-2'), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.scores.organisation.value).toBe(82)
    expect(result.current.scores.organisation.comment).toBe('Score org vérifié')
    expect(result.current.scores.relation.value).toBe(91)
    expect(result.current.scores.relation.comment).toBe('Relation suivie')
    expect(result.current.scores.organisation.updatedAt).toBe('2024-01-02T03:04:05.000Z')
    expect(result.current.scores.relation.updatedAt).toBe('2024-01-02T03:04:05.000Z')

    expect(supabaseMocks.mockFrom).toHaveBeenCalledWith('apporteur_manual_scores')
    expect(supabaseMocks.selectCalls).toEqual([
      'organisation_score, organisation_comment, relation_score, relation_comment, updated_at',
    ])
    expect(supabaseMocks.eqCalls).toEqual([{ column: 'apporteur_id', value: 'ap-2' }])
    expect(supabaseMocks.mockChannel).toHaveBeenCalledTimes(1)
    expect(supabaseMocks.channelNames.at(0)).toContain('apporteur-manual-scores-ap-2-')
    expect(supabaseMocks.onCalls.at(0)).toEqual({
      event: 'postgres_changes',
      config: {
        event: '*',
        schema: 'public',
        table: 'apporteur_manual_scores',
        filter: 'apporteur_id=eq.ap-2',
      },
      callback: expect.any(Function),
    })

    unmount()

    expect(supabaseMocks.mockRemoveChannel).toHaveBeenCalledWith(supabaseMocks.realtimeChannel)
  })

  it('place la query en erreur quand Supabase renvoie une erreur', async () => {
    supabaseMocks.setSelectResult(supabaseMocks.QUERY_ERROR)
    const { Wrapper, queryClient } = createWrapper()

    const { result } = renderHook(() => useApporteurManualScores('ap-err'), { wrapper: Wrapper })

    await waitFor(() => {
      const state = queryClient.getQueryState(['apporteur-manual-scores', 'ap-err'])
      expect(state?.status).toBe('error')
    })

    const state = queryClient.getQueryState(['apporteur-manual-scores', 'ap-err'])
    expect(state?.error).toEqual({ message: 'x' })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.scores.organisation.value).toBe(DEFAULT_MANUAL_SCORES.organisation.value)
    expect(result.current.scores.organisation.comment).toBe(
      DEFAULT_MANUAL_SCORES.organisation.comment
    )
    expect(result.current.scores.relation.value).toBe(DEFAULT_MANUAL_SCORES.relation.value)
    expect(result.current.scores.relation.comment).toBe(DEFAULT_MANUAL_SCORES.relation.comment)
  })

  it('met à jour le score organisation en clampant la valeur et en conservant le score relation courant', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useApporteurManualScores('ap-mut'), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.scores.organisation.value).toBe(82)
    })

    await act(async () => {
      await result.current.updateScore.mutateAsync({
        key: 'organisation',
        value: 140,
        comment: 'Très bon suivi',
      })
    })

    expect(supabaseMocks.upsertCalls).toHaveLength(1)
    expect(supabaseMocks.upsertCalls.at(0)).toEqual({
      payload: {
        apporteur_id: 'ap-mut',
        organisation_score: 100,
        organisation_comment: 'Très bon suivi',
        relation_score: 91,
        relation_comment: 'Relation suivie',
        created_by: 'u1',
      },
      options: { onConflict: 'apporteur_id' },
    })
  })

  it('ne lance aucune requête quand apporteurId est absent', () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useApporteurManualScores(undefined), { wrapper: Wrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.scores.organisation.value).toBe(DEFAULT_MANUAL_SCORES.organisation.value)
    expect(result.current.scores.relation.value).toBe(DEFAULT_MANUAL_SCORES.relation.value)
    expect(supabaseMocks.mockFrom).not.toHaveBeenCalled()
    expect(supabaseMocks.mockChannel).not.toHaveBeenCalled()
  })
})
