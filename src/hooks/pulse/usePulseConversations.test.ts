import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  CONV_ROWS,
  CONV_DETAIL,
  NEW_CONV,
  CURRENT_PROFILE,
  mockFrom,
  mockFromExtended,
  mockRpc,
  toastSuccess,
  toastError,
  debugError,
  RESPONSES,
  recordedInserts,
  recordedUpdates,
  recordedDeletes,
} = vi.hoisted(() => {
  const CURRENT_PROFILE = { id: 'u1', email: 'test@example.com', nom: 'T', prenom: 'U' }

  const CONV_ROWS = [
    {
      id: 'conv-1',
      name: 'Conversation 1',
      is_archived: false,
      last_message: [
        { id: 'm1', content: 'old', created_at: '2023-01-01T00:00:00.000Z' },
        { id: 'm2', content: 'new', created_at: '2023-02-01T00:00:00.000Z' },
      ],
    },
    {
      id: 'conv-2',
      name: 'Conversation 2',
      is_archived: false,
      last_message: null,
    },
  ]

  const CONV_DETAIL = {
    id: 'conv-1',
    name: 'Conversation 1',
    members: [{ id: 'm1', user_id: 'u1', role: 'admin' }],
  }

  const NEW_CONV = { id: 'new-conv-1', name: 'New convo' }

  // Control responses per test
  const RESPONSES = {
    createConvError: false,
    addMembersError: false,
    updateConvError: false,
    archiveError: false,
    addMemberError: false,
    removeMemberError: false,
    updateMemberRoleError: false,
    fetchConvsRows: CONV_ROWS,
    fetchConvDetail: CONV_DETAIL,
    fetchConvsError: false,
    updatedConv: (id: string) => ({ id, name: 'Updated' }),
  }

  const recordedInserts: Record<string, unknown[]> = {}
  const recordedUpdates: Record<string, unknown[]> = {}
  const recordedDeletes: Record<string, unknown[]> = {}

  // Builder factory used by mockFrom and mockFromExtended
  function builderFactory(table: string) {
    const state: {
      table: string
      _op?: string
      _select?: boolean
      _single?: boolean
      _maybeSingle?: boolean
      _payload?: unknown
      _filters?: Record<string, unknown>
    } = { table, _filters: {} }

    const builder: any = {
      select(arg?: unknown) {
        state._op = state._op || 'select'
        state._select = true
        return builder
      },
      insert(payload: unknown) {
        state._op = 'insert'
        state._payload = payload
        recordedInserts[table] = recordedInserts[table] || []
        recordedInserts[table].push(payload)
        return builder
      },
      update(payload: unknown) {
        state._op = 'update'
        state._payload = payload
        recordedUpdates[table] = recordedUpdates[table] || []
        recordedUpdates[table].push(payload)
        return builder
      },
      delete() {
        state._op = 'delete'
        return builder
      },
      eq(field: string, value: unknown) {
        ;(state._filters as Record<string, unknown>)[field] = value
        return builder
      },
      order(_field: string, _opts?: unknown) {
        return builder
      },
      maybeSingle() {
        state._maybeSingle = true
        return builder
      },
      single() {
        state._single = true
        return builder
      },
      limit() {
        return builder
      },
      in() {
        return builder
      },
      then(onFulfilled: unknown, onRejected: unknown) {
        // Build response based on state and RESPONSES
        const respond = async () => {
          // pulse_conversations table logic
          if (table === 'pulse_conversations') {
            if (state._op === 'insert') {
              if (RESPONSES.createConvError) {
                return { data: null, error: { message: 'creation error' } }
              }
              return { data: NEW_CONV, error: null }
            }
            if (state._op === 'update') {
              if (RESPONSES.updateConvError) {
                return { data: null, error: { message: 'update error' } }
              }
              // use id from filters if present
              const id = (state._filters || {})['id'] as string | undefined
              const data = RESPONSES.updatedConv(id ?? 'conv-unknown')
              return { data, error: null }
            }
            // select (list or detail)
            if (state._select) {
              if (RESPONSES.fetchConvsError) {
                return { data: null, error: { message: 'fetch error' } }
              }
              const id = (state._filters || {})['id'] as string | undefined
              if (id) {
                const data =
                  RESPONSES.fetchConvDetail && RESPONSES.fetchConvDetail.id === id
                    ? RESPONSES.fetchConvDetail
                    : null
                // maybeSingle behavior
                if (state._maybeSingle || state._single) {
                  return { data, error: null }
                }
                // default
                return { data: [data], error: null }
              }
              // list
              return { data: RESPONSES.fetchConvsRows, error: null }
            }
          }

          if (table === 'pulse_conversation_members') {
            if (state._op === 'insert') {
              if (RESPONSES.addMembersError || RESPONSES.addMemberError) {
                return { data: null, error: { message: 'add members error' } }
              }
              return { data: state._payload, error: null }
            }
            if (state._op === 'delete') {
              if (RESPONSES.removeMemberError) {
                return { data: null, error: { message: 'remove error' } }
              }
              recordedDeletes[table] = recordedDeletes[table] || []
              recordedDeletes[table].push(state._filters)
              return { data: null, error: null }
            }
            if (state._op === 'update') {
              if (RESPONSES.updateMemberRoleError) {
                return { data: null, error: { message: 'update role error' } }
              }
              recordedUpdates[table] = recordedUpdates[table] || []
              recordedUpdates[table].push(state._payload)
              return { data: null, error: null }
            }
          }

          // Fallback
          return { data: null, error: null }
        }

        return Promise.resolve()
          .then(() => respond())
          .then(onFulfilled as any, onRejected as any)
      },
      catch() {
        return Promise.resolve()
      },
    }

    return builder
  }

  const mockFrom = vi.fn((table: string) => builderFactory(table))
  const mockFromExtended = vi.fn((table: string) => builderFactory(table))
  const mockRpc = vi.fn(async (name: string) => {
    if (name !== 'create_pulse_conversation') {
      return { data: null, error: { message: `unexpected rpc: ${name}` } }
    }
    if (RESPONSES.createConvError) {
      return { data: null, error: { message: 'creation error' } }
    }
    return { data: NEW_CONV, error: null }
  })

  const toastSuccess = vi.fn()
  const toastError = vi.fn()
  const debugError = vi.fn()

  return {
    CONV_ROWS,
    CONV_DETAIL,
    NEW_CONV,
    CURRENT_PROFILE,
    mockFrom,
    mockFromExtended,
    mockRpc,
    toastSuccess,
    toastError,
    debugError,
    RESPONSES,
    recordedInserts,
    recordedUpdates,
    recordedDeletes,
  }
})

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mockFrom, rpc: mockRpc } }))
vi.mock('@/lib/supabaseTyped', () => ({ fromExtended: mockFromExtended }))
vi.mock('@/hooks/profile/useProfiles', () => ({ useCurrentProfile: () => ({ data: CURRENT_PROFILE, isLoading: false }) }))
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))
vi.mock('@/lib/debug', () => ({ debug: { error: debugError } }))
vi.mock('@/lib/queryPresets', () => ({ queryPresets: { standard: {} } }))

