// @ts-nocheck
/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCsmFacturation } from './useCsmFacturation'

const {
  LIST_ROWS,
  SINGLE_ROW,
  UPSERTED_ROW,
  builderState,
  mockFrom,
  mockFromExtended,
  mockToastError,
  mockSanitizeSupabaseError,
} = vi.hoisted(() => {
  const LIST_ROWS = [
    {
      id: 'fac-1',
      etablissement_id: 'eta-1',
      modele_facturation: 'abonnement',
      date_deploiement: '2024-01-10',
      date_debut_periode: '2024-01-01',
      date_fin_periode: '2024-01-31',
      derniere_relance: '2024-01-20',
      facturation_effectuee: true,
      notes: 'Premiere facture',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-21T10:00:00Z',
    },
    {
      id: 'fac-2',
      etablissement_id: 'eta-2',
      modele_facturation: 'acte',
      date_deploiement: '2024-02-05',
      date_debut_periode: '2024-02-01',
      date_fin_periode: '2024-02-29',
      derniere_relance: null,
      facturation_effectuee: false,
      notes: 'En attente',
      created_at: '2024-02-01T09:00:00Z',
      updated_at: '2024-02-06T09:00:00Z',
    },
  ]

  const SINGLE_ROW = {
    id: 'fac-single',
    etablissement_id: 'eta-target',
    modele_facturation: 'forfait',
    date_deploiement: '2024-03-01',
    date_debut_periode: '2024-03-01',
    date_fin_periode: '2024-03-31',
    derniere_relance: '2024-03-15',
    facturation_effectuee: false,
    notes: 'Client prioritaire',
    created_at: '2024-03-01T08:00:00Z',
    updated_at: '2024-03-16T08:00:00Z',
  }

  const UPSERTED_ROW = {
    id: 'fac-upsert',
    etablissement_id: 'eta-upsert',
    modele_facturation: 'abonnement',
    date_deploiement: '2024-04-01',
    date_debut_periode: '2024-04-01',
    date_fin_periode: '2024-04-30',
    derniere_relance: null,
    facturation_effectuee: true,
    notes: 'Mise a jour',
    created_at: '2024-04-01T07:00:00Z',
    updated_at: '2024-04-02T07:00:00Z',
  }

  const builderState = {
    mode: 'list' as 'list' | 'single' | 'upsert' | 'error-list' | 'error-single' | 'error-upsert',
    eqField: undefined as string | undefined,
    eqValue: undefined as string | undefined,
    limitValue: undefined as number | undefined,
    upsertValues: undefined as Record<string, unknown> | undefined,
    upsertOptions: undefined as Record<string, unknown> | undefined,
    selectArgs: [] as unknown[],
  }

  const createBuilder = () => {
    const builder = {
      select: vi.fn((...args: unknown[]) => {
        builderState.selectArgs = args
        return builder
      }),
      eq: vi.fn((field: string, value: string) => {
        builderState.eqField = field
        builderState.eqValue = value
        return builder
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn((value: number) => {
        builderState.limitValue = value
        return builder
      }),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn((values: Record<string, unknown>, options: Record<string, unknown>) => {
        builderState.upsertValues = values
        builderState.upsertOptions = options
        return builder
      }),
      single: vi.fn(async () => {
        if (builderState.mode === 'error-upsert') {
          return { data: null, error: { message: 'upsert failed' } }
        }
        return { data: UPSERTED_ROW, error: null }
      }),
      maybeSingle: vi.fn(async () => {
        if (builderState.mode === 'error-single') {
          return { data: null, error: { message: 'single failed' } }
        }
        return { data: SINGLE_ROW, error: null }
      }),
      then: (
        onFulfilled?: (value: { data: unknown; error: unknown }) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => {
        if (builderState.mode === 'error-list') {
          const value = { data: null, error: { message: 'list failed' } }
          return Promise.resolve(value).then(onFulfilled, onRejected)
        }
        const value = { data: LIST_ROWS, error: null }
        return Promise.resolve(value).then(onFulfilled, onRejected)
      },
      catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
    }
    return builder
  }

  const mockFrom = vi.fn(() => createBuilder())
  const mockFromExtended = vi.fn(() => createBuilder())
  const mockToastError = vi.fn()
  const mockSanitizeSupabaseError = vi.fn((error: unknown) => {
    const message =
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : 'unknown'
    return 'Erreur: ' + message
  })

  return {
    LIST_ROWS,
    SINGLE_ROW,
    UPSERTED_ROW,
    builderState,
    mockFrom,
    mockFromExtended,
    mockToastError,
    mockSanitizeSupabaseError,
  }
})

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: mockFromExtended,
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children?: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

describe('useCsmFacturation', () => {
  beforeEach(() => {
    builderState.mode = 'list'
    builderState.eqField = undefined
    builderState.eqValue = undefined
    builderState.limitValue = undefined
    builderState.upsertValues = undefined
    builderState.upsertOptions = undefined
    builderState.selectArgs = []
    mockFrom.mockClear()
    mockFromExtended.mockClear()
    mockToastError.mockClear()
    mockSanitizeSupabaseError.mockClear()
  })

  it('charge puis retourne la liste quand aucun etablissementId nest fourni', async () => {
    const { result } = renderHook(() => useCsmFacturation(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toEqual([])
    expect(result.current.single).toBeNull()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFromExtended).toHaveBeenCalledWith('csm_facturation_suivi')
    expect(builderState.limitValue).toBe(500)
    expect(result.current.data).toEqual(LIST_ROWS)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data[0].modele_facturation).toBe('abonnement')
    expect(result.current.data[0].facturation_effectuee).toBe(true)
    expect(result.current.data[1].modele_facturation).toBe('acte')
    expect(result.current.data[1].facturation_effectuee).toBe(false)
    expect(result.current.single).toBeNull()
    expect(builderState.selectArgs[0]).toContain('modele_facturation')
    expect(builderState.selectArgs[0]).toContain('facturation_effectuee')
  })

  it('charge puis retourne une fiche unique quand etablissementId est fourni', async () => {
    builderState.mode = 'single'

    const { result } = renderHook(() => useCsmFacturation('eta-target'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toEqual([])
    expect(result.current.single).toBeNull()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(builderState.eqField).toBe('etablissement_id')
    expect(builderState.eqValue).toBe('eta-target')
    expect(result.current.data).toEqual([SINGLE_ROW])
    expect(result.current.single).toEqual(SINGLE_ROW)
    expect(result.current.single?.notes).toBe('Client prioritaire')
    expect(result.current.single?.modele_facturation).toBe('forfait')
    expect(result.current.single?.facturation_effectuee).toBe(false)
  })

  it('passe en erreur de requete quand la recuperation liste echoue', async () => {
    builderState.mode = 'error-list'

    const { result } = renderHook(() => useCsmFacturation(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual([])
    expect(result.current.single).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.upsert).toEqual(expect.any(Function))
  })

  it('passe en erreur de requete quand la recuperation single echoue', async () => {
    builderState.mode = 'error-single'

    const { result } = renderHook(() => useCsmFacturation('eta-target'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual([])
    expect(result.current.single).toBeNull()
    expect(builderState.eqField).toBe('etablissement_id')
    expect(builderState.eqValue).toBe('eta-target')
  })

  it('execute la mutation upsert avec les bonnes valeurs et options', async () => {
    const { result } = renderHook(() => useCsmFacturation(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const payload = {
      etablissement_id: 'eta-upsert',
      modele_facturation: 'abonnement',
      notes: 'Mise a jour',
      facturation_effectuee: true,
    }

    await act(async () => {
      const response = await result.current.upsert(payload)
      expect(response).toEqual(UPSERTED_ROW)
    })

    expect(mockFromExtended).toHaveBeenCalledWith('csm_facturation_suivi')
    expect(builderState.upsertValues).toEqual(payload)
    expect(builderState.upsertOptions).toEqual({ onConflict: 'etablissement_id' })
  })

  it('sanitise et affiche lerreur toast quand la mutation echoue', async () => {
    builderState.mode = 'error-upsert'

    const { result } = renderHook(() => useCsmFacturation(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const payload = {
      etablissement_id: 'eta-upsert',
      modele_facturation: 'abonnement',
    }

    await act(async () => {
      await expect(result.current.upsert(payload)).rejects.toMatchObject({
        message: 'upsert failed',
      })
    })

    expect(builderState.upsertValues).toEqual(payload)
    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'upsert failed' })
    )
    expect(mockToastError).toHaveBeenCalledWith('Erreur: upsert failed')
  })
})
