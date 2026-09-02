// @ts-nocheck
/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCsmSante } from './useCsmSante'

const {
  LIST_ROWS,
  SINGLE_ROW,
  UPSERTED_ROW,
  QUERY_ERROR,
  MUTATION_ERROR,
  SANITIZED_MESSAGE,
  mockToastError,
  mockSanitizeSupabaseError,
  mockFromExtended,
  mockFrom,
  queryBuilder,
  mutationBuilder,
} = vi.hoisted(() => {
  const LIST_ROWS = [
    {
      id: '1',
      etablissement_id: 'eta-1',
      weather: 'sunny',
      taux_utilisation: 82,
      taux_utilisation_trend: 'up',
      taux_uhcd: 14,
      taux_uhcd_dim: 10,
      taux_uhcd_trend: 'down',
      objectif_eme: 90,
      dossiers_traites: 120,
      passages_total: 150,
      periode_reference: '2024-05',
      paliers_uhcd: [{ seuil: 10 }],
      resume_sante: 'Bonne dynamique',
      actions: [{ label: 'Renforcer' }],
      created_at: '2024-05-01',
      updated_at: '2024-05-02',
    },
    {
      id: '2',
      etablissement_id: 'eta-2',
      weather: 'cloudy',
      taux_utilisation: 76,
      taux_utilisation_trend: 'stable',
      taux_uhcd: 18,
      taux_uhcd_dim: 12,
      taux_uhcd_trend: 'up',
      objectif_eme: 88,
      dossiers_traites: 98,
      passages_total: 140,
      periode_reference: '2024-05',
      paliers_uhcd: [{ seuil: 12 }],
      resume_sante: 'Sous surveillance',
      actions: [{ label: 'Ajuster' }],
      created_at: '2024-05-03',
      updated_at: '2024-05-04',
    },
  ]

  const SINGLE_ROW = {
    id: '10',
    etablissement_id: 'eta-10',
    weather: 'rain',
    taux_utilisation: 64,
    taux_utilisation_trend: 'down',
    taux_uhcd: 22,
    taux_uhcd_dim: 15,
    taux_uhcd_trend: 'up',
    objectif_eme: 85,
    dossiers_traites: 70,
    passages_total: 110,
    periode_reference: '2024-06',
    paliers_uhcd: [{ seuil: 15 }],
    resume_sante: 'Tension sur UHCD',
    actions: [{ label: 'Planifier' }],
    created_at: '2024-06-01',
    updated_at: '2024-06-02',
  }

  const UPSERTED_ROW = {
    id: '20',
    etablissement_id: 'eta-upsert',
    weather: 'storm',
    taux_utilisation: 91,
    taux_utilisation_trend: 'up',
    taux_uhcd: 12,
    taux_uhcd_dim: 8,
    taux_uhcd_trend: 'down',
    objectif_eme: 95,
    dossiers_traites: 160,
    passages_total: 180,
    periode_reference: '2024-07',
    paliers_uhcd: [{ seuil: 8 }],
    resume_sante: 'Très bon niveau',
    actions: [{ label: 'Maintenir' }],
    created_at: '2024-07-01',
    updated_at: '2024-07-02',
  }

  const QUERY_ERROR = { message: 'x' }
  const MUTATION_ERROR = new Error('x')
  const SANITIZED_MESSAGE = 'sanitized-error'

  const mockToastError = vi.fn()
  const mockSanitizeSupabaseError = vi.fn(() => SANITIZED_MESSAGE)
  const mockFromExtended = vi.fn()
  const mockFrom = vi.fn()

  const queryBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  }

  const mutationBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  }

  return {
    LIST_ROWS,
    SINGLE_ROW,
    UPSERTED_ROW,
    QUERY_ERROR,
    MUTATION_ERROR,
    SANITIZED_MESSAGE,
    mockToastError,
    mockSanitizeSupabaseError,
    mockFromExtended,
    mockFrom,
    queryBuilder,
    mutationBuilder,
  }
})

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}))

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: mockFromExtended,
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

