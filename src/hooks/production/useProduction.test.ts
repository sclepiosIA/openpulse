// @vitest-environment jsdom

import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDeploiement, useProduction } from './useProduction'

const {
  AUTH_STATE,
  toastSpy,
  mockFrom,
  ETABLISSEMENTS_PRODUCTION,
  ETABLISSEMENTS_DEPLOIEMENT,
  LINKS_PRODUCTION,
  GROUPES_PRODUCTION,
  LINKS_DEPLOIEMENT,
  GROUPES_DEPLOIEMENT,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    loading: false,
    user: { id: 'u1', email: 't@t.co' } as { id: string; email: string } | null,
  },
  toastSpy: vi.fn(),
  mockFrom: vi.fn(),
  ETABLISSEMENTS_PRODUCTION: [
    {
      id: 'e1',
      nom: 'Clinique Alpha',
      ville: 'Paris',
      region: 'IDF',
      type: 'Clinique',
      statut: 'Production',
      progression: 100,
      created_at: '2024-01-02',
      updated_at: '2024-01-03',
      logo_url: null,
    },
    {
      id: 'e2',
      nom: 'Hopital Beta',
      ville: 'Lyon',
      region: 'ARA',
      type: 'Hopital',
      statut: 'Production',
      progression: 95,
      created_at: '2024-01-01',
      updated_at: '2024-01-04',
      logo_url: null,
    },
  ],
  ETABLISSEMENTS_DEPLOIEMENT: [
    {
      id: 'd1',
      nom: 'Centre Gamma',
      ville: 'Lille',
      region: 'HDF',
      type: 'Centre',
      statut: 'Installation',
      progression: 60,
      created_at: '2024-02-02',
      updated_at: '2024-02-03',
      logo_url: null,
    },
    {
      id: 'd2',
      nom: 'Cabinet Delta',
      ville: 'Nantes',
      region: 'PDL',
      type: 'Cabinet',
      statut: 'Formation',
      progression: 70,
      created_at: '2024-02-01',
      updated_at: '2024-02-04',
      logo_url: null,
    },
  ],
  LINKS_PRODUCTION: [
    { etablissement_id: 'e1', groupe_id: 'g1' },
    { etablissement_id: 'e2', groupe_id: 'g2' },
  ],
  GROUPES_PRODUCTION: [
    { id: 'g1', logo_url: 'logo-g1.png' },
    { id: 'g2', logo_url: null },
  ],
  LINKS_DEPLOIEMENT: [
    { etablissement_id: 'd1', groupe_id: 'g3' },
    { etablissement_id: 'd2', groupe_id: 'g4' },
  ],
  GROUPES_DEPLOIEMENT: [
    { id: 'g3', logo_url: 'logo-g3.png' },
    { id: 'g4', logo_url: 'logo-g4.png' },
  ],
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/config/phases', () => ({
  PHASE_GROUPS: {
    deploiement: {
      statuts: ['Installation', 'Formation', 'Parametrage'],
    },
  },
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}))

type SupabaseError = {
  message: string
}

type ResponseShape = {
  data: unknown
  error: SupabaseError | null
}

