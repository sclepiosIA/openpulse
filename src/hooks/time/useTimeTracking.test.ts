import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  isoWeek,
  toDateStr,
  weekDates,
  useActivityTypes,
  useWeekImputations,
  useWeeklySubmission,
  useUpsertImputation,
  useDeleteImputation,
  useSubmitWeek,
  useSuggestImputations,
  useSuggestWeekImputations,
  usePendingWeeklySubmissions,
  useApproveWeek,
  useRentabiliteEtablissement,
  useRentabiliteProjetRd,
} from './useTimeTracking'

const {
  AUTH_STATE,
  ACTIVITY_TYPES,
  IMPUTATIONS,
  WEEKLY_SUBMISSION,
  PENDING_SUBMISSIONS,
  RENTABILITE_ETABLISSEMENT,
  RENTABILITE_PROJET_RD,
  SUBMIT_WEEK_RESULT,
  SUGGEST_DAY_RESULT,
  SUGGEST_WEEK_RESULT,
  APPROVE_WEEK_RESULT,
  ERROR_RESULT_X,
  mockFrom,
  mockInvoke,
  mockSelect,
  mockEq,
  mockGte,
  mockOrder,
  mockLimit,
  mockInsert,
  mockUpdate,
  mockDelete,
  resetSupabaseMocks,
  setTableResult,
  setInvokeResult,
} = vi.hoisted(() => {
  type SupabaseError = { message: string }
  type QueryResult = { data: unknown; error: SupabaseError | null }

  const AUTH_USER = { id: 'u1', email: 't@t.co' }
  const AUTH_STATE = {
    user: AUTH_USER,
    session: { user: AUTH_USER },
    isLoading: false,
  }

  const ACTIVITY_TYPES = [
    {
      id: 'act-dev',
      code: 'DEV',
      label: 'Développement',
      category: 'production',
      is_billable_default: true,
      is_cir_eligible: true,
      is_absence: false,
      color: '#123',
    },
    {
      id: 'act-abs',
      code: 'ABS',
      label: 'Absence',
      category: 'absence',
      is_billable_default: false,
      is_cir_eligible: false,
      is_absence: true,
      color: null,
    },
  ]

  const IMPUTATIONS = [
    {
      id: 'imp1',
      user_id: 'u1',
      date_imputation: '2024-01-02',
      week_iso: '2024-W01',
      duration_minutes: 120,
      activity_type_id: 'act-dev',
      etablissement_id: 'et1',
      projet_rd_id: 'pr1',
      tache_id: null,
      is_billable: true,
      hourly_rate_snapshot: 50,
      cout_horaire_charge_snapshot: 30,
      tjm_snapshot: 400,
      note: 'atelier',
      status: 'draft',
    },
  ]

  const WEEKLY_SUBMISSION = {
    id: 'sub1',
    user_id: 'u1',
    week_iso: '2024-W01',
    status: 'submitted',
    total_minutes: 420,
    billable_minutes: 300,
    submitted_at: '2024-01-05T10:00:00Z',
    approved_at: null,
    rejection_reason: null,
    note: 'semaine complète',
  }

  const PENDING_SUBMISSIONS = [
    WEEKLY_SUBMISSION,
    {
      id: 'sub2',
      user_id: 'u2',
      week_iso: '2024-W02',
      status: 'submitted',
      total_minutes: 300,
      billable_minutes: 240,
      submitted_at: '2024-01-12T10:00:00Z',
      approved_at: null,
      rejection_reason: null,
      note: null,
    },
  ]

  const RENTABILITE_ETABLISSEMENT = [
    {
      mois: '2024-01',
      etablissement_id: 'et1',
      total_minutes: 600,
      billable_minutes: 480,
      chiffre_affaires: 1200,
      cout_charge: 700,
      marge: 500,
    },
  ]

  const RENTABILITE_PROJET_RD = [
    {
      mois: '2024-02',
      projet_rd_id: 'pr1',
      total_minutes: 900,
      billable_minutes: 600,
      chiffre_affaires: 1800,
      cout_charge: 950,
      marge: 850,
    },
  ]

  const SUBMIT_WEEK_PAYLOAD = { ok: true, status: 'submitted' }
  const SUGGEST_DAY_PAYLOAD = {
    suggestions: [
      {
        date: '2024-01-02',
        activity_type_code: 'DEV',
        duration_minutes: 180,
        etablissement_id: 'et1',
        projet_rd_id: 'pr1',
        note: 'Suggestion jour',
      },
    ],
  }
  const SUGGEST_WEEK_PAYLOAD = {
    suggestions: [
      {
        date: '2024-01-01',
        activity_type_code: 'DEV',
        duration_minutes: 240,
        etablissement_id: 'et1',
        projet_rd_id: null,
        note: 'Suggestion semaine',
      },
    ],
  }
  const APPROVE_WEEK_PAYLOAD = { ok: true, status: 'approved' }

  const ACTIVITY_TYPES_RESULT: QueryResult = { data: ACTIVITY_TYPES, error: null }
  const IMPUTATIONS_RESULT: QueryResult = { data: IMPUTATIONS, error: null }
  const WEEKLY_SUBMISSION_RESULT: QueryResult = { data: WEEKLY_SUBMISSION, error: null }
  const PENDING_SUBMISSIONS_RESULT: QueryResult = { data: PENDING_SUBMISSIONS, error: null }
  const RENTABILITE_ETABLISSEMENT_RESULT: QueryResult = {
    data: RENTABILITE_ETABLISSEMENT,
    error: null,
  }
  const RENTABILITE_PROJET_RD_RESULT: QueryResult = { data: RENTABILITE_PROJET_RD, error: null }
  const SUBMIT_WEEK_RESULT: QueryResult = { data: SUBMIT_WEEK_PAYLOAD, error: null }
  const SUGGEST_DAY_RESULT: QueryResult = { data: SUGGEST_DAY_PAYLOAD, error: null }
  const SUGGEST_WEEK_RESULT: QueryResult = { data: SUGGEST_WEEK_PAYLOAD, error: null }
  const APPROVE_WEEK_RESULT: QueryResult = { data: APPROVE_WEEK_PAYLOAD, error: null }
  const ERROR_RESULT_X: QueryResult = { data: null, error: { message: 'x' } }
  const EMPTY_RESULT: QueryResult = { data: null, error: null }

  const state = {
    tableResults: new Map<string, QueryResult>(),
    invokeResults: new Map<string, QueryResult>(),
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

  const resolveTable = (table: string): QueryResult => state.tableResults.get(table) ?? EMPTY_RESULT
  const resolveInvoke = (name: string): QueryResult => state.invokeResults.get(name) ?? EMPTY_RESULT

  const createBuilder = (table: string) => {
    const builder = {
      select: vi.fn((columns?: string) => {
        if (columns === undefined) {
          mockSelect()
        } else {
          mockSelect(columns)
        }
        return builder
      }),
      eq: vi.fn((column: string, value: unknown) => {
        mockEq(column, value)
        return builder
      }),
      gte: vi.fn((column: string, value: unknown) => {
        mockGte(column, value)
        return builder
      }),
      lte: vi.fn((column: string, value: unknown) => {
        mockLte(column, value)
        return builder
      }),
      in: vi.fn((column: string, values: readonly unknown[]) => {
        mockIn(column, values)
        return builder
      }),
      order: vi.fn((column: string, options?: { ascending?: boolean }) => {
        if (options === undefined) {
          mockOrder(column)
        } else {
          mockOrder(column, options)
        }
        return builder
      }),
      limit: vi.fn((count: number) => {
        mockLimit(count)
        return builder
      }),
      insert: vi.fn((value: unknown) => {
        mockInsert(value)
        return builder
      }),
      update: vi.fn((value: unknown) => {
        mockUpdate(value)
        return builder
      }),
      delete: vi.fn(() => {
        mockDelete()
        return builder
      }),
      single: vi.fn(() => Promise.resolve(resolveTable(table))),
      maybeSingle: vi.fn(() => Promise.resolve(resolveTable(table))),
      then: vi.fn(
        (
          onfulfilled?: ((value: QueryResult) => unknown) | null,
          onrejected?: ((reason: unknown) => unknown) | null
        ) => Promise.resolve(resolveTable(table)).then(onfulfilled, onrejected)
      ),
      catch: vi.fn((onrejected?: ((reason: unknown) => unknown) | null) =>
        Promise.resolve(resolveTable(table)).catch(onrejected)
      ),
    }

    return builder
  }

  const mockFrom = vi.fn((table: string) => createBuilder(table))
  const mockInvoke = vi.fn((name: string, _options?: unknown) =>
    Promise.resolve(resolveInvoke(name))
  )

  const resetSupabaseMocks = () => {
    AUTH_STATE.user = AUTH_USER
    AUTH_STATE.session = { user: AUTH_USER }
    AUTH_STATE.isLoading = false

    state.tableResults.clear()
    state.tableResults.set('time_activity_types', ACTIVITY_TYPES_RESULT)
    state.tableResults.set('time_imputations', IMPUTATIONS_RESULT)
    state.tableResults.set('time_weekly_submissions', WEEKLY_SUBMISSION_RESULT)
    state.tableResults.set('v_time_rentabilite_etablissement', RENTABILITE_ETABLISSEMENT_RESULT)
    state.tableResults.set('v_time_rentabilite_projet_rd', RENTABILITE_PROJET_RD_RESULT)

    state.invokeResults.clear()
    state.invokeResults.set('time-submit-week', SUBMIT_WEEK_RESULT)
    state.invokeResults.set('time-suggest-imputation', SUGGEST_DAY_RESULT)
    state.invokeResults.set('time-approve-week', APPROVE_WEEK_RESULT)
  }

  const setTableResult = (table: string, result: QueryResult) => {
    state.tableResults.set(table, result)
  }

  const setInvokeResult = (name: string, result: QueryResult) => {
    state.invokeResults.set(name, result)
  }

  resetSupabaseMocks()

  return {
    AUTH_STATE,
    ACTIVITY_TYPES,
    IMPUTATIONS,
    WEEKLY_SUBMISSION,
    PENDING_SUBMISSIONS,
    RENTABILITE_ETABLISSEMENT,
    RENTABILITE_PROJET_RD,
    SUBMIT_WEEK_RESULT,
    SUGGEST_DAY_RESULT,
    SUGGEST_WEEK_RESULT,
    APPROVE_WEEK_RESULT,
    ERROR_RESULT_X,
    mockFrom,
    mockInvoke,
    mockSelect,
    mockEq,
    mockGte,
    mockOrder,
    mockLimit,
    mockInsert,
    mockUpdate,
    mockDelete,
    resetSupabaseMocks,
    setTableResult,
    setInvokeResult,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
  useAuthSafe: () => AUTH_STATE,
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)

  return { wrapper, queryClient }
}

beforeEach(() => {
  resetSupabaseMocks()
  vi.clearAllMocks()
})

describe('date helpers', () => {
  it('calcule les semaines ISO et les dates UTC attendues', () => {
    expect(isoWeek(new Date(Date.UTC(2024, 0, 1)))).toBe('2024-W01')
    expect(isoWeek(new Date(Date.UTC(2024, 11, 30)))).toBe('2025-W01')
    expect(toDateStr(new Date(Date.UTC(2024, 0, 7)))).toBe('2024-01-07')

    const dates = weekDates('2024-W01').map(toDateStr)

    expect(dates).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      '2024-01-04',
      '2024-01-05',
      '2024-01-06',
      '2024-01-07',
    ])
  })
})

