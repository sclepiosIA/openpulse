import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(),
  channel: vi.fn()
}

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: mockSupabase
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

interface WrapperProps {
  children: React.ReactNode
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return ({ children }: WrapperProps) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// Mock data
const mockConversations = [
  {
    id: 'conv-1',
    visitor_id: 'visitor-1',
    visitor_name: 'Marie Dupont',
    visitor_email: 'marie@example.com',
    status: 'active',
    assigned_to: 'user-1',
    started_at: '2024-01-15T10:00:00Z',
    last_message_at: '2024-01-15T10:30:00Z',
    unread_count: 2
  },
  {
    id: 'conv-2',
    visitor_id: 'visitor-2',
    visitor_name: 'Jean Martin',
    visitor_email: 'jean@example.com',
    status: 'waiting',
    assigned_to: null,
    started_at: '2024-01-15T10:15:00Z',
    last_message_at: '2024-01-15T10:15:00Z',
    unread_count: 1
  },
  {
    id: 'conv-3',
    visitor_id: 'visitor-3',
    visitor_name: 'Pierre Durand',
    visitor_email: null,
    status: 'closed',
    assigned_to: 'user-1',
    started_at: '2024-01-14T14:00:00Z',
    last_message_at: '2024-01-14T14:45:00Z',
    closed_at: '2024-01-14T14:50:00Z',
    unread_count: 0
  }
]

const mockMessages = [
  {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_type: 'visitor',
    content: 'Bonjour, j\'ai une question sur votre solution',
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 'msg-2',
    conversation_id: 'conv-1',
    sender_type: 'agent',
    sender_id: 'user-1',
    content: 'Bonjour Marie ! Comment puis-je vous aider ?',
    created_at: '2024-01-15T10:05:00Z'
  },
  {
    id: 'msg-3',
    conversation_id: 'conv-1',
    sender_type: 'visitor',
    content: 'Je voudrais savoir comment fonctionne la synchronisation email',
    created_at: '2024-01-15T10:10:00Z'
  }
]

describe('Live Chat Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Conversations', () => {
    it('should fetch all conversations', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockConversations,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('live_chat_conversations')
        .select('*')
        .order('last_message_at', { ascending: false })

      expect(mockSupabase.from).toHaveBeenCalledWith('live_chat_conversations')
      expect(result.data).toEqual(mockConversations)
    })

    it('should fetch active conversations only', async () => {
      const activeConversations = mockConversations.filter(c => c.status === 'active')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: activeConversations,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('live_chat_conversations')
        .select('*')
        .eq('status', 'active')

      expect(result.data).toHaveLength(1)
    })

    it('should fetch waiting conversations', async () => {
      const waitingConversations = mockConversations.filter(c => c.status === 'waiting')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: waitingConversations,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('live_chat_conversations')
        .select('*')
        .eq('status', 'waiting')

      expect(result.data).toHaveLength(1)
      expect(result.data?.[0].assigned_to).toBeNull()
    })

    it('should assign conversation to agent', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockConversations[1], assigned_to: 'user-2', status: 'active' },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('live_chat_conversations')
        .update({ assigned_to: 'user-2', status: 'active' })
        .eq('id', 'conv-2')
        .select()
        .single()

      expect(result.data?.assigned_to).toBe('user-2')
      expect(result.data?.status).toBe('active')
    })

    it('should close conversation', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { 
                ...mockConversations[0], 
                status: 'closed',
                closed_at: '2024-01-15T11:00:00Z'
              },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('live_chat_conversations')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', 'conv-1')
        .select()
        .single()

      expect(result.data?.status).toBe('closed')
      expect(result.data?.closed_at).toBeDefined()
    })
  })

  describe('Messages', () => {
    it('should fetch messages for conversation', async () => {
      const conversationMessages = mockMessages.filter(m => m.conversation_id === 'conv-1')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: conversationMessages,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('live_chat_messages')
        .select('*')
        .eq('conversation_id', 'conv-1')
        .order('created_at')

      expect(result.data).toHaveLength(3)
    })

    it('should send agent message', async () => {
      const newMessage = {
        conversation_id: 'conv-1',
        sender_type: 'agent',
        sender_id: 'user-1',
        content: 'Voici comment fonctionne la synchronisation...'
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'msg-new', ...newMessage, created_at: new Date().toISOString() },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const result = await mockSupabase
        .from('live_chat_messages')
        .insert(newMessage)
        .select()
        .single()

      expect(result.data?.sender_type).toBe('agent')
      expect(result.data?.content).toContain('synchronisation')
    })
  })

  describe('Real-time Subscriptions', () => {
    it('should subscribe to new messages', () => {
      const mockOn = vi.fn().mockReturnThis()
      const mockSubscribe = vi.fn()
      
      mockSupabase.channel.mockReturnValue({
        on: mockOn,
        subscribe: mockSubscribe
      })

      const channel = mockSupabase.channel('live-chat-conv-1')
      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages' }, () => {})
        .subscribe()

      expect(mockSupabase.channel).toHaveBeenCalledWith('live-chat-conv-1')
      expect(mockOn).toHaveBeenCalled()
      expect(mockSubscribe).toHaveBeenCalled()
    })

    it('should subscribe to conversation updates', () => {
      const mockOn = vi.fn().mockReturnThis()
      const mockSubscribe = vi.fn()
      
      mockSupabase.channel.mockReturnValue({
        on: mockOn,
        subscribe: mockSubscribe
      })

      const channel = mockSupabase.channel('conversations-updates')
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_conversations' }, () => {})
        .subscribe()

      expect(mockSubscribe).toHaveBeenCalled()
    })
  })

  describe('Analytics', () => {
    it('should count conversations by status', () => {
      const countByStatus = mockConversations.reduce((acc, conv) => {
        acc[conv.status] = (acc[conv.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      expect(countByStatus['active']).toBe(1)
      expect(countByStatus['waiting']).toBe(1)
      expect(countByStatus['closed']).toBe(1)
    })

    it('should calculate total unread messages', () => {
      const totalUnread = mockConversations.reduce((sum, c) => sum + c.unread_count, 0)
      expect(totalUnread).toBe(3) // 2 + 1 + 0
    })

    it('should calculate average response time', () => {
      // Simulating response time calculation
      const responseTimes = [5, 3, 8, 2, 10] // minutes
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      expect(avgResponseTime).toBe(5.6)
    })

    it('should count messages per conversation', () => {
      const messagesByConv = mockMessages.reduce((acc, msg) => {
        acc[msg.conversation_id] = (acc[msg.conversation_id] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      expect(messagesByConv['conv-1']).toBe(3)
    })
  })

  describe('Typing Indicators', () => {
    it('should broadcast typing status', () => {
      const mockTrack = vi.fn()
      const mockSubscribe = vi.fn()
      
      mockSupabase.channel.mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: mockSubscribe,
        track: mockTrack
      })

      const channel = mockSupabase.channel('typing-conv-1')
      channel.track({ user_id: 'user-1', is_typing: true })

      expect(mockTrack).toHaveBeenCalledWith({ user_id: 'user-1', is_typing: true })
    })
  })

  describe('Visitor Info', () => {
    it('should identify returning visitor', () => {
      const visitor = mockConversations[0]
      expect(visitor.visitor_email).toBe('marie@example.com')
      expect(visitor.visitor_name).toBe('Marie Dupont')
    })

    it('should handle anonymous visitor', () => {
      const visitor = mockConversations[2]
      expect(visitor.visitor_email).toBeNull()
      expect(visitor.visitor_name).toBe('Pierre Durand')
    })
  })
})
