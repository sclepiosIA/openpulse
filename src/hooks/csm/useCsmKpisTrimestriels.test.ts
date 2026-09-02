/* @vitest-environment jsdom */
import React, { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCsmKpisTrimestriels } from './useCsmKpisTrimestriels'

const {
  ROWS,
  UPSERT_RESULT,
  authState,
  mockToastError,
  mockToastSuccess,
  mockSanitizeSupabaseError,
  mockFromExtended,
  mockFrom,
  mockInvalidateQueries,
} = vi.hoisted(() => ({
  ROWS: [
    {
      id: 'kpi-1',
      etablissement_id: 'eta-1',
      periode: '2024-T1',
      taux_satisfaction: 91,
      dossiers_traites: 120,
      taux_utilisation_formatage: 72,
      taux_utilisation_ocr: 61,
      taux_utilisation_cotations: 58,
      taux_utilisation_courriers: 49,
      taux_utilisation_traduction: 17,
      taux_utilisation_examens: 35,
      taux_utilisation_chatbot: 23,
      taux_uhcd_marque: 11,
      taux_uhcd_compte: 8,
      ccm2_plus: 41,
      ccmu3_plus: 29,
      avis_specialise: 14,
      temps_passage_urgences: 187,
      sort_order: 1,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'kpi-2',
      etablissement_id: 'eta-1',
      periode: '2024-T2',
      taux_satisfaction: 94,
      dossiers_traites: 132,
      taux_utilisation_formatage: 77,
      taux_utilisation_ocr: 66,
      taux_utilisation_cotations: 62,
      taux_utilisation_courriers: 51,
      taux_utilisation_traduction: 19,
      taux_utilisation_examens: 38,
      taux_utilisation_chatbot: 25,
      taux_uhcd_marque: 13,
      taux_uhcd_compte: 9,
      ccm2_plus: 44,
      ccmu3_plus: 31,
      avis_specialise: 16,
      temps_passage_urgences: 176,
      sort_order: 2,
      created_at: '2024-04-01',
      updated_at: '2024-04-02',
    },
  ],
  UPSERT_RESULT: {
    id: 'kpi-3',
    etablissement_id: 'eta-1',
    periode: '2024-T3',
    taux_satisfaction: 96,
    sort_order: 3,
  },
  authState: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockSanitizeSupabaseError: vi.fn((error: Error) => `sanitized:${error.message}`),
  mockFromExtended: vi.fn(),
  mockFrom: vi.fn(),
  mockInvalidateQueries: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authState,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: mockFromExtended,
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

function createBuilder(options?: {
  listResult?: { data: typeof ROWS | null; error: Error | null }
  singleResult?: { data: typeof UPSERT_RESULT | null; error: Error | null }
  deleteResult?: { error: Error | null }
}) {
  const listResult = options?.listResult ?? { data: ROWS, error: null }
  const singleResult = options?.singleResult ?? { data: UPSERT_RESULT, error: null }
  const deleteResult = options?.deleteResult ?? { error: null }

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(async () => listResult),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => {
      const deleteBuilder = {
        eq: vi.fn(async () => deleteResult),
        then: (onFulfilled: (value: { error: Error | null }) => unknown) =>
          Promise.resolve(deleteResult).then(onFulfilled),
        catch: (onRejected: (reason: unknown) => unknown) =>
          Promise.resolve(deleteResult).catch(onRejected),
      }
      return deleteBuilder
    }),
    single: vi.fn(async () => singleResult),
    maybeSingle: vi.fn(async () => singleResult),
    then: (onFulfilled: (value: { data: typeof ROWS | null; error: Error | null }) => unknown) =>
      Promise.resolve(listResult).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(listResult).catch(onRejected),
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

  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(mockInvalidateQueries)

  const wrapper = ({ children }: PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { wrapper, queryClient }
}

describe('useCsmKpisTrimestriels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('charge les KPI trimestriels puis retourne les valeurs métier attendues et filtre par établissement', async () => {
    const builder = createBuilder()
    mockFromExtended.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmKpisTrimestriels('eta-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toEqual([])

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFromExtended).toHaveBeenCalledWith('csm_kpis_trimestriels')
    expect(builder.select).toHaveBeenCalledTimes(1)
    expect(builder.eq).toHaveBeenCalledWith('etablissement_id', 'eta-1')
    expect(builder.order).toHaveBeenCalledWith('sort_order', { ascending: true })
    expect(builder.limit).toHaveBeenCalledWith(500)

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data[0]).toMatchObject({
      id: 'kpi-1',
      periode: '2024-T1',
      taux_satisfaction: 91,
      dossiers_traites: 120,
      sort_order: 1,
    })
    expect(result.current.data[1]).toMatchObject({
      id: 'kpi-2',
      periode: '2024-T2',
      taux_satisfaction: 94,
      temps_passage_urgences: 176,
      sort_order: 2,
    })
  })

  it('retourne data vide et stoppe le chargement quand la requête échoue', async () => {
    const builder = createBuilder({
      listResult: { data: null, error: new Error('x') },
    })
    mockFromExtended.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmKpisTrimestriels('eta-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toEqual([])

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual([])
    expect(builder.eq).toHaveBeenCalledWith('etablissement_id', 'eta-1')
    expect(builder.order).toHaveBeenCalledWith('sort_order', { ascending: true })
    expect(builder.limit).toHaveBeenCalledWith(500)
  })

  it('upsert supprime id absent du payload, appelle la table attendue et invalide le cache', async () => {
    const builder = createBuilder()
    mockFromExtended.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmKpisTrimestriels('eta-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const payload = {
      etablissement_id: 'eta-1',
      periode: '2024-T3',
      taux_satisfaction: 96,
      sort_order: 3,
    }

    await act(async () => {
      await result.current.upsert(payload)
    })

    expect(mockFromExtended).toHaveBeenCalledWith('csm_kpis_trimestriels')
    expect(builder.upsert).toHaveBeenCalledWith({
      etablissement_id: 'eta-1',
      periode: '2024-T3',
      taux_satisfaction: 96,
      sort_order: 3,
    })
    expect(builder.single).toHaveBeenCalledTimes(1)
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['csm-kpis-trimestriels'] })
  })

  it('remove supprime par id et invalide le cache', async () => {
    const builder = createBuilder()
    mockFromExtended.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmKpisTrimestriels('eta-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.remove('kpi-2')
    })

    expect(mockFromExtended).toHaveBeenCalledWith('csm_kpis_trimestriels')
    expect(builder.delete).toHaveBeenCalledTimes(1)
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['csm-kpis-trimestriels'] })
  })

  it('affiche un toast d’erreur sanitizé quand l’upsert échoue', async () => {
    const builder = createBuilder({
      singleResult: { data: null, error: new Error('x') },
    })
    mockFromExtended.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmKpisTrimestriels('eta-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await expect(
      result.current.upsert({
        etablissement_id: 'eta-1',
        periode: '2024-T4',
        taux_satisfaction: 88,
      }),
    ).rejects.toThrow('x')

    await waitFor(() => {
      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(expect.objectContaining({ message: 'x' }))
      expect(mockToastError).toHaveBeenCalledWith('sanitized:x')
    })
  })

  it('affiche un toast d’erreur sanitizé quand la suppression échoue', async () => {
    const builder = createBuilder({
      deleteResult: { error: new Error('x') },
    })
    mockFromExtended.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmKpisTrimestriels('eta-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await expect(result.current.remove('kpi-1')).rejects.toThrow('x')

    await waitFor(() => {
      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(expect.objectContaining({ message: 'x' }))
      expect(mockToastError).toHaveBeenCalledWith('sanitized:x')
    })
  })
})