describe('useActivityTypes', () => {
  it('passe du chargement au succès avec les types d’activité actifs triés', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useActivityTypes(), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(ACTIVITY_TYPES)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0]).toMatchObject({
      id: 'act-dev',
      code: 'DEV',
      label: 'Développement',
      is_billable_default: true,
      is_cir_eligible: true,
    })
    expect(mockFrom).toHaveBeenCalledWith('time_activity_types')
    expect(mockSelect).toHaveBeenCalledWith(
      'id, code, label, category, is_billable_default, is_cir_eligible, is_absence, color'
    )
    expect(mockEq).toHaveBeenCalledWith('active', true)
    expect(mockOrder).toHaveBeenCalledWith('sort_order')
  })

  it('expose isError quand Supabase retourne une erreur', async () => {
    setTableResult('time_activity_types', ERROR_RESULT_X)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useActivityTypes(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toMatchObject({ message: 'x' })
    expect(result.current.data).toBeUndefined()
  })
})

describe('time tracking queries', () => {
  it('charge les imputations de la semaine pour l’utilisateur authentifié', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useWeekImputations('2024-W01'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(IMPUTATIONS)
    expect(result.current.data?.[0]).toMatchObject({
      id: 'imp1',
      user_id: 'u1',
      week_iso: '2024-W01',
      duration_minutes: 120,
      activity_type_id: 'act-dev',
      status: 'draft',
    })
    expect(mockFrom).toHaveBeenCalledWith('time_imputations')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'u1')
    expect(mockEq).toHaveBeenCalledWith('week_iso', '2024-W01')
    expect(mockOrder).toHaveBeenCalledWith('date_imputation')
  })

  it('charge la soumission hebdomadaire via maybeSingle', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useWeeklySubmission('2024-W01'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(WEEKLY_SUBMISSION)
    expect(result.current.data).toMatchObject({
      id: 'sub1',
      user_id: 'u1',
      week_iso: '2024-W01',
      status: 'submitted',
      total_minutes: 420,
      billable_minutes: 300,
    })
    expect(mockFrom).toHaveBeenCalledWith('time_weekly_submissions')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'u1')
    expect(mockEq).toHaveBeenCalledWith('week_iso', '2024-W01')
  })

  it('charge les soumissions en attente de validation admin', async () => {
    setTableResult('time_weekly_submissions', { data: PENDING_SUBMISSIONS, error: null })
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => usePendingWeeklySubmissions(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(PENDING_SUBMISSIONS)
    expect(result.current.data?.map((submission) => submission.id)).toEqual(['sub1', 'sub2'])
    expect(mockFrom).toHaveBeenCalledWith('time_weekly_submissions')
    expect(mockEq).toHaveBeenCalledWith('status', 'submitted')
    expect(mockOrder).toHaveBeenCalledWith('submitted_at', { ascending: false })
  })
})

