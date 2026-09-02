// @vitest-environment jsdom
import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useJarvisPreferences } from './useJarvisPreferences'

const {
  EXISTING_PREFS,
  INSERTED_PREFS,
  builderState,
  mockFrom,
  toastMock,
  sanitizeSupabaseErrorMock,
  debugErrorMock,
} = vi.hoisted(() => {
  const EXISTING_PREFS = {
    user_id: 'user-1',
    enabled: false,
    voice_enabled: true,
    proactive_mode: false,
    confidence_threshold: 0.7,
    auto_approve_above: 0.9,
    notification_frequency: 'daily',
    quiet_hours_enabled: true,
    quiet_hours_start: '21:00',
    quiet_hours_end: '06:00',
    preferred_voice: 'fr-FR-DeniseNeural',
    voice_speed: 1,
    wake_word: 'Jarvis',
    formal_tone: false,
    include_sources: false,
    max_actions_per_hour: 8,
    triggers_enabled: {
      new_email: false,
      task_due: true,
      calendar_reminder: false,
      support_ticket: true,
    },
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z',
  }

  const INSERTED_PREFS = {
    user_id: 'user-1',
    enabled: true,
    voice_enabled: false,
    proactive_mode: true,
    confidence_threshold: 0.85,
    auto_approve_above: 0.95,
    notification_frequency: 'immediate',
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    preferred_voice: 'fr-FR-DeniseNeural',
    voice_speed: 1,
    wake_word: 'Jarvis',
    formal_tone: true,
    include_sources: true,
    max_actions_per_hour: 20,
    triggers_enabled: {
      new_email: true,
      task_due: true,
      calendar_reminder: true,
      support_ticket: true,
    },
    created_at: '2024-01-03T00:00:00.000Z',
    updated_at: '2024-01-03T00:00:00.000Z',
  }

  const builderState = {
    selectResult: { data: EXISTING_PREFS as unknown, error: null as { message: string } | null },
    maybeSingleResult: { data: EXISTING_PREFS as unknown, error: null as { message: string } | null },
    singleResult: { data: INSERTED_PREFS as unknown, error: null as { message: string } | null },
    insertResult: { data: INSERTED_PREFS as unknown, error: null as { message: string } | null },
    upsertResult: { data: null as unknown, error: null as { message: string } | null },
  }

  const toastMock = vi.fn()
  const sanitizeSupabaseErrorMock = vi.fn((error: Error | { message?: string }) => error.message ?? 'sanitized')
  const debugErrorMock = vi.fn()

  const mockFrom = vi.fn((table: string) => {
    const builder = {
      table,
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      upsert: vi.fn(async () => builderState.upsertResult),
      single: vi.fn(async () => builderState.singleResult),
      maybeSingle: vi.fn(async () => builderState.maybeSingleResult),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(builderState.selectResult).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve(builderState.selectResult).catch(onRejected),
    }
    return builder
  })

  return {
    EXISTING_PREFS,
    INSERTED_PREFS,
    builderState,
    mockFrom,
    toastMock,
    sanitizeSupabaseErrorMock,
    debugErrorMock,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function getLastBuilderWithMethod(methodName: 'upsert' | 'insert' | 'select') {
  const results = [...mockFrom.mock.results]
  for (let i = results.length - 1; i >= 0; i--) {
    const res = results[i]
    if (res && 'value' in res && res.value && typeof res.value === 'object') {
      const builder = res.value as Record<string, unknown>
      const fn = builder[methodName] as unknown
      if (fn && typeof fn === 'function' && 'mock' in (fn as object)) {
        const mock = (fn as { mock: { calls: unknown[] } }).mock
        if (mock.calls.length > 0) {
          return builder as { [k in typeof methodName]: ReturnType<typeof vi.fn> }
        }
      }
    }
  }
  return null
}

describe('useJarvisPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    builderState.selectResult = { data: EXISTING_PREFS, error: null }
    builderState.maybeSingleResult = { data: EXISTING_PREFS, error: null }
    builderState.singleResult = { data: INSERTED_PREFS, error: null }
    builderState.insertResult = { data: INSERTED_PREFS, error: null }
    builderState.upsertResult = { data: null, error: null }
  })

  it('charge les préférences existantes et expose les indicateurs métier', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useJarvisPreferences('user-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.preferences).toBeUndefined()
    expect(result.current.isEnabled).toBe(true)
    expect(result.current.isVoiceEnabled).toBe(false)
    expect(result.current.isProactiveMode).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFrom).toHaveBeenCalledWith('jarvis_preferences')
    expect(result.current.error).toBeNull()
    expect(result.current.preferences).toEqual(EXISTING_PREFS)
    expect(result.current.isEnabled).toBe(false)
    expect(result.current.isVoiceEnabled).toBe(true)
    expect(result.current.isProactiveMode).toBe(false)
    expect(result.current.preferences?.notification_frequency).toBe('daily')
    expect(result.current.preferences?.max_actions_per_hour).toBe(8)
    expect(result.current.preferences?.triggers_enabled.new_email).toBe(false)
  })

  it('crée les préférences par défaut quand aucune ligne n’existe', async () => {
    builderState.maybeSingleResult = { data: null, error: null }
    builderState.singleResult = { data: INSERTED_PREFS, error: null }

    const wrapper = createWrapper()
    const { result } = renderHook(() => useJarvisPreferences('user-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFrom).toHaveBeenCalledWith('jarvis_preferences')
    expect(result.current.preferences).toEqual(INSERTED_PREFS)
    expect(result.current.isEnabled).toBe(true)
    expect(result.current.isVoiceEnabled).toBe(false)
    expect(result.current.isProactiveMode).toBe(true)
    expect(result.current.preferences?.confidence_threshold).toBe(0.85)
    expect(result.current.preferences?.quiet_hours_start).toBe('22:00')
    expect(result.current.preferences?.triggers_enabled.support_ticket).toBe(true)
  })

  it('remonte une erreur de chargement quand la requêteéchoue', async () => {
    builderState.maybeSingleResult = { data: null, error: { message: 'load failed' } }

    const wrapper = createWrapper()
    const { result } = renderHook(() => useJarvisPreferences('user-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })

    expect(result.current.isLoading).toBe(false)
    expect(debugErrorMock).toHaveBeenCalled()
    expect((result.current.error as Error).message).toBe('load failed')
    expect(result.current.preferences).toBeUndefined()
  })

  it('met à jour les préférences et affiche un toast de succès', async () => {
    const invalidateQueries = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const wrapper = createWrapper()
    const { result } = renderHook(() => useJarvisPreferences('user-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.updatePreferences({ enabled: true, voice_enabled: false })
    })

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalled()
    })

    const builder = getLastBuilderWithMethod('upsert')
    expect(builder).not.toBeNull()
    if (builder) {
      expect(builder.upsert).toHaveBeenCalledTimes(1)
      expect(builder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          enabled: true,
          voice_enabled: false,
          updated_at: expect.any(String),
        })
      )
    }
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['jarvis-preferences', 'user-1'] })
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Préférences sauvegardées',
      description: 'Vos paramètres Jarvis ont été mis à jour',
    })
  })

  it('gère les erreurs de mutation avec message sanitizé', async () => {
    builderState.upsertResult = { data: null, error: { message: 'save failed' } }

    const wrapper = createWrapper()
    const { result } = renderHook(() => useJarvisPreferences('user-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.updatePreferences({ formal_tone: true })
    })

    await waitFor(() => {
      expect(sanitizeSupabaseErrorMock).toHaveBeenCalled()
    })

    const builder = getLastBuilderWithMethod('upsert')
    expect(builder).not.toBeNull()
    if (builder) {
      expect(builder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          formal_tone: true,
          updated_at: expect.any(String),
        })
      )
    }
    expect(sanitizeSupabaseErrorMock).toHaveBeenCalledWith(expect.objectContaining({ message: 'save failed' }))
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'save failed',
      variant: 'destructive',
    })
  })

  it('toggleEnabled inverse la valeur courante', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useJarvisPreferences('user-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.toggleEnabled()
    })

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalled()
    })

    const builder = getLastBuilderWithMethod('upsert')
    expect(builder).not.toBeNull()
    if (builder) {
      expect(builder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          enabled: true,
          updated_at: expect.any(String),
        })
      )
    }
  })

  it('toggleVoice inverse la valeur courante', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useJarvisPreferences('user-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.toggleVoice()
    })

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalled()
    })

    const builder = getLastBuilderWithMethod('upsert')
    expect(builder).not.toBeNull()
    if (builder) {
      expect(builder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          voice_enabled: false,
          updated_at: expect.any(String),
        })
      )
    }
  })

  it('toggleProactiveMode inverse la valeur courante', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useJarvisPreferences('user-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.toggleProactiveMode()
    })

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalled()
    })

    const builder = getLastBuilderWithMethod('upsert')
    expect(builder).not.toBeNull()
    if (builder) {
      expect(builder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          proactive_mode: true,
          updated_at: expect.any(String),
        })
      )
    }
  })
})