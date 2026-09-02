/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'


import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useAISuggestions } from './useAISuggestions'

const {
  SUGGESTIONS,
  CRM_ONLY,
  OP_ONLY,
  QUERY_SUCCESS_RESULT,
  QUERY_ERROR_RESULT,
  APPLY_SUCCESS_RESULT,
  APPLY_ERROR_RESULT,
  REJECT_SINGLE_SUCCESS_RESULT,
  REJECT_IN_SUCCESS_RESULT,
  mockFrom,
  mockInvoke,
  mockSanitizeSupabaseError,
  toastSuccess,
  toastError,
} = vi.hoisted(() => {
  const SUGGESTIONS_DATA = [
    {
      id: 's1',
      email_thread_id: 'th1',
      etablissement_id: 'eta1',
      partenaire_id: 'p1',
      action_type: 'create_task',
      action_data: { title: 'Relancer dossier inscription urgent', priority: 'high' },
      confidence_score: 0.95,
      status: 'pending' as const,
      reason: 'Action utile',
      created_at: '2024-01-03T10:00:00.000Z',
      etablissement: { nom: 'Etab Alpha', ville: 'Paris' },
      email_thread: { subject: 'Inscription', last_message_date: '2024-01-03T09:00:00.000Z' },
    },
    {
      id: 's2',
      email_thread_id: 'th2',
      etablissement_id: 'eta1',
      partenaire_id: 'p1',
      action_type: 'create_task',
      action_data: { title: 'Urgent relancer dossier inscription', priority: 'medium' },
      confidence_score: 0.9,
      status: 'pending' as const,
      reason: 'Très similaire',
      created_at: '2024-01-02T10:00:00.000Z',
      etablissement: { nom: 'Etab Alpha', ville: 'Paris' },
      email_thread: { subject: 'Re: Inscription', last_message_date: '2024-01-02T09:00:00.000Z' },
    },
    {
      id: 's3',
      email_thread_id: 'th3',
      etablissement_id: 'eta2',
      partenaire_id: 'p2',
      action_type: 'send_email_response',
      action_data: {
        title: 'Répondre au prospect',
        to: 'demo@test.co',
        subject: 'Suite à votre message',
        body: 'Bonjour',
      },
      confidence_score: 0.88,
      status: 'pending' as const,
      reason: 'CRM',
      created_at: '2024-01-01T10:00:00.000Z',
      etablissement: { nom: 'Etab Beta', ville: 'Lyon' },
      email_thread: { subject: 'Prospection', last_message_date: '2024-01-01T09:00:00.000Z' },
    },
  ]

  return {
    SUGGESTIONS: SUGGESTIONS_DATA,
    CRM_ONLY: SUGGESTIONS_DATA.filter((s) => s.action_type === 'send_email_response'),
    OP_ONLY: SUGGESTIONS_DATA.filter((s) => s.action_type === 'create_task'),
    QUERY_SUCCESS_RESULT: { data: SUGGESTIONS_DATA, error: null },
    QUERY_ERROR_RESULT: { data: null, error: { message: 'query failed' } },
    APPLY_SUCCESS_RESULT: { data: { ok: true }, error: null },
    APPLY_ERROR_RESULT: { data: null, error: { message: 'apply failed' } },
    REJECT_SINGLE_SUCCESS_RESULT: { data: { id: 's1' }, error: null },
    REJECT_IN_SUCCESS_RESULT: { data: [{ id: 's2' }], error: null },
    mockFrom: vi.fn(),
    mockInvoke: vi.fn(),
    mockSanitizeSupabaseError: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  }
})

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}))

