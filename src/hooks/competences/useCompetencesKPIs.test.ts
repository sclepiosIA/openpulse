import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// @vitest-environment jsdom

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useCompetencesKPIs } from './useCompetencesKPIs'

const {
  TOTAL_COMPETENCES_COUNT,
  EMPLOYEE_COMPETENCES_ROWS,
  TOTAL_EMPLOYEE_COMPETENCES_COUNT,
  CERT_EXPIRING_30_COUNT,
  CERT_EXPIRING_90_COUNT,
  PLANS_EN_COURS_COUNT,
  ACTIVE_PLANS_ROWS,
  mockFrom,
} = vi.hoisted(() => ({
  TOTAL_COMPETENCES_COUNT: 12,
  EMPLOYEE_COMPETENCES_ROWS: [
    { profile_id: 'p1' },
    { profile_id: 'p1' },
    { profile_id: 'p2' },
    { profile_id: 'p3' },
  ],
  TOTAL_EMPLOYEE_COMPETENCES_COUNT: 7,
  CERT_EXPIRING_30_COUNT: 2,
  CERT_EXPIRING_90_COUNT: 5,
  PLANS_EN_COURS_COUNT: 3,
  ACTIVE_PLANS_ROWS: [{ progression: 20 }, { progression: 50 }, { progression: 80 }],
  mockFrom: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

type QueryResult = {
  data?: unknown
  error?: { message: string } | null
  count?: number | null
}

type FilterCall = {
  method: string
  args: unknown[]
}

type Builder = {
  table: string
  selectedColumns?: string
  selectOptions?: Record<string, unknown>
  filters: FilterCall[]
  limitValue?: number
  result: QueryResult
  select: (columns: string, options?: Record<string, unknown>) => Builder
  eq: (column: string, value: unknown) => Builder
  gte: (column: string, value: unknown) => Builder
  lte: (column: string, value: unknown) => Builder
  in: (column: string, value: unknown[]) => Builder
  order: (...args: unknown[]) => Builder
  limit: (value: number) => Builder
  insert: (...args: unknown[]) => Builder
  update: (...args: unknown[]) => Builder
  delete: () => Builder
  single: () => Promise<QueryResult>
  maybeSingle: () => Promise<QueryResult>
  then: <TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => Promise<TResult1 | TResult2>
  catch: <TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ) => Promise<QueryResult | TResult>
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper() {
  const queryClient = createQueryClient()

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

function createBuilder(table: string, resolver: (builder: Builder) => QueryResult): Builder {
  const builder = {} as Builder

  builder.table = table
  builder.filters = []
  builder.result = {}

  builder.select = (columns: string, options?: Record<string, unknown>) => {
    builder.selectedColumns = columns
    builder.selectOptions = options
    builder.result = resolver(builder)
    return builder
  }

  builder.eq = (column: string, value: unknown) => {
    builder.filters.push({ method: 'eq', args: [column, value] })
    builder.result = resolver(builder)
    return builder
  }

  builder.gte = (column: string, value: unknown) => {
    builder.filters.push({ method: 'gte', args: [column, value] })
    builder.result = resolver(builder)
    return builder
  }

  builder.lte = (column: string, value: unknown) => {
    builder.filters.push({ method: 'lte', args: [column, value] })
    builder.result = resolver(builder)
    return builder
  }

  builder.in = (column: string, value: unknown[]) => {
    builder.filters.push({ method: 'in', args: [column, value] })
    builder.result = resolver(builder)
    return builder
  }

  builder.order = (..._args: unknown[]) => {
    builder.result = resolver(builder)
    return builder
  }

  builder.limit = (value: number) => {
    builder.limitValue = value
    builder.result = resolver(builder)
    return builder
  }

  builder.insert = (..._args: unknown[]) => {
    builder.result = resolver(builder)
    return builder
  }

  builder.update = (..._args: unknown[]) => {
    builder.result = resolver(builder)
    return builder
  }

  builder.delete = () => {
    builder.result = resolver(builder)
    return builder
  }

  builder.single = () => Promise.resolve(builder.result)
  builder.maybeSingle = () => Promise.resolve(builder.result)
  builder.then = (onfulfilled, onrejected) =>
    Promise.resolve(builder.result).then(onfulfilled, onrejected)
  builder.catch = (onrejected) => Promise.resolve(builder.result).catch(onrejected)

  return builder
}

describe('useCompetencesKPIs', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('retourne isLoading puis calcule les KPIs métier attendus en succès', async () => {
    let certificationCallIndex = 0

    mockFrom.mockImplementation((table: string) =>
      createBuilder(table, (builder) => {
        if (table === 'referentiel_competences') {
          return { count: TOTAL_COMPETENCES_COUNT, error: null }
        }

        if (table === 'employee_competences') {
          if (builder.selectedColumns === 'profile_id' && builder.limitValue === 1000) {
            return { data: EMPLOYEE_COMPETENCES_ROWS, error: null }
          }

          if (builder.selectedColumns === 'id') {
            return { count: TOTAL_EMPLOYEE_COMPETENCES_COUNT, error: null }
          }
        }

        if (table === 'employee_certifications') {
          const hasStatusValid = builder.filters.some(
            (f) => f.method === 'eq' && f.args[0] === 'statut' && f.args[1] === 'valide'
          )
          const hasGteDate = builder.filters.some(
            (f) =>
              f.method === 'gte' && f.args[0] === 'date_expiration' && typeof f.args[1] === 'string'
          )
          const hasLteDate = builder.filters.some(
            (f) =>
              f.method === 'lte' && f.args[0] === 'date_expiration' && typeof f.args[1] === 'string'
          )

          if (hasStatusValid && hasGteDate && hasLteDate) {
            certificationCallIndex += 1
            return {
              count: certificationCallIndex === 1 ? CERT_EXPIRING_30_COUNT : CERT_EXPIRING_90_COUNT,
              error: null,
            }
          }
        }

        if (table === 'plans_developpement') {
          const hasEnCours = builder.filters.some(
            (f) => f.method === 'eq' && f.args[0] === 'statut' && f.args[1] === 'en_cours'
          )

          if (builder.selectedColumns === 'id' && hasEnCours) {
            return { count: PLANS_EN_COURS_COUNT, error: null }
          }

          if (builder.selectedColumns === 'progression' && hasEnCours) {
            return { data: ACTIVE_PLANS_ROWS, error: null }
          }
        }

        return { data: null, error: null }
      })
    )

    const { result } = renderHook(() => useCompetencesKPIs(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({
      totalCompetences: 12,
      totalEmployeesWithCompetences: 3,
      averageCompetencesPerEmployee: 2.3,
      certificationExpiringIn30Days: 2,
      certificationExpiringIn90Days: 5,
      plansEnCours: 3,
      progressionMoyenne: 50,
    })

    expect(mockFrom).toHaveBeenCalledWith('referentiel_competences')
    expect(mockFrom).toHaveBeenCalledWith('employee_competences')
    expect(mockFrom).toHaveBeenCalledWith('employee_certifications')
    expect(mockFrom).toHaveBeenCalledWith('plans_developpement')
    expect(mockFrom).toHaveBeenCalledTimes(7)
  })

  it('passe en erreur quand une requête Supabase renvoie error', async () => {
    mockFrom.mockImplementation((table: string) =>
      createBuilder(table, () => {
        if (table === 'referentiel_competences') {
          throw new Error('x')
        }

        return { data: null, error: null }
      })
    )

    const { result } = renderHook(() => useCompetencesKPIs(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toContain('x')
    expect(mockFrom).toHaveBeenCalledWith('referentiel_competences')
  })
})
