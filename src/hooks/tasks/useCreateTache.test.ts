/* @vitest-environment jsdom */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCreateTache, type CreateTacheData } from './useCreateTache'

const {
  mockFrom,
  mockToast,
  mockSanitizeSupabaseError,
  SUCCESS_RESULT,
} = vi.hoisted(() => {
  const SUCCESS_RESULT = {
    id: 't1',
    titre: 'Nouvelle tâche',
    description: 'Description test',
    etablissement_id: 'e1',
    categorie_id: 'c1',
    priorite: 'high',
    date_debut: '2024-01-10',
    echeance: '2024-01-20',
    responsable_id: 'u1',
    recurrence_rule: null,
    ordre: 3,
    etablissements: { nom: 'Établissement A' },
    categories_taches: { nom: 'Catégorie A', couleur: '#fff' },
    profiles: { user_id: 'u1', prenom: 'Jean', nom: 'Dupont', email: 'jean@example.test' },
  }

  return {
    mockFrom: vi.fn(),
    mockToast: vi.fn(),
    mockSanitizeSupabaseError: vi.fn(),
    SUCCESS_RESULT,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children)
  }
}

type BuilderResponse = {
  data: typeof SUCCESS_RESULT | null
  error: { message: string } | null
}

function createSupabaseBuilder(response: BuilderResponse) {
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
    delete: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(response),
    maybeSingle: vi.fn().mockResolvedValue(response),
    then: (onFulfilled: (value: BuilderResponse) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(response).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(response).catch(onRejected),
  }

  return builder
}

describe('useCreateTache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSanitizeSupabaseError.mockImplementation((error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string'
      ) {
        return (error as { message: string }).message
      }
      return 'Erreur'
    })
  })

  it('crée une tâche avec transformation des dates, invalide les queries et affiche un toast de succès', async () => {
    const client = createQueryClient()
    const invalidateQueriesSpy = vi.spyOn(client, 'invalidateQueries')
    const builder = createSupabaseBuilder({ data: SUCCESS_RESULT, error: null })
    mockFrom.mockReturnValue(builder)

    const wrapper = createWrapper(client)
    const { result } = renderHook(() => useCreateTache(), { wrapper })

    expect(result.current.isPending).toBe(false)

    const payload: CreateTacheData = {
      titre: 'Nouvelle tâche',
      description: 'Description test',
      etablissement_id: 'e1',
      categorie_id: 'c1',
      priorite: 'high',
      date_debut: '2024-01-10T12:34:56.000Z',
      echeance: '2024-01-20T08:00:00.000Z',
      responsable_id: 'u1',
      recurrence_rule: 'FREQ=WEEKLY',
      ordre: 3,
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(mockFrom).toHaveBeenCalledWith('taches')
    expect(builder.insert).toHaveBeenCalledWith([
      {
        ...payload,
        date_debut: '2024-01-10',
        echeance: '2024-01-20',
      },
    ])
    expect(builder.select).toHaveBeenCalledWith(`
          *,
          etablissements (nom),
          categories_taches (nom, couleur),
          profiles!taches_responsable_id_fkey (user_id, prenom, nom, email)
        `)
    expect(builder.single).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(SUCCESS_RESULT)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['taches'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['etablissements'] })
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Tâche créée avec succès',
    })
  })

  it('passe null pour les dates absentes', async () => {
    const client = createQueryClient()
    const builder = createSupabaseBuilder({ data: SUCCESS_RESULT, error: null })
    mockFrom.mockReturnValue(builder)

    const wrapper = createWrapper(client)
    const { result } = renderHook(() => useCreateTache(), { wrapper })

    const payload: CreateTacheData = {
      titre: 'Sans dates',
      etablissement_id: 'e2',
      categorie_id: 'c2',
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(builder.insert).toHaveBeenCalledWith([
      {
        ...payload,
        date_debut: null,
        echeance: null,
      },
    ])
  })

  it('remonte une erreur, passe en isError et affiche un toast destructif avec message sanitizé', async () => {
    const client = createQueryClient()
    const error = { message: 'x' }
    const builder = createSupabaseBuilder({ data: null, error })
    mockFrom.mockReturnValue(builder)
    mockSanitizeSupabaseError.mockReturnValue('x')

    const wrapper = createWrapper(client)
    const { result } = renderHook(() => useCreateTache(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          titre: 'Erreur tâche',
          etablissement_id: 'e1',
          categorie_id: 'c1',
        })
      ).rejects.toEqual(error)
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(error)
    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(error)
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'x',
      variant: 'destructive',
    })
  })
})