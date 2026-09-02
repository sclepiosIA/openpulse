/* @vitest-environment jsdom */

import React, { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  useBIDatasets,
  useBIQuestions,
  useBIQuestion,
  useSaveBIQuestion,
  useDeleteBIQuestion,
  useBIDashboards,
  useBIDashboard,
  useUpdateBIDashboardLayout,
  useRunBIQuery,
  useExplainBIWithAI,
  type BIQuestion,
} from './useBIStudio'

const {
  DATASETS_ROWS,
  QUESTIONS_ROWS,
  QUESTION_ROW,
  DASHBOARDS_ROWS,
  DASHBOARD_ROW,
  RUN_RESULT,
  ANALYSIS_TEXT,
  INSERTED_QUESTION,
  UPDATED_QUESTION,
  mockFrom,
  mockInvoke,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  DATASETS_ROWS: [
    {
      id: 'ds1',
      key: 'sales',
      name: 'Sales',
      description: 'Sales dataset',
      source_view: 'vw_sales',
      columns: [{ name: 'amount', type: 'number', label: 'Amount' }],
      allowed_roles: ['admin'],
      is_active: true,
      created_at: '2024-01-01',
    },
  ],
  QUESTIONS_ROWS: [
    {
      id: 'q1',
      dataset_id: 'ds1',
      name: 'Revenue by month',
      description: 'Monthly revenue',
      definition: {
        group_by: [{ col: 'created_at', date_trunc: 'month' }],
        aggregations: [{ fn: 'sum', col: 'amount', alias: 'revenue' }],
      },
      viz_type: 'line',
      viz_config: { x: 'month', y: 'revenue' },
      params: [],
      is_shared: true,
      tags: ['finance'],
      created_by: 'u1',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'q2',
      dataset_id: 'ds2',
      name: 'Orders count',
      description: null,
      definition: { aggregations: [{ fn: 'count', alias: 'count' }] },
      viz_type: 'kpi',
      viz_config: {},
      params: [],
      is_shared: false,
      tags: ['ops'],
      created_by: 'u1',
      created_at: '2024-01-03',
      updated_at: '2024-01-04',
    },
  ],
  QUESTION_ROW: {
    id: 'q1',
    dataset_id: 'ds1',
    name: 'Revenue by month',
    description: 'Monthly revenue',
    definition: {
      group_by: [{ col: 'created_at', date_trunc: 'month' }],
      aggregations: [{ fn: 'sum', col: 'amount', alias: 'revenue' }],
    },
    viz_type: 'line',
    viz_config: { x: 'month', y: 'revenue' },
    params: [],
    is_shared: true,
    tags: ['finance'],
    created_by: 'u1',
    created_at: '2024-01-01',
    updated_at: '2024-01-02',
  },
  DASHBOARDS_ROWS: [
    {
      id: 'd1',
      slug: 'sales-overview',
      name: 'Sales Overview',
      description: 'Main dashboard',
      icon: 'chart',
      layout: [{ i: 'q1', x: 0, y: 0, w: 6, h: 4 }],
      filters: [],
      allowed_roles: ['admin'],
      is_favorite: true,
      sort_order: 1,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
  ],
  DASHBOARD_ROW: {
    id: 'd1',
    slug: 'sales-overview',
    name: 'Sales Overview',
    description: 'Main dashboard',
    icon: 'chart',
    layout: [{ i: 'q1', x: 0, y: 0, w: 6, h: 4 }],
    filters: [],
    allowed_roles: ['admin'],
    is_favorite: true,
    sort_order: 1,
    created_at: '2024-01-01',
    updated_at: '2024-01-02',
  },
  RUN_RESULT: {
    rows: [{ month: '2024-01', revenue: 1200 }],
    row_count: 1,
    cached: true,
    duration_ms: 42,
    sql: 'select ...',
  },
  ANALYSIS_TEXT: 'Revenue is increasing.',
  INSERTED_QUESTION: {
    id: 'q-new',
    dataset_id: 'ds1',
    name: 'New question',
    description: null,
    definition: {},
    viz_type: 'table',
    viz_config: {},
    params: [],
    is_shared: false,
    tags: [],
    created_by: 'u1',
    created_at: '2024-02-01',
    updated_at: '2024-02-01',
  },
  UPDATED_QUESTION: {
    id: 'q1',
    dataset_id: 'ds1',
    name: 'Updated question',
    description: 'Updated desc',
    definition: {},
    viz_type: 'table',
    viz_config: {},
    params: [],
    is_shared: true,
    tags: ['updated'],
    created_by: 'u1',
    created_at: '2024-01-01',
    updated_at: '2024-02-02',
  },
  mockFrom: vi.fn(),
  mockInvoke: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}))

