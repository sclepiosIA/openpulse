/* @vitest-environment jsdom */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  useContractSections,
  buildSectionTree,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useReorderSections,
  useSectionVersions,
  useRestoreVersion,
  useCreateSectionFromClause,
} from './useContractSections'

type ResponseShape = {
  data: unknown
  error: { message: string } | null
}

type BuilderConfig = {
  response?: ResponseShape
  singleResponse?: ResponseShape
  maybeSingleResponse?: ResponseShape
}

const {
  CONTRACT_ID,
  SECTION_ID,
  CLAUSE_ID,
  SECTIONS_ROWS,
  VERSION_ROWS,
  CREATED_SECTION,
  UPDATED_SECTION_DB,
  CLAUSE_CREATED_SECTION,
  AUTH_STATE,
  mockFrom,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
} = vi.hoisted(() => ({
  CONTRACT_ID: 'ctr-1',
  SECTION_ID: 'sec-1',
  CLAUSE_ID: 'cl-1',
  SECTIONS_ROWS: [
    {
      id: 'sec-root',
      contrat_id: 'ctr-1',
      parent_id: null,
      titre: 'Préambule',
      contenu_html: '<p>Intro</p>',
      ordre: 2,
      type: 'section' as const,
      clause_source_id: null,
      variables_values: {},
      metadata: { level: 1 },
      is_locked: false,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'sec-child',
      contrat_id: 'ctr-1',
      parent_id: 'sec-root',
      titre: 'Article 1',
      contenu_html: '<p>Texte</p>',
      ordre: 1,
      type: 'article' as const,
      clause_source_id: null,
      variables_values: { amount: '100' },
      metadata: {},
      is_locked: false,
      created_at: '2024-01-03',
      updated_at: '2024-01-04',
    },
    {
      id: 'sec-other',
      contrat_id: 'ctr-1',
      parent_id: null,
      titre: 'Annexe',
      contenu_html: null,
      ordre: 1,
      type: 'annexe' as const,
      clause_source_id: null,
      variables_values: {},
      metadata: {},
      is_locked: true,
      created_at: '2024-01-05',
      updated_at: '2024-01-06',
    },
  ],
  VERSION_ROWS: [
    {
      id: 'ver-2',
      section_id: 'sec-1',
      contenu_html: '<p>v2</p>',
      titre: 'Titre v2',
      note: null,
      version_number: 2,
      created_by: 'u1',
      created_at: '2024-02-02',
    },
    {
      id: 'ver-1',
      section_id: 'sec-1',
      contenu_html: '<p>v1</p>',
      titre: null,
      note: 'initiale',
      version_number: 1,
      created_by: 'u1',
      created_at: '2024-02-01',
    },
  ],
  CREATED_SECTION: {
    id: 'sec-new',
    contrat_id: 'ctr-1',
    parent_id: null,
    titre: 'Nouvelle section',
    contenu_html: '',
    ordre: 0,
    type: 'section' as const,
    clause_source_id: null,
    variables_values: {},
    metadata: {},
    is_locked: false,
    created_at: '2024-03-01',
    updated_at: '2024-03-01',
  },
  UPDATED_SECTION_DB: {
    id: 'sec-1',
    parent_id: 'sec-root',
    titre: 'Titre modifié',
    contenu_html: '<p>maj</p>',
    ordre: 3,
    type: 'clause' as const,
    is_locked: true,
    variables_values: { foo: 'bar' },
    updated_at: '2024-03-05',
  },
  CLAUSE_CREATED_SECTION: {
    id: 'sec-clause',
    contrat_id: 'ctr-1',
    parent_id: null,
    titre: 'Clause livrable',
    contenu_html: '<p>Contenu clause</p>',
    ordre: 7,
    type: 'clause' as const,
    clause_source_id: 'cl-1',
    variables_values: {},
    metadata: {},
    is_locked: false,
    created_at: '2024-04-01',
    updated_at: '2024-04-01',
  },
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockDebugError: vi.fn(),
}))

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

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

