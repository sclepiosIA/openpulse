/* @vitest-environment jsdom */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  useArchiveFeedback,
  useBulkArchiveFeedbacks,
  useDeleteFeedback,
  useFeedbackList,
  useFeedbackStats,
  useUpdateFeedback,
} from './useFeedbackList'

const {
  FEEDBACK_ROWS,
  PROFILE_ROWS,
  STATS_ROWS,
  UPDATED_ROW,
  ARCHIVED_ROW,
  mockFrom,
  mockFromExtended,
  debugWarn,
} = vi.hoisted(() => ({
  FEEDBACK_ROWS: [
    {
      id: 'fb1',
      user_id: 'u1',
      type: 'bug',
      priority: 'high',
      status: 'new',
      title: 'Erreur affichage',
      description: 'Le tableau ne charge pas',
      screenshot_url: null,
      current_route: '/dashboard',
      console_logs: [{ level: 'error', message: 'boom' }],
      browser_info: { language: 'fr', viewportWidth: 1280 },
      created_at: '2024-01-02T10:00:00.000Z',
      updated_at: '2024-01-02T10:00:00.000Z',
      resolved_at: null,
      resolved_by: null,
      admin_notes: null,
      archived_at: null,
    },
    {
      id: 'fb2',
      user_id: null,
      type: 'question',
      priority: 'low',
      status: 'reviewed',
      title: 'Comment exporter ?',
      description: null,
      screenshot_url: null,
      current_route: '/help',
      console_logs: null,
      browser_info: null,
      created_at: '2024-01-01T09:00:00.000Z',
      updated_at: '2024-01-01T09:00:00.000Z',
      resolved_at: null,
      resolved_by: null,
      admin_notes: 'Traité',
      archived_at: null,
    },
  ],
  PROFILE_ROWS: [{ id: 'u1', email: 'user1@test.local', nom: 'Durand', prenom: 'Alice' }],
  STATS_ROWS: [
    { type: 'bug', status: 'new', priority: 'critical' },
    { type: 'bug', status: 'resolved', priority: 'high' },
    { type: 'question', status: 'reviewed', priority: 'low' },
    { type: 'amelioration', status: 'in_progress', priority: 'medium' },
    { type: 'autre', status: 'wont_fix', priority: 'low' },
  ],
  UPDATED_ROW: {
    id: 'fb1',
    status: 'resolved',
    admin_notes: 'Corrigé',
    resolved_at: '2024-02-01T08:00:00.000Z',
    resolved_by: 'admin1',
    archived_at: null,
  },
  ARCHIVED_ROW: {
    id: 'fb1',
    archived_at: '2024-02-01T08:00:00.000Z',
  },
  mockFrom: vi.fn(),
  mockFromExtended: vi.fn(),
  debugWarn: vi.fn(),
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    warn: debugWarn,
    log: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: mockFromExtended,
}))

type BuilderResponse = {
  data: unknown
  error: { message: string } | null
}

type BuilderConfig = {
  response?: BuilderResponse
  singleResponse?: BuilderResponse
  maybeSingleResponse?: BuilderResponse
}

function createBuilder(config?: BuilderConfig) {
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
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => state.singleResponse),
    maybeSingle: vi.fn(async () => state.maybeSingleResponse),
    then: (
      onFulfilled: (value: BuilderResponse) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(state.response).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(state.response).catch(onRejected),
  }

  return builder
}