import {
  usePulseConversations,
  usePulseConversation,
  useCreatePulseConversation,
  useUpdatePulseConversation,
  useArchivePulseConversation,
  useAddPulseConversationMember,
  useRemovePulseConversationMember,
  useUpdatePulseConversationMemberRole,
  pulseConversationKeys,
} from './usePulseConversations'

describe('usePulseConversations hooks', () => {
  const createWrapper = () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })
    return (props: { children?: unknown }) =>
      React.createElement(QueryClientProvider, { client: qc }, (props.children as any) ?? null)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // reset responses to defaults
    RESPONSES.createConvError = false
    RESPONSES.addMembersError = false
    RESPONSES.updateConvError = false
    RESPONSES.archiveError = false
    RESPONSES.addMemberError = false
    RESPONSES.removeMemberError = false
    RESPONSES.updateMemberRoleError = false
    RESPONSES.fetchConvsRows = CONV_ROWS
    RESPONSES.fetchConvDetail = CONV_DETAIL
    RESPONSES.fetchConvsError = false
    RESPONSES.updatedConv = (id: string) => ({ id, name: 'Updated' })
    // clear recorded arrays
    Object.keys(recordedInserts).forEach((k) => delete recordedInserts[k])
    Object.keys(recordedUpdates).forEach((k) => delete recordedUpdates[k])
    Object.keys(recordedDeletes).forEach((k) => delete recordedDeletes[k])
  })

  it('fetches conversation list and processes last_message', async () => {
    const { result } = renderHook(() => usePulseConversations(), { wrapper: createWrapper() })

    // initial loading state should be true before the async fetch resolves
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      if (result.current.isSuccess !== true) throw new Error('not ready')
    })

    const data = result.current.data
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(2)
    const c1 = data.find((d: any) => d.id === 'conv-1')
    expect(c1).toBeDefined()
    // last_message should be the most recent message (m2)
    expect(c1.last_message).toBeDefined()
    expect((c1.last_message as any).id).toBe('m2')
  })

  it('reports error when fetchConversations returns an error', async () => {
    RESPONSES.fetchConvsError = true

    const { result } = renderHook(() => usePulseConversations(), { wrapper: createWrapper() })

    await waitFor(() => {
      if (result.current.isError !== true) throw new Error('not errored')
    })

    expect(result.current.error).toBeDefined()
    // underlying mock returns { message: 'fetch error' }
    // react-query wraps but error.message should include our message
    const err = result.current.error as any
    expect(String(err.message || err)).toContain('fetch error')
  })

  it('fetches single conversation detail when id provided', async () => {
    const { result } = renderHook(() => usePulseConversation('conv-1'), { wrapper: createWrapper() })

    await waitFor(() => {
      if (result.current.isSuccess !== true) throw new Error('not ready')
    })

    expect(result.current.data).toBeDefined()
    expect((result.current.data as any).id).toBe('conv-1')
    expect((result.current.data as any).members).toBeDefined()
    expect((result.current.data as any).members.length).toBeGreaterThan(0)
  })

  it('creates a conversation and adds members, calls toast on success', async () => {
    // ensure success path
    RESPONSES.createConvError = false
    RESPONSES.addMembersError = false

    const { result } = renderHook(() => useCreatePulseConversation(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        name: 'New Conversation',
        member_ids: ['u1', 'u2'],
        visibility: 'private',
      } as unknown as Record<string, unknown>)
    })

    expect(mockRpc).toHaveBeenCalledWith('create_pulse_conversation', {
      p_name: 'New Conversation',
      p_description: null,
      p_visibility: 'private',
      p_etablissement_id: null,
      p_metadata: {},
      p_member_ids: ['u1', 'u2'],
    })
    await waitFor(() => {
      expect(result.current.data).toEqual(NEW_CONV)
    })

    expect(toastSuccess).toHaveBeenCalledWith('Conversation créée')
  })

  it('handles error during conversation creation and calls toast.error', async () => {
    RESPONSES.createConvError = true

    const { result } = renderHook(() => useCreatePulseConversation(), { wrapper: createWrapper() })

    let threw = false
    await act(async () => {
      try {
        await result.current.mutateAsync({
          name: 'Should fail',
        } as unknown as Record<string, unknown>)
      } catch (e) {
        threw = true
      }
    })
    expect(threw).toBe(true)
    expect(debugError).toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la création de la conversation')
  })

  it('updates a conversation and invalidates keys, shows success toast', async () => {
    RESPONSES.updateConvError = false

    const { result } = renderHook(() => useUpdatePulseConversation(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'conv-1', name: 'Updated name' } as unknown as Record<string, unknown>)
    })

    // supabase.from should have been called for update
    const fromCalls = mockFrom.mock.calls.map((c) => c[0])
    expect(fromCalls).toContain('pulse_conversations')

    // recorded update should include updated_at and other keys in payload
    const updates = recordedUpdates['pulse_conversations'] || []
    expect(updates.length).toBeGreaterThan(0)
    const lastUpdate = updates[updates.length - 1] as any
    expect(lastUpdate.updated_at).toBeDefined()
    expect(toastSuccess).toHaveBeenCalledWith('Conversation mise à jour')
  })

  it('archives a conversation and includes archived_by in payload', async () => {
    RESPONSES.archiveError = false

    const { result } = renderHook(() => useArchivePulseConversation(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('conv-1')
    })

    expect(mockFrom).toHaveBeenCalled()
    const updates = recordedUpdates['pulse_conversations'] || []
    expect(updates.length).toBeGreaterThan(0)
    const archivedPayload = updates[updates.length - 1] as any
    expect(archivedPayload.is_archived).toBe(true)
    expect(archivedPayload.archived_by).toBe(CURRENT_PROFILE.id)
    expect(toastSuccess).toHaveBeenCalledWith('Conversation archivée')
  })

  it('adds a member and includes invited_by', async () => {
    RESPONSES.addMemberError = false

    const { result } = renderHook(() => useAddPulseConversationMember(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ conversationId: 'conv-1', userId: 'u3', role: 'member' })
    })

    // ensure insert called on members table
    const inserts = recordedInserts['pulse_conversation_members'] || []
    expect(inserts.length).toBeGreaterThan(0)
    const payload = inserts[inserts.length - 1] as any
    // payload may be single object
    expect((payload as any).conversation_id).toBe('conv-1')
    expect((payload as any).user_id).toBe('u3')
    expect((payload as any).invited_by).toBe(CURRENT_PROFILE.id)
    expect(toastSuccess).toHaveBeenCalledWith('Membre ajouté')
  })

  it('removes a member and invalidates detail query, shows toast', async () => {
    RESPONSES.removeMemberError = false

    const { result } = renderHook(() => useRemovePulseConversationMember(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ conversationId: 'conv-1', userId: 'u3' })
    })

    // recorded deletes should include filters with conversation_id and user_id
    const deletes = recordedDeletes['pulse_conversation_members'] || []
    expect(deletes.length).toBeGreaterThan(0)
    const lastDelete = deletes[deletes.length - 1] as any
    expect(lastDelete.conversation_id).toBe('conv-1')
    expect(lastDelete.user_id).toBe('u3')
    expect(toastSuccess).toHaveBeenCalledWith('Membre retiré')
  })

  it('updates a member role and shows success toast', async () => {
    RESPONSES.updateMemberRoleError = false

    const { result } = renderHook(() => useUpdatePulseConversationMemberRole(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ conversationId: 'conv-1', userId: 'u3', role: 'admin' })
    })

    const updates = recordedUpdates['pulse_conversation_members'] || []
    expect(updates.length).toBeGreaterThan(0)
    const last = updates[updates.length - 1] as any
    expect(last.role).toBe('admin')
    expect(toastSuccess).toHaveBeenCalledWith('Rôle mis à jour')
  })
})