function createBuilder(config?: BuilderConfig) {
  const state = {
    response: config?.response ?? { data: null, error: null },
    singleResponse: config?.singleResponse ?? config?.response ?? { data: null, error: null },
    maybeSingleResponse: config?.maybeSingleResponse ??
      config?.response ?? { data: null, error: null },
  }

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
    single: vi.fn(async () => state.singleResponse),
    maybeSingle: vi.fn(async () => state.maybeSingleResponse),
    then: (
      onFulfilled?: ((value: ResponseShape) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null
    ) => Promise.resolve(state.response).then(onFulfilled ?? undefined, onRejected ?? undefined),
    catch: (onRejected?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve(state.response).catch(onRejected ?? undefined),
  }

  return builder
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper(client?: QueryClient) {
  const queryClient = client ?? createTestQueryClient()

  return function Wrapper(props: { children?: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('buildSectionTree', () => {
  it('construit une hiérarchie triée par ordre avec les enfants imbriqués', () => {
    const tree = buildSectionTree(SECTIONS_ROWS)

    expect(tree).toHaveLength(2)
    expect(tree[0].id).toBe('sec-other')
    expect(tree[1].id).toBe('sec-root')
    expect(tree[1].children).toHaveLength(1)
    expect(tree[1].children?.[0].id).toBe('sec-child')
    expect(tree[1].children?.[0].titre).toBe('Article 1')
    expect(tree[1].children?.[0].variables_values).toEqual({ amount: '100' })
  })
})

describe('useContractSections', () => {
  it("charge les sections d'un contrat puis renvoie les valeurs métier attendues", async () => {
    const builder = createBuilder({
      response: { data: SECTIONS_ROWS, error: null },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useContractSections(CONTRACT_ID), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('contrat_sections')
    expect(builder.select).toHaveBeenCalledWith(
      'id, contrat_id, parent_id, titre, contenu_html, ordre, type, clause_source_id, variables_values, metadata, is_locked, created_at, updated_at'
    )
    expect(builder.eq).toHaveBeenCalledWith('contrat_id', CONTRACT_ID)
    expect(builder.order).toHaveBeenCalledWith('ordre', { ascending: true })
    expect(builder.limit).toHaveBeenCalledWith(500)

    expect(result.current.data).toHaveLength(3)
    expect(result.current.data?.[0].titre).toBe('Préambule')
    expect(result.current.data?.[1].type).toBe('article')
    expect(result.current.data?.[2].is_locked).toBe(true)
  })

  it('passe en erreur si la requête supabase renvoie une erreur', async () => {
    const builder = createBuilder({
      response: { data: null, error: { message: 'x' } },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useContractSections(CONTRACT_ID), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('x')
  })
})

describe('useCreateSection', () => {
  it('crée une section avec les valeurs par défaut et invalide le cache du contrat', async () => {
    const builder = createBuilder({
      singleResponse: { data: CREATED_SECTION, error: null },
    })
    mockFrom.mockReturnValue(builder)

    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useCreateSection(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync({ contrat_id: CONTRACT_ID })
    })

    expect(mockFrom).toHaveBeenCalledWith('contrat_sections')
    expect(builder.insert).toHaveBeenCalledWith({
      contrat_id: CONTRACT_ID,
      parent_id: null,
      titre: 'Nouvelle section',
      contenu_html: '',
      ordre: 0,
      type: 'section',
      clause_source_id: null,
      variables_values: {},
      metadata: {},
      is_locked: false,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['contract-sections', CONTRACT_ID],
    })
  })

  it('passe en erreur et notifie via toast si la création échoue', async () => {
    const builder = createBuilder({
      singleResponse: { data: null, error: { message: 'x' } },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCreateSection(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await expect(result.current.mutateAsync({ contrat_id: CONTRACT_ID })).rejects.toEqual({
        message: 'x',
      })
    })

    expect(mockDebugError).toHaveBeenCalledWith('Erreur création section:', { message: 'x' })
    expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la création de la section')
  })
})

describe('useUpdateSection', () => {
  it('met à jour uniquement les champs fournis puis invalide la clé du contrat', async () => {
    const builder = createBuilder({
      singleResponse: { data: UPDATED_SECTION_DB, error: null },
    })
    mockFrom.mockReturnValue(builder)

    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateSection(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync({
        id: SECTION_ID,
        contrat_id: CONTRACT_ID,
        titre: 'Titre modifié',
        contenu_html: '<p>maj</p>',
        ordre: 3,
        parent_id: 'sec-root',
        type: 'clause',
        is_locked: true,
        variables_values: { foo: 'bar' },
      })
    })

    expect(builder.update).toHaveBeenCalledWith({
      titre: 'Titre modifié',
      contenu_html: '<p>maj</p>',
      ordre: 3,
      parent_id: 'sec-root',
      type: 'clause',
      is_locked: true,
      variables_values: { foo: 'bar' },
    })
    expect(builder.eq).toHaveBeenCalledWith('id', SECTION_ID)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['contract-sections', CONTRACT_ID],
    })
  })

  it('passe en erreur et affiche un toast si la mise à jour échoue', async () => {
    const builder = createBuilder({
      singleResponse: { data: null, error: { message: 'x' } },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useUpdateSection(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: SECTION_ID, contrat_id: CONTRACT_ID, titre: 'Ko' })
      ).rejects.toEqual({ message: 'x' })
    })

    expect(mockDebugError).toHaveBeenCalledWith('Erreur mise à jour section:', { message: 'x' })
    expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la mise à jour')
  })
})

describe('useDeleteSection', () => {
  it('supprime une section puis notifie le succès', async () => {
    const builder = createBuilder({
      response: { data: null, error: null },
    })
    mockFrom.mockReturnValue(builder)

    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteSection(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync({ id: SECTION_ID, contrat_id: CONTRACT_ID })
    })

    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', SECTION_ID)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['contract-sections', CONTRACT_ID],
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Section supprimée')
  })

  it('passe en erreur si la suppression échoue', async () => {
    const builder = createBuilder({
      response: { data: null, error: { message: 'x' } },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useDeleteSection(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: SECTION_ID, contrat_id: CONTRACT_ID })
      ).rejects.toEqual({ message: 'x' })
    })

    expect(mockDebugError).toHaveBeenCalledWith('Erreur suppression section:', { message: 'x' })
    expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la suppression')
  })
})

describe('useReorderSections', () => {
  it('met à jour chaque section avec son ordre et son parent', async () => {
    const builderA = createBuilder({
      response: { data: null, error: null },
    })
    const builderB = createBuilder({
      response: { data: null, error: null },
    })

    mockFrom.mockImplementation(() => {
      const next = mockFrom.mock.calls.length === 1 ? builderA : builderB
      return next
    })

    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useReorderSections(), {
      wrapper: createWrapper(client),
    })

    const payload = {
      contrat_id: CONTRACT_ID,
      sections: [
        { id: 'sec-a', ordre: 1, parent_id: null },
        { id: 'sec-b', ordre: 2, parent_id: 'sec-a' },
      ],
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(builderA.update).toHaveBeenCalledWith({ ordre: 1, parent_id: null })
    expect(builderA.eq).toHaveBeenCalledWith('id', 'sec-a')
    expect(builderB.update).toHaveBeenCalledWith({ ordre: 2, parent_id: 'sec-a' })
    expect(builderB.eq).toHaveBeenCalledWith('id', 'sec-b')
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['contract-sections', CONTRACT_ID],
    })
  })

  it('passe en erreur si une mise à jour du lot échoue', async () => {
    const builderA = createBuilder({
      response: { data: null, error: null },
    })
    const builderB = createBuilder({
      response: { data: null, error: { message: 'x' } },
    })

    mockFrom.mockImplementation(() => {
      const next = mockFrom.mock.calls.length === 1 ? builderA : builderB
      return next
    })

    const { result } = renderHook(() => useReorderSections(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          contrat_id: CONTRACT_ID,
          sections: [
            { id: 'sec-a', ordre: 1, parent_id: null },
            { id: 'sec-b', ordre: 2, parent_id: null },
          ],
        })
      ).rejects.toEqual({ message: 'x' })
    })

    expect(mockDebugError).toHaveBeenCalledWith('Erreur réordonnancement:', { message: 'x' })
    expect(mockToastError).toHaveBeenCalledWith('Erreur lors du réordonnancement')
  })
})