function createBuilder(config?: {
  awaitResult?: { data: unknown; error: { message: string } | null }
  singleResult?: { data: unknown; error: { message: string } | null }
}) {
  const awaitResult = config?.awaitResult ?? QUERY_SUCCESS_RESULT
  const singleResult = config?.singleResult ?? REJECT_SINGLE_SUCCESS_RESULT

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
    single: vi.fn(() => Promise.resolve(singleResult)),
    maybeSingle: vi.fn(() => Promise.resolve(singleResult)),
    then: (
      onFulfilled?: (value: typeof awaitResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(awaitResult).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(awaitResult).catch(onRejected),
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

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  }
}

describe('useAISuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSanitizeSupabaseError.mockImplementation(
      (error: { message?: string }) => error.message ?? 'sanitized'
    )
    mockInvoke.mockResolvedValue(APPLY_SUCCESS_RESULT)
  })

  it('charge les suggestions, applique le filtre operational et groupe les similaires', async () => {
    const builder = createBuilder({ awaitResult: QUERY_SUCCESS_RESULT })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useAISuggestions('eta1', 'operational'), {
      wrapper,
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFrom).toHaveBeenCalledWith('ai_suggested_actions')
    expect(builder.select).toHaveBeenCalledWith(
      expect.stringContaining('etablissement:etablissements!etablissement_id')
    )
    expect(builder.eq).toHaveBeenCalledWith('status', 'pending')
    expect(builder.eq).toHaveBeenCalledWith('etablissement_id', 'eta1')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })

    expect(result.current.suggestions).toEqual(OP_ONLY)
    expect(result.current.suggestionGroups).toHaveLength(1)
    expect(result.current.suggestionGroups[0].primary.id).toBe('s1')
    expect(result.current.suggestionGroups[0].similar.map((s) => s.id)).toEqual(['s2'])
  })

  it('filtre les suggestions CRM correctement', async () => {
    const builder = createBuilder({ awaitResult: QUERY_SUCCESS_RESULT })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useAISuggestions(undefined, 'crm'), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.suggestions).toEqual(CRM_ONLY)
    expect(result.current.suggestionGroups).toHaveLength(1)
    expect(result.current.suggestionGroups[0].primary.id).toBe('s3')
    expect(result.current.suggestionGroups[0].similar).toEqual([])
  })

  it('passe en erreur quand le chargement supabase échoue', async () => {
    const builder = createBuilder({ awaitResult: QUERY_ERROR_RESULT })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useAISuggestions(), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.suggestions).toEqual([])
    expect(result.current.suggestionGroups).toEqual([])
  })

  it('approuve une suggestion et appelle la fonction edge avec le bon payload', async () => {
    const builder = createBuilder({ awaitResult: QUERY_SUCCESS_RESULT })
    mockFrom.mockReturnValue(builder)
    mockInvoke.mockResolvedValue(APPLY_SUCCESS_RESULT)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useAISuggestions(), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.approveSuggestionAsync('s1')
    })

    expect(mockInvoke).toHaveBeenCalledWith('apply-ai-suggestion', {
      body: { suggestion_id: 's1' },
    })
    expect(toastSuccess).toHaveBeenCalledWith('Suggestion appliquée avec succès')
  })

  it('rejette une suggestion avec la mise à jour Supabase attendue', async () => {
    const queryBuilder = createBuilder({ awaitResult: QUERY_SUCCESS_RESULT })
    const rejectBuilder = createBuilder({ singleResult: REJECT_SINGLE_SUCCESS_RESULT })

    mockFrom.mockReturnValueOnce(queryBuilder).mockReturnValueOnce(rejectBuilder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useAISuggestions(), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.rejectSuggestionAsync('s1')
    })

    expect(mockFrom).toHaveBeenNthCalledWith(2, 'ai_suggested_actions')
    expect(rejectBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'rejected',
        reviewed_at: expect.any(String),
      })
    )
    expect(rejectBuilder.eq).toHaveBeenCalledWith('id', 's1')
    expect(rejectBuilder.eq).toHaveBeenCalledWith('status', 'pending')
    expect(rejectBuilder.select).toHaveBeenCalledWith('id')
    expect(toastSuccess).toHaveBeenCalledWith('Suggestion rejetée')
  })

  it('gère une erreur de mutation approve avec message sanitizé', async () => {
    const builder = createBuilder({ awaitResult: QUERY_SUCCESS_RESULT })
    mockFrom.mockReturnValue(builder)
    mockInvoke.mockResolvedValue(APPLY_ERROR_RESULT)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useAISuggestions(), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await expect(result.current.approveSuggestionAsync('s1')).rejects.toEqual(
        APPLY_ERROR_RESULT.error
      )
    })

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(APPLY_ERROR_RESULT.error)
    expect(toastError).toHaveBeenCalledWith('apply failed')
  })

  it('approuve la suggestion principale et rejette les similaires', async () => {
    const queryBuilder = createBuilder({ awaitResult: QUERY_SUCCESS_RESULT })
    const rejectSimilarBuilder = createBuilder({ awaitResult: REJECT_IN_SUCCESS_RESULT })

    mockFrom.mockReturnValueOnce(queryBuilder).mockReturnValueOnce(rejectSimilarBuilder)
    mockInvoke.mockResolvedValue(APPLY_SUCCESS_RESULT)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useAISuggestions(), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.approveSuggestionAndRejectSimilar({ primaryId: 's1', similarIds: ['s2'] })
    })

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('apply-ai-suggestion', {
        body: { suggestion_id: 's1' },
      })
    })

    expect(mockFrom).toHaveBeenNthCalledWith(2, 'ai_suggested_actions')
    expect(rejectSimilarBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'rejected',
        reviewed_at: expect.any(String),
      })
    )
    expect(rejectSimilarBuilder.in).toHaveBeenCalledWith('id', ['s2'])
    expect(toastSuccess).toHaveBeenCalledWith('Suggestion appliquée et similaires ignorées')
  })
})
