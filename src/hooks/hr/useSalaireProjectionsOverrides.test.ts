/* @vitest-environment jsdom */

import React, { type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useSalaireProjectionsOverrides } from './useSalaireProjectionsOverrides'

const {
  AUTH_STATE,
  ROWS,
  CREATED_ROW,
  mockFrom,
  toastSuccess,
  toastError,
  sanitizeSupabaseErrorMock,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'user-1', email: 'test@example.com' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  },
  ROWS: [
    {
      id: 'ov-1',
      profile_id: 'p1',
      montant: 3100,
      date_effet: '2024-01-01',
      notes: 'début année',
      created_at: '2024-01-02T00:00:00.000Z',
      created_by: 'user-1',
    },
    {
      id: 'ov-2',
      profile_id: 'p1',
      montant: 3300,
      date_effet: '2024-03-01',
      notes: 'augmentation mars',
      created_at: '2024-03-02T00:00:00.000Z',
      created_by: 'user-1',
    },
    {
      id: 'ov-3',
      profile_id: 'p2',
      montant: 2800,
      date_effet: '2024-02-01',
      notes: null,
      created_at: '2024-02-02T00:00:00.000Z',
      created_by: 'user-1',
    },
  ],
  CREATED_ROW: {
    id: 'ov-created',
    profile_id: 'p1',
    montant: 3500,
    date_effet: '2024-04-01',
    notes: 'ajustement',
    created_at: '2024-04-02T00:00:00.000Z',
    created_by: 'user-1',
  },
  mockFrom: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  sanitizeSupabaseErrorMock: vi.fn((error: Error | { message?: string }) => error.message ?? 'erreur'),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

type BuilderResult = { data: unknown; error: { message: string } | null }

