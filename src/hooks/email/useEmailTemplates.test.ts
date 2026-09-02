// @vitest-environment jsdom
import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useEmailTemplates,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
} from './useEmailTemplates'

const {
  EMAIL_TEMPLATES,
  CREATED_TEMPLATE,
  UPDATED_TEMPLATE,
  mockFrom,
  mockToast,
  mockSanitizeSupabaseError,
  builderState,
  builder,
} = vi.hoisted(() => {
  const EMAIL_TEMPLATES = [
    {
      id: 'tpl-1',
      name: 'Bienvenue',
      subject: 'Bienvenue {{first_name}}',
      content: '<p>Bonjour {{first_name}}</p>',
      category: 'onboarding',
      variables: ['first_name'],
      is_active: true,
      created_by: 'user-1',
      created_at: '2024-01-02T10:00:00.000Z',
      updated_at: '2024-01-03T10:00:00.000Z',
    },
    {
      id: 'tpl-2',
      name: 'Relance',
      subject: 'Nous pensons à vous',
      content: '<p>Relance</p>',
      category: 'marketing',
      variables: [],
      is_active: false,
      created_by: 'user-2',
      created_at: '2024-01-01T09:00:00.000Z',
      updated_at: '2024-01-01T09:30:00.000Z',
    },
  ]

  const CREATED_TEMPLATE = {
    id: 'tpl-3',
    name: 'Nouveau modèle',
    subject: 'Sujet nouveau',
    content: '<p>Nouveau</p>',
    category: 'support',
    variables: ['ticket_id'],
    is_active: true,
    created_by: 'user-3',
    created_at: '2024-02-01T08:00:00.000Z',
    updated_at: '2024-02-01T08:00:00.000Z',
  }

  const UPDATED_TEMPLATE = {
    id: 'tpl-1',
    name: 'Bienvenue modifié',
    subject: 'Bienvenue mis à jour',
    content: '<p>Bonjour mis à jour</p>',
    category: 'onboarding',
    variables: ['first_name', 'company'],
    is_active: true,
    created_by: 'user-1',
    created_at: '2024-01-02T10:00:00.000Z',
    updated_at: '2024-02-02T10:00:00.000Z',
  }

  const mockFrom = vi.fn()
  const mockToast = vi.fn()
  const mockSanitizeSupabaseError = vi.fn()

  const builderState = {
    response: { data: EMAIL_TEMPLATES as unknown, error: null as { message: string } | null },
    table: '',
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
    single: vi.fn(async () => builderState.response),
    maybeSingle: vi.fn(async () => builderState.response),
    then: (
      onFulfilled?: (value: typeof builderState.response) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(builderState.response).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(builderState.response).catch(onRejected),
  }

  return {
    EMAIL_TEMPLATES,
    CREATED_TEMPLATE,
    UPDATED_TEMPLATE,
    mockFrom,
    mockToast,
    mockSanitizeSupabaseError,
    builderState,
    builder,
  }
})

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}))

