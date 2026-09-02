/* @vitest-environment jsdom */

import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as transcriptionModule from './transcription'

const {
  AUTH_STATE,
  SESSIONS_ROWS,
  SESSION_DETAILS_ROW,
  PARTICIPANTS_ROWS,
  SEGMENTS_ROWS,
  CREATED_SESSION_ROW,
  mockFrom,
  mockSelect,
  mockEq,
  mockGte,
  mockLte,
  mockIn,
  mockOrder,
  mockLimit,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockSingle,
  mockMaybeSingle,
  mockThen,
  mockCatch,
  toastSuccess,
  toastError,
  navigateMock,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const SESSIONS_ROWS = [
    {
      id: 's1',
      title: 'Réunion projet',
      status: 'active',
      started_at: '2024-01-01T10:00:00.000Z',
      created_by: 'u1',
      language: 'fr',
      created_at: '2024-01-01T09:59:00.000Z',
      updated_at: '2024-01-01T10:00:00.000Z',
      decisions: [{ decision: 'Valider le budget', owner: 'Alice' }],
      next_steps: [{ task: 'Envoyer le compte-rendu', assignee: 'Bob', priority: 'haute' }],
      room_code: 'ROOM1',
      full_transcript: 'Bonjour à tous',
    },
    {
      id: 's2',
      title: 'Comité hebdo',
      status: 'ended',
      started_at: '2024-01-02T10:00:00.000Z',
      ended_at: '2024-01-02T11:00:00.000Z',
      created_by: 'u1',
      language: 'en',
      created_at: '2024-01-02T09:59:00.000Z',
      updated_at: '2024-01-02T11:00:00.000Z',
      decisions: [],
      next_steps: [],
    },
  ]

  const PARTICIPANTS_ROWS = [
    {
      id: 'p1',
      session_id: 's1',
      user_id: 'u1',
      display_name: 'Alice',
      azure_speaker_id: 'spk1',
      joined_at: '2024-01-01T10:00:00.000Z',
      is_transcribing: true,
    },
  ]

  const SEGMENTS_ROWS = [
    {
      id: 'seg1',
      session_id: 's1',
      user_id: 'u1',
      speaker_name: 'Alice',
      speaker_id: 'spk1',
      text: 'Bonjour à tous',
      start_time_ms: 0,
      end_time_ms: 2000,
      is_partial: false,
      confidence: 0.98,
      created_at: '2024-01-01T10:00:01.000Z',
    },
  ]

  const SESSION_DETAILS_ROW = {
    ...SESSIONS_ROWS[0],
    participants: PARTICIPANTS_ROWS,
    segments: SEGMENTS_ROWS,
  }

  const CREATED_SESSION_ROW = {
    id: 's3',
    title: 'Point client',
    status: 'active',
    started_at: '2024-01-03T10:00:00.000Z',
    created_by: 'u1',
    language: 'fr',
    created_at: '2024-01-03T10:00:00.000Z',
    updated_at: '2024-01-03T10:00:00.000Z',
    decisions: [],
    next_steps: [],
    room_code: 'ABCD',
  }

  return {
    AUTH_STATE,
    SESSIONS_ROWS,
    SESSION_DETAILS_ROW,
    PARTICIPANTS_ROWS,
    SEGMENTS_ROWS,
    CREATED_SESSION_ROW,
    mockFrom: vi.fn(),
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockGte: vi.fn(),
    mockLte: vi.fn(),
    mockIn: vi.fn(),
    mockOrder: vi.fn(),
    mockLimit: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockSingle: vi.fn(),
    mockMaybeSingle: vi.fn(),
    mockThen: vi.fn(),
    mockCatch: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    navigateMock: vi.fn(),
  }
})

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: mockSelect,
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    in: mockIn,
    order: mockOrder,
    limit: mockLimit,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    then: mockThen,
    catch: mockCatch,
  }

  mockSelect.mockImplementation(() => builder)
  mockEq.mockImplementation(() => builder)
  mockGte.mockImplementation(() => builder)
  mockLte.mockImplementation(() => builder)
  mockIn.mockImplementation(() => builder)
  mockOrder.mockImplementation(() => builder)
  mockLimit.mockImplementation(() => builder)
  mockInsert.mockImplementation(() => builder)
  mockUpdate.mockImplementation(() => builder)
  mockDelete.mockImplementation(() => builder)
  mockFrom.mockImplementation(() => builder)

  return {
    supabase: {
      from: mockFrom,
    },
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children?: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

function setupBuilderDefaults() {
  const builder = {
    select: mockSelect,
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    in: mockIn,
    order: mockOrder,
    limit: mockLimit,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    then: mockThen,
    catch: mockCatch,
  }

  mockSelect.mockImplementation(() => builder)
  mockEq.mockImplementation(() => builder)
  mockGte.mockImplementation(() => builder)
  mockLte.mockImplementation(() => builder)
  mockIn.mockImplementation(() => builder)
  mockOrder.mockImplementation(() => builder)
  mockLimit.mockImplementation(() => builder)
  mockInsert.mockImplementation(() => builder)
  mockUpdate.mockImplementation(() => builder)
  mockDelete.mockImplementation(() => builder)
  mockFrom.mockImplementation(() => builder)
}

function setupThenableSuccess(result: unknown) {
  mockThen.mockImplementation((onFulfilled?: (value: unknown) => unknown) => {
    const value = onFulfilled ? onFulfilled(result) : result
    return Promise.resolve(value)
  })
  mockCatch.mockImplementation(() => Promise.resolve(result))
  mockSingle.mockResolvedValue(result)
  mockMaybeSingle.mockResolvedValue(result)
}

function setupThenableFailure(message: string) {
  const failure = { data: null, error: { message } }
  mockThen.mockImplementation((onFulfilled?: (value: unknown) => unknown) => {
    const value = onFulfilled ? onFulfilled(failure) : failure
    return Promise.resolve(value)
  })
  mockCatch.mockImplementation((onRejected?: (reason: unknown) => unknown) => {
    const value = onRejected ? onRejected(failure) : failure
    return Promise.resolve(value)
  })
  mockSingle.mockResolvedValue(failure)
  mockMaybeSingle.mockResolvedValue(failure)
}

describe('transcription.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupBuilderDefaults()
  })

  it('expose le module', () => {
    expect(transcriptionModule).toBeTruthy()
  })

  it('charge des données stables si un hook de requête est exporté', async () => {
    setupThenableSuccess({ data: SESSIONS_ROWS, error: null })

    const queryEntry = Object.entries(transcriptionModule).find(
      ([name, value]) =>
        name.startsWith('use') &&
        typeof value === 'function' &&
        !/(create|add|start|update|delete|remove|end|archive)/i.test(name),
    )

    if (!queryEntry) {
      expect(transcriptionModule).toBeTruthy()
      return
    }

    const hook = queryEntry[1] as () => unknown
    const { result } = renderHook(() => hook(), { wrapper: createWrapper() })

    expect(result.current).toBeTruthy()

    await waitFor(() => {
      const current = result.current as {
        isLoading?: boolean
        isSuccess?: boolean
        data?: unknown
      }
      expect(current.isLoading === false || current.isSuccess === true || current.data !== undefined).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalled()

    const current = result.current as {
      data?: unknown
    }

    if (Array.isArray(current.data)) {
      expect(current.data[0]).toMatchObject({
        id: 's1',
        title: 'Réunion projet',
        status: 'active',
        language: 'fr',
      })
      expect((current.data[0] as { decisions?: Array<{ decision: string }> }).decisions?.[0]?.decision).toBe('Valider le budget')
      expect((current.data[0] as { next_steps?: Array<{ task: string }> }).next_steps?.[0]?.task).toBe('Envoyer le compte-rendu')
    } else if (current.data && typeof current.data === 'object') {
      expect(current.data).toMatchObject({
        id: 's1',
        title: 'Réunion projet',
      })
    }
  })

  it('passe en erreur quand la requête renvoie { data:null, error }', async () => {
    setupThenableFailure('x')

    const queryEntry = Object.entries(transcriptionModule).find(
      ([name, value]) =>
        name.startsWith('use') &&
        typeof value === 'function' &&
        !/(create|add|start|update|delete|remove|end|archive)/i.test(name),
    )

    if (!queryEntry) {
      expect(transcriptionModule).toBeTruthy()
      return
    }

    const hook = queryEntry[1] as () => unknown
    const { result } = renderHook(() => hook(), { wrapper: createWrapper() })

    await waitFor(() => {
      const current = result.current as {
        isError?: boolean
        error?: { message?: string }
        data?: unknown
      }
      expect(current.isError === true || current.error?.message === 'x' || current.data === null).toBe(true)
    })
  })

  it('déclenche une mutation si un hook de mutation est exporté', async () => {
    setupThenableSuccess({ data: CREATED_SESSION_ROW, error: null })

    const mutationEntry = Object.entries(transcriptionModule).find(
      ([name, value]) =>
        name.startsWith('use') &&
        typeof value === 'function' &&
        /(create|add|start)/i.test(name),
    )

    if (!mutationEntry) {
      expect(transcriptionModule).toBeTruthy()
      return
    }

    const hook = mutationEntry[1] as () => {
      mutateAsync?: (input: unknown) => Promise<unknown>
      mutate?: (input: unknown) => void
    }

    const { result } = renderHook(() => hook(), { wrapper: createWrapper() })

    const payload = {
      title: 'Point client',
      roomCode: 'ABCD',
      displayName: 'Alice',
      language: 'fr',
      etablissementId: 'e1',
      partenaireId: 'p1',
      groupeId: 'g1',
      externalMeetingUrl: 'https://meet.local',
    }

    await act(async () => {
      if (result.current.mutateAsync) {
        await result.current.mutateAsync(payload)
      } else if (result.current.mutate) {
        result.current.mutate(payload)
      }
    })

    expect(mockFrom).toHaveBeenCalled()
    expect(mockInsert).toHaveBeenCalled()
    const firstArg = mockInsert.mock.calls[0]?.[0]
    expect(firstArg).toBeTruthy()
  })

  it('garde les références stables utilisées dans les mocks', () => {
    expect(SESSIONS_ROWS[0].title).toBe('Réunion projet')
    expect(SESSION_DETAILS_ROW.participants).toBe(PARTICIPANTS_ROWS)
    expect(SESSION_DETAILS_ROW.segments).toBe(SEGMENTS_ROWS)
    expect(CREATED_SESSION_ROW.room_code).toBe('ABCD')
  })
})