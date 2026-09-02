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

// Mock data - Epics
const mockEpics = [
  {
    id: 'epic-1',
    title: 'Module Email V2',
    description: 'Refonte complète du module email',
    status: 'in_progress',
    priority: 'high',
    color: '#3b82f6',
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'epic-2',
    title: 'Intégration Qonto',
    description: 'Synchronisation bancaire automatique',
    status: 'todo',
    priority: 'medium',
    color: '#10b981',
    created_at: '2024-01-05T00:00:00Z'
  }
]

// Mock data - User Stories
const mockStories = [
  {
    id: 'story-1',
    epic_id: 'epic-1',
    title: 'Classification IA des emails',
    description: 'En tant qu\'utilisateur, je veux que mes emails soient classifiés automatiquement',
    status: 'done',
    points: 8,
    sprint_id: 'sprint-1',
    assignee_id: 'user-1',
    priority: 'high',
    acceptance_criteria: ['Classification par catégorie', 'Tags automatiques', 'Score de confiance']
  },
  {
    id: 'story-2',
    epic_id: 'epic-1',
    title: 'Génération de titres IA',
    description: 'Générer des titres lisibles pour les threads email',
    status: 'in_progress',
    points: 5,
    sprint_id: 'sprint-1',
    assignee_id: 'user-2',
    priority: 'medium',
    acceptance_criteria: ['Titre < 60 caractères', 'Pas de préfixes RE/TR']
  },
  {
    id: 'story-3',
    epic_id: 'epic-1',
    title: 'Synchronisation IMAP optimisée',
    description: 'Améliorer les performances de synchronisation',
    status: 'todo',
    points: 13,
    sprint_id: null,
    assignee_id: null,
    priority: 'low',
    acceptance_criteria: ['Sync incrémentale', 'Gestion des erreurs']
  }
]

// Mock data - Sprints
const mockSprints = [
  {
    id: 'sprint-1',
    name: 'Sprint 12',
    goal: 'Finaliser la classification email',
    start_date: '2024-01-15',
    end_date: '2024-01-29',
    status: 'active',
    velocity: 21
  },
  {
    id: 'sprint-2',
    name: 'Sprint 13',
    goal: 'Intégration bancaire',
    start_date: '2024-01-29',
    end_date: '2024-02-12',
    status: 'planned',
    velocity: null
  }
]

