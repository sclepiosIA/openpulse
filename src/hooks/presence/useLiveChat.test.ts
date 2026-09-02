// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// @vitest-environment jsdom
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'

const {
  CONVERSATIONS,
  SINGLE_CONVERSATION,
  MESSAGES,
  AGENTS,
  CURRENT_PROFILE,
  CREATED_CONVERSATION,
  CREATED_MESSAGE,
  TICKET,
  mockFrom,
  mockToast,
  mockSanitize,
  mockUseCurrentProfile,
  invalidateQueriesSpy,
  removeChannelSpy,
  channelOnSpy,
  channelSubscribeSpy,
  builder,
  builderState,
} = vi.hoisted(() => {
  const CONVERSATIONS = [
    {
      id: 'conv-1',
      visitor_id: 'visitor-1',
      visitor_name: 'Alice',
      visitor_email: 'alice@example.test',
      etablissement_id: 'eta-1',
      assigned_to: 'agent-1',
      status: 'active',
      priority: 'normal',
      source: 'widget',
      tags: ['vip'],
      created_at: '2024-01-01T10:00:00.000Z',
      updated_at: '2024-01-01T11:00:00.000Z',
      etablissement: { id: 'eta-1', nom: 'Hotel Bleu' },
      assigned_agent: { id: 'agent-1', nom: 'Doe', prenom: 'Jane' },
    },
    {
      id: 'conv-2',
      visitor_id: 'visitor-2',
      visitor_name: 'Bob',
      visitor_email: 'bob@example.test',
      etablissement_id: 'eta-2',
      assigned_to: null,
      status: 'waiting',
      priority: 'urgent',
      source: 'widget',
      tags: [],
      created_at: '2024-01-02T10:00:00.000Z',
      updated_at: '2024-01-02T11:00:00.000Z',
      etablissement: { id: 'eta-2', nom: 'Hotel Vert' },
      assigned_agent: null,
    },
  ]

  const SINGLE_CONVERSATION = {
    id: 'conv-1',
    visitor_id: 'visitor-1',
    visitor_name: 'Alice',
    visitor_email: 'alice@example.test',
    etablissement_id: 'eta-1',
    assigned_to: 'agent-1',
    status: 'active',
    priority: 'normal',
    source: 'widget',
    tags: ['vip'],
    created_at: '2024-01-01T10:00:00.000Z',
    updated_at: '2024-01-01T11:00:00.000Z',
    etablissement: { id: 'eta-1', nom: 'Hotel Bleu' },
    assigned_agent: { id: 'agent-1', nom: 'Doe', prenom: 'Jane' },
  }

  const MESSAGES = [
    {
      id: 'msg-1',
      session_id: 'conv-1',
      sender_type: 'visitor',
      sender_id: null,
      sender_name: 'Alice',
      content: 'Bonjour',
      read_at: null,
      created_at: '2024-01-01T10:01:00.000Z',
      sender: null,
    },
    {
      id: 'msg-2',
      session_id: 'conv-1',
      sender_type: 'agent',
      sender_id: 'profile-1',
      sender_name: 'Jane',
      content: 'Comment puis-je aider ?',
      read_at: null,
      created_at: '2024-01-01T10:02:00.000Z',
      sender: { id: 'profile-1', nom: 'Doe', prenom: 'Jane' },
    },
  ]

  const AGENTS = [
    {
      id: 'agent-row-1',
      profile_id: 'profile-1',
      is_available: true,
      max_concurrent_chats: 3,
      current_chat_count: 1,
      specialties: ['support'],
      last_active_at: '2024-01-01T12:00:00.000Z',
      created_at: '2024-01-01T09:00:00.000Z',
      updated_at: '2024-01-01T12:00:00.000Z',
      profile: { id: 'profile-1', nom: 'Doe', prenom: 'Jane', avatar_url: null },
    },
  ]

  const CURRENT_PROFILE = { id: 'profile-1', nom: 'Doe', prenom: 'Jane' }

  const CREATED_CONVERSATION = {
    id: 'conv-new',
    etablissement_id: 'eta-1',
    visitor_id: 'generated-visitor',
    visitor_name: 'Charlie',
    visitor_email: 'charlie@example.test',
    assigned_to: null,
    status: 'waiting',
    priority: 'normal',
    source: 'widget',
    tags: [],
    created_at: '2024-01-03T10:00:00.000Z',
    updated_at: '2024-01-03T10:00:00.000Z',
  }

  const CREATED_MESSAGE = {
    id: 'msg-new',
    session_id: 'conv-1',
    sender_type: 'agent',
    sender_id: 'profile-1',
    sender_name: 'Jane',
    content: 'Réponse agent',
    read_at: null,
    created_at: '2024-01-01T10:03:00.000Z',
  }

  const TICKET = {
    id: 'ticket-1',
    titre: 'Sujet',
    description: 'Description',
    statut: 'open',
    priorite: 'high',
    etablissement_id: 'eta-2',
  }

  const builderState = {
    table: '',
    resultData: null as unknown,
    resultError: null as { message: string } | null,
    maybeSingleData: null as unknown,
    maybeSingleError: null as { message: string } | null,
    singleData: null as unknown,
    singleError: null as { message: string } | null,
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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: builderState.singleData, error: builderState.singleError })),
    maybeSingle: vi.fn(async () => ({
      data: builderState.maybeSingleData,
      error: builderState.maybeSingleError,
    })),
    then: (onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) =>
      Promise.resolve(
        onFulfilled({ data: builderState.resultData, error: builderState.resultError })
      ),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
  }

  const mockFrom = vi.fn((table: string) => {
    builderState.table = table
    return builder
  })

  const mockToast = vi.fn()
  const mockSanitize = vi.fn((error: Error | { message?: string }) => error.message ?? 'sanitized')
  const mockUseCurrentProfile = vi.fn(() => ({ data: CURRENT_PROFILE }))
  const invalidateQueriesSpy = vi.fn()
  const removeChannelSpy = vi.fn()
  const channelOnSpy = vi.fn()
  const channelSubscribeSpy = vi.fn()

  return {
    CONVERSATIONS,
    SINGLE_CONVERSATION,
    MESSAGES,
    AGENTS,
    CURRENT_PROFILE,
    CREATED_CONVERSATION,
    CREATED_MESSAGE,
    TICKET,
    mockFrom,
    mockToast,
    mockSanitize,
    mockUseCurrentProfile,
    invalidateQueriesSpy,
    removeChannelSpy,
    channelOnSpy,
    channelSubscribeSpy,
    builder,
    builderState,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: vi.fn(() => {
      const channel = {
        on: channelOnSpy,
        subscribe: channelSubscribeSpy,
      }
      channelOnSpy.mockReturnValue(channel)
      channelSubscribeSpy.mockReturnValue(channel)
      return channel
    }),
    removeChannel: removeChannelSpy,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitize,
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: mockUseCurrentProfile,
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    frequent: {
      staleTime: 30000,
    },
  },
}))

