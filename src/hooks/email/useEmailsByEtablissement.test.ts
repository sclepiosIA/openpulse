import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useEmailsByEtablissement } from './useEmailsByEtablissement'

const {
  ROWS_SUCCESS,
  ERROR_RESPONSE,
  RESPONSES,
  mockFrom,
  setEmailThreadsResponse,
} = vi.hoisted(() => {
  const ROWS_SUCCESS = [
    {
      id: 't1',
      etablissement_id: 'e1',
      subject: 'Hello',
      message_count: 5,
      unread_count: 2,
      last_message_date: '2024-05-11T12:00:00Z',
      is_archived: false,
      created_at: '2024-05-09T09:00:00Z',
      etablissement: {
        id: 'e1',
        nom: 'Lycee Alpha',
        ville: 'Paris',
        statut: 'actif',
        relationship_status: 'client',
        engagement_score: 42,
        last_email_received_at: '2024-05-10T10:00:00Z',
        last_email_sent_at: '2024-05-10T10:30:00Z',
      },
      messages: [
        { id: 'm1', sent_date: '2024-05-10T09:00:00Z', from_address: 'a@a.co', is_sent: false },
        { id: 'm2', sent_date: '2024-05-10T11:00:00Z', from_address: 'me@me.co', is_sent: true },
        { id: 'm3', sent_date: '2024-05-10T12:00:00Z', from_address: 'a@a.co', is_sent: false },
        { id: 'm4', sent_date: '2024-05-10T12:45:00Z', from_address: 'me@me.co', is_sent: true },
      ],
    },
    {
      id: 't2',
      etablissement_id: 'e1',
      subject: 'Follow-up',
      message_count: 3,
      unread_count: 0,
      last_message_date: '2024-05-12T09:00:00Z',
      is_archived: true,
      created_at: '2024-05-11T08:00:00Z',
      etablissement: {
        id: 'e1',
        nom: 'Lycee Alpha',
        ville: 'Paris',
        statut: 'actif',
        relationship_status: 'client',
        engagement_score: 42,
        last_email_received_at: '2024-05-10T10:00:00Z',
        last_email_sent_at: '2024-05-10T10:30:00Z',
      },
      messages: [{ id: 'n1', sent_date: '2024-05-11T08:00:00Z', from_address: 'a@a.co', is_sent: false }],
    },
    {
      id: 't3',
      etablissement_id: 'e2',
      subject: 'Hi',
      message_count: 7,
      unread_count: 1,
      last_message_date: '2024-04-01T08:00:00Z',
      is_archived: false,
      created_at: '2024-03-31T12:00:00Z',
      etablissement: {
        id: 'e2',
        nom: 'College Beta',
        ville: 'Lyon',
        statut: 'prospect',
        relationship_status: null,
        engagement_score: null,
        last_email_received_at: null,
        last_email_sent_at: null,
      },
      messages: [
        { id: 'x1', sent_date: '2024-04-01T07:00:00Z', from_address: 'p@p.co', is_sent: false },
        { id: 'x2', sent_date: '2024-04-01T18:00:00Z', from_address: 'me@me.co', is_sent: true },
      ],
    },
  ]
  const ERROR_RESPONSE = { data: null, error: { message: 'x' } }
  const RESPONSES: Record<string, { data: unknown; error: unknown }> = {
    email_threads: { data: ROWS_SUCCESS, error: null },
  }
  const makeBuilder = (table: string) => {
    const builder: any = {
      select: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(R) as Promise<any>),
      maybeSingle: vi.fn(() => Promise.resolve(R) as Promise<any>),
      then: (onFulfilled: (v: any) => any, onRejected?: (r: any) => any) =>
        Promise.resolve(R).then(onFulfilled, onRejected),
      catch: (onRejected: (r: any) => any) => Promise.resolve(R).catch(onRejected),
    }
    const R = RESPONSES[table] ?? { data: null, error: null }
    return builder
  }
  const mockFrom = vi.fn((table: string) => makeBuilder(table))
  const setEmailThreadsResponse = (response: { data: unknown; error: unknown }) => {
    RESPONSES.email_threads = response
  }
  return { ROWS_SUCCESS, ERROR_RESPONSE, RESPONSES, mockFrom, setEmailThreadsResponse }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    standard: {},
  },
}))

function createWrapper(): React.FC<{ children?: React.ReactNode }> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  const Wrapper = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return Wrapper
}

describe('useEmailsByEtablissement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setEmailThreadsResponse({ data: ROWS_SUCCESS, error: null })
  })

  it('returns loading then success with aggregated stats per établissement', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailsByEtablissement(), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const data = result.current.data
    expect(Array.isArray(data)).toBe(true)
    expect(data?.length).toBe(2)

    const s1 = data?.[0]
    expect(s1?.etablissement_id).toBe('e1')
    expect(s1?.etablissement_nom).toBe('Lycee Alpha')
    expect(s1?.etablissement_ville).toBe('Paris')
    expect(s1?.total_threads).toBe(2)
    expect(s1?.total_messages).toBe(8)
    expect(s1?.unread_count).toBe(2)
    expect(s1?.last_message_date).toBe('2024-05-12T09:00:00Z')
    expect(s1?.active_threads).toBe(1)
    expect(s1?.archived_threads).toBe(1)
    expect(s1?.relationship_status).toBe('client')
    expect(s1?.engagement_score).toBe(42)
    expect(s1?.last_email_received_at).toBe('2024-05-10T10:00:00Z')
    expect(s1?.last_email_sent_at).toBe('2024-05-10T10:30:00Z')
    expect(s1?.avg_response_time_hours).toBe(1.4)
    expect(s1?.threads.length).toBe(2)

    const s2 = data?.[1]
    expect(s2?.etablissement_id).toBe('e2')
    expect(s2?.etablissement_nom).toBe('College Beta')
    expect(s2?.etablissement_ville).toBe('Lyon')
    expect(s2?.total_threads).toBe(1)
    expect(s2?.total_messages).toBe(7)
    expect(s2?.unread_count).toBe(1)
    expect(s2?.last_message_date).toBe('2024-04-01T08:00:00Z')
    expect(s2?.active_threads).toBe(1)
    expect(s2?.archived_threads).toBe(0)
    expect(s2?.relationship_status).toBe('prospect')
    expect(s2?.engagement_score).toBe(0)
    expect(s2?.last_email_received_at).toBeNull()
    expect(s2?.last_email_sent_at).toBeNull()
    expect(s2?.avg_response_time_hours).toBe(11)
  })

  it('handles error state when supabase returns an error', async () => {
    setEmailThreadsResponse(ERROR_RESPONSE)
    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailsByEtablissement(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as { message?: string } | null)?.message).toBe('x')
    expect(mockFrom).toHaveBeenCalledWith('email_threads')
  })
})