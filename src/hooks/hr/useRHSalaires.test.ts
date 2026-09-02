/* @vitest-environment jsdom */

import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useRHSalaires, groupSalairesByMonth } from './useRHSalaires'

const {
  SALAIRES_ROWS,
  SINGLE_CREATED,
  SINGLE_UPDATED,
  queryState,
  mutationState,
  mockFrom,
  toastSuccess,
  toastError,
  sanitizeSupabaseErrorMock,
  debugErrorMock,
  logSalaryBatchViewMock,
  logSalaryAccessMock,
} = vi.hoisted(() => {
  const SALAIRES_ROWS = [
    {
      id: 'sal-1',
      profile_id: 'prof-1',
      mois: '2024-02-01',
      salaire_brut: 3200,
      salaire_net: 2500,
      net_paye: 2480,
      cotisations_patronales: 900,
      cotisations_salariales: 700,
      primes: 120,
      heures_supplementaires: 4,
      source_type: 'manual' as const,
      source_document_id: 'doc-1',
      created_at: '2024-02-02',
      updated_at: '2024-02-02',
      profiles: {
        id: 'prof-1',
        prenom: 'Jean',
        nom: 'Dupont',
        email: 'jean@example.fr',
        fonction: 'Technicien',
      },
    },
    {
      id: 'sal-2',
      profile_id: 'prof-2',
      mois: '2024-01-01',
      salaire_brut: 4100,
      salaire_net: 3180,
      net_paye: 3150,
      cotisations_patronales: 1100,
      cotisations_salariales: 920,
      primes: 200,
      heures_supplementaires: 2,
      source_type: 'auto_bulletin' as const,
      source_document_id: 'doc-2',
      created_at: '2024-01-31',
      updated_at: '2024-01-31',
      profiles: {
        id: 'prof-2',
        prenom: 'Marie',
        nom: 'Martin',
        email: 'marie@example.fr',
        fonction: 'Manager',
      },
    },
  ]

  const SINGLE_CREATED = {
    id: 'sal-3',
    profile_id: 'prof-3',
    mois: '2024-03-01',
    salaire_brut: 3000,
    salaire_net: 2350,
    cotisations_patronales: 850,
    cotisations_salariales: 650,
  }

  const SINGLE_UPDATED = {
    id: 'sal-1',
    profile_id: 'prof-1',
    mois: '2024-02-01',
    salaire_brut: 3300,
    salaire_net: 2580,
    cotisations_patronales: 930,
    cotisations_salariales: 720,
  }

  const queryState = {
    data: SALAIRES_ROWS as unknown,
    error: null as { message: string } | null,
  }

  const mutationState = {
    insertData: SINGLE_CREATED as unknown,
    insertError: null as { message: string } | null,
    updateData: SINGLE_UPDATED as unknown,
    updateError: null as { message: string } | null,
    deleteError: null as { message: string } | null,
  }

  const toastSuccess = vi.fn()
  const toastError = vi.fn()
  const sanitizeSupabaseErrorMock = vi.fn((error: { message?: string }) => error.message ?? 'sanitized error')
  const debugErrorMock = vi.fn()
  const logSalaryBatchViewMock = vi.fn()
  const logSalaryAccessMock = vi.fn()

  const mockFrom = vi.fn(() => {
    let operation: 'select' | 'insert' | 'update' | 'delete' = 'select'

    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => {
        operation = 'insert'
        return builder
      }),
      update: vi.fn(() => {
        operation = 'update'
        return builder
      }),
      delete: vi.fn(() => {
        operation = 'delete'
        return builder
      }),
      single: vi.fn(async () => {
        if (operation === 'insert') {
          return { data: mutationState.insertData, error: mutationState.insertError }
        }
        if (operation === 'update') {
          return { data: mutationState.updateData, error: mutationState.updateError }
        }
        return { data: queryState.data, error: queryState.error }
      }),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (
        onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => {
        const value =
          operation === 'delete'
            ? { data: null, error: mutationState.deleteError }
            : { data: queryState.data, error: queryState.error }
        return Promise.resolve(value).then(onFulfilled, onRejected)
      },
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
    }

    return builder
  })

  return {
    SALAIRES_ROWS,
    SINGLE_CREATED,
    SINGLE_UPDATED,
    queryState,
    mutationState,
    mockFrom,
    toastSuccess,
    toastError,
    sanitizeSupabaseErrorMock,
    debugErrorMock,
    logSalaryBatchViewMock,
    logSalaryAccessMock,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
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

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
  },
}))