function createBuilder(config: {
  selectResult?: BuilderResult
  singleResult?: BuilderResult
  deleteResult?: BuilderResult
}) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(config.singleResult ?? { data: null, error: null })),
    single: vi.fn(() => Promise.resolve(config.singleResult ?? { data: null, error: null })),
    then: (
      onFulfilled?: ((value: BuilderResult) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null
    ) =>
      Promise.resolve(config.deleteResult ?? config.selectResult ?? { data: null, error: null }).then(
        onFulfilled ?? undefined,
        onRejected ?? undefined
      ),
    catch: (onRejected?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve(config.deleteResult ?? config.selectResult ?? { data: null, error: null }).catch(
        onRejected ?? undefined
      ),
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

  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { wrapper, queryClient }
}

describe('useSalaireProjectionsOverrides', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('charge les overrides, expose les valeurs métier et calcule la surcharge applicable', async () => {
    const selectBuilder = createBuilder({
      selectResult: { data: ROWS, error: null },
    })

    mockFrom.mockImplementation((table: string) => {
      expect(table).toBe('salaire_projections_overrides')
      return selectBuilder
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useSalaireProjectionsOverrides(), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.overrides).toEqual([])

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(selectBuilder.select).toHaveBeenCalledWith(
      'id, profile_id, montant, date_effet, notes, created_at, created_by'
    )
    expect(selectBuilder.order).toHaveBeenCalledWith('date_effet', { ascending: false })

    expect(result.current.overrides).toHaveLength(3)
    expect(result.current.overrides[0]).toEqual(ROWS[0])
    expect(result.current.overrides[1].montant).toBe(3300)
    expect(result.current.overrides[2].profile_id).toBe('p2')

    expect(result.current.getApplicableOverride('p1', '2023-12-01')).toBeNull()
    expect(result.current.getApplicableOverride('p1', '2024-02-01')).toEqual(ROWS[0])
    expect(result.current.getApplicableOverride('p1', '2024-03-15')).toEqual(ROWS[1])
    expect(result.current.getApplicableOverride('p2', '2024-02-15')).toEqual(ROWS[2])
    expect(result.current.getApplicableOverride('unknown', '2024-03-15')).toBeNull()
  })

  it('crée une surcharge, envoie les bonnes données, invalide le cache et affiche un toast de succès', async () => {
    const selectBuilder = createBuilder({
      selectResult: { data: ROWS, error: null },
    })
    const upsertBuilder = createBuilder({
      singleResult: { data: CREATED_ROW, error: null },
    })

    mockFrom.mockImplementation(() => {
      if (mockFrom.mock.calls.length === 1) return selectBuilder
      return upsertBuilder
    })

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useSalaireProjectionsOverrides(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const payload = {
      profile_id: 'p1',
      montant: 3500,
      date_effet: '2024-04-01',
      notes: 'ajustement',
    }

    let mutationResult: unknown
    await act(async () => {
      mutationResult = await result.current.createOverride(payload)
    })

    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      {
        profile_id: 'p1',
        montant: 3500,
        date_effet: '2024-04-01',
        notes: 'ajustement',
        created_by: 'user-1',
      },
      {
        onConflict: 'profile_id,date_effet',
      }
    )
    expect(upsertBuilder.select).toHaveBeenCalledWith()
    expect(upsertBuilder.single).toHaveBeenCalled()
    expect(mutationResult).toEqual(CREATED_ROW)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['salaire-projections-overrides'] })
    expect(toastSuccess).toHaveBeenCalledWith('Projection de salaire modifiée')
  })

  it('supprime une surcharge, filtre par id, invalide le cache et affiche un toast de succès', async () => {
    const selectBuilder = createBuilder({
      selectResult: { data: ROWS, error: null },
    })
    const deleteBuilder = createBuilder({
      deleteResult: { data: null, error: null },
    })

    mockFrom.mockImplementation(() => {
      if (mockFrom.mock.calls.length === 1) return selectBuilder
      return deleteBuilder
    })

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useSalaireProjectionsOverrides(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.deleteOverride('ov-2')
    })

    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'ov-2')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['salaire-projections-overrides'] })
    expect(toastSuccess).toHaveBeenCalledWith('Surcharge supprimée')
  })

  it('retourne des overrides vides quand le chargement échoue et la fonction métier reste sûre', async () => {
    const selectBuilder = createBuilder({
      selectResult: { data: null, error: { message: 'load failed' } },
    })

    mockFrom.mockImplementation(() => selectBuilder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useSalaireProjectionsOverrides(), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.overrides).toEqual([])
    expect(result.current.getApplicableOverride('p1', '2024-03-01')).toBeNull()
  })

  it('gère une erreur de création avec sanitation et toast', async () => {
    const selectBuilder = createBuilder({
      selectResult: { data: ROWS, error: null },
    })
    const upsertBuilder = createBuilder({
      singleResult: { data: null, error: { message: 'insert failed' } },
    })

    mockFrom.mockImplementation(() => {
      if (mockFrom.mock.calls.length === 1) return selectBuilder
      return upsertBuilder
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useSalaireProjectionsOverrides(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await expect(
        result.current.createOverride({
          profile_id: 'p1',
          montant: 3600,
          date_effet: '2024-05-01',
          notes: 'mai',
        })
      ).rejects.toEqual({ message: 'insert failed' })
    })

    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      {
        profile_id: 'p1',
        montant: 3600,
        date_effet: '2024-05-01',
        notes: 'mai',
        created_by: 'user-1',
      },
      {
        onConflict: 'profile_id,date_effet',
      }
    )
    expect(sanitizeSupabaseErrorMock).toHaveBeenCalledWith({ message: 'insert failed' })
    expect(toastError).toHaveBeenCalledWith('insert failed')
  })

  it('gère une erreur de suppression avec sanitation et toast', async () => {
    const selectBuilder = createBuilder({
      selectResult: { data: ROWS, error: null },
    })
    const deleteBuilder = createBuilder({
      deleteResult: { data: null, error: { message: 'delete failed' } },
    })

    mockFrom.mockImplementation(() => {
      if (mockFrom.mock.calls.length === 1) return selectBuilder
      return deleteBuilder
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useSalaireProjectionsOverrides(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await expect(result.current.deleteOverride('ov-1')).rejects.toEqual({ message: 'delete failed' })
    })

    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'ov-1')
    expect(sanitizeSupabaseErrorMock).toHaveBeenCalledWith({ message: 'delete failed' })
    expect(toastError).toHaveBeenCalledWith('delete failed')
  })
})