// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// @vitest-environment jsdom

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCsmParcours } from './useCsmParcours'

const {
  JALONS,
  UPSERTED_JALON,
  mockFromExtended,
  mockToastError,
  mockSanitizeSupabaseError,
  mockFrom,
} = vi.hoisted(() => ({
  JALONS: [
    {
      id: 'j1',
      etablissement_id: 'eta-1',
      jalon_type: 'audit',
      statut: 'planifie',
      date_jalon: '2024-01-10',
      notes: 'Préparation',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'j2',
      etablissement_id: 'eta-1',
      jalon_type: 'kickoff',
      statut: 'termine',
      date_jalon: '2024-01-05',
      notes: 'Lancement',
      created_at: '2024-01-01',
      updated_at: '2024-01-03',
    },
  ],
  UPSERTED_JALON: {
    id: 'j3',
    etablissement_id: 'eta-1',
    jalon_type: 'formation',
    statut: 'planifie',
    date_jalon: '2024-02-01',
    notes: 'Session équipe',
    created_at: '2024-01-04',
    updated_at: '2024-01-04',
  },
  mockFromExtended: vi.fn(),
  mockToastError: vi.fn(),
  mockSanitizeSupabaseError: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: mockFromExtended,
}))

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

type SupabaseError = { message: string }
type SupabaseResult<T> = { data: T | null; error: SupabaseError | null }

function createBuilder<T>(result: {
  thenResult?: SupabaseResult<T>
  singleResult?: SupabaseResult<T>
  maybeSingleResult?: SupabaseResult<T>
}) {
  const resolvedThen = result.thenResult ?? ({ data: null, error: null } as SupabaseResult<T>)
  const resolvedSingle = result.singleResult ?? ({ data: null, error: null } as SupabaseResult<T>)
  const resolvedMaybeSingle =
    result.maybeSingleResult ?? ({ data: null, error: null } as SupabaseResult<T>)

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => resolvedSingle),
    maybeSingle: vi.fn(async () => resolvedMaybeSingle),
    then: (
      onFulfilled?: (value: SupabaseResult<T>) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(resolvedThen).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(resolvedThen).catch(onRejected),
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

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { Wrapper, queryClient }
}