function resetBuilder(
  builder: {
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
    upsert: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    then: ReturnType<typeof vi.fn>
    catch: ReturnType<typeof vi.fn>
  },
  stableResult: { data: unknown; error: unknown }
) {
  builder.select.mockReset()
  builder.eq.mockReset()
  builder.gte.mockReset()
  builder.lte.mockReset()
  builder.in.mockReset()
  builder.order.mockReset()
  builder.limit.mockReset()
  builder.insert.mockReset()
  builder.update.mockReset()
  builder.delete.mockReset()
  builder.upsert.mockReset()
  builder.single.mockReset()
  builder.maybeSingle.mockReset()
  builder.then.mockReset()
  builder.catch.mockReset()

  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.gte.mockReturnValue(builder)
  builder.lte.mockReturnValue(builder)
  builder.in.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.limit.mockReturnValue(builder)
  builder.insert.mockReturnValue(builder)
  builder.update.mockReturnValue(builder)
  builder.delete.mockReturnValue(builder)
  builder.upsert.mockReturnValue(builder)
  builder.single.mockResolvedValue(stableResult)
  builder.maybeSingle.mockResolvedValue(stableResult)
  builder.then.mockImplementation(
    (
      onFulfilled?: (value: { data: unknown; error: unknown }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(stableResult).then(onFulfilled, onRejected)
  )
  builder.catch.mockImplementation((onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(stableResult).catch(onRejected)
  )
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

describe('useCsmSante', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    resetBuilder(queryBuilder, { data: LIST_ROWS, error: null })
    resetBuilder(mutationBuilder, { data: UPSERTED_ROW, error: null })

    mockFromExtended.mockImplementation(() => queryBuilder)
    mockFrom.mockImplementation(() => queryBuilder)
    mockSanitizeSupabaseError.mockReturnValue(SANITIZED_MESSAGE)
  })

  it('charge puis retourne la liste des comptes de santé sans filtre établissement', async () => {
    const { result } = renderHook(() => useCsmSante(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toEqual([])
    expect(result.current.single).toBeNull()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFromExtended).toHaveBeenCalledWith('csm_sante_comptes')
    expect(queryBuilder.select).toHaveBeenCalledTimes(1)
    expect(queryBuilder.limit).toHaveBeenCalledWith(500)
    expect(queryBuilder.eq).not.toHaveBeenCalled()

    expect(result.current.data).toEqual(LIST_ROWS)
    expect(result.current.data[0]).toMatchObject({
      etablissement_id: 'eta-1',
      weather: 'sunny',
      taux_utilisation: 82,
      dossiers_traites: 120,
      passages_total: 150,
    })
    expect(result.current.data[1]).toMatchObject({
      etablissement_id: 'eta-2',
      weather: 'cloudy',
      taux_uhcd: 18,
      objectif_eme: 88,
    })
    expect(result.current.single).toBeNull()
  })

  it('charge puis retourne un seul compte quand etablissementId est fourni', async () => {
    queryBuilder.maybeSingle.mockResolvedValue({ data: SINGLE_ROW, error: null })

    const { result } = renderHook(() => useCsmSante('eta-10'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toEqual([])
    expect(result.current.single).toBeNull()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFromExtended).toHaveBeenCalledWith('csm_sante_comptes')
    expect(queryBuilder.eq).toHaveBeenCalledWith('etablissement_id', 'eta-10')
    expect(queryBuilder.maybeSingle).toHaveBeenCalledTimes(1)
    expect(queryBuilder.limit).not.toHaveBeenCalled()

    expect(result.current.data).toEqual([SINGLE_ROW])
    expect(result.current.single).toEqual(SINGLE_ROW)
    expect(result.current.single).toMatchObject({
      etablissement_id: 'eta-10',
      weather: 'rain',
      taux_utilisation: 64,
      resume_sante: 'Tension sur UHCD',
    })
  })

  it('passe en erreur quand la récupération échoue', async () => {
    queryBuilder.maybeSingle.mockResolvedValue({ data: null, error: QUERY_ERROR })

    const { result } = renderHook(() => useCsmSante('eta-fail'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toEqual([])
    expect(result.current.single).toBeNull()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(queryBuilder.eq).toHaveBeenCalledWith('etablissement_id', 'eta-fail')
    expect(queryBuilder.maybeSingle).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual([])
    expect(result.current.single).toBeNull()
  })

  it('déclenche l’upsert avec les bonnes valeurs', async () => {
    mockFromExtended
      .mockImplementationOnce(() => queryBuilder)
      .mockImplementationOnce(() => mutationBuilder)

    const { result } = renderHook(() => useCsmSante(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const payload = {
      etablissement_id: 'eta-upsert',
      weather: 'storm',
      taux_utilisation: 91,
      resume_sante: 'Très bon niveau',
    }

    await act(async () => {
      await result.current.upsert(payload)
    })

    expect(mockFromExtended).toHaveBeenLastCalledWith('csm_sante_comptes')
    expect(mutationBuilder.upsert).toHaveBeenCalledWith(payload, { onConflict: 'etablissement_id' })
    expect(mutationBuilder.select).toHaveBeenCalledTimes(1)
    expect(mutationBuilder.single).toHaveBeenCalledTimes(1)
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('gère l’erreur d’upsert avec sanitization et toast', async () => {
    mockFromExtended
      .mockImplementationOnce(() => queryBuilder)
      .mockImplementationOnce(() => mutationBuilder)

    mutationBuilder.single.mockResolvedValue({ data: null, error: MUTATION_ERROR })

    const { result } = renderHook(() => useCsmSante(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const payload = {
      etablissement_id: 'eta-upsert',
      weather: 'storm',
    }

    await act(async () => {
      await expect(result.current.upsert(payload)).rejects.toThrow('x')
    })

    expect(mutationBuilder.upsert).toHaveBeenCalledWith(payload, { onConflict: 'etablissement_id' })
    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(MUTATION_ERROR)
    expect(mockToastError).toHaveBeenCalledWith(SANITIZED_MESSAGE)
  })
})