describe('time tracking mutations', () => {
  it('insère une imputation avec user_id et week_iso calculés', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useUpsertImputation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        date_imputation: '2024-01-02',
        duration_minutes: 120,
        activity_type_id: 'act-dev',
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('time_imputations')
    expect(mockInsert).toHaveBeenCalledWith({
      date_imputation: '2024-01-02',
      duration_minutes: 120,
      activity_type_id: 'act-dev',
      user_id: 'u1',
      week_iso: '2024-W01',
    })
  })

  it('met à jour une imputation existante par id', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useUpsertImputation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'imp1',
        date_imputation: '2024-01-03',
        duration_minutes: 90,
        note: 'mise à jour',
      })
    })

    expect(mockUpdate).toHaveBeenCalledWith({
      id: 'imp1',
      date_imputation: '2024-01-03',
      duration_minutes: 90,
      note: 'mise à jour',
      user_id: 'u1',
      week_iso: '2024-W01',
    })
    expect(mockEq).toHaveBeenCalledWith('id', 'imp1')
  })

  it('supprime une imputation par id', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDeleteImputation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('imp1')
    })

    expect(mockFrom).toHaveBeenCalledWith('time_imputations')
    expect(mockDelete).toHaveBeenCalledWith()
    expect(mockEq).toHaveBeenCalledWith('id', 'imp1')
  })

  it('soumet une semaine via edge function', async () => {
    setInvokeResult('time-submit-week', SUBMIT_WEEK_RESULT)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useSubmitWeek(), { wrapper })

    let response: unknown = null
    await act(async () => {
      response = await result.current.mutateAsync({ week_iso: '2024-W01', note: 'ok' })
    })

    expect(response).toEqual({ ok: true, status: 'submitted' })
    expect(mockInvoke).toHaveBeenCalledWith('time-submit-week', {
      body: { week_iso: '2024-W01', note: 'ok' },
    })
  })

  it('remonte une erreur de mutation quand une edge function échoue', async () => {
    setInvokeResult('time-submit-week', ERROR_RESULT_X)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useSubmitWeek(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync({ week_iso: '2024-W01' })).rejects.toMatchObject({
        message: 'x',
      })
    })

    expect(mockInvoke).toHaveBeenCalledWith('time-submit-week', {
      body: { week_iso: '2024-W01', note: undefined },
    })
  })

  it('demande une suggestion IA pour une date', async () => {
    setInvokeResult('time-suggest-imputation', SUGGEST_DAY_RESULT)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useSuggestImputations(), { wrapper })

    let response: unknown = null
    await act(async () => {
      response = await result.current.mutateAsync('2024-01-02')
    })

    expect(response).toEqual({
      suggestions: [
        {
          date: '2024-01-02',
          activity_type_code: 'DEV',
          duration_minutes: 180,
          etablissement_id: 'et1',
          projet_rd_id: 'pr1',
          note: 'Suggestion jour',
        },
      ],
    })
    expect(mockInvoke).toHaveBeenCalledWith('time-suggest-imputation', {
      body: { date: '2024-01-02' },
    })
  })

  it('demande une suggestion IA pour toute une semaine', async () => {
    setInvokeResult('time-suggest-imputation', SUGGEST_WEEK_RESULT)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useSuggestWeekImputations(), { wrapper })

    let response: unknown = null
    await act(async () => {
      response = await result.current.mutateAsync('2024-01-01')
    })

    expect(response).toEqual({
      suggestions: [
        {
          date: '2024-01-01',
          activity_type_code: 'DEV',
          duration_minutes: 240,
          etablissement_id: 'et1',
          projet_rd_id: null,
          note: 'Suggestion semaine',
        },
      ],
    })
    expect(mockInvoke).toHaveBeenCalledWith('time-suggest-imputation', {
      body: { week_start: '2024-01-01' },
    })
  })

  it('approuve une semaine via edge function', async () => {
    setInvokeResult('time-approve-week', APPROVE_WEEK_RESULT)
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useApproveWeek(), { wrapper })

    let response: unknown = null
    await act(async () => {
      response = await result.current.mutateAsync({
        submission_id: 'sub1',
        action: 'approve',
        reason: 'valide',
      })
    })

    expect(response).toEqual({ ok: true, status: 'approved' })
    expect(mockInvoke).toHaveBeenCalledWith('time-approve-week', {
      body: { submission_id: 'sub1', action: 'approve', reason: 'valide' },
    })
  })
})