describe('useCsmParcours', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSanitizeSupabaseError.mockReturnValue('Erreur traitée')
  })

  it('charge les jalons et applique le filtre établissement', async () => {
    const queryBuilder = createBuilder<typeof JALONS>({
      thenResult: { data: JALONS, error: null },
    })

    mockFromExtended.mockReturnValue(queryBuilder)

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmParcours('eta-1'), { wrapper: Wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toEqual([])

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFromExtended).toHaveBeenCalledWith('csm_parcours_jalons')
    expect(queryBuilder.select).toHaveBeenCalledWith(
      'id, etablissement_id, jalon_type, statut, date_jalon, notes, created_at, updated_at'
    )
    expect(queryBuilder.eq).toHaveBeenCalledWith('etablissement_id', 'eta-1')
    expect(queryBuilder.order).toHaveBeenCalledWith('jalon_type')
    expect(queryBuilder.limit).toHaveBeenCalledWith(500)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data[0]).toMatchObject({
      id: 'j1',
      etablissement_id: 'eta-1',
      jalon_type: 'audit',
      statut: 'planifie',
      notes: 'Préparation',
    })
    expect(result.current.data[1]).toMatchObject({
      id: 'j2',
      etablissement_id: 'eta-1',
      jalon_type: 'kickoff',
      statut: 'termine',
      date_jalon: '2024-01-05',
    })
  })

  it('charge les jalons sans filtre quand etablissementId est absent', async () => {
    const queryBuilder = createBuilder<typeof JALONS>({
      thenResult: { data: JALONS, error: null },
    })

    mockFromExtended.mockReturnValue(queryBuilder)

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmParcours(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(queryBuilder.eq).not.toHaveBeenCalled()
    expect(result.current.data.map((j) => j.jalon_type)).toEqual(['audit', 'kickoff'])
  })

  it('passe en erreur si la requête de chargement échoue', async () => {
    const queryBuilder = createBuilder<typeof JALONS>({
      thenResult: { data: null, error: { message: 'x' } },
    })

    mockFromExtended.mockReturnValue(queryBuilder)

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmParcours('eta-1'), { wrapper: Wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toEqual([])

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual([])
    expect(queryBuilder.eq).toHaveBeenCalledWith('etablissement_id', 'eta-1')
    expect(queryBuilder.order).toHaveBeenCalledWith('jalon_type')
    expect(queryBuilder.limit).toHaveBeenCalledWith(500)
  })

  it('upsert un jalon puis invalide la query', async () => {
    const queryBuilder = createBuilder<typeof JALONS>({
      thenResult: { data: JALONS, error: null },
    })
    const upsertBuilder = createBuilder<typeof UPSERTED_JALON>({
      singleResult: { data: UPSERTED_JALON, error: null },
    })

    mockFromExtended.mockReturnValueOnce(queryBuilder).mockReturnValueOnce(upsertBuilder)

    const { Wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCsmParcours('eta-1'), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const payload = {
      etablissement_id: 'eta-1',
      jalon_type: 'formation',
      statut: 'planifie',
      notes: 'Session équipe',
    }

    await act(async () => {
      await result.current.upsert(payload)
    })

    expect(upsertBuilder.upsert).toHaveBeenCalledWith(payload, {
      onConflict: 'etablissement_id,jalon_type',
    })
    expect(upsertBuilder.select).toHaveBeenCalledWith()
    expect(upsertBuilder.single).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['csm-parcours-jalons'] })
  })

  it('gère une erreur lors du upsert avec toast.error', async () => {
    const queryBuilder = createBuilder<typeof JALONS>({
      thenResult: { data: JALONS, error: null },
    })
    const upsertBuilder = createBuilder<typeof UPSERTED_JALON>({
      singleResult: { data: null, error: { message: 'x' } },
    })

    mockFromExtended.mockReturnValueOnce(queryBuilder).mockReturnValueOnce(upsertBuilder)

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmParcours('eta-1'), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await expect(
        result.current.upsert({
          etablissement_id: 'eta-1',
          jalon_type: 'formation',
          statut: 'planifie',
        })
      ).rejects.toEqual({ message: 'x' })
    })

    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      {
        etablissement_id: 'eta-1',
        jalon_type: 'formation',
        statut: 'planifie',
      },
      { onConflict: 'etablissement_id,jalon_type' }
    )
    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'x' })
    expect(mockToastError).toHaveBeenCalledWith('Erreur traitée')
  })

  it('supprime un jalon puis invalide la query', async () => {
    const queryBuilder = createBuilder<typeof JALONS>({
      thenResult: { data: JALONS, error: null },
    })
    const deleteBuilder = createBuilder<null>({
      thenResult: { data: null, error: null },
    })

    mockFromExtended.mockReturnValueOnce(queryBuilder).mockReturnValueOnce(deleteBuilder)

    const { Wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCsmParcours('eta-1'), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.remove('j2')
    })

    expect(deleteBuilder.delete).toHaveBeenCalledWith()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'j2')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['csm-parcours-jalons'] })
  })

  it('gère une erreur lors de la suppression avec toast.error', async () => {
    const queryBuilder = createBuilder<typeof JALONS>({
      thenResult: { data: JALONS, error: null },
    })
    const deleteBuilder = createBuilder<null>({
      thenResult: { data: null, error: { message: 'x' } },
    })

    mockFromExtended.mockReturnValueOnce(queryBuilder).mockReturnValueOnce(deleteBuilder)

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmParcours('eta-1'), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await expect(result.current.remove('j2')).rejects.toEqual({ message: 'x' })
    })

    expect(deleteBuilder.delete).toHaveBeenCalledWith()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'j2')
    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'x' })
    expect(mockToastError).toHaveBeenCalledWith('Erreur traitée')
  })
})
