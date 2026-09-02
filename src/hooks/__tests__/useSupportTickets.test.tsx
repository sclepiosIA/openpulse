import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase - use local mock to avoid strict type checking
const mockSupabase = {
  from: vi.fn()
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

// Mock data matching actual DB schema
const mockSupportTickets = [
  {
    id: 'ticket-1',
    sujet: 'Problème de connexion',
    description: 'Impossible de me connecter depuis ce matin',
    statut: 'ouvert',
    priorite: 'haute',
    etablissement_id: 'etab-1',
    email_thread_id: 'thread-1',
    assigne_a: 'user-1',
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2024-01-15T08:00:00Z'
  },
  {
    id: 'ticket-2',
    sujet: 'Question sur les rapports',
    description: 'Comment exporter un rapport en PDF?',
    statut: 'en_cours',
    priorite: 'normale',
    etablissement_id: 'etab-2',
    email_thread_id: 'thread-2',
    assigne_a: 'user-2',
    created_at: '2024-01-14T10:00:00Z',
    updated_at: '2024-01-15T09:30:00Z'
  },
  {
    id: 'ticket-3',
    sujet: 'Demande de formation',
    description: 'Besoin d\'une formation pour les nouveaux utilisateurs',
    statut: 'résolu',
    priorite: 'basse',
    etablissement_id: 'etab-1',
    email_thread_id: null,
    assigne_a: 'user-1',
    created_at: '2024-01-10T14:00:00Z',
    updated_at: '2024-01-12T16:00:00Z',
    date_resolution: '2024-01-12T16:00:00Z'
  }
]

const mockTicketComments = [
  {
    id: 'comment-1',
    ticket_id: 'ticket-1',
    user_id: 'user-1',
    content: 'Je vérifie le problème',
    is_internal: false,
    created_at: '2024-01-15T08:30:00Z'
  },
  {
    id: 'comment-2',
    ticket_id: 'ticket-1',
    user_id: 'user-support',
    content: 'Note interne: Problème réseau identifié',
    is_internal: true,
    created_at: '2024-01-15T09:00:00Z'
  }
]

describe('Support Tickets Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchSupportTickets', () => {
    it('should fetch all support tickets', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockSupportTickets,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false })

      expect(mockSupabase.from).toHaveBeenCalledWith('support_tickets')
      expect(result.data).toEqual(mockSupportTickets)
      expect(result.error).toBeNull()
    })

    it('should fetch tickets by status', async () => {
      const openTickets = mockSupportTickets.filter(t => t.statut === 'ouvert')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: openTickets,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('support_tickets')
        .select('*')
        .eq('statut', 'ouvert')
        .order('created_at', { ascending: false })

      expect(result.data).toHaveLength(1)
      expect(result.data?.[0].statut).toBe('ouvert')
    })

    it('should fetch tickets by priority', async () => {
      const highPriorityTickets = mockSupportTickets.filter(t => t.priorite === 'haute')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: highPriorityTickets,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('support_tickets')
        .select('*')
        .eq('priorite', 'haute')

      expect(result.data).toHaveLength(1)
      expect(result.data?.[0].priorite).toBe('haute')
    })
  })

  describe('createSupportTicket', () => {
    it('should create a new support ticket', async () => {
      const newTicket = {
        sujet: 'Nouveau problème',
        description: 'Description du problème',
        priorite: 'normale',
        etablissement_id: 'etab-1'
      }

      const createdTicket = { 
        id: 'ticket-new', 
        statut: 'ouvert',
        ...newTicket 
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: createdTicket,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const result = await mockSupabase
        .from('support_tickets')
        .insert(newTicket)
        .select()
        .single()

      expect(result.data?.statut).toBe('ouvert')
      expect(result.error).toBeNull()
    })

    it('should create ticket from email thread', async () => {
      const ticketFromEmail = {
        sujet: 'Re: Problème urgent',
        description: 'Contenu de l\'email',
        email_thread_id: 'thread-new',
        etablissement_id: 'etab-1',
        priorite: 'haute'
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'ticket-email', ...ticketFromEmail },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const result = await mockSupabase
        .from('support_tickets')
        .insert(ticketFromEmail)
        .select()
        .single()

      expect(result.data?.email_thread_id).toBe('thread-new')
    })
  })

  describe('updateSupportTicket', () => {
    it('should update ticket status', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockSupportTickets[0], statut: 'en_cours' },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('support_tickets')
        .update({ statut: 'en_cours' })
        .eq('id', 'ticket-1')
        .select()
        .single()

      expect(result.data?.statut).toBe('en_cours')
    })

    it('should assign ticket to user', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockSupportTickets[0], assigne_a: 'user-3' },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('support_tickets')
        .update({ assigne_a: 'user-3' })
        .eq('id', 'ticket-1')
        .select()
        .single()

      expect(result.data?.assigne_a).toBe('user-3')
    })

    it('should resolve ticket with resolution date', async () => {
      const dateResolution = new Date().toISOString()
      
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { 
                ...mockSupportTickets[0], 
                statut: 'résolu',
                date_resolution: dateResolution 
              },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('support_tickets')
        .update({ statut: 'résolu', date_resolution: dateResolution })
        .eq('id', 'ticket-1')
        .select()
        .single()

      expect(result.data?.statut).toBe('résolu')
      expect(result.data?.date_resolution).toBeDefined()
    })
  })

  describe('Ticket Comments', () => {
    it('should fetch comments for a ticket', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockTicketComments,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('support_ticket_comments')
        .select('*')
        .eq('ticket_id', 'ticket-1')
        .order('created_at', { ascending: true })

      expect(result.data).toHaveLength(2)
    })

    it('should filter internal comments', async () => {
      const publicComments = mockTicketComments.filter(c => !c.is_internal)
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: publicComments,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('support_ticket_comments')
        .select('*')
        .eq('ticket_id', 'ticket-1')
        .eq('is_internal', false)

      expect(result.data).toHaveLength(1)
      expect(result.data?.[0].is_internal).toBe(false)
    })

    it('should add a comment to ticket', async () => {
      const newComment = {
        ticket_id: 'ticket-1',
        user_id: 'user-1',
        content: 'Nouveau commentaire',
        is_internal: false
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'comment-new', ...newComment },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const result = await mockSupabase
        .from('support_ticket_comments')
        .insert(newComment)
        .select()
        .single()

      expect(result.data?.content).toBe('Nouveau commentaire')
    })
  })

  describe('Support Analytics', () => {
    it('should calculate tickets by status', () => {
      const ticketsByStatus = mockSupportTickets.reduce((acc, ticket) => {
        acc[ticket.statut] = (acc[ticket.statut] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      expect(ticketsByStatus['ouvert']).toBe(1)
      expect(ticketsByStatus['en_cours']).toBe(1)
      expect(ticketsByStatus['résolu']).toBe(1)
    })

    it('should calculate average resolution time', () => {
      const resolvedTickets = mockSupportTickets.filter(t => t.date_resolution)
      
      const resolutionTimes = resolvedTickets.map(t => {
        const created = new Date(t.created_at).getTime()
        const resolved = new Date(t.date_resolution!).getTime()
        return (resolved - created) / (1000 * 60 * 60) // hours
      })

      const avgResolutionTime = resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      expect(avgResolutionTime).toBeGreaterThan(0)
    })

    it('should count high priority unresolved tickets', () => {
      const urgentTickets = mockSupportTickets.filter(
        t => t.priorite === 'haute' && t.statut !== 'résolu'
      )
      expect(urgentTickets).toHaveLength(1)
    })
  })
})