vi.mock('@/integrations/supabase/client', () => {
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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

  const wrapper = ({ children }: React.PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { wrapper, queryClient, invalidateSpy }
}

beforeEach(() => {
  vi.clearAllMocks()
  builderState.response = { data: EMAIL_TEMPLATES, error: null }
  builderState.table = ''
  mockSanitizeSupabaseError.mockReturnValue('Erreur propre')
})

describe('useEmailTemplates', () => {
  it('charge les modèles email et retourne les valeurs métier attendues', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useEmailTemplates(), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('email_templates')
    expect(builder.select).toHaveBeenCalledWith(
      'id, name, subject, content, category, variables, is_active, created_by, created_at, updated_at'
    )
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(500)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].name).toBe('Bienvenue')
    expect(result.current.data?.[0].subject).toBe('Bienvenue {{first_name}}')
    expect(result.current.data?.[0].variables).toEqual(['first_name'])
    expect(result.current.data?.[1].category).toBe('marketing')
    expect(result.current.data?.[1].is_active).toBe(false)
  })

  it('passe en erreur si la requête supabase échoue', async () => {
    const { wrapper } = createWrapper()
    builderState.response = { data: null, error: { message: 'x' } }

    const { result } = renderHook(() => useEmailTemplates(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual({ message: 'x' })
    expect(result.current.data).toBeUndefined()
    expect(mockFrom).toHaveBeenCalledWith('email_templates')
  })
})

describe('useCreateEmailTemplate', () => {
  it('crée un modèle, invalide la query et affiche un toast de succès', async () => {
    const { wrapper, invalidateSpy } = createWrapper()
    builderState.response = { data: CREATED_TEMPLATE, error: null }

    const payload = {
      name: 'Nouveau modèle',
      subject: 'Sujet nouveau',
      content: '<p>Nouveau</p>',
      category: 'support',
      variables: ['ticket_id'],
      is_active: true,
    }

    const { result } = renderHook(() => useCreateEmailTemplate(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(mockFrom).toHaveBeenCalledWith('email_templates')
    expect(builder.insert).toHaveBeenCalledWith([payload])
    expect(builder.select).toHaveBeenCalled()
    expect(builder.single).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['email-templates'] })
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Succès',
      description: "Modèle d'email créé avec succès",
    })
  })

  it('gère une erreur de création avec message sanitizé', async () => {
    const { wrapper, invalidateSpy } = createWrapper()
    builderState.response = { data: null, error: { message: 'x' } }

    const payload = {
      name: 'Nouveau modèle',
      subject: 'Sujet nouveau',
      content: '<p>Nouveau</p>',
      category: 'support',
      variables: ['ticket_id'],
      is_active: true,
    }

    const { result } = renderHook(() => useCreateEmailTemplate(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync(payload)).rejects.toEqual({ message: 'x' })
    })

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'x' })
    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur propre',
      variant: 'destructive',
    })
  })
})

describe('useUpdateEmailTemplate', () => {
  it('met à jour un modèle, invalide la query et affiche un toast de succès', async () => {
    const { wrapper, invalidateSpy } = createWrapper()
    builderState.response = { data: UPDATED_TEMPLATE, error: null }

    const payload = {
      id: 'tpl-1',
      name: 'Bienvenue modifié',
      subject: 'Bienvenue mis à jour',
      content: '<p>Bonjour mis à jour</p>',
      variables: ['first_name', 'company'],
      is_active: true,
    }

    const { result } = renderHook(() => useUpdateEmailTemplate(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(mockFrom).toHaveBeenCalledWith('email_templates')
    expect(builder.update).toHaveBeenCalledWith({
      name: 'Bienvenue modifié',
      subject: 'Bienvenue mis à jour',
      content: '<p>Bonjour mis à jour</p>',
      variables: ['first_name', 'company'],
      is_active: true,
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 'tpl-1')
    expect(builder.select).toHaveBeenCalled()
    expect(builder.single).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['email-templates'] })
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Succès',
      description: "Modèle d'email mis à jour avec succès",
    })
  })

  it('gère une erreur de mise à jour avec message sanitizé', async () => {
    const { wrapper, invalidateSpy } = createWrapper()
    builderState.response = { data: null, error: { message: 'x' } }

    const { result } = renderHook(() => useUpdateEmailTemplate(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'tpl-1', name: 'KO' })).rejects.toEqual({ message: 'x' })
    })

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'x' })
    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur propre',
      variant: 'destructive',
    })
  })
})

describe('useDeleteEmailTemplate', () => {
  it('supprime un modèle, invalide la query et affiche un toast de succès', async () => {
    const { wrapper, invalidateSpy } = createWrapper()
    builderState.response = { data: null, error: null }

    const { result } = renderHook(() => useDeleteEmailTemplate(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('tpl-2')
    })

    expect(mockFrom).toHaveBeenCalledWith('email_templates')
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'tpl-2')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['email-templates'] })
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Succès',
      description: "Modèle d'email supprimé avec succès",
    })
  })

  it('gère une erreur de suppression avec message sanitizé', async () => {
    const { wrapper, invalidateSpy } = createWrapper()
    builderState.response = { data: null, error: { message: 'x' } }

    const { result } = renderHook(() => useDeleteEmailTemplate(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync('tpl-2')).rejects.toEqual({ message: 'x' })
    })

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'x' })
    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur propre',
      variant: 'destructive',
    })
  })
})