// @ts-nocheck
/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useReferentielCompetences } from './useReferentielCompetences'

const {
  REFERENTIEL_ROWS,
  CREATED_COMPETENCE,
  UPDATED_COMPETENCE,
  mockFrom,
  mockToastSuccess,
  mockToastError,
  mockSanitizeSupabaseError,
  state,
} = vi.hoisted(() => {
  const REFERENTIEL_ROWS = [
    {
      id: 'comp-1',
      nom: 'Communication orale',
      description: 'Présenter clairement des idées',
      categorie: 'soft_skills',
      parent_id: null,
      icone: 'message-circle',
      ordre: 1,
      est_actif: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'comp-2',
      nom: 'React',
      description: 'Développer des interfaces',
      categorie: 'technique',
      parent_id: null,
      icone: 'code',
      ordre: 2,
      est_actif: true,
      created_at: '2024-01-03',
      updated_at: '2024-01-04',
    },
    {
      id: 'comp-3',
      nom: 'Gestion du temps',
      description: 'Prioriser les tâches',
      categorie: 'soft_skills',
      parent_id: null,
      icone: 'clock',
      ordre: 3,
      est_actif: false,
      created_at: '2024-01-05',
      updated_at: '2024-01-06',
    },
  ]

  const CREATED_COMPETENCE = {
    id: 'comp-4',
    nom: 'TypeScript',
    description: 'Typer les applications',
    categorie: 'technique',
    parent_id: null,
    icone: 'file-code',
    ordre: 4,
    est_actif: true,
    created_at: '2024-02-01',
    updated_at: '2024-02-01',
  }

  const UPDATED_COMPETENCE = {
    id: 'comp-2',
    nom: 'React avancé',
    description: 'Développer des interfaces',
    categorie: 'technique',
    parent_id: null,
    icone: 'code',
    ordre: 2,
    est_actif: true,
    created_at: '2024-01-03',
    updated_at: '2024-03-01',
  }

  const state = {
    selectResponse: { data: REFERENTIEL_ROWS, error: null as { message: string } | null },
    singleResponse: {
      data: CREATED_COMPETENCE as unknown,
      error: null as { message: string } | null,
    },
    operation: 'select' as 'select' | 'insert' | 'update' | 'delete',
    table: '',
    selectArgs: [] as unknown[][],
    orderArgs: [] as unknown[][],
    eqArgs: [] as Array<[string, unknown]>,
    ilikeArgs: [] as Array<[string, string]>,
    insertArgs: [] as unknown[],
    updateArgs: [] as unknown[],
    deleteCalls: 0,
  }

  const createBuilder = () => {
    const builder = {
      select: vi.fn((...args: unknown[]) => {
        state.selectArgs.push(args)
        return builder
      }),
      eq: vi.fn((column: string, value: unknown) => {
        state.eqArgs.push([column, value])
        return builder
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      ilike: vi.fn((column: string, value: string) => {
        state.ilikeArgs.push([column, value])
        return builder
      }),
      order: vi.fn((...args: unknown[]) => {
        state.orderArgs.push(args)
        return builder
      }),
      limit: vi.fn(() => builder),
      insert: vi.fn((payload: unknown) => {
        state.operation = 'insert'
        state.insertArgs.push(payload)
        return builder
      }),
      update: vi.fn((payload: unknown) => {
        state.operation = 'update'
        state.updateArgs.push(payload)
        return builder
      }),
      delete: vi.fn(() => {
        state.operation = 'delete'
        state.deleteCalls += 1
        return builder
      }),
      single: vi.fn(async () => state.singleResponse),
      maybeSingle: vi.fn(async () => state.singleResponse),
      then: (
        onFulfilled?: ((value: unknown) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null
      ) => {
        const response =
          state.operation === 'select'
            ? state.selectResponse
            : state.operation === 'delete'
              ? { data: null, error: null }
              : state.singleResponse

        return Promise.resolve(response).then(onFulfilled ?? undefined, onRejected ?? undefined)
      },
      catch: (onRejected?: ((reason: unknown) => unknown) | null) => {
        const response =
          state.operation === 'select'
            ? state.selectResponse
            : state.operation === 'delete'
              ? { data: null, error: null }
              : state.singleResponse

        return Promise.resolve(response).catch(onRejected ?? undefined)
      },
    }

    return builder
  }

  const mockFrom = vi.fn((table: string) => {
    state.table = table
    state.operation = 'select'
    return createBuilder()
  })

  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()
  const mockSanitizeSupabaseError = vi.fn(
    (error: { message?: string }) => `sanitized:${error.message ?? 'unknown'}`
  )

  return {
    REFERENTIEL_ROWS,
    CREATED_COMPETENCE,
    UPDATED_COMPETENCE,
    mockFrom,
    mockToastSuccess,
    mockToastError,
    mockSanitizeSupabaseError,
    state,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}))

function createWrapperAndClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const Wrapper = ({ children }: { children?: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)

  return { Wrapper, queryClient }
}

describe('useReferentielCompetences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.selectResponse = { data: REFERENTIEL_ROWS, error: null }
    state.singleResponse = { data: CREATED_COMPETENCE, error: null }
    state.operation = 'select'
    state.table = ''
    state.selectArgs = []
    state.orderArgs = []
    state.eqArgs = []
    state.ilikeArgs = []
    state.insertArgs = []
    state.updateArgs = []
    state.deleteCalls = 0
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals?.()
    vi.unstubAllEnvs?.()
  })

  it('charge les compétences et les groupe par catégorie', async () => {
    const { Wrapper } = createWrapperAndClient()
    const { result, unmount } = renderHook(() => useReferentielCompetences(), {
      wrapper: Wrapper,
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.competences).toEqual([])

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.competences).toEqual(REFERENTIEL_ROWS)
    })

    expect(mockFrom).toHaveBeenCalledWith('referentiel_competences')
    expect(state.selectArgs[0]).toEqual([
      'id, nom, description, categorie, parent_id, icone, ordre, est_actif, created_at, updated_at',
    ])
    expect(state.orderArgs[0]).toEqual(['ordre', { ascending: true }])
    expect(state.eqArgs).toContainEqual(['est_actif', true])

    expect(result.current.competencesByCategory.soft_skills).toEqual([
      REFERENTIEL_ROWS[0],
      REFERENTIEL_ROWS[2],
    ])
    expect(result.current.competencesByCategory.technique).toEqual([REFERENTIEL_ROWS[1]])
    expect(result.current.competencesByCategory.soft_skills[0].nom).toBe('Communication orale')
    expect(result.current.competencesByCategory.technique[0].icone).toBe('code')

    unmount()
  })

  it('applique les filtres catégorie, actifOnly et search', async () => {
    const { Wrapper } = createWrapperAndClient()
    const { result, unmount } = renderHook(
      () =>
        useReferentielCompetences({
          categorie: 'technique',
          actifOnly: false,
          search: 'React',
        }),
      {
        wrapper: Wrapper,
      }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.competences).toEqual(REFERENTIEL_ROWS)
    })

    expect(state.eqArgs).toContainEqual(['categorie', 'technique'])
    expect(state.eqArgs).not.toContainEqual(['est_actif', true])
    expect(state.ilikeArgs).toContainEqual(['nom', '%React%'])
    expect(result.current.competences[1].nom).toBe('React')

    unmount()
  })

  it('passe en erreur quand la requête échoue', async () => {
    state.selectResponse = { data: null, error: { message: 'x' } }

    const { Wrapper } = createWrapperAndClient()
    const { result, unmount } = renderHook(() => useReferentielCompetences(), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error?.message).toBe('x')
    expect(result.current.competences).toEqual([])

    unmount()
  })

  it('crée une compétence puis invalide la query et affiche un toast de succès', async () => {
    state.singleResponse = { data: CREATED_COMPETENCE, error: null }
    const { Wrapper, queryClient } = createWrapperAndClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result, unmount } = renderHook(() => useReferentielCompetences(), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const payload = {
      nom: 'TypeScript',
      description: 'Typer les applications',
      categorie: 'technique',
      est_actif: true,
    }

    await act(async () => {
      await result.current.createCompetence.mutateAsync(payload)
    })

    expect(mockFrom).toHaveBeenCalledWith('referentiel_competences')
    expect(state.insertArgs[0]).toEqual(payload)

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['referentiel-competences'] })
      expect(mockToastSuccess).toHaveBeenCalledWith('Compétence ajoutée au référentiel')
      expect(result.current.createCompetence.isSuccess).toBe(true)
    })

    unmount()
  })

  it('met à jour une compétence avec le bon id et les bonnes données', async () => {
    state.singleResponse = { data: UPDATED_COMPETENCE, error: null }
    const { Wrapper, queryClient } = createWrapperAndClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result, unmount } = renderHook(() => useReferentielCompetences(), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const mutationPayload = {
      id: 'comp-2',
      nom: 'React avancé',
      est_actif: true,
    }

    await act(async () => {
      await result.current.updateCompetence.mutateAsync(mutationPayload)
    })

    expect(state.updateArgs[0]).toEqual({
      nom: 'React avancé',
      est_actif: true,
    })
    expect(state.eqArgs).toContainEqual(['id', 'comp-2'])

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['referentiel-competences'] })
      expect(mockToastSuccess).toHaveBeenCalledWith('Compétence mise à jour')
      expect(result.current.updateCompetence.isSuccess).toBe(true)
    })

    unmount()
  })

  it('supprime une compétence avec le bon id', async () => {
    const { Wrapper, queryClient } = createWrapperAndClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result, unmount } = renderHook(() => useReferentielCompetences(), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.deleteCompetence.mutateAsync('comp-3')
    })

    expect(state.deleteCalls).toBe(1)
    expect(state.eqArgs).toContainEqual(['id', 'comp-3'])

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['referentiel-competences'] })
      expect(mockToastSuccess).toHaveBeenCalledWith('Compétence supprimée')
      expect(result.current.deleteCompetence.isSuccess).toBe(true)
    })

    unmount()
  })

  it('affiche un toast d’erreur sanitizé quand une création échoue', async () => {
    state.singleResponse = { data: null, error: { message: 'x' } }

    const { Wrapper } = createWrapperAndClient()
    const { result, unmount } = renderHook(() => useReferentielCompetences(), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await expect(
        result.current.createCompetence.mutateAsync({
          nom: 'TypeScript',
          categorie: 'technique',
        })
      ).rejects.toMatchObject({ message: 'x' })
    })

    await waitFor(() => {
      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'x' })
      )
      expect(mockToastError).toHaveBeenCalledWith('sanitized:x')
      expect(result.current.createCompetence.isError).toBe(true)
    })

    unmount()
  })
})