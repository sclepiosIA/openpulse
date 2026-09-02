/* @vitest-environment jsdom */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'

const {
  AUTH_STATE,
  TEMPLATE_ROWS,
  CLAUSE_ROWS,
  CREATED_TEMPLATE_RESULT,
  UPDATED_TEMPLATE_RESULT,
  CREATED_CLAUSE_RESULT,
  UPDATED_CLAUSE_RESULT,
  mockFrom,
  toastSuccess,
  toastError,
  debugError,
  builderState,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const TEMPLATE_ROWS = [
    {
      id: 'tpl-1',
      nom: 'Bail habitation',
      description: 'Template principal',
      type: 'bail',
      contenu_html: '<p>Contenu</p>',
      variables: null,
      clauses_ids: 'bad',
      est_actif: true,
      created_by: 'u1',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'tpl-2',
      nom: 'Vente',
      description: 'Template vente',
      type: 'vente',
      contenu_html: '<p>Vente</p>',
      variables: ['nom_client'],
      clauses_ids: ['cl-1'],
      est_actif: true,
      created_by: 'u1',
      created_at: '2024-01-03',
      updated_at: '2024-01-04',
    },
  ]

  const CLAUSE_ROWS = [
    {
      id: 'cl-1',
      titre: 'Clause résolutoire',
      contenu_html: '<p>Clause</p>',
      categorie: 'juridique',
      sous_categorie: 'bail',
      preview_text: 'Preview',
      variables: null,
      ordre: 1,
      est_actif: true,
      est_obligatoire: true,
      usage_count: 12,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'cl-2',
      titre: 'Clause assurance',
      contenu_html: '<p>Assurance</p>',
      categorie: 'garanties',
      sous_categorie: 'habitation',
      preview_text: 'Assurance',
      variables: ['montant'],
      ordre: 2,
      est_actif: true,
      est_obligatoire: false,
      usage_count: 5,
      created_at: '2024-01-05',
      updated_at: '2024-01-06',
    },
  ]

  const CREATED_TEMPLATE_RESULT = {
    id: 'tpl-new',
    nom: 'Nouveau modèle',
    variables: [],
    clauses_ids: [],
    created_by: 'u1',
  }

  const UPDATED_TEMPLATE_RESULT = {
    id: 'tpl-1',
    nom: 'Bail habitation modifié',
  }

  const CREATED_CLAUSE_RESULT = {
    id: 'cl-new',
    titre: 'Nouvelle clause',
    variables: [],
  }

  const UPDATED_CLAUSE_RESULT = {
    id: 'cl-1',
    titre: 'Clause modifiée',
  }

  const mockFrom = vi.fn()
  const toastSuccess = vi.fn()
  const toastError = vi.fn()
  const debugError = vi.fn()

  const builderState = {
    table: '',
    selected: undefined as string | undefined,
    inserted: undefined as unknown,
    updated: undefined as unknown,
    eqCalls: [] as Array<[string, unknown]>,
    orderCalls: [] as Array<[string, unknown?]>,
    limitCalls: [] as number[],
    response: { data: null as unknown, error: null as { message: string } | null },
  }

  return {
    AUTH_STATE,
    TEMPLATE_ROWS,
    CLAUSE_ROWS,
    CREATED_TEMPLATE_RESULT,
    UPDATED_TEMPLATE_RESULT,
    CREATED_CLAUSE_RESULT,
    UPDATED_CLAUSE_RESULT,
    mockFrom,
    toastSuccess,
    toastError,
    debugError,
    builderState,
  }
})

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}))

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: vi.fn((value?: string) => {
      builderState.selected = value
      return builder
    }),
    eq: vi.fn((column: string, value: unknown) => {
      builderState.eqCalls.push([column, value])
      return builder
    }),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn((column: string, options?: unknown) => {
      builderState.orderCalls.push([column, options])
      return builder
    }),
    limit: vi.fn((value: number) => {
      builderState.limitCalls.push(value)
      return builder
    }),
    insert: vi.fn((value: unknown) => {
      builderState.inserted = value
      return builder
    }),
    update: vi.fn((value: unknown) => {
      builderState.updated = value
      return builder
    }),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => builderState.response),
    maybeSingle: vi.fn(async () => builderState.response),
    then: (
      onFulfilled: (value: typeof builderState.response) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(builderState.response).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(builderState.response).catch(onRejected),
  }

  mockFrom.mockImplementation((table: string) => {
    builderState.table = table
    return builder
  })

  return {
    supabase: {
      from: mockFrom,
    },
  }
})