type Builder = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: <TResult1 = ResponseShape, TResult2 = never>(
    onFulfilled?: ((value: ResponseShape) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => Promise<TResult1 | TResult2>
  catch: <TResult = never>(
    onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ) => Promise<ResponseShape | TResult>
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, retryDelay: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper() {
  const queryClient = createQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function createThenableBuilder(response: ResponseShape): Builder {
  const builder = {} as Builder

  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.update = vi.fn(() => builder)
  builder.delete = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve(response))
  builder.maybeSingle = vi.fn(() => Promise.resolve(response))
  builder.then = <TResult1 = ResponseShape, TResult2 = never>(
    onFulfilled?: ((value: ResponseShape) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => Promise.resolve(response).then(onFulfilled, onRejected)
  builder.catch = <TResult = never>(
    onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ) => Promise.resolve(response).catch(onRejected)

  return builder
}

describe('useProduction / useDeploiement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    AUTH_STATE.loading = false
    AUTH_STATE.user = { id: 'u1', email: 't@t.co' }
  })

  it('charge les établissements en production, enrichit les logos de groupe et applique les filtres métier', async () => {
    const productionBuilder = createThenableBuilder({
      data: ETABLISSEMENTS_PRODUCTION,
      error: null,
    })
    const linksBuilder = createThenableBuilder({
      data: LINKS_PRODUCTION,
      error: null,
    })
    const groupesBuilder = createThenableBuilder({
      data: GROUPES_PRODUCTION,
      error: null,
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'etablissements') return productionBuilder
      if (table === 'etablissements_groupes') return linksBuilder
      if (table === 'groupes_etablissements') return groupesBuilder
      throw new Error(`unexpected table ${table}`)
    })

    const { result } = renderHook(() => useProduction(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'etablissements')
    expect(productionBuilder.eq).toHaveBeenCalledWith('statut', 'Production')
    expect(productionBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(productionBuilder.limit).toHaveBeenCalledWith(2000)

    expect(mockFrom).toHaveBeenNthCalledWith(2, 'etablissements_groupes')
    expect(linksBuilder.in).toHaveBeenCalledWith('etablissement_id', ['e1', 'e2'])

    expect(mockFrom).toHaveBeenNthCalledWith(3, 'groupes_etablissements')
    expect(groupesBuilder.in).toHaveBeenCalledWith('id', ['g1', 'g2'])

    expect(result.current.data).toEqual([
      {
        ...ETABLISSEMENTS_PRODUCTION[0],
        groupe_logo_url: 'logo-g1.png',
      },
      {
        ...ETABLISSEMENTS_PRODUCTION[1],
        groupe_logo_url: null,
      },
    ])
    expect(result.current.data?.[0]?.nom).toBe('Clinique Alpha')
    expect(result.current.data?.[0]?.groupe_logo_url).toBe('logo-g1.png')
    expect(result.current.data?.[1]?.ville).toBe('Lyon')
    expect(result.current.data?.[1]?.groupe_logo_url).toBeNull()
    expect(toastSpy).not.toHaveBeenCalled()
  })

  it('passe en erreur et déclenche un toast si la requête production échoue', async () => {
    const productionBuilder = createThenableBuilder({
      data: null,
      error: { message: 'x' },
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'etablissements') return productionBuilder
      throw new Error(`unexpected table ${table}`)
    })

    const { result } = renderHook(() => useProduction(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.failureCount).toBe(3), { timeout: 3000 })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 })

    expect(productionBuilder.eq).toHaveBeenCalledWith('statut', 'Production')
    expect(productionBuilder.then).toBeDefined()
    expect(result.current.error).toEqual({ message: 'x' })
    expect(toastSpy).toHaveBeenCalledTimes(3)
    expect(toastSpy).toHaveBeenLastCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger les établissements en production',
      variant: 'destructive',
    })
  })

  it('charge les établissements en déploiement avec les statuts du groupe et enrichit les logos', async () => {
    const deploiementBuilder = createThenableBuilder({
      data: ETABLISSEMENTS_DEPLOIEMENT,
      error: null,
    })
    const linksBuilder = createThenableBuilder({
      data: LINKS_DEPLOIEMENT,
      error: null,
    })
    const groupesBuilder = createThenableBuilder({
      data: GROUPES_DEPLOIEMENT,
      error: null,
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'etablissements') return deploiementBuilder
      if (table === 'etablissements_groupes') return linksBuilder
      if (table === 'groupes_etablissements') return groupesBuilder
      throw new Error(`unexpected table ${table}`)
    })

    const { result } = renderHook(() => useDeploiement(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(deploiementBuilder.in).toHaveBeenCalledWith('statut', ['Installation', 'Formation', 'Parametrage'])
    expect(deploiementBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(deploiementBuilder.limit).toHaveBeenCalledWith(2000)

    expect(mockFrom).toHaveBeenNthCalledWith(2, 'etablissements_groupes')
    expect(linksBuilder.in).toHaveBeenCalledWith('etablissement_id', ['d1', 'd2'])
    expect(mockFrom).toHaveBeenNthCalledWith(3, 'groupes_etablissements')
    expect(groupesBuilder.in).toHaveBeenCalledWith('id', ['g3', 'g4'])

    expect(result.current.data).toEqual([
      {
        ...ETABLISSEMENTS_DEPLOIEMENT[0],
        groupe_logo_url: 'logo-g3.png',
      },
      {
        ...ETABLISSEMENTS_DEPLOIEMENT[1],
        groupe_logo_url: 'logo-g4.png',
      },
    ])
    expect(result.current.data?.[0]?.statut).toBe('Installation')
    expect(result.current.data?.[1]?.nom).toBe('Cabinet Delta')
    expect(result.current.data?.[1]?.groupe_logo_url).toBe('logo-g4.png')
    expect(toastSpy).not.toHaveBeenCalled()
  })

  it('désactive la requête tant que l’authentification charge ou sans utilisateur', () => {
    AUTH_STATE.loading = true
    AUTH_STATE.user = null

    const { result } = renderHook(() => useProduction(), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.isLoading).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})