import * as LiveChatModule from './useLiveChat'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(invalidateQueriesSpy)

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return {
    queryClient,
    wrapper,
  }
}

function resetBuilder() {
  builder.select.mockClear()
  builder.eq.mockClear()
  builder.gte.mockClear()
  builder.lte.mockClear()
  builder.in.mockClear()
  builder.order.mockClear()
  builder.limit.mockClear()
  builder.insert.mockClear()
  builder.update.mockClear()
  builder.delete.mockClear()
  builder.upsert.mockClear()
  builder.single.mockClear()
  builder.maybeSingle.mockClear()
  mockFrom.mockClear()
  mockToast.mockClear()
  mockSanitize.mockClear()
  invalidateQueriesSpy.mockClear()
  removeChannelSpy.mockClear()
  channelOnSpy.mockClear()
  channelSubscribeSpy.mockClear()
  mockUseCurrentProfile.mockReset()
  mockUseCurrentProfile.mockReturnValue({ data: CURRENT_PROFILE })
  builderState.table = ''
  builderState.resultData = null
  builderState.resultError = null
  builderState.maybeSingleData = null
  builderState.maybeSingleError = null
  builderState.singleData = null
  builderState.singleError = null
}

describe('useLiveChat', () => {
  beforeEach(() => {
    resetBuilder()
  })

  it('charge les conversations puis expose les données filtrées', async () => {
    builderState.resultData = CONVERSATIONS
    const { wrapper } = createWrapper()

    const { result, unmount } = renderHook(
      () => LiveChatModule.useLiveChatConversations({ status: 'active', assigned_to: 'agent-1' }),
      { wrapper }
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('live_chat_conversations')
    expect(builder.eq).toHaveBeenCalledWith('status', 'active')
    expect(builder.eq).toHaveBeenCalledWith('assigned_to', 'agent-1')
    expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(500)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].visitor_name).toBe('Alice')
    expect(result.current.data?.[1].status).toBe('waiting')

    unmount()
    expect(removeChannelSpy).toHaveBeenCalledTimes(1)
  })

  it('met la query en erreur pour les conversations si supabase échoue', async () => {
    builderState.resultError = { message: 'boom conversations' }
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => LiveChatModule.useLiveChatConversations(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('boom conversations')
  })

  it('charge une conversation unique', async () => {
    builderState.maybeSingleData = SINGLE_CONVERSATION
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => LiveChatModule.useLiveChatConversation('conv-1'), {
      wrapper,
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('live_chat_conversations')
    expect(builder.eq).toHaveBeenCalledWith('id', 'conv-1')
    expect(builder.maybeSingle).toHaveBeenCalled()
    expect(result.current.data?.id).toBe('conv-1')
    expect(result.current.data?.etablissement?.nom).toBe('Hotel Bleu')
  })

  it('met la query conversation unique en erreur si supabase échoue', async () => {
    builderState.maybeSingleError = { message: 'conversation failed' }
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => LiveChatModule.useLiveChatConversation('conv-1'), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('conversation failed')
  })

  it('crée une conversation et invalide la liste', async () => {
    builderState.singleData = CREATED_CONVERSATION
    vi.stubGlobal('crypto', { randomUUID: () => 'generated-visitor' })
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => LiveChatModule.useCreateConversation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        visitor_name: 'Charlie',
        visitor_email: 'charlie@example.test',
        etablissement_id: 'eta-1',
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('live_chat_conversations')
    expect(builder.insert).toHaveBeenCalledWith({
      visitor_id: 'generated-visitor',
      visitor_name: 'Charlie',
      visitor_email: 'charlie@example.test',
      etablissement_id: 'eta-1',
      source: 'widget',
      status: 'waiting',
    })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['live-chat-conversations'] })
  })

  it('remonte une erreur de création de conversation via toast', async () => {
    builderState.singleError = { message: 'insert failed' }
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => LiveChatModule.useCreateConversation(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          visitor_name: 'Charlie',
          visitor_email: 'charlie@example.test',
          etablissement_id: 'eta-1',
        })
      ).rejects.toMatchObject({ message: 'insert failed' })
    })

    expect(mockSanitize).toHaveBeenCalled()
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'insert failed',
      variant: 'destructive',
    })
  })

  it('met à jour une conversation en retirant les champs non persistés', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => LiveChatModule.useUpdateConversation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'conv-1',
        status: 'resolved',
        assigned_to: 'agent-1',
        etablissement: { id: 'eta-1', nom: 'Hotel Bleu' },
        assigned_agent: { id: 'agent-1' },
        messages: [],
        last_message: null,
        unread_count: 3,
        visitor_metadata: { locale: 'fr' },
      } as Partial<{
        id: string
        status: string
        assigned_to: string
        etablissement: { id: string; nom: string }
        assigned_agent: { id: string }
        messages: unknown[]
        last_message: null
        unread_count: number
        visitor_metadata: { locale: string }
      }> & { id: string })
    })

    expect(builder.update).toHaveBeenCalledWith({
      status: 'resolved',
      assigned_to: 'agent-1',
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 'conv-1')
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['live-chat-conversations'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['live-chat-conversation', 'conv-1'],
    })
  })

  it('assigne une conversation et affiche un toast de succès', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => LiveChatModule.useAssignConversation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ conversationId: 'conv-1', agentId: 'agent-2' })
    })

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        assigned_to: 'agent-2',
        status: 'active',
        first_response_at: expect.any(String),
      })
    )
    expect(builder.eq).toHaveBeenCalledWith('id', 'conv-1')
    expect(mockToast).toHaveBeenCalledWith({ title: 'Conversation assignée' })
  })

  it('résout une conversation', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => LiveChatModule.useResolveConversation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('conv-1')
    })

    expect(builder.update).toHaveBeenCalledWith({
      status: 'resolved',
      resolved_at: expect.any(String),
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 'conv-1')
    expect(mockToast).toHaveBeenCalledWith({ title: 'Conversation résolue' })
  })

  it('escalade une conversation avec sa raison', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => LiveChatModule.useEscalateConversation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ conversationId: 'conv-1', reason: 'Besoin expert' })
    })

    expect(builder.update).toHaveBeenCalledWith({
      status: 'escalated',
      escalated_at: expect.any(String),
      escalated_reason: 'Besoin expert',
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 'conv-1')
    expect(mockToast).toHaveBeenCalledWith({ title: 'Conversation escaladée' })
  })

  it('crée un ticket depuis une conversation urgente puis relie la conversation', async () => {
    builder.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'conv-2',
        etablissement_id: 'eta-2',
        priority: 'urgent',
        status: 'waiting',
        ticket_id: null,
      },
      error: null,
    })
    builder.single.mockResolvedValueOnce({ data: TICKET, error: null })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => LiveChatModule.useCreateTicketFromChat(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        conversationId: 'conv-2',
        subject: 'Sujet',
        description: 'Description',
      })
    })

    expect(builder.insert).toHaveBeenCalledWith([
      {
        titre: 'Sujet',
        description: 'Description',
        etablissement_id: 'eta-2',
        statut: 'open',
        priorite: 'high',
      },
    ])
    expect(builder.update).toHaveBeenCalledWith({
      status: 'ticket_created',
      ticket_id: 'ticket-1',
    })
    expect(mockToast).toHaveBeenCalledWith({ title: 'Ticket créé avec succès' })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['support-tickets'] })
  })

  it('charge les messages d une conversation', async () => {
    builderState.resultData = MESSAGES
    const { wrapper } = createWrapper()

    const { result, unmount } = renderHook(() => LiveChatModule.useLiveChatMessages('conv-1'), {
      wrapper,
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('live_chat_messages')
    expect(builder.eq).toHaveBeenCalledWith('conversation_id', 'conv-1')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(builder.limit).toHaveBeenCalledWith(1000)
    expect(result.current.data?.[0].content).toBe('Bonjour')
    expect(result.current.data?.[1].sender_type).toBe('agent')

    unmount()
    expect(removeChannelSpy).toHaveBeenCalledTimes(1)
  })

  it('met la query messages en erreur si supabase échoue', async () => {
    builderState.resultError = { message: 'messages failed' }
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => LiveChatModule.useLiveChatMessages('conv-1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('messages failed')
  })

  it('envoie un message agent avec le profile courant puis touche updated_at de la conversation', async () => {
    builder.single.mockResolvedValueOnce({ data: CREATED_MESSAGE, error: null })
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => LiveChatModule.useSendMessage(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        conversationId: 'conv-1',
        content: 'Réponse agent',
      })
    })

    expect(builder.insert).toHaveBeenCalledWith({
      session_id: 'conv-1',
      content: 'Réponse agent',
      sender_type: 'agent',
      sender_id: 'profile-1',
    })
    expect(builder.update).toHaveBeenCalledWith({
      updated_at: expect.any(String),
    })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['live-chat-messages', 'conv-1'],
    })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['live-chat-conversations'] })
  })

  it('charge les agents live chat', async () => {
    builderState.resultData = AGENTS
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => LiveChatModule.useLiveChatAgents(), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('live_chat_agents')
    expect(builder.order).toHaveBeenCalledWith('is_available', { ascending: false })
    expect(result.current.data?.[0].profile.prenom).toBe('Jane')
    expect(result.current.data?.[0].current_chat_count).toBe(1)
  })

  it('met la query agents en erreur si supabase échoue', async () => {
    builderState.resultError = { message: 'agents failed' }
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => LiveChatModule.useLiveChatAgents(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('agents failed')
  })

  it('bascule la disponibilité de l agent via upsert et affiche le bon toast', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => LiveChatModule.useToggleAgentAvailability(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(true)
    })

    expect(builder.upsert).toHaveBeenCalledWith(
      {
        profile_id: 'profile-1',
        is_available: true,
        last_active_at: expect.any(String),
      },
      {
        onConflict: 'profile_id',
      }
    )
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['live-chat-agents'] })
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Vous êtes maintenant disponible',
    })
  })

  it('retourne une erreur si on change la disponibilité sans profil courant', async () => {
    mockUseCurrentProfile.mockReturnValue({ data: null })
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => LiveChatModule.useToggleAgentAvailability(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync(true)).rejects.toMatchObject({
        message: 'Non authentifié',
      })
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Non authentifié',
      variant: 'destructive',
    })
  })
})