function createWrapper(client?: QueryClient) {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return {
    queryClient,
    wrapper,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useFeedbackList', () => {
  it('charge les feedbacks, applique les filtres et enrichit avec le profil utilisateur', async () => {
    const feedbackBuilder = createBuilder({
      response: { data: FEEDBACK_ROWS, error: null },
    })
    const profilesBuilder = createBuilder({
      response: { data: PROFILE_ROWS, error: null },
    })

    mockFromExtended.mockReturnValue(feedbackBuilder)
    mockFrom.mockReturnValue(profilesBuilder)

    const { wrapper } = createWrapper()

    const { result } = renderHook(
      () =>
        useFeedbackList({
          type: 'bug',
          status: 'new',
          priority: 'high',
          showArchived: false,
        }),
      { wrapper }
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFromExtended).toHaveBeenCalledWith('user_feedbacks')
    expect(feedbackBuilder.select).toHaveBeenCalledWith(
      'id, user_id, type, priority, status, title, description, screenshot_url, current_route, console_logs, browser_info, created_at, updated_at, resolved_at, resolved_by, admin_notes, archived_at'
    )
    expect(feedbackBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(feedbackBuilder.limit).toHaveBeenCalledWith(200)
    expect(feedbackBuilder.is).toHaveBeenCalledWith('archived_at', null)
    expect(feedbackBuilder.eq).toHaveBeenCalledWith('type', 'bug')
    expect(feedbackBuilder.eq).toHaveBeenCalledWith('status', 'new')
    expect(feedbackBuilder.eq).toHaveBeenCalledWith('priority', 'high')

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(profilesBuilder.select).toHaveBeenCalledWith('id, email, nom, prenom')
    expect(profilesBuilder.in).toHaveBeenCalledWith('id', ['u1'])

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0]).toMatchObject({
      id: 'fb1',
      type: 'bug',
      priority: 'high',
      status: 'new',
      title: 'Erreur affichage',
      user_email: 'user1@test.local',
      user_name: 'Alice Durand',
    })
    expect(result.current.data?.[0].console_logs).toEqual([{ level: 'error', message: 'boom' }])
    expect(result.current.data?.[0].browser_info).toEqual({ language: 'fr', viewportWidth: 1280 })
    expect(result.current.data?.[1]).toMatchObject({
      id: 'fb2',
      user_id: null,
      user_email: null,
      user_name: null,
      status: 'reviewed',
    })
  })

  it('passe en erreur si la requête feedback retourne une erreur', async () => {
    const feedbackBuilder = createBuilder({
      response: { data: null, error: { message: 'x' } },
    })

    mockFromExtended.mockReturnValue(feedbackBuilder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useFeedbackList(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('x')
  })

  it('ignore silencieusement une erreur de récupération des profils et garde les feedbacks', async () => {
    const feedbackBuilder = createBuilder({
      response: { data: FEEDBACK_ROWS, error: null },
    })
    const profilesBuilder = createBuilder({
      response: { data: null, error: null },
    })
    profilesBuilder.then = (
      _onFulfilled: (value: BuilderResponse) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.reject(new Error('profiles failed')).then(_onFulfilled, onRejected)
    profilesBuilder.catch = (onRejected: (reason: unknown) => unknown) =>
      Promise.reject(new Error('profiles failed')).catch(onRejected)

    mockFromExtended.mockReturnValue(feedbackBuilder)
    mockFrom.mockReturnValue(profilesBuilder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useFeedbackList(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(debugWarn).toHaveBeenCalledWith(
      '[useFeedbackList] Could not fetch profiles for chunk'
    )
    expect(result.current.data?.[0]).toMatchObject({
      id: 'fb1',
      user_email: null,
      user_name: null,
    })
  })
})

describe('useFeedbackStats', () => {
  it('calcule les statistiques métier par type, statut et priorité', async () => {
    const statsBuilder = createBuilder({
      response: { data: STATS_ROWS, error: null },
    })

    mockFromExtended.mockReturnValue(statsBuilder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useFeedbackStats(), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFromExtended).toHaveBeenCalledWith('user_feedbacks')
    expect(statsBuilder.select).toHaveBeenCalledWith('type, status, priority')
    expect(result.current.data).toEqual({
      total: 5,
      byType: {
        bug: 2,
        amelioration: 1,
        question: 1,
        autre: 1,
      },
      byStatus: {
        new: 1,
        reviewed: 1,
        in_progress: 1,
        resolved: 1,
        wont_fix: 1,
      },
      byPriority: {
        critical: 1,
        high: 1,
        medium: 1,
        low: 2,
      },
    })
  })

  it('passe en erreur si la requête stats retourne une erreur', async () => {
    const statsBuilder = createBuilder({
      response: { data: null, error: { message: 'x' } },
    })

    mockFromExtended.mockReturnValue(statsBuilder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useFeedbackStats(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('x')
  })
})

describe('mutations feedback', () => {
  it('useUpdateFeedback met à jour un feedback et invalide les requêtes liées', async () => {
    const updateBuilder = createBuilder({
      singleResponse: { data: UPDATED_ROW, error: null },
    })
    mockFromExtended.mockReturnValue(updateBuilder)

    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateFeedback(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'fb1',
        updates: {
          status: 'resolved',
          admin_notes: 'Corrigé',
          resolved_at: '2024-02-01T08:00:00.000Z',
          resolved_by: 'admin1',
        },
      })
    })

    expect(mockFromExtended).toHaveBeenCalledWith('user_feedbacks')
    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: 'resolved',
      admin_notes: 'Corrigé',
      resolved_at: '2024-02-01T08:00:00.000Z',
      resolved_by: 'admin1',
    })
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'fb1')
    expect(updateBuilder.select).toHaveBeenCalledWith()
    expect(updateBuilder.single).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user_feedbacks'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user_feedbacks_stats'] })
  })

  it('useArchiveFeedback archive un feedback par id', async () => {
    const archiveBuilder = createBuilder({
      singleResponse: { data: ARCHIVED_ROW, error: null },
    })
    mockFromExtended.mockReturnValue(archiveBuilder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useArchiveFeedback(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('fb1')
    })

    expect(mockFromExtended).toHaveBeenCalledWith('user_feedbacks')
    expect(archiveBuilder.update).toHaveBeenCalledTimes(1)
    const archivePayload = archiveBuilder.update.mock.calls[0]?.[0] as { archived_at: string }
    expect(typeof archivePayload.archived_at).toBe('string')
    expect(archiveBuilder.eq).toHaveBeenCalledWith('id', 'fb1')
    expect(archiveBuilder.select).toHaveBeenCalledWith()
    expect(archiveBuilder.single).toHaveBeenCalled()
  })

  it('useBulkArchiveFeedbacks archive plusieurs feedbacks', async () => {
    const bulkBuilder = createBuilder({
      response: { data: null, error: null },
    })
    mockFromExtended.mockReturnValue(bulkBuilder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useBulkArchiveFeedbacks(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(['fb1', 'fb2'])
    })

    expect(mockFromExtended).toHaveBeenCalledWith('user_feedbacks')
    expect(bulkBuilder.update).toHaveBeenCalledTimes(1)
    const bulkPayload = bulkBuilder.update.mock.calls[0]?.[0] as { archived_at: string }
    expect(typeof bulkPayload.archived_at).toBe('string')
    expect(bulkBuilder.in).toHaveBeenCalledWith('id', ['fb1', 'fb2'])
  })

  it('useDeleteFeedback supprime un feedback', async () => {
    const deleteBuilder = createBuilder({
      response: { data: null, error: null },
    })
    mockFromExtended.mockReturnValue(deleteBuilder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useDeleteFeedback(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('fb2')
    })

    expect(mockFromExtended).toHaveBeenCalledWith('user_feedbacks')
    expect(deleteBuilder.delete).toHaveBeenCalledWith()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'fb2')
  })

  it('useUpdateFeedback passe en erreur si la mutation retourne une erreur', async () => {
    const updateBuilder = createBuilder({
      singleResponse: { data: null, error: { message: 'x' } },
    })
    mockFromExtended.mockReturnValue(updateBuilder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useUpdateFeedback(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'fb1',
          updates: { status: 'resolved' },
        })
      ).rejects.toMatchObject({ message: 'x' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})