type ResultShape = { data?: unknown; error?: Error | null }

function createBuilder(result: ResultShape, state?: { table?: string }) {
  const builderState = state ?? {}
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      if (builderState.table === 'bi_questions' && column === 'dataset_id') {
        return createBuilder(
          { data: QUESTIONS_ROWS.filter((q) => q.dataset_id === value), error: null },
          builderState
        )
      }
      if (builderState.table === 'bi_questions' && column === 'id') {
        return createBuilder({ data: QUESTION_ROW, error: null }, builderState)
      }
      if (builderState.table === 'bi_dashboards' && column === 'slug') {
        return createBuilder({ data: DASHBOARD_ROW, error: null }, builderState)
      }
      return builder
    }),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => createBuilder({ data: INSERTED_QUESTION, error: null }, builderState)),
    update: vi.fn(() => createBuilder({ data: UPDATED_QUESTION, error: null }, builderState)),
    delete: vi.fn(() => createBuilder({ data: null, error: null }, builderState)),
    single: vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
    maybeSingle: vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
    then: (onFulfilled: (value: { data: unknown; error: Error | null }) => unknown) =>
      Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).catch(onRejected),
  }
  return builder
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client }, children)
  }
}

describe('useBIStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockFrom.mockImplementation((table: string) => {
      if (table === 'bi_datasets')
        return createBuilder({ data: DATASETS_ROWS, error: null }, { table })
      if (table === 'bi_questions')
        return createBuilder({ data: QUESTIONS_ROWS, error: null }, { table })
      if (table === 'bi_dashboards')
        return createBuilder({ data: DASHBOARDS_ROWS, error: null }, { table })
      return createBuilder({ data: [], error: null }, { table })
    })

    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'bi-run-query') {
        return Promise.resolve({ data: RUN_RESULT, error: null })
      }
      if (fnName === 'bi-explain-with-ai') {
        return Promise.resolve({ data: { analysis: ANALYSIS_TEXT }, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })
  })

  it('charge les datasets actifs et les trie via la requête', async () => {
    const client = createQueryClient()
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useBIDatasets(), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('bi_datasets')
    expect(result.current.data).toEqual(DATASETS_ROWS)
    expect(result.current.data?.[0].name).toBe('Sales')
    expect(result.current.data?.[0].source_view).toBe('vw_sales')
  })

  it('passe en erreur si le chargement des datasets échoue', async () => {
    const client = createQueryClient()
    const wrapper = createWrapper(client)
    const error = new Error('datasets failed')

    mockFrom.mockImplementation((table: string) => {
      if (table === 'bi_datasets') return createBuilder({ data: null, error }, { table })
      return createBuilder({ data: [], error: null }, { table })
    })

    const { result } = renderHook(() => useBIDatasets(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('datasets failed')
  })

  it('charge toutes les questions puis filtre par datasetId', async () => {
    const client = createQueryClient()
    const wrapper = createWrapper(client)

    const allHook = renderHook(() => useBIQuestions(), { wrapper })
    await waitFor(() => expect(allHook.result.current.isSuccess).toBe(true))
    expect(allHook.result.current.data).toHaveLength(2)
    expect(allHook.result.current.data?.[0].name).toBe('Revenue by month')

    const filteredClient = createQueryClient()
    const filteredWrapper = createWrapper(filteredClient)
    const filteredHook = renderHook(() => useBIQuestions('ds1'), { wrapper: filteredWrapper })
    await waitFor(() => expect(filteredHook.result.current.isSuccess).toBe(true))
    expect(filteredHook.result.current.data).toEqual([QUESTIONS_ROWS[0]])
    expect(filteredHook.result.current.data?.[0].dataset_id).toBe('ds1')
  })

  it('charge une question par id et reste idle sans id', async () => {
    const idleClient = createQueryClient()
    const idleWrapper = createWrapper(idleClient)
    const idleHook = renderHook(() => useBIQuestion(), { wrapper: idleWrapper })

    expect(idleHook.result.current.fetchStatus).toBe('idle')
    expect(idleHook.result.current.data).toBeUndefined()

    const client = createQueryClient()
    const wrapper = createWrapper(client)
    const { result } = renderHook(() => useBIQuestion('q1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('q1')
    expect(result.current.data?.name).toBe('Revenue by month')
    expect(result.current.data?.viz_type).toBe('line')
  })

  it('sauvegarde une nouvelle question puis invalide et toast success', async () => {
    const client = createQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useSaveBIQuestion(), { wrapper })

    const payload = {
      dataset_id: 'ds1',
      name: 'New question',
      definition: {},
      viz_type: 'table' as const,
      viz_config: {},
      tags: [],
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(mockFrom).toHaveBeenCalledWith('bi_questions')
    const questionsBuilder = mockFrom.mock.results.find((r) => r.type === 'return')
      ?.value as ReturnType<typeof createBuilder>
    expect(questionsBuilder.insert).toHaveBeenCalledWith({
      name: 'New question',
      description: null,
      definition: {},
      viz_type: 'table',
      viz_config: {},
      tags: [],
      dataset_id: 'ds1',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bi', 'questions'] })
    expect(toastSuccess).toHaveBeenCalledWith('Question sauvegardée')
  })

  it('met à jour une question existante avec le bon payload', async () => {
    const client = createQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useSaveBIQuestion(), { wrapper })

    const payload: Partial<BIQuestion> & { dataset_id: string; name: string } = {
      id: 'q1',
      dataset_id: 'ds1',
      name: 'Updated question',
      description: 'Updated desc',
      definition: {},
      viz_type: 'table',
      viz_config: {},
      tags: ['updated'],
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    const questionsBuilder = mockFrom.mock.results.find((r) => r.type === 'return')
      ?.value as ReturnType<typeof createBuilder>
    expect(questionsBuilder.update).toHaveBeenCalledWith({
      name: 'Updated question',
      description: 'Updated desc',
      definition: {},
      viz_type: 'table',
      viz_config: {},
      tags: ['updated'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bi', 'questions'] })
    expect(toastSuccess).toHaveBeenCalledWith('Question sauvegardée')
  })

  it('gère les erreurs de sauvegarde avec isError et toast error', async () => {
    const client = createQueryClient()
    const wrapper = createWrapper(client)
    const error = new Error('save failed')

    mockFrom.mockImplementation((table: string) => {
      if (table !== 'bi_questions') return createBuilder({ data: [], error: null }, { table })
      const failing = createBuilder({ data: null, error }, { table })
      failing.insert = vi.fn(() => createBuilder({ data: null, error }, { table }))
      return failing
    })

    const { result } = renderHook(() => useSaveBIQuestion(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          dataset_id: 'ds1',
          name: 'Broken question',
        })
      ).rejects.toThrow('save failed')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toastError).toHaveBeenCalledWith('Erreur : save failed')
  })

  it('supprime une question puis invalide et toast success', async () => {
    const client = createQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useDeleteBIQuestion(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('q1')
    })

    const questionsBuilder = mockFrom.mock.results.find((r) => r.type === 'return')
      ?.value as ReturnType<typeof createBuilder>
    expect(questionsBuilder.delete).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bi', 'questions'] })
    expect(toastSuccess).toHaveBeenCalledWith('Question supprimée')
  })

  it('charge les dashboards et un dashboard par slug', async () => {
    const client = createQueryClient()
    const wrapper = createWrapper(client)

    const dashboardsHook = renderHook(() => useBIDashboards(), { wrapper })
    await waitFor(() => expect(dashboardsHook.result.current.isSuccess).toBe(true))
    expect(dashboardsHook.result.current.data).toEqual(DASHBOARDS_ROWS)
    expect(dashboardsHook.result.current.data?.[0].slug).toBe('sales-overview')

    const singleClient = createQueryClient()
    const singleWrapper = createWrapper(singleClient)
    const dashboardHook = renderHook(() => useBIDashboard('sales-overview'), {
      wrapper: singleWrapper,
    })
    await waitFor(() => expect(dashboardHook.result.current.isSuccess).toBe(true))
    expect(dashboardHook.result.current.data?.name).toBe('Sales Overview')
    expect(dashboardHook.result.current.data?.layout[0]).toEqual({
      i: 'q1',
      x: 0,
      y: 0,
      w: 6,
      h: 4,
    })
  })

  it('met à jour le layout du dashboard', async () => {
    const client = createQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useUpdateBIDashboardLayout(), { wrapper })

    const layout = [{ i: 'q1', x: 1, y: 2, w: 8, h: 5 }]

    await act(async () => {
      await result.current.mutateAsync({ id: 'd1', layout })
    })

    const dashboardsBuilder = mockFrom.mock.results.find((r) => r.type === 'return')
      ?.value as ReturnType<typeof createBuilder>
    expect(dashboardsBuilder.update).toHaveBeenCalledWith({ layout })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bi', 'dashboards'] })
  })

  it('exécute une requête BI et remonte une erreur de fonction', async () => {
    const client = createQueryClient()
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useRunBIQuery('q1'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockInvoke).toHaveBeenCalledWith('bi-run-query', { body: { question_id: 'q1' } })
    expect(result.current.data).toEqual(RUN_RESULT)
    expect(result.current.data?.row_count).toBe(1)
    expect(result.current.data?.cached).toBe(true)

    const errorClient = createQueryClient()
    const errorWrapper = createWrapper(errorClient)
    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'bi-run-query') {
        return Promise.resolve({ data: { error: 'run failed' }, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const errorHook = renderHook(() => useRunBIQuery('q1'), { wrapper: errorWrapper })
    await waitFor(() => expect(errorHook.result.current.isError).toBe(true))
    expect(errorHook.result.current.error?.message).toBe('run failed')
  })

  it('explique les résultats avec AI et gère les erreurs', async () => {
    const client = createQueryClient()
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useExplainBIWithAI(), { wrapper })

    await act(async () => {
      const value = await result.current.mutateAsync({
        question_name: 'Revenue by month',
        rows: RUN_RESULT.rows,
        viz_type: 'line',
        context: 'finance',
      })
      expect(value).toBe('Revenue is increasing.')
    })

    expect(mockInvoke).toHaveBeenCalledWith('bi-explain-with-ai', {
      body: {
        question_name: 'Revenue by month',
        rows: RUN_RESULT.rows,
        viz_type: 'line',
        context: 'finance',
      },
    })

    const errorClient = createQueryClient()
    const errorWrapper = createWrapper(errorClient)
    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'bi-explain-with-ai') {
        return Promise.resolve({ data: { error: 'ai failed' }, error: null })
      }
      return Promise.resolve({ data: RUN_RESULT, error: null })
    })

    const errorHook = renderHook(() => useExplainBIWithAI(), { wrapper: errorWrapper })

    await act(async () => {
      await expect(
        errorHook.result.current.mutateAsync({
          question_name: 'Revenue by month',
          rows: RUN_RESULT.rows,
        })
      ).rejects.toThrow('ai failed')
    })

    await waitFor(() => expect(errorHook.result.current.isError).toBe(true))
  })
})
