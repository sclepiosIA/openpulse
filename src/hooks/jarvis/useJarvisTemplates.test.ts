/* @vitest-environment jsdom */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useJarvisTemplates } from './useJarvisTemplates'

const {
  USER,
  TEMPLATES,
  CREATE_RESULT,
  UPDATE_RESULT,
  DUPLICATE_RESULT,
  toastSpy,
  debugErrorSpy,
  mockFrom,
} = vi.hoisted(() => ({
  USER: { id: 'u1', email: 'u1@test.local' },
  TEMPLATES: [
    {
      id: 'tpl-system-1',
      user_id: null,
      name: 'Résumé client',
      description: 'Template système',
      action_type: 'email',
      template_data: {
        subject: 'Bonjour {{name}}',
        body: 'Votre dossier {{caseId}} est prêt pour {{name}}',
      },
      variables: ['name', 'caseId'],
      usage_count: 7,
      is_system: true,
      created_at: '2024-01-02T10:00:00.000Z',
      updated_at: '2024-01-03T10:00:00.000Z',
    },
    {
      id: 'tpl-user-1',
      user_id: 'u1',
      name: 'Relance',
      description: 'Template perso',
      action_type: 'sms',
      template_data: {
        message: 'Salut {{firstName}}',
      },
      variables: ['firstName'],
      usage_count: 2,
      is_system: false,
      created_at: '2024-02-02T10:00:00.000Z',
      updated_at: '2024-02-03T10:00:00.000Z',
    },
  ],
  CREATE_RESULT: {
    id: 'tpl-created-1',
    user_id: 'u1',
    name: 'Nouveau template',
    description: 'Créé',
    action_type: 'email',
    template_data: {
      subject: 'Salut {{name}}',
      body: 'Dossier {{caseId}}',
    },
    variables: ['name', 'caseId'],
    usage_count: 0,
    is_system: false,
    created_at: '2024-03-01T10:00:00.000Z',
    updated_at: '2024-03-01T10:00:00.000Z',
  },
  UPDATE_RESULT: {
    id: 'tpl-user-1',
    user_id: 'u1',
    name: 'Relance modifiée',
    description: 'MAJ',
    action_type: 'sms',
    template_data: {
      message: 'Bonjour {{firstName}} {{city}}',
    },
    variables: ['firstName', 'city'],
    usage_count: 2,
    is_system: false,
    created_at: '2024-02-02T10:00:00.000Z',
    updated_at: '2024-04-01T10:00:00.000Z',
  },
  DUPLICATE_RESULT: {
    id: 'tpl-dup-1',
    user_id: 'u1',
    name: 'Résumé client (copie)',
    description: 'Template système',
    action_type: 'email',
    template_data: {
      subject: 'Bonjour {{name}}',
      body: 'Votre dossier {{caseId}} est prêt pour {{name}}',
    },
    variables: ['name', 'caseId'],
    usage_count: 0,
    is_system: false,
    created_at: '2024-05-01T10:00:00.000Z',
    updated_at: '2024-05-01T10:00:00.000Z',
  },
  toastSpy: vi.fn(),
  debugErrorSpy: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({
    user: USER,
    session: { user: USER },
    isLoading: false,
  }),
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorSpy,
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

type ResponseShape<T> = {
  data: T
  error: { message: string } | null
}

function createBuilder(config?: {
  response?: ResponseShape<unknown>
  singleResponse?: ResponseShape<unknown>
  maybeSingleResponse?: ResponseShape<unknown>
}) {
  const state = {
    response: config?.response ?? { data: null, error: null },
    singleResponse: config?.singleResponse ?? config?.response ?? { data: null, error: null },
    maybeSingleResponse:
      config?.maybeSingleResponse ?? config?.response ?? { data: null, error: null },
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
    single: vi.fn(() => Promise.resolve(state.singleResponse)),
    maybeSingle: vi.fn(() => Promise.resolve(state.maybeSingleResponse)),
    then: (
      onFulfilled?: (value: ResponseShape<unknown>) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(state.response).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(state.response).catch(onRejected),
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

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

describe('useJarvisTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('charge les templates puis expose les données métier attendues', async () => {
    const builder = createBuilder({
      response: { data: TEMPLATES, error: null },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useJarvisTemplates(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.templates).toEqual([])

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFrom).toHaveBeenCalledWith('jarvis_action_templates')
    expect(builder.select).toHaveBeenCalledWith(
      'id, name, description, action_type, template_data, variables, is_system, usage_count, user_id, created_at, updated_at'
    )
    expect(builder.order).toHaveBeenNthCalledWith(1, 'is_system', { ascending: false })
    expect(builder.order).toHaveBeenNthCalledWith(2, 'usage_count', { ascending: false })
    expect(builder.order).toHaveBeenNthCalledWith(3, 'created_at', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(200)
    expect(result.current.error).toBeNull()
    expect(result.current.templates).toHaveLength(2)
    expect(result.current.templates[0].id).toBe('tpl-system-1')
    expect(result.current.templates[0].is_system).toBe(true)
    expect(result.current.templates[0].variables).toEqual(['name', 'caseId'])
    expect(result.current.templates[1].name).toBe('Relance')
    expect(result.current.templates[1].template_data).toEqual({ message: 'Salut {{firstName}}' })
  })

  it('passe en erreur si la requête de chargement échoue', async () => {
    const queryError = { message: 'fetch failed' }
    const builder = createBuilder({
      response: { data: null, error: queryError },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useJarvisTemplates(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeTruthy()
    })

    expect(result.current.templates).toEqual([])
    expect(debugErrorSpy).toHaveBeenCalledWith('Error fetching Jarvis templates:', queryError)
  })

  it('crée un template, extrait les variables et déclenche le toast de succès', async () => {
    const queryBuilder = createBuilder({
      response: { data: TEMPLATES, error: null },
    })
    const insertBuilder = createBuilder({
      singleResponse: { data: CREATE_RESULT, error: null },
    })

    mockFrom.mockReturnValueOnce(queryBuilder).mockReturnValueOnce(insertBuilder)

    const { result } = renderHook(() => useJarvisTemplates(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.createTemplate({
        name: 'Nouveau template',
        description: 'Créé',
        action_type: 'email',
        template_data: {
          subject: 'Salut {{name}}',
          body: 'Dossier {{caseId}} puis {{name}}',
        },
      })
    })

    expect(mockFrom).toHaveBeenNthCalledWith(2, 'jarvis_action_templates')
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      name: 'Nouveau template',
      description: 'Créé',
      action_type: 'email',
      template_data: {
        subject: 'Salut {{name}}',
        body: 'Dossier {{caseId}} puis {{name}}',
      },
      variables: ['name', 'caseId'],
      is_system: false,
    })
    expect(insertBuilder.select).toHaveBeenCalled()
    expect(insertBuilder.single).toHaveBeenCalled()
    expect(toastSpy).toHaveBeenCalledWith({
      title: '✅ Template créé',
      description: 'Votre nouveau template est prêt à être utilisé',
    })
  })

  it('met à jour un template avec variables recalculées', async () => {
    const queryBuilder = createBuilder({
      response: { data: TEMPLATES, error: null },
    })
    const updateBuilder = createBuilder({
      singleResponse: { data: UPDATE_RESULT, error: null },
    })

    mockFrom.mockReturnValueOnce(queryBuilder).mockReturnValueOnce(updateBuilder)

    const { result } = renderHook(() => useJarvisTemplates(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.updateTemplate({
        id: 'tpl-user-1',
        name: 'Relance modifiée',
        description: 'MAJ',
        template_data: {
          message: 'Bonjour {{firstName}} {{city}} {{firstName}}',
        },
      })
    })

    expect(updateBuilder.update).toHaveBeenCalledWith({
      name: 'Relance modifiée',
      description: 'MAJ',
      template_data: {
        message: 'Bonjour {{firstName}} {{city}} {{firstName}}',
      },
      variables: ['firstName', 'city'],
    })
    expect(updateBuilder.eq).toHaveBeenNthCalledWith(1, 'id', 'tpl-user-1')
    expect(updateBuilder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'u1')
    expect(toastSpy).toHaveBeenCalledWith({
      title: '✅ Template mis à jour',
    })
  })

  it('supprime un template avec filtrage sur user_id', async () => {
    const queryBuilder = createBuilder({
      response: { data: TEMPLATES, error: null },
    })
    const deleteBuilder = createBuilder({
      response: { data: null, error: null },
    })

    mockFrom.mockReturnValueOnce(queryBuilder).mockReturnValueOnce(deleteBuilder)

    const { result } = renderHook(() => useJarvisTemplates(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.deleteTemplate('tpl-user-1')
    })

    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenNthCalledWith(1, 'id', 'tpl-user-1')
    expect(deleteBuilder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'u1')
    expect(toastSpy).toHaveBeenCalledWith({
      title: '🗑️ Template supprimé',
    })
  })

  it('incrémente le compteur d’utilisation d’un template existant', async () => {
    const queryBuilder = createBuilder({
      response: { data: TEMPLATES, error: null },
    })
    const updateBuilder = createBuilder({
      response: { data: null, error: null },
    })

    mockFrom.mockReturnValueOnce(queryBuilder).mockReturnValueOnce(updateBuilder)

    const { result } = renderHook(() => useJarvisTemplates(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.useTemplate('tpl-user-1')
    })

    expect(updateBuilder.update).toHaveBeenCalledWith({ usage_count: 3 })
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'tpl-user-1')
    expect(toastSpy).toHaveBeenCalledWith({
      title: '📋 Template copié',
      description: '"Relance" est prêt à être utilisé',
    })
  })

  it('duplique un template système vers les templates utilisateur', async () => {
    const queryBuilder = createBuilder({
      response: { data: TEMPLATES, error: null },
    })
    const insertBuilder = createBuilder({
      singleResponse: { data: DUPLICATE_RESULT, error: null },
    })

    mockFrom.mockReturnValueOnce(queryBuilder).mockReturnValueOnce(insertBuilder)

    const { result } = renderHook(() => useJarvisTemplates(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.duplicateTemplate('tpl-system-1')
    })

    expect(insertBuilder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      name: 'Résumé client (copie)',
      description: 'Template système',
      action_type: 'email',
      template_data: {
        subject: 'Bonjour {{name}}',
        body: 'Votre dossier {{caseId}} est prêt pour {{name}}',
      },
      variables: ['name', 'caseId'],
      is_system: false,
    })
    expect(insertBuilder.select).toHaveBeenCalled()
    expect(insertBuilder.single).toHaveBeenCalled()
    expect(toastSpy).toHaveBeenCalledWith({
      title: '📋 Template dupliqué',
      description: 'Vous pouvez maintenant le personnaliser',
    })
  })

  it('remonte une erreur de mutation create et affiche le toast destructif', async () => {
    const queryBuilder = createBuilder({
      response: { data: TEMPLATES, error: null },
    })
    const createError = { message: 'insert failed' }
    const insertBuilder = createBuilder({
      singleResponse: { data: null, error: createError },
    })

    mockFrom.mockReturnValueOnce(queryBuilder).mockReturnValueOnce(insertBuilder)

    const { result } = renderHook(() => useJarvisTemplates(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await expect(
      result.current.createTemplate({
        name: 'Ko',
        action_type: 'email',
        template_data: { subject: '{{name}}' },
      })
    ).rejects.toEqual(createError)

    expect(debugErrorSpy).toHaveBeenCalledWith('Error creating template:', createError)
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de créer le template',
      variant: 'destructive',
    })
  })
})