describe('useSectionVersions', () => {
  it('charge les versions et convertit titre/note null en undefined', async () => {
    const builder = createBuilder({
      response: { data: VERSION_ROWS, error: null },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSectionVersions(SECTION_ID), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('contrat_section_versions')
    expect(builder.eq).toHaveBeenCalledWith('section_id', SECTION_ID)
    expect(builder.order).toHaveBeenCalledWith('version_number', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(50)
    expect(result.current.data?.[0].version_number).toBe(2)
    expect(result.current.data?.[0].titre).toBe('Titre v2')
    expect(result.current.data?.[0].note).toBeUndefined()
    expect(result.current.data?.[1].titre).toBeUndefined()
    expect(result.current.data?.[1].note).toBe('initiale')
  })

  it('passe en erreur si le chargement des versions échoue', async () => {
    const builder = createBuilder({
      response: { data: null, error: { message: 'x' } },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSectionVersions(SECTION_ID), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('x')
  })
})

describe('useRestoreVersion', () => {
  it("restaure le contenu et le titre d'une version puis invalide les caches utiles", async () => {
    const builder = createBuilder({
      response: { data: null, error: null },
    })
    mockFrom.mockReturnValue(builder)

    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useRestoreVersion(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync({
        sectionId: SECTION_ID,
        version: {
          id: 'ver-2',
          section_id: SECTION_ID,
          contenu_html: '<p>v2</p>',
          titre: 'Titre v2',
          note: null,
          version_number: 2,
          created_by: 'u1',
          created_at: '2024-02-02',
        },
      })
    })

    expect(builder.update).toHaveBeenCalledWith({
      contenu_html: '<p>v2</p>',
      titre: 'Titre v2',
    })
    expect(builder.eq).toHaveBeenCalledWith('id', SECTION_ID)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contract-sections'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['section-versions', SECTION_ID] })
    expect(mockToastSuccess).toHaveBeenCalledWith('Version restaurée')
  })

  it('passe en erreur si la restauration échoue', async () => {
    const builder = createBuilder({
      response: { data: null, error: { message: 'x' } },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useRestoreVersion(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          sectionId: SECTION_ID,
          version: {
            id: 'ver-1',
            section_id: SECTION_ID,
            contenu_html: '<p>ko</p>',
            titre: 'Erreur',
            note: null,
            version_number: 1,
            created_by: 'u1',
            created_at: '2024-02-01',
          },
        })
      ).rejects.toEqual({ message: 'x' })
    })

    expect(mockDebugError).toHaveBeenCalledWith('Erreur restauration:', { message: 'x' })
    expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la restauration')
  })
})

describe('useCreateSectionFromClause', () => {
  it("crée une section de type clause et met à jour le compteur d'usage", async () => {
    const createSectionBuilder = createBuilder({
      singleResponse: { data: CLAUSE_CREATED_SECTION, error: null },
    })
    const usageBuilder = createBuilder({
      response: { data: null, error: null },
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'contrat_sections') return createSectionBuilder
      return usageBuilder
    })

    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useCreateSectionFromClause(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync({
        contrat_id: CONTRACT_ID,
        clauseId: CLAUSE_ID,
        titre: 'Clause livrable',
        contenu: '<p>Contenu clause</p>',
        ordre: 7,
      })
    })

    expect(createSectionBuilder.insert).toHaveBeenCalledWith([
      {
        contrat_id: CONTRACT_ID,
        parent_id: null,
        titre: 'Clause livrable',
        contenu_html: '<p>Contenu clause</p>',
        ordre: 7,
        type: 'clause',
        clause_source_id: CLAUSE_ID,
        variables_values: {},
        metadata: {},
      },
    ])
    expect(usageBuilder.update).toHaveBeenCalledWith({ usage_count: 1 })
    expect(usageBuilder.eq).toHaveBeenCalledWith('id', CLAUSE_ID)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['contract-sections', CONTRACT_ID],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['contrat-clauses'],
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Clause ajoutée au contrat')
  })

  it('passe en erreur si la création depuis une clause échoue', async () => {
    const createSectionBuilder = createBuilder({
      singleResponse: { data: null, error: { message: 'x' } },
    })

    mockFrom.mockReturnValue(createSectionBuilder)

    const { result } = renderHook(() => useCreateSectionFromClause(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          contrat_id: CONTRACT_ID,
          clauseId: CLAUSE_ID,
          titre: 'Clause KO',
          contenu: '<p>ko</p>',
          ordre: 2,
          parent_id: 'sec-root',
        })
      ).rejects.toEqual({ message: 'x' })
    })

    expect(mockDebugError).toHaveBeenCalledWith('Erreur ajout clause:', { message: 'x' })
    expect(mockToastError).toHaveBeenCalledWith("Erreur lors de l'ajout de la clause")
  })
})
