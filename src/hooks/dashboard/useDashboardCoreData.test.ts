// @ts-nocheck
/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useDashboardCoreData } from './useDashboardCoreData'

const {
  AUTH_STATE,
  ETABLISSEMENTS_ROWS,
  TACHES_ROWS,
  EMAIL_THREADS_ROWS,
  OVERVIEW_RPC_ROW,
  mockFrom,
  mockRpc,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    loading: false,
    user: { id: 'u1', email: 'user@test.dev' },
  },
  ETABLISSEMENTS_ROWS: [
    {
      id: 'e1',
      nom: 'Clinique A',
      ville: 'Paris',
      region: 'IDF',
      type: 'hopital',
      statut: 'production',
      progression: 80,
      created_at: '2024-01-03T10:00:00.000Z',
      updated_at: '2024-01-04T10:00:00.000Z',
      last_email_received_at: '2024-02-01T08:00:00.000Z',
      last_email_sent_at: '2024-02-01T09:00:00.000Z',
    },
    {
      id: 'e2',
      nom: 'Clinique B',
      ville: 'Lyon',
      region: 'ARA',
      type: 'clinique',
      statut: 'pipeline',
      progression: 25,
      created_at: '2024-01-02T10:00:00.000Z',
      updated_at: '2024-01-03T10:00:00.000Z',
      last_email_received_at: null,
      last_email_sent_at: null,
    },
  ],
  TACHES_ROWS: [
    {
      id: 't1',
      archive: false,
      titre: 'Relancer client',
      created_at: '2024-01-05T10:00:00.000Z',
      categories_taches: { id: 'c1', nom: 'Suivi', couleur: '#123456' },
      etablissements: { id: 'e1', nom: 'Clinique A' },
    },
    {
      id: 't2',
      archive: false,
      titre: 'Préparer signature',
      created_at: '2024-01-04T10:00:00.000Z',
      categories_taches: { id: 'c2', nom: 'Signature', couleur: '#654321' },
      etablissements: { id: 'e2', nom: 'Clinique B' },
    },
  ],
  EMAIL_THREADS_ROWS: [
    { etablissement_id: 'e1', last_message_date: '2024-03-02T10:00:00.000Z' },
    { etablissement_id: 'e1', last_message_date: '2024-03-01T10:00:00.000Z' },
    { etablissement_id: 'e2', last_message_date: '2024-02-15T10:00:00.000Z' },
    { etablissement_id: null, last_message_date: '2024-02-10T10:00:00.000Z' },
  ],
  OVERVIEW_RPC_ROW: [
    {
      total_etablissements: '12',
      total_prospects: '3',
      total_pipeline: '4',
      total_contractuel: '2',
      total_production: '5',
      total_bloques: '1',
      valeur_bloquee: '1500',
      total_taches: '27',
      valeur_totale: '98765',
      valeur_pipeline: '12345',
    },
  ],
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    standard: {
      staleTime: 0,
      gcTime: 0,
      retry: 0,
    },
  },
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}))

type QueryResult = { data: unknown; error: { message: string } | null }