vi.mock('./useSalaryAudit', () => ({
  logSalaryBatchView: logSalaryBatchViewMock,
  logSalaryAccess: logSalaryAccessMock,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return QueryClientProvider({ client: queryClient, children })
  }
}

describe('useRHSalaires', () => {
  beforeEach(() => {
    queryState.data = SALAIRES_ROWS
    queryState.error = null
    mutationState.insertData = SINGLE_CREATED
    mutationState.insertError = null
    mutationState.updateData = SINGLE_UPDATED
    mutationState.updateError = null
    mutationState.deleteError = null

    mockFrom.mockClear()
    toastSuccess.mockClear()
    toastError.mockClear()
    sanitizeSupabaseErrorMock.mockClear()
    debugErrorMock.mockClear()
    logSalaryBatchViewMock.mockClear()
    logSalaryAccessMock.mockClear()
  })

  it('charge les salaires, normalise le mois filtre et expose les valeurs métier attendues', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useRHSalaires('2024-02'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFrom).toHaveBeenCalledWith('rh_salaires_mensuels')
    expect(result.current.salaires).toEqual(SALAIRES_ROWS)
    expect(result.current.salaires?.[0].profiles?.prenom).toBe('Jean')
    expect(result.current.salaires?.[1].salaire_net).toBe(3180)
    expect(logSalaryBatchViewMock).toHaveBeenCalledWith('2024-02', 2)

    const builder = mockFrom.mock.results[0].value as {
      eq: ReturnType<typeof vi.fn>
      order: ReturnType<typeof vi.fn>
      select: ReturnType<typeof vi.fn>
    }

    expect(builder.select).toHaveBeenCalled()
    expect(builder.order).toHaveBeenCalledWith('mois', { ascending: false })
    expect(builder.eq).toHaveBeenCalledWith('mois', '2024-02-01')
  })

  it('passe en erreur si la requête échoue', async () => {
    const wrapper = createWrapper()
    queryState.data = null
    queryState.error = { message: 'x' }

    const { result } = renderHook(() => useRHSalaires('2024-01'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.salaires).toBeUndefined()
    expect(logSalaryBatchViewMock).not.toHaveBeenCalled()
  })

  it('crée un salaire, envoie le bon payload, affiche un toast et journalise l accès', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useRHSalaires(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const payload = {
      profile_id: 'prof-3',
      mois: '2024-03-01',
      salaire_brut: 3000,
      salaire_net: 2350,
      cotisations_patronales: 850,
      cotisations_salariales: 650,
      primes: 90,
    }

    await act(async () => {
      await result.current.createSalaire(payload)
    })

    const insertBuilder = mockFrom.mock.results.find((r) => {
      const value = r.value as { insert?: ReturnType<typeof vi.fn> }
      return Boolean(value.insert) && value.insert.mock.calls.length > 0
    })?.value as {
      insert: ReturnType<typeof vi.fn>
    }

    expect(insertBuilder.insert).toHaveBeenCalledWith(payload)
    expect(toastSuccess).toHaveBeenCalledWith('Salaire créé avec succès')
    expect(logSalaryAccessMock).toHaveBeenCalledWith({
      targetProfileId: 'prof-3',
      accessType: 'CREATE',
      salaryMonth: '2024-03-01',
    })
  })

  it('met à jour un salaire, envoie le bon payload et journalise la modification', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useRHSalaires('2024-02'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const updatePayload = {
      id: 'sal-1',
      salaire_net: 2580,
      primes: 150,
    }

    await act(async () => {
      await result.current.updateSalaire(updatePayload)
    })

    const updateBuilder = mockFrom.mock.results.find((r) => {
      const value = r.value as { update?: ReturnType<typeof vi.fn> }
      return Boolean(value.update) && value.update.mock.calls.length > 0
    })?.value as {
      update: ReturnType<typeof vi.fn>
      eq: ReturnType<typeof vi.fn>
    }

    expect(updateBuilder.update).toHaveBeenCalledWith({
      salaire_net: 2580,
      primes: 150,
    })
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'sal-1')
    expect(toastSuccess).toHaveBeenCalledWith('Salaire mis à jour avec succès')
    expect(logSalaryAccessMock).toHaveBeenCalledWith({
      targetProfileId: 'prof-1',
      accessType: 'UPDATE',
      salaryMonth: '2024-02-01',
    })
  })

  it('supprime un salaire, appelle delete/eq et journalise la suppression', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useRHSalaires('2024-02'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.deleteSalaire('sal-2')
    })

    const deleteBuilder = mockFrom.mock.results.find((r) => {
      const value = r.value as { delete?: ReturnType<typeof vi.fn> }
      return Boolean(value.delete) && value.delete.mock.calls.length > 0
    })?.value as {
      delete: ReturnType<typeof vi.fn>
      eq: ReturnType<typeof vi.fn>
    }

    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'sal-2')
    expect(toastSuccess).toHaveBeenCalledWith('Salaire supprimé avec succès')
    expect(logSalaryAccessMock).toHaveBeenCalledWith({
      accessType: 'DELETE',
      details: { deleted_salary_id: 'sal-2' },
    })
  })

  it('gère les erreurs de mutation avec sanitizer, toast et debug', async () => {
    const wrapper = createWrapper()
    mutationState.insertError = { message: 'x' }

    const { result } = renderHook(() => useRHSalaires(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await expect(
      result.current.createSalaire({
        profile_id: 'prof-9',
        mois: '2024-04-01',
        salaire_brut: 2000,
        salaire_net: 1600,
        cotisations_patronales: 500,
        cotisations_salariales: 400,
      })
    ).rejects.toEqual({ message: 'x' })

    expect(sanitizeSupabaseErrorMock).toHaveBeenCalledWith({ message: 'x' })
    expect(toastError).toHaveBeenCalledWith('x')
    expect(debugErrorMock).toHaveBeenCalledWith('Erreur création salaire:', { message: 'x' })
  })
})

describe('groupSalairesByMonth', () => {
  it('groupe par mois et trie du plus récent au plus ancien', () => {
    const grouped = groupSalairesByMonth([
      SALAIRES_ROWS[1],
      SALAIRES_ROWS[0],
      {
        ...SALAIRES_ROWS[0],
        id: 'sal-4',
        mois: '2024-02-15',
      },
    ])

    expect(grouped).toHaveLength(2)
    expect(grouped[0][0]).toBe('2024-02')
    expect(grouped[0][1]).toHaveLength(2)
    expect(grouped[1][0]).toBe('2024-01')
    expect(grouped[1][1][0].id).toBe('sal-2')
  })

  it('retourne un tableau vide pour undefined ou tableau vide', () => {
    expect(groupSalairesByMonth(undefined)).toEqual([])
    expect(groupSalairesByMonth([])).toEqual([])
  })
})