import {
  useContratTemplates,
  useContratClauses,
  useCreateTemplate,
  useUpdateTemplate,
  useCreateClause,
  useUpdateClause,
  useDeleteClause,
} from './useContratTemplates'

function createWrapper(client?: QueryClient) {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function resetBuilderState() {
  builderState.table = ''
  builderState.selected = undefined
  builderState.inserted = undefined
  builderState.updated = undefined
  builderState.eqCalls = []
  builderState.orderCalls = []
  builderState.limitCalls = []
  builderState.response = { data: null, error: null }
  mockFrom.mockClear()
  toastSuccess.mockClear()
  toastError.mockClear()
  debugError.mockClear()
}

describe('useContratTemplates', () => {
  beforeEach(() => {
    resetBuilderState()
  })

  it('charge les templates actifs et normalise variables et clauses_ids', async () => {
    builderState.response = { data: TEMPLATE_ROWS, error: null }

    const { result } = renderHook(() => useContratTemplates(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('contrat_templates')
    expect(builderState.selected).toContain('contenu_html')
    expect(builderState.eqCalls).toContainEqual(['est_actif', true])
    expect(builderState.orderCalls).toContainEqual(['nom', undefined])
    expect(builderState.limitCalls).toContain(100)

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0]).toMatchObject({
      id: 'tpl-1',
      nom: 'Bail habitation',
      variables: [],
      clauses_ids: [],
    })
    expect(result.current.data?.[1]).toMatchObject({
      id: 'tpl-2',
      nom: 'Vente',
      variables: ['nom_client'],
      clauses_ids: ['cl-1'],
    })
  })

  it('passe en erreur quand la requête templates échoue', async () => {
    builderState.response = { data: null, error: { message: 'x' } }

    const { result } = renderHook(() => useContratTemplates(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('x')
    expect(mockFrom).toHaveBeenCalledWith('contrat_templates')
  })
})

describe('useContratClauses', () => {
  beforeEach(() => {
    resetBuilderState()
  })

  it('charge les clauses actives et normalise variables', async () => {
    builderState.response = { data: CLAUSE_ROWS, error: null }

    const { result } = renderHook(() => useContratClauses(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('contrat_clauses')
    expect(builderState.eqCalls).toContainEqual(['est_actif', true])
    expect(builderState.orderCalls).toContainEqual(['ordre', undefined])
    expect(builderState.limitCalls).toContain(200)

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0]).toMatchObject({
      id: 'cl-1',
      titre: 'Clause résolutoire',
      variables: [],
      est_obligatoire: true,
    })
    expect(result.current.data?.[1]).toMatchObject({
      id: 'cl-2',
      titre: 'Clause assurance',
      variables: ['montant'],
      usage_count: 5,
    })
  })

  it('passe en erreur quand la requête clauses échoue', async () => {
    builderState.response = { data: null, error: { message: 'x' } }

    const { result } = renderHook(() => useContratClauses(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('x')
    expect(mockFrom).toHaveBeenCalledWith('contrat_clauses')
  })
})

describe('mutations templates', () => {
  beforeEach(() => {
    resetBuilderState()
  })

  it('crée un template avec created_by, variables et clauses_ids par défaut', async () => {
    builderState.response = { data: CREATED_TEMPLATE_RESULT, error: null }
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateTemplate(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync({
        nom: 'Nouveau modèle',
        type: 'bail',
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('contrat_templates')
    expect(builderState.inserted).toEqual({
      nom: 'Nouveau modèle',
      type: 'bail',
      created_by: 'u1',
      variables: [],
      clauses_ids: [],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contrat-templates'] })
    expect(toastSuccess).toHaveBeenCalledWith('Modèle créé avec succès')
  })

  it('gère une erreur de création de template', async () => {
    builderState.response = { data: null, error: { message: 'x' } }

    const { result } = renderHook(() => useCreateTemplate(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          nom: 'Nouveau modèle',
        })
      ).rejects.toMatchObject({ message: 'x' })
    })

    expect(debugError).toHaveBeenCalledWith('Erreur création template:', { message: 'x' })
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la création du modèle')
  })

  it('met à jour un template avec les données métier attendues', async () => {
    builderState.response = { data: UPDATED_TEMPLATE_RESULT, error: null }
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateTemplate(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'tpl-1',
        nom: 'Bail habitation modifié',
        description: 'Desc',
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('contrat_templates')
    expect(builderState.updated).toEqual({
      nom: 'Bail habitation modifié',
      description: 'Desc',
    })
    expect(builderState.eqCalls).toContainEqual(['id', 'tpl-1'])
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contrat-templates'] })
    expect(toastSuccess).toHaveBeenCalledWith('Modèle mis à jour')
  })

  it('gère une erreur de mise à jour de template', async () => {
    builderState.response = { data: null, error: { message: 'x' } }

    const { result } = renderHook(() => useUpdateTemplate(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'tpl-1',
          nom: 'Échec',
        })
      ).rejects.toMatchObject({ message: 'x' })
    })

    expect(debugError).toHaveBeenCalledWith('Erreur mise à jour template:', { message: 'x' })
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la mise à jour')
  })
})

describe('mutations clauses', () => {
  beforeEach(() => {
    resetBuilderState()
  })

  it('crée une clause avec variables par défaut', async () => {
    builderState.response = { data: CREATED_CLAUSE_RESULT, error: null }
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateClause(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync({
        titre: 'Nouvelle clause',
        categorie: 'juridique',
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('contrat_clauses')
    expect(builderState.inserted).toEqual({
      titre: 'Nouvelle clause',
      categorie: 'juridique',
      variables: [],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contrat-clauses'] })
    expect(toastSuccess).toHaveBeenCalledWith('Clause créée avec succès')
  })

  it('gère une erreur de création de clause', async () => {
    builderState.response = { data: null, error: { message: 'x' } }

    const { result } = renderHook(() => useCreateClause(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          titre: 'Nouvelle clause',
        })
      ).rejects.toMatchObject({ message: 'x' })
    })

    expect(debugError).toHaveBeenCalledWith('Erreur création clause:', { message: 'x' })
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la création de la clause')
  })

  it('met à jour une clause', async () => {
    builderState.response = { data: UPDATED_CLAUSE_RESULT, error: null }
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateClause(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'cl-1',
        titre: 'Clause modifiée',
        ordre: 3,
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('contrat_clauses')
    expect(builderState.updated).toEqual({
      titre: 'Clause modifiée',
      ordre: 3,
    })
    expect(builderState.eqCalls).toContainEqual(['id', 'cl-1'])
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contrat-clauses'] })
    expect(toastSuccess).toHaveBeenCalledWith('Clause mise à jour')
  })

  it('gère une erreur de mise à jour de clause', async () => {
    builderState.response = { data: null, error: { message: 'x' } }

    const { result } = renderHook(() => useUpdateClause(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'cl-1',
          titre: 'Échec',
        })
      ).rejects.toMatchObject({ message: 'x' })
    })

    expect(debugError).toHaveBeenCalledWith('Erreur mise à jour clause:', { message: 'x' })
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la mise à jour')
  })

  it('supprime logiquement une clause en mettant est_actif à false', async () => {
    builderState.response = { data: null, error: null }
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteClause(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync('cl-2')
    })

    expect(mockFrom).toHaveBeenCalledWith('contrat_clauses')
    expect(builderState.updated).toEqual({ est_actif: false })
    expect(builderState.eqCalls).toContainEqual(['id', 'cl-2'])
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contrat-clauses'] })
    expect(toastSuccess).toHaveBeenCalledWith('Clause supprimée')
  })

  it('gère une erreur de suppression de clause', async () => {
    builderState.response = { data: null, error: { message: 'x' } }

    const { result } = renderHook(() => useDeleteClause(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await expect(result.current.mutateAsync('cl-2')).rejects.toMatchObject({ message: 'x' })
    })

    expect(debugError).toHaveBeenCalledWith('Erreur suppression clause:', { message: 'x' })
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la suppression')
  })
})