function createBuilder(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    not: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (
      onFulfilled: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  }
  return builder
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useDashboardCoreData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    AUTH_STATE.loading = false
    AUTH_STATE.user = { id: 'u1', email: 'user@test.dev' }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'etablissements') {
        return createBuilder({ data: ETABLISSEMENTS_ROWS, error: null })
      }
      if (table === 'taches') {
        return createBuilder({ data: TACHES_ROWS, error: null })
      }
      if (table === 'email_threads') {
        return createBuilder({ data: EMAIL_THREADS_ROWS, error: null })
      }
      return createBuilder({ data: [], error: null })
    })

    mockRpc.mockResolvedValue({
      data: OVERVIEW_RPC_ROW,
      error: null,
    })
  })

  it('expose un état de chargement initial puis les données métier agrégées au succès', async () => {
    let etablissementsResolved = false
    let tachesResolved = false
    let emailsResolved = false
    let overviewResolved = false

    mockFrom.mockImplementation((table: string) => {
      if (table === 'etablissements') {
        return createBuilder({
          data: new Promise<typeof ETABLISSEMENTS_ROWS>((resolve) => {
            setTimeout(() => {
              etablissementsResolved = true
              resolve(ETABLISSEMENTS_ROWS)
            }, 0)
          }) as unknown,
          error: null,
        })
      }
      if (table === 'taches') {
        return createBuilder({
          data: new Promise<typeof TACHES_ROWS>((resolve) => {
            setTimeout(() => {
              tachesResolved = true
              resolve(TACHES_ROWS)
            }, 0)
          }) as unknown,
          error: null,
        })
      }
      if (table === 'email_threads') {
        return createBuilder({
          data: new Promise<typeof EMAIL_THREADS_ROWS>((resolve) => {
            setTimeout(() => {
              emailsResolved = true
              resolve(EMAIL_THREADS_ROWS)
            }, 0)
          }) as unknown,
          error: null,
        })
      }
      return createBuilder({ data: [], error: null })
    })

    mockRpc.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            overviewResolved = true
            resolve({ data: OVERVIEW_RPC_ROW, error: null })
          }, 0)
        })
    )

    mockFrom.mockImplementation((table: string) => {
      const makeAsyncBuilder = (payload: unknown, onResolve: () => void) => {
        const resultPromise = new Promise<QueryResult>((resolve) => {
          setTimeout(() => {
            onResolve()
            resolve({ data: payload, error: null })
          }, 0)
        })
        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          not: vi.fn(() => builder),
          order: vi.fn(() => builder),
          limit: vi.fn(() => builder),
          gte: vi.fn(() => builder),
          lte: vi.fn(() => builder),
          in: vi.fn(() => builder),
          insert: vi.fn(() => builder),
          update: vi.fn(() => builder),
          delete: vi.fn(() => builder),
          single: vi.fn(async () => ({ data: payload, error: null })),
          maybeSingle: vi.fn(async () => ({ data: payload, error: null })),
          then: (
            onFulfilled: (value: QueryResult) => unknown,
            onRejected?: (reason: unknown) => unknown
          ) => resultPromise.then(onFulfilled, onRejected),
          catch: (onRejected: (reason: unknown) => unknown) => resultPromise.catch(onRejected),
        }
        return builder
      }

      if (table === 'etablissements') {
        return makeAsyncBuilder(ETABLISSEMENTS_ROWS, () => {
          etablissementsResolved = true
        })
      }
      if (table === 'taches') {
        return makeAsyncBuilder(TACHES_ROWS, () => {
          tachesResolved = true
        })
      }
      if (table === 'email_threads') {
        return makeAsyncBuilder(EMAIL_THREADS_ROWS, () => {
          emailsResolved = true
        })
      }
      return makeAsyncBuilder([], () => {})
    })

    mockRpc.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            overviewResolved = true
            resolve({ data: OVERVIEW_RPC_ROW, error: null })
          }, 0)
        })
    )

    const { result } = renderHook(() => useDashboardCoreData(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isReady).toBe(false)
    expect(result.current.etablissements).toBeUndefined()
    expect(result.current.taches).toBeUndefined()
    expect(result.current.lastEmailByEtablissement).toBeUndefined()
    expect(result.current.overview).toBeUndefined()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isReady).toBe(true)
    })

    expect(etablissementsResolved).toBe(true)
    expect(tachesResolved).toBe(true)
    expect(emailsResolved).toBe(true)
    expect(overviewResolved).toBe(true)

    expect(result.current.etablissements).toEqual(ETABLISSEMENTS_ROWS)
    expect(result.current.taches).toEqual(TACHES_ROWS)
    expect(result.current.etablissements?.[0]?.nom).toBe('Clinique A')
    expect(result.current.taches?.[1]?.categories_taches?.nom).toBe('Signature')

    expect(result.current.lastEmailByEtablissement).toBeInstanceOf(Map)
    expect(result.current.lastEmailByEtablissement?.get('e1')).toBe('2024-03-02T10:00:00.000Z')
    expect(result.current.lastEmailByEtablissement?.get('e2')).toBe('2024-02-15T10:00:00.000Z')
    expect(result.current.lastEmailByEtablissement?.size).toBe(2)

    expect(result.current.overview).toEqual({
      total_etablissements: 12,
      total_prospects: 3,
      total_pipeline: 4,
      total_contractuel: 2,
      total_production: 5,
      total_bloques: 1,
      valeur_bloquee: 1500,
      total_taches: 27,
      valeur_totale: 98765,
      valeur_pipeline: 12345,
    })

    expect(result.current.isLoadingEtablissements).toBe(false)
    expect(result.current.isLoadingTaches).toBe(false)
    expect(result.current.isLoadingLastEmail).toBe(false)
    expect(result.current.isLoadingOverview).toBe(false)
    expect(result.current.errors).toEqual([])

    expect(mockFrom).toHaveBeenCalledWith('etablissements')
    expect(mockFrom).toHaveBeenCalledWith('taches')
    expect(mockFrom).toHaveBeenCalledWith('email_threads')
    expect(mockRpc).toHaveBeenCalledWith('get_dashboard_overview')
  })

  it('remonte une erreur quand une des requêtes échoue', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'etablissements') {
        return createBuilder({ data: null, error: { message: 'etabs failed' } })
      }
      if (table === 'taches') {
        return createBuilder({ data: TACHES_ROWS, error: null })
      }
      if (table === 'email_threads') {
        return createBuilder({ data: EMAIL_THREADS_ROWS, error: null })
      }
      return createBuilder({ data: [], error: null })
    })

    mockRpc.mockResolvedValue({
      data: OVERVIEW_RPC_ROW,
      error: null,
    })

    const { result } = renderHook(() => useDashboardCoreData(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isReady).toBe(false)
    expect(result.current.errors).toHaveLength(1)

    const firstError = result.current.errors[0] as { message?: string }
    expect(firstError.message).toBe('etabs failed')

    expect(result.current.etablissements).toBeUndefined()
    expect(result.current.taches).toEqual(TACHES_ROWS)
    expect(result.current.lastEmailByEtablissement?.get('e1')).toBe('2024-03-02T10:00:00.000Z')
    expect(result.current.overview?.total_taches).toBe(27)
  })

  it('nexécute aucune requête tant que l’auth est en chargement ou sans utilisateur', async () => {
    AUTH_STATE.loading = true
    AUTH_STATE.user = null as unknown as { id: string; email: string }

    const { result } = renderHook(() => useDashboardCoreData(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isReady).toBe(false)
    expect(result.current.etablissements).toBeUndefined()
    expect(result.current.taches).toBeUndefined()
    expect(result.current.lastEmailByEtablissement).toBeUndefined()
    expect(result.current.overview).toBeUndefined()
    expect(result.current.errors).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
