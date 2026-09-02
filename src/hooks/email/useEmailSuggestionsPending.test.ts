import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEmailSuggestionsPending } from './useEmailSuggestionsPending'

const {
  SUGGESTIONS_ROWS,
  THREADS_ROWS,
  ETABS_ROWS,
  DOMAIN_MAPPINGS_ROWS,
  ALL_ETABS_ROWS,
  mockFrom,
  builderByTable,
  setBuilderResponse,
  resetBuilders,
  debugLog,
} = vi.hoisted(() => {
  type SupabaseError = { message: string } | null
  type SupabaseResponse<T> = { data: T; error: SupabaseError }

  const SUGGESTIONS_ROWS = [
    {
      id: 's1',
      email_thread_id: 't1',
      suggested_etablissement_id: null,
      match_confidence: 0.9,
      match_reason: 'domain: newco.example',
      suggestion_type: 'ai',
      extracted_data: { nom: 'NewCo', ville: 'Paris' },
      created_at: '2024-01-02T10:00:00.000Z',
      status: 'pending',
    },
    {
      id: 's2',
      email_thread_id: 't2',
      suggested_etablissement_id: 'e1',
      match_confidence: 0.8,
      match_reason: 'depuis configured.example',
      suggestion_type: 'ai',
      extracted_data: { domain: 'configured.example' },
      created_at: '2024-01-03T10:00:00.000Z',
      status: 'pending',
    },
    {
      id: 's3',
      email_thread_id: 't3',
      suggested_etablissement_id: null,
      match_confidence: 0.7,
      match_reason: null,
      suggestion_type: 'ai',
      extracted_data: [{ domain: 'newdomain.example', ville: 'Lyon', nom: 'LyoCo' }],
      created_at: '2024-01-04T10:00:00.000Z',
      status: 'pending',
    },
  ] as const

  const THREADS_ROWS = [
    { id: 't1', subject: 'Demande infos', ai_summary: 'x', last_message_date: '2024-01-02T10:00:00.000Z', message_count: 1 },
    { id: 't2', subject: 'Question', ai_summary: null, last_message_date: '2024-01-03T10:00:00.000Z', message_count: 1 },
    { id: 't3', subject: '(sans objet)', ai_summary: null, last_message_date: '2024-01-04T10:00:00.000Z', message_count: 1 },
  ] as const

  const ETABS_ROWS = [{ id: 'e1', nom: 'Configured School', ville: 'Nice' }] as const
  const DOMAIN_MAPPINGS_ROWS = [{ domain: 'configured.example' }] as const
  const ALL_ETABS_ROWS = [{ email_domains: ['configured.example', 'known.example'] }] as const

  type ResponseByTable = Map<string, SupabaseResponse<unknown>>
  const responseByTable: ResponseByTable = new Map()

  type Builder = {
    __table: string
    __ops: Array<{ method: string; args: unknown[] }>
    select: (...args: unknown[]) => Builder
    eq: (...args: unknown[]) => Builder
    gte: (...args: unknown[]) => Builder
    lte: (...args: unknown[]) => Builder
    in: (...args: unknown[]) => Builder
    order: (...args: unknown[]) => Builder
    limit: (...args: unknown[]) => Builder
    insert: (...args: unknown[]) => Builder
    update: (...args: unknown[]) => Builder
    delete: (...args: unknown[]) => Builder
    single: () => Promise<SupabaseResponse<unknown>>
    maybeSingle: () => Promise<SupabaseResponse<unknown>>
    then: <TResult1 = SupabaseResponse<unknown>, TResult2 = never>(
      onfulfilled?: ((value: SupabaseResponse<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise<TResult1 | TResult2>
    catch: <TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
    ) => Promise<SupabaseResponse<unknown> | TResult>
  }

  const builderByTable = new Map<string, Builder>()

  const getResponse = (table: string): SupabaseResponse<unknown> =>
    responseByTable.get(table) ?? { data: null, error: null }

  const createBuilder = (table: string): Builder => {
    const builder: Builder = {
      __table: table,
      __ops: [],
      select: (...args) => {
        builder.__ops.push({ method: 'select', args })
        return builder
      },
      eq: (...args) => {
        builder.__ops.push({ method: 'eq', args })
        return builder
      },
      gte: (...args) => {
        builder.__ops.push({ method: 'gte', args })
        return builder
      },
      lte: (...args) => {
        builder.__ops.push({ method: 'lte', args })
        return builder
      },
      in: (...args) => {
        builder.__ops.push({ method: 'in', args })
        return builder
      },
      order: (...args) => {
        builder.__ops.push({ method: 'order', args })
        return builder
      },
      limit: (...args) => {
        builder.__ops.push({ method: 'limit', args })
        return builder
      },
      insert: (...args) => {
        builder.__ops.push({ method: 'insert', args })
        return builder
      },
      update: (...args) => {
        builder.__ops.push({ method: 'update', args })
        return builder
      },
      delete: (...args) => {
        builder.__ops.push({ method: 'delete', args })
        return builder
      },
      single: async () => getResponse(table),
      maybeSingle: async () => getResponse(table),
      then: (onfulfilled, onrejected) => Promise.resolve(getResponse(table)).then(onfulfilled as never, onrejected as never),
      catch: (onrejected) => Promise.resolve(getResponse(table)).catch(onrejected as never),
    }
    return builder
  }

  const mockFrom = vi.fn((table: string) => {
    const builder = createBuilder(table)
    builderByTable.set(table, builder)
    return builder
  })

  const setBuilderResponse = (table: string, response: SupabaseResponse<unknown>) => {
    responseByTable.set(table, response)
  }

  const resetBuilders = () => {
    builderByTable.clear()
    responseByTable.clear()
    mockFrom.mockClear()
    debugLog.mockClear()
  }

  const debugLog = vi.fn()

  return {
    SUGGESTIONS_ROWS,
    THREADS_ROWS,
    ETABS_ROWS,
    DOMAIN_MAPPINGS_ROWS,
    ALL_ETABS_ROWS,
    mockFrom,
    builderByTable,
    setBuilderResponse,
    resetBuilders,
    debugLog,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    log: debugLog,
  },
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const Wrapper = ({ children }: React.PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { Wrapper, queryClient }
}

describe('useEmailSuggestionsPending', () => {
  it('passe par isLoading puis retourne les suggestions filtrées/enrichies (succès)', async () => {
    resetBuilders()

    setBuilderResponse('email_to_etablissement_suggestions', { data: SUGGESTIONS_ROWS, error: null })
    setBuilderResponse('email_threads', { data: THREADS_ROWS, error: null })
    setBuilderResponse('etablissements', { data: ETABS_ROWS, error: null })
    setBuilderResponse('email_domain_mappings', { data: DOMAIN_MAPPINGS_ROWS, error: null })
    setBuilderResponse('etablissements:all', { data: ALL_ETABS_ROWS, error: null })

    const originalFrom = mockFrom.getMockImplementation()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'etablissements') {
        const existing = builderByTable.get('etablissements')
        if (!existing) return originalFrom ? originalFrom(table) : ({} as never)

        const callsForThisTable = mockFrom.mock.calls.filter((c) => c[0] === 'etablissements').length
        if (callsForThisTable >= 2) {
          const b = (originalFrom ? originalFrom(table) : existing) as typeof existing
          builderByTable.set('etablissements:all:builder', b)
          return b
        }
        return existing
      }
      return originalFrom ? originalFrom(table) : ({} as never)
    })

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useEmailSuggestionsPending(), { wrapper: Wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const data = result.current.data
    expect(Array.isArray(data)).toBe(true)

    expect(data?.map((s) => s.id)).toEqual(['s1'])
    const s1 = data?.[0]
    expect(s1.email_thread.id).toBe('t1')
    expect(s1.email_thread.subject).toBe('Demande infos')
    expect(s1.suggested_etablissement).toBeUndefined()
    expect(s1.display_etab_name).toBe('NewCo')
    expect(s1.display_etab_ville).toBe('Paris')
    expect(s1.derived_domains).toEqual(['newco.example'])

    const suggestionsBuilder = builderByTable.get('email_to_etablissement_suggestions')
    expect(
      suggestionsBuilder?.__ops.some((o) => o.method === 'eq' && o.args[0] === 'status' && o.args[1] === 'pending')
    ).toBe(true)
    expect(
      suggestionsBuilder?.__ops.some((o) => o.method === 'gte' && o.args[0] === 'match_confidence' && o.args[1] === 0.6)
    ).toBe(true)
    expect(suggestionsBuilder?.__ops.some((o) => o.method === 'limit' && o.args[0] === 50)).toBe(true)

    const threadsBuilder = builderByTable.get('email_threads')
    const inOp = threadsBuilder?.__ops.find((o) => o.method === 'in' && o.args[0] === 'id')
    expect(Array.isArray(inOp?.args[1])).toBe(true)
    expect(new Set(inOp?.args[1] as string[])).toEqual(new Set(['t1', 't2', 't3']))

    const domainMappingsBuilder = builderByTable.get('email_domain_mappings')
    expect(domainMappingsBuilder?.__ops.some((o) => o.method === 'select' && typeof o.args[0] === 'string' && (o.args[0] as string).includes('domain'))).toBe(true)

    expect(debugLog).toHaveBeenCalled()
  })

  it('met isError si la requête principale renvoie une erreur', async () => {
    resetBuilders()
    setBuilderResponse('email_to_etablissement_suggestions', { data: null, error: { message: 'x' } })

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useEmailSuggestionsPending(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeTruthy()
    expect((result.current.error as { message?: string }).message).toBe('x')
  })
})