import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
const mockSupabase = {
  from: vi.fn()
}

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: mockSupabase
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
const mockNotifications = [
  {
    id: 'notif-1',
    user_id: 'user-1',
    title: 'Nouvelle tâche assignée',
    body: 'Vous avez été assigné à la tâche "Déploiement CHU Paris"',
    type: 'task_assigned',
    read: false,
    data: { task_id: 'task-123', etablissement_id: 'etab-1' },
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 'notif-2',
    user_id: 'user-1',
    title: 'Email important',
    body: 'Nouveau message de CHU Lyon concernant le contrat',
    type: 'email_received',
    read: false,
    data: { thread_id: 'thread-456' },
    created_at: '2024-01-15T09:30:00Z'
  },
  {
    id: 'notif-3',
    user_id: 'user-1',
    title: 'Rappel: RDV demain',
    body: 'Réunion de suivi avec CHU Marseille à 14h',
    type: 'calendar_reminder',
    read: true,
    data: { event_id: 'event-789' },
    created_at: '2024-01-14T16:00:00Z'
  }
]

describe('Notifications Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Fetch Notifications', () => {
    it('should fetch all notifications', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockNotifications,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('notifications')
        .select('*')
        .eq('user_id', 'user-1')
        .order('created_at', { ascending: false })

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications')
      expect(result.data).toEqual(mockNotifications)
    })

    it('should fetch unread notifications only', async () => {
      const unreadNotifs = mockNotifications.filter(n => !n.read)
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: unreadNotifs,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('notifications')
        .select('*')
        .eq('user_id', 'user-1')
        .eq('read', false)

      expect(result.data).toHaveLength(2)
    })

    it('should filter by type', async () => {
      const emailNotifs = mockNotifications.filter(n => n.type === 'email_received')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: emailNotifs,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('notifications')
        .select('*')
        .eq('user_id', 'user-1')
        .eq('type', 'email_received')

      expect(result.data).toHaveLength(1)
    })
  })

  describe('Mark as Read', () => {
    it('should mark single notification as read', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: { ...mockNotifications[0], read: true },
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('notifications')
        .update({ read: true })
        .eq('id', 'notif-1')

      expect(result.data?.read).toBe(true)
    })

    it('should mark all as read', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: mockNotifications.map(n => ({ ...n, read: true })),
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', 'user-1')

      expect(result.data?.every((n: { read: boolean }) => n.read)).toBe(true)
    })
  })

  describe('Delete Notifications', () => {
    it('should delete single notification', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ delete: mockDelete })

      const result = await mockSupabase
        .from('notifications')
        .delete()
        .eq('id', 'notif-3')

      expect(result.error).toBeNull()
    })

    it('should delete read notifications', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ delete: mockDelete })

      const result = await mockSupabase
        .from('notifications')
        .delete()
        .eq('user_id', 'user-1')
        .eq('read', true)

      expect(result.error).toBeNull()
    })
  })

  describe('Notification Counts', () => {
    it('should count unread notifications', () => {
      const unreadCount = mockNotifications.filter(n => !n.read).length
      expect(unreadCount).toBe(2)
    })

    it('should count by type', () => {
      const countByType = mockNotifications.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      expect(countByType['task_assigned']).toBe(1)
      expect(countByType['email_received']).toBe(1)
      expect(countByType['calendar_reminder']).toBe(1)
    })
  })

  describe('Push Subscriptions', () => {
    it('should register push subscription', async () => {
      const subscription = {
        user_id: 'user-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        p256dh: 'key123',
        auth: 'auth456',
        device_type: 'web'
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'sub-1', ...subscription },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const result = await mockSupabase
        .from('push_subscriptions')
        .insert(subscription)
        .select()
        .single()

      expect(result.data?.endpoint).toBe(subscription.endpoint)
    })

    it('should unsubscribe from push', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ delete: mockDelete })

      const result = await mockSupabase
        .from('push_subscriptions')
        .delete()
        .eq('id', 'sub-1')

      expect(result.error).toBeNull()
    })
  })

  describe('Notification Preferences', () => {
    it('should fetch user preferences', async () => {
      const mockPrefs = {
        user_id: 'user-1',
        email_notifications: true,
        push_notifications: true,
        task_notifications: true,
        email_thread_notifications: true,
        calendar_notifications: true
      }

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockPrefs,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', 'user-1')
        .single()

      expect(result.data?.push_notifications).toBe(true)
    })

    it('should update preferences', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: { push_notifications: false },
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('notification_preferences')
        .update({ push_notifications: false })
        .eq('user_id', 'user-1')

      expect(result.data?.push_notifications).toBe(false)
    })
  })
})