describe('rentabilité queries', () => {
  it('charge la rentabilité par établissement avec filtre mois', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useRentabiliteEtablissement('2024-01'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(RENTABILITE_ETABLISSEMENT)
    expect(result.current.data?.[0]).toMatchObject({
      mois: '2024-01',
      etablissement_id: 'et1',
      total_minutes: 600,
      marge: 500,
    })
    expect(mockFrom).toHaveBeenCalledWith('v_time_rentabilite_etablissement')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockGte).toHaveBeenCalledWith('mois', '2024-01')
    expect(mockOrder).toHaveBeenCalledWith('mois', { ascending: false })
    expect(mockLimit).toHaveBeenCalledWith(500)
  })

  it('charge la rentabilité par projet R&D avec filtre mois', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useRentabiliteProjetRd('2024-02'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(RENTABILITE_PROJET_RD)
    expect(result.current.data?.[0]).toMatchObject({
      mois: '2024-02',
      projet_rd_id: 'pr1',
      total_minutes: 900,
      marge: 850,
    })
    expect(mockFrom).toHaveBeenCalledWith('v_time_rentabilite_projet_rd')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockGte).toHaveBeenCalledWith('mois', '2024-02')
    expect(mockOrder).toHaveBeenCalledWith('mois', { ascending: false })
    expect(mockLimit).toHaveBeenCalledWith(500)
  })
})
