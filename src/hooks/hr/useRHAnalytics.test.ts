import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRHAnalytics } from './useRHAnalytics'

const {
  mockFrom,
  mockSelect,
  mockGte,
  mockOrder,
  mockLimit,
  mockSingle,
  mockMaybeSingle,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockThen,
  mockCatch,
  baseDate,
  salairesDataSuccess,
  profilesDataSuccess,
  salairesErrorResponse,
  profilesErrorResponse,
} = vi.hoisted(() => {
  const mockThen = vi.fn()
  const mockCatch = vi.fn()

  const builder: Record<string, unknown> = {}

  const chain = function (this: unknown) {
    return this
  }

  builder.select = vi.fn(chain)
  builder.gte = vi.fn(chain)
  builder.lte = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.in = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.limit = vi.fn(chain)
  builder.insert = vi.fn(chain)
  builder.update = vi.fn(chain)
  builder.delete = vi.fn(chain)

  builder.single = vi.fn(async () => ({ data: null, error: null }))
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }))

  builder.then = mockThen
  builder.catch = mockCatch

  const mockSelect = builder.select as jest.Mock | typeof vi.fn
  const mockGte = builder.gte as jest.Mock | typeof vi.fn
  const mockOrder = builder.order as jest.Mock | typeof vi.fn
  const mockLimit = builder.limit as jest.Mock | typeof vi.fn
  const mockSingle = builder.single as jest.Mock | typeof vi.fn
  const mockMaybeSingle = builder.maybeSingle as jest.Mock | typeof vi.fn
  const mockInsert = builder.insert as jest.Mock | typeof vi.fn
  const mockUpdate = builder.update as jest.Mock | typeof vi.fn
  const mockDelete = builder.delete as jest.Mock | typeof vi.fn

  const mockFrom = vi.fn((_table: string) => builder)

  const baseDate = new Date('2024-06-15T00:00:00.000Z')

  const salairesDataSuccess = [
    {
      profile_id: 'p1',
      mois: '2024-05-01',
      salaire_brut: 3000,
      cotisations_salariales: 600,
      cotisations_patronales: 900,
      primes: 200,
      heures_supplementaires: 10,
      profiles: {
        nom: 'Durand',
        prenom: 'Alice',
      },
    },
    {
      profile_id: 'p2',
      mois: '2024-05-01',
      salaire_brut: 2500,
      cotisations_salariales: 500,
      cotisations_patronales: 800,
      primes: 0,
      heures_supplementaires: 5,
      profiles: {
        nom: 'Martin',
        prenom: 'Bob',
      },
    },
    {
      profile_id: 'p1',
      mois: '2024-04-01',
      salaire_brut: 2900,
      cotisations_salariales: 580,
      cotisations_patronales: 870,
      primes: 150,
      heures_supplementaires: 8,
      profiles: {
        nom: 'Durand',
        prenom: 'Alice',
      },
    },
  ]

  const profilesDataSuccess = [
    {
      id: 'p1',
      date_embauche: '2022-01-10',
      type_contrat: 'cdi',
      actif: true,
      nom: 'Durand',
      prenom: 'Alice',
    },
    {
      id: 'p2',
      date_embauche: '2023-11-05',
      type_contrat: 'cdd',
      actif: false,
      nom: 'Martin',
      prenom: 'Bob',
    },
    {
      id: 'p3',
      date_embauche: '2024-02-01',
      type_contrat: 'stage',
      actif: true,
      nom: 'Dupont',
      prenom: 'Chloe',
    },
    {
      id: 'p4',
      date_embauche: null,
      type_contrat: null,
      actif: true,
      nom: 'Sans',
      prenom: 'Date',
    },
  ]

  const salairesErrorResponse = { data: null, error: { message: 'salaires error' } }
  const profilesErrorResponse = { data: null, error: { message: 'profiles error' } }

  return {
    mockFrom,
    mockSelect,
    mockGte,
    mockOrder,
    mockLimit,
    mockSingle,
    mockMaybeSingle,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockThen,
    mockCatch,
    baseDate,
    salairesDataSuccess,
    profilesDataSuccess,
    salairesErrorResponse,
    profilesErrorResponse,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('date-fns', async () => {
  const actual = await vi.importActual<typeof import('date-fns')>('date-fns')
  return {
    ...actual,
    subMonths: (date: Date, amount: number) => {
      const d = new Date(date.getTime())
      d.setMonth(d.getMonth() - amount)
      return d
    },
    format: (date: Date, fmt: string) => {
      const yyyy = date.getUTCFullYear()
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(date.getUTCDate()).padStart(2, '0')
      if (fmt === 'yyyy-MM-dd') {
        return `${yyyy}-${mm}-${dd}`
      }
      return `${yyyy}-${mm}-${dd}`
    },
    differenceInMonths: (dateLeft: Date, dateRight: Date) => {
      const yearDiff = dateLeft.getUTCFullYear() - dateRight.getUTCFullYear()
      const monthDiff = dateLeft.getUTCMonth() - dateRight.getUTCMonth()
      const totalMonths = yearDiff * 12 + monthDiff
      return totalMonths
    },
  }
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

function createWrapper() {
  const queryClient = createQueryClient()
  function Wrapper(props: { children?: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
  return Wrapper
}

describe('useRHAnalytics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(baseDate)

    mockFrom.mockClear()
    mockSelect.mockClear()
    mockGte.mockClear()
    mockOrder.mockClear()
    mockLimit.mockClear()
    mockThen.mockReset()
    mockCatch.mockReset()

    mockThen.mockImplementation(function (this: unknown, onFulfilled?: (value: unknown) => unknown, _onRejected?: (reason: unknown) => unknown) {
      if (typeof onFulfilled === 'function') {
        onFulfilled({ data: salairesDataSuccess, error: null })
      }
      return this
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('gère le chargement puis le succès avec calculs métier corrects', async () => {
    let callIndex = 0

    mockThen.mockImplementation(function (this: unknown, onFulfilled?: (value: unknown) => unknown, _onRejected?: (reason: unknown) => unknown) {
      if (typeof onFulfilled === 'function') {
        if (callIndex === 0) {
          onFulfilled({ data: salairesDataSuccess, error: null })
        } else {
          onFulfilled({ data: profilesDataSuccess, error: null })
        }
      }
      callIndex += 1
      return this
    })

    const { result } = renderHook(() => useRHAnalytics(2), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'rh_salaires_mensuels')
    expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('profiles:profile_id'))
    expect(mockGte).toHaveBeenCalledWith(
      'mois',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    )
    expect(mockOrder).toHaveBeenCalledWith('mois', { ascending: true })

    expect(mockFrom).toHaveBeenNthCalledWith(2, 'profiles')
    expect(mockLimit).toHaveBeenCalledWith(500)

    expect(result.current.isSuccess).toBe(true)
    const data = result.current.data
    expect(data).toBeDefined()

    expect(data?.evolutionMensuelle).toHaveLength(2)
    const may = data?.evolutionMensuelle.find((m) => m.mois === '2024-05')
    const apr = data?.evolutionMensuelle.find((m) => m.mois === '2024-04')

    expect(may).toEqual({
      mois: '2024-05',
      masseSalariale: 3000 + 900 + 2500 + 800,
      effectif: 2,
      coutMoyen: (3000 + 900 + 2500 + 800) / 2,
    })
    expect(apr).toEqual({
      mois: '2024-04',
      masseSalariale: 2900 + 870,
      effectif: 1,
      coutMoyen: 2900 + 870,
    })

    expect(data?.repartitionContrats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'CDI', count: 1 }),
        expect.objectContaining({ type: 'CDD', count: 1 }),
        expect.objectContaining({ type: 'Stage', count: 1 }),
        expect.objectContaining({ type: 'Non spécifié', count: 1 }),
      ])
    )
    const totalProfiles = data?.repartitionContrats.reduce((sum, r) => sum + r.count, 0) ?? 0
    expect(totalProfiles).toBe(4)

    expect(typeof data?.ancienneteMoyenne).toBe('number')
    expect(data?.ancienneteMoyenne).toBeGreaterThan(0)

    expect(data?.turnover12Mois.entrees).toBeGreaterThanOrEqual(1)
    expect(data?.turnover12Mois.sorties).toBe(1)
    expect(data?.turnover12Mois.tauxTurnover).toBeGreaterThan(0)

    expect(data?.chargesDetail.totalSalaireBrut).toBe(3000 + 2500)
    expect(data?.chargesDetail.totalCotisationsSalariales).toBe(600 + 500)
    expect(data?.chargesDetail.totalCotisationsPatronales).toBe(900 + 800)
    expect(data?.chargesDetail.totalPrimes).toBe(200 + 0)
    expect(data?.chargesDetail.totalHeuresSupplementaires).toBe(10 + 5)

    expect(data?.top3Couts).toHaveLength(2)
    const top1 = data?.top3Couts[0]
    const top2 = data?.top3Couts[1]
    expect(top1?.coutTotal).toBeGreaterThan(top2?.coutTotal ?? 0)
    expect(top1).toMatchObject({
      profile_id: 'p1',
      nom: 'Durand',
      prenom: 'Alice',
    })
    expect(top2).toMatchObject({
      profile_id: 'p2',
      nom: 'Martin',
      prenom: 'Bob',
    })
  })

  it('renvoie isError quand la requête des salaires échoue', async () => {
    mockThen.mockImplementation(function (this: unknown, onFulfilled?: (value: unknown) => unknown, _onRejected?: (reason: unknown) => unknown) {
      if (typeof onFulfilled === 'function') {
        onFulfilled(salairesErrorResponse)
      }
      return this
    })

    const { result } = renderHook(() => useRHAnalytics(2), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBeDefined()
    expect((result.current.error as { message?: string } | undefined)?.message).toBe('salaires error')
  })

  it('renvoie isError quand la requête des profiles échoue', async () => {
    let callIndex = 0

    mockThen.mockImplementation(function (this: unknown, onFulfilled?: (value: unknown) => unknown, _onRejected?: (reason: unknown) => unknown) {
      if (typeof onFulfilled === 'function') {
        if (callIndex === 0) {
          onFulfilled({ data: salairesDataSuccess, error: null })
        } else {
          onFulfilled(profilesErrorResponse)
        }
      }
      callIndex += 1
      return this
    })

    const { result } = renderHook(() => useRHAnalytics(2), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBeDefined()
    expect((result.current.error as { message?: string } | undefined)?.message).toBe('profiles error')
  })
})