import React, { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useJobOffers,
  useJobOffer,
  useCreateJobOffer,
  useUpdateJobOffer,
  useDeleteJobOffer,
  useJobOffersKPIs,
} from './useJobOffers'

const {
  JOB_OFFERS,
  CANDIDATES,
  mockFrom,
  ERROR_ON,
  USER,
  sanitizeSupabaseErrorMock,
  sanitizePostgrestValueMock,
  toastMock,
} = vi.hoisted(() => {
  const JOB_OFFERS = [
    {
      id: 'o1',
      titre: 'Développeur',
      statut: 'published',
      created_at: '2023-01-01T00:00:00.000Z',
      nombre_postes: 2,
      postes_pourvus: 1,
      description: 'Dev job',
    },
    {
      id: 'o2',
      titre: 'Designer',
      statut: 'draft',
      created_at: '2023-01-02T00:00:00.000Z',
      nombre_postes: 1,
      postes_pourvus: 0,
      description: 'Design job',
    },
  ]

  const CANDIDATES = [
    { id: 'c1', statut: 'new', job_offer_id: 'o1' },
    { id: 'c2', statut: 'offer_accepted', job_offer_id: 'o1' },
    { id: 'c3', statut: 'screening', job_offer_id: 'o2' },
  ]

  const ERROR_ON = {
    job_offers: false,
    job_offer_single: false,
    candidates: false,
    create: false,
    update: false,
    delete: false,
  }

  const mockFrom = vi.fn((table: string) => {
    const builder = {
      table,
      _select: undefined as unknown,
      _eq: undefined as unknown,
      _updates: undefined as unknown,
      _inserted: undefined as unknown,
      _op: 'select' as string,
      select(arg?: string) {
        this._select = arg
        this._op = 'select'
        return this
      },
      order() {
        return this
      },
      in() {
        return this
      },
      or() {
        return this
      },
      limit() {
        return this
      },
      eq(key: string, val: unknown) {
        this._eq = [key, val]
        return this
      },
      maybeSingle() {
        if (this.table === 'job_offers') {
          if (ERROR_ON.job_offer_single) return Promise.resolve({ data: null, error: { message: 'booom' } })
          if (this._eq) {
            const found = JOB_OFFERS.find((o) => o.id === (this._eq as any)[1])
            return Promise.resolve({ data: found ?? null, error: null })
          }
          return Promise.resolve({ data: null, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      },
      single() {
        if (this.table === 'job_offers') {
          if (this._op === 'insert') {
            if (ERROR_ON.create) return Promise.resolve({ data: null, error: { message: 'create error' } })
            return Promise.resolve({ data: this._inserted ?? null, error: null })
          }
          if (this._op === 'update') {
            if (ERROR_ON.update) return Promise.resolve({ data: null, error: { message: 'update error' } })
            const id = this._eq ? (this._eq as any)[1] : 'unknown'
            return Promise.resolve({ data: { id, ...(this._updates as object) }, error: null })
          }
          return Promise.resolve({ data: JOB_OFFERS[0] ?? null, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      },
      insert(obj: unknown) {
        this._op = 'insert'
        this._inserted = { id: 'new1', ...(obj as object) }
        return this
      },
      update(obj: unknown) {
        this._op = 'update'
        this._updates = obj
        return this
      },
      delete() {
        this._op = 'delete'
        return this
      },
      then(resolve: (value: any) => void) {
        if (this.table === 'job_offers') {
          if (ERROR_ON.job_offers) {
            return resolve({ data: null, error: { message: 'job offers fail' } })
          }
          if (this._op === 'delete') {
            if (ERROR_ON.delete) return resolve({ error: { message: 'delete err' } })
            return resolve({ error: null })
          }
          if (this._op === 'select') {
            if (this._select && String(this._select).includes('statut')) {
              const data = JOB_OFFERS.map(({ statut, nombre_postes, postes_pourvus }) => ({
                statut,
                nombre_postes,
                postes_pourvus,
              }))
              return resolve({ data, error: null })
            }
            return resolve({ data: JOB_OFFERS, error: null })
          }
          if (this._op === 'insert') {
            if (ERROR_ON.create) return resolve({ data: null, error: { message: 'create error' } })
            return resolve({ data: this._inserted ?? null, error: null })
          }
          if (this._op === 'update') {
            if (ERROR_ON.update) return resolve({ data: null, error: { message: 'update error' } })
            const id = this._eq ? (this._eq as any)[1] : 'unknown'
            return resolve({ data: [{ id, ...(this._updates as object) }], error: null })
          }
        }

        if (this.table === 'candidates') {
          if (ERROR_ON.candidates) return resolve({ data: null, error: { message: 'candidates fail' } })
          return resolve({ data: CANDIDATES, error: null })
        }

        return resolve({ data: [], error: null })
      },
      catch() {
        return this
      },
    }
    return builder
  })

  const USER = { user: { id: 'u1', email: 'test@example.com' }, loading: false }

  const sanitizeSupabaseErrorMock = vi.fn((e: Error) => `sanitized:${String(e?.message ?? '')}`)
  const sanitizePostgrestValueMock = vi.fn((v: string) => String(v).replace(/%/g, ''))
  const toastMock = { success: vi.fn(), error: vi.fn() }

  return {
    JOB_OFFERS,
    CANDIDATES,
    mockFrom,
    ERROR_ON,
    USER,
    sanitizeSupabaseErrorMock,
    sanitizePostgrestValueMock,
    toastMock,
  }
})

vi.mock('@/integrations/supabase/client', () => {
  return { supabase: { from: mockFrom } }
})

vi.mock('@/components/AuthProvider', () => {
  return { useAuth: () => USER }
})

vi.mock('sonner', () => {
  return { toast: toastMock }
})

vi.mock('@/lib/supabaseErrorSanitizer', () => {
  return { sanitizeSupabaseError: sanitizeSupabaseErrorMock }
})

vi.mock('@/lib/sanitize', () => {
  return { sanitizePostgrestValue: sanitizePostgrestValueMock }
})

describe('useJobOffers hooks', () => {
  let qc: QueryClient
  let wrapper: ({ children }: { children: ReactNode }) => React.ReactElement

  beforeEach(() => {
    vi.clearAllMocks()
    ERROR_ON.job_offers = false
    ERROR_ON.job_offer_single = false
    ERROR_ON.candidates = false
    ERROR_ON.create = false
    ERROR_ON.update = false
    ERROR_ON.delete = false

    qc = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })
    wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children)
  })

  afterEach(() => {
    qc.clear()
  })

  it('loads list of job offers successfully', async () => {
    const { result } = renderHook(() => useJobOffers(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(Array.isArray(result.current.data)).toBe(true)
    expect(result.current.data).toHaveLength(2)
    // @ts-expect-error runtime shape
    expect(result.current.data[0].id).toBe('o1')
    // @ts-expect-error runtime shape
    expect(result.current.data.map((o) => o.titre)).toEqual(expect.arrayContaining(['Développeur', 'Designer']))
  })

  it('reports error when backend returns error for job offers', async () => {
    ERROR_ON.job_offers = true

    const { result } = renderHook(() => useJobOffers(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
    // @ts-expect-error runtime shape
    expect(String(result.current.error?.message ?? result.current.error)).toContain('job offers fail')
  })

  it('loads a single job offer by id', async () => {
    const { result } = renderHook(() => useJobOffer('o1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).not.toBeNull()
    // @ts-expect-error runtime shape
    expect(result.current.data.id).toBe('o1')
    // @ts-expect-error runtime shape
    expect(result.current.data.titre).toBe('Développeur')
  })

  it('returns null / stays idle when id is undefined', async () => {
    const { result } = renderHook(() => useJobOffer(undefined), { wrapper })

    expect(result.current.isIdle || result.current.isLoading === false).toBeTruthy()
    expect(result.current.data).toBeUndefined()
  })

  it('create mutation calls supabase insert and triggers invalidation and toast', async () => {
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useCreateJobOffer(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ titre: 'Nouvelle offre', description: 'desc' })
    })

    expect(toastMock.success).toHaveBeenCalledWith("Offre d'emploi créée")
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['job-offers'] })
  })

  it('update mutation calls supabase update and triggers proper invalidations and toast', async () => {
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateJobOffer(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ id: 'o1', titre: 'Mis à jour' })
    })

    expect(toastMock.success).toHaveBeenCalledWith('Offre mise à jour')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['job-offers'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['job-offer', 'o1'] })
  })

  it('delete mutation calls supabase delete and triggers invalidation and toast', async () => {
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteJobOffer(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('o1')
    })

    expect(toastMock.success).toHaveBeenCalledWith('Offre supprimée')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['job-offers'] })
  })

  it('computes KPIs correctly from offers and candidates', async () => {
    const { result } = renderHook(() => useJobOffersKPIs(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeDefined()
    // @ts-expect-error runtime shape
    expect(result.current.data.totalOffers).toBe(2)
    // @ts-expect-error runtime shape
    expect(result.current.data.activeOffers).toBe(1)
    // @ts-expect-error runtime shape
    expect(result.current.data.totalCandidates).toBe(3)
    // @ts-expect-error runtime shape
    expect(result.current.data.newCandidates).toBe(1)
    // @ts-expect-error runtime shape
    expect(result.current.data.hiredCandidates).toBe(1)
    // @ts-expect-error runtime shape
    expect(result.current.data.inProgress).toBe(1)
    // @ts-expect-error runtime shape
    expect(result.current.data.conversionRate).toBe(33)
  })

  it('propagates error when KPIs candidate select fails', async () => {
    ERROR_ON.candidates = true
    const { result } = renderHook(() => useJobOffersKPIs(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    // @ts-expect-error runtime
    expect(String(result.current.error?.message ?? '')).toContain('candidates fail')
  })
})