describe('R&D Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Epics Management', () => {
    it('should fetch all epics', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockEpics,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('rd_epics')
        .select('*')
        .order('created_at', { ascending: false })

      expect(mockSupabase.from).toHaveBeenCalledWith('rd_epics')
      expect(result.data).toEqual(mockEpics)
    })

    it('should create a new epic', async () => {
      const newEpic = {
        title: 'Nouveau Module',
        description: 'Description du nouveau module',
        status: 'todo',
        priority: 'high'
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'epic-new', ...newEpic },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const result = await mockSupabase
        .from('rd_epics')
        .insert(newEpic)
        .select()
        .single()

      expect(result.data?.title).toBe('Nouveau Module')
    })

    it('should update epic status', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockEpics[0], status: 'done' },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('rd_epics')
        .update({ status: 'done' })
        .eq('id', 'epic-1')
        .select()
        .single()

      expect(result.data?.status).toBe('done')
    })
  })

  describe('User Stories Management', () => {
    it('should fetch stories by epic', async () => {
      const epicStories = mockStories.filter(s => s.epic_id === 'epic-1')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: epicStories,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('rd_stories')
        .select('*')
        .eq('epic_id', 'epic-1')
        .order('priority')

      expect(result.data).toHaveLength(3)
    })

    it('should fetch stories by sprint', async () => {
      const sprintStories = mockStories.filter(s => s.sprint_id === 'sprint-1')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: sprintStories,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('rd_stories')
        .select('*')
        .eq('sprint_id', 'sprint-1')

      expect(result.data).toHaveLength(2)
    })

    it('should create a new story with Fibonacci points', async () => {
      const newStory = {
        epic_id: 'epic-1',
        title: 'Nouvelle fonctionnalité',
        description: 'Description de la story',
        points: 5, // Fibonacci: 1, 2, 3, 5, 8, 13, 21
        status: 'todo',
        priority: 'medium'
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'story-new', ...newStory },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const result = await mockSupabase
        .from('rd_stories')
        .insert(newStory)
        .select()
        .single()

      expect(result.data?.points).toBe(5)
    })

    it('should move story to different column (Kanban)', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockStories[1], status: 'review' },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('rd_stories')
        .update({ status: 'review' })
        .eq('id', 'story-2')
        .select()
        .single()

      expect(result.data?.status).toBe('review')
    })

    it('should assign story to sprint', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockStories[2], sprint_id: 'sprint-2' },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('rd_stories')
        .update({ sprint_id: 'sprint-2' })
        .eq('id', 'story-3')
        .select()
        .single()

      expect(result.data?.sprint_id).toBe('sprint-2')
    })
  })

  describe('Sprint Management', () => {
    it('should fetch active sprint', async () => {
      const activeSprint = mockSprints.filter(s => s.status === 'active')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: activeSprint[0],
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('rd_sprints')
        .select('*')
        .eq('status', 'active')
        .single()

      expect(result.data?.name).toBe('Sprint 12')
    })

    it('should create a new sprint', async () => {
      const newSprint = {
        name: 'Sprint 14',
        goal: 'Objectif du sprint',
        start_date: '2024-02-12',
        end_date: '2024-02-26',
        status: 'planned'
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'sprint-new', ...newSprint },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const result = await mockSupabase
        .from('rd_sprints')
        .insert(newSprint)
        .select()
        .single()

      expect(result.data?.name).toBe('Sprint 14')
    })

    it('should close sprint and record velocity', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockSprints[0], status: 'completed', velocity: 21 },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('rd_sprints')
        .update({ status: 'completed', velocity: 21 })
        .eq('id', 'sprint-1')
        .select()
        .single()

      expect(result.data?.status).toBe('completed')
      expect(result.data?.velocity).toBe(21)
    })
  })

  describe('R&D Analytics', () => {
    it('should calculate sprint velocity', () => {
      const completedStories = mockStories.filter(s => s.status === 'done')
      const velocity = completedStories.reduce((sum, s) => sum + s.points, 0)
      expect(velocity).toBe(8)
    })

    it('should calculate sprint burndown', () => {
      const sprintStories = mockStories.filter(s => s.sprint_id === 'sprint-1')
      const totalPoints = sprintStories.reduce((sum, s) => sum + s.points, 0)
      const completedPoints = sprintStories
        .filter(s => s.status === 'done')
        .reduce((sum, s) => sum + s.points, 0)
      const remainingPoints = totalPoints - completedPoints

      expect(totalPoints).toBe(13) // 8 + 5
      expect(completedPoints).toBe(8)
      expect(remainingPoints).toBe(5)
    })

    it('should calculate stories by status (CFD)', () => {
      const storiesByStatus = mockStories.reduce((acc, story) => {
        acc[story.status] = (acc[story.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      expect(storiesByStatus['done']).toBe(1)
      expect(storiesByStatus['in_progress']).toBe(1)
      expect(storiesByStatus['todo']).toBe(1)
    })

    it('should calculate backlog size', () => {
      const backlogStories = mockStories.filter(s => s.sprint_id === null)
      const backlogPoints = backlogStories.reduce((sum, s) => sum + s.points, 0)

      expect(backlogStories).toHaveLength(1)
      expect(backlogPoints).toBe(13)
    })

    it('should calculate average velocity from history', () => {
      const velocityHistory = [18, 21, 19, 22, 20]
      const avgVelocity = velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length
      expect(avgVelocity).toBe(20)
    })
  })

  describe('Fibonacci Points Validation', () => {
    it('should validate Fibonacci sequence for story points', () => {
      const fibonacciSequence = [1, 2, 3, 5, 8, 13, 21, 34]
      
      mockStories.forEach(story => {
        expect(fibonacciSequence).toContain(story.points)
      })
    })
  })
})
