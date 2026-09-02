// @vitest-environment jsdom

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGanttDragDrop } from './useGanttDragDrop'

const {
  TOAST_FN,
  MUTATE_ASYNC,
  SANITIZE_FN,
  DEBUG_WARN,
  DEBUG_ERROR,
  TACHE_KEYS,
  AUTH_STATE,
  TASK_ONE,
  TASK_TWO,
} = vi.hoisted(() => ({
  TOAST_FN: vi.fn(),
  MUTATE_ASYNC: vi.fn(),
  SANITIZE_FN: vi.fn(),
  DEBUG_WARN: vi.fn(),
  DEBUG_ERROR: vi.fn(),
  TACHE_KEYS: {
    lists: () => ['taches', 'list'] as const,
  },
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  TASK_ONE: {
    id: 'task-1',
    date_debut: '2024-01-06',
    echeance: '2024-01-10',
    created_at: '2024-01-02T00:00:00.000Z',
    titre: 'A',
  },
  TASK_TWO: {
    id: 'task-2',
    date_debut: '2024-01-03',
    echeance: null,
    created_at: '2024-01-03T00:00:00.000Z',
    titre: 'B',
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    warn: DEBUG_WARN,
    error: DEBUG_ERROR,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: SANITIZE_FN,
}))

vi.mock('@/hooks/tasks/useTaches', () => ({
  useUpdateTache: () => ({
    mutateAsync: MUTATE_ASYNC,
    isPending: false,
    isError: false,
    error: null,
  }),
  tacheKeys: TACHE_KEYS,
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

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { wrapper, queryClient }
}

describe('useGanttDragDrop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    SANITIZE_FN.mockReturnValue('Erreur nettoyée')
    MUTATE_ASYNC.mockResolvedValue({ data: { id: 'task-1' }, error: null })
  })

  it('initialise correctement et calcule les infos de drag au démarrage', async () => {
    const { wrapper } = createWrapper()
    const containerRef = { current: document.createElement('div') }
    const timeline = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
      pixelsPerDay: 20,
    }

    const { result } = renderHook(() => useGanttDragDrop(timeline, containerRef), { wrapper })

    expect(result.current.isDragging).toBe(false)
    expect(result.current.draggedTaskId).toBeNull()
    expect(result.current.dragStartInfo).toBeNull()
    expect(result.current.sensors).toBeDefined()

    act(() => {
      result.current.handleDragStart('task-1', TASK_ONE)
    })

    await waitFor(() => {
      expect(result.current.isDragging).toBe(true)
      expect(result.current.draggedTaskId).toBe('task-1')
      expect(result.current.dragStartInfo).toEqual({
        taskId: 'task-1',
        originalLeft: 100,
        originalStartDate: new Date('2024-01-06'),
        originalEndDate: new Date('2024-01-10'),
      })
    })
  })

  it('met à jour le cache, appelle la mutation et affiche un toast de succès lors d’un déplacement', async () => {
    const { wrapper, queryClient } = createWrapper()
    const containerRef = { current: document.createElement('div') }
    const timeline = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
      pixelsPerDay: 20,
    }

    queryClient.setQueryData(TACHE_KEYS.lists(), [TASK_ONE, TASK_TWO])

    const { result } = renderHook(() => useGanttDragDrop(timeline, containerRef), { wrapper })

    act(() => {
      result.current.handleDragStart('task-1', TASK_ONE)
    })

    await act(async () => {
      await result.current.handleDragEnd(
        { delta: { x: 40, y: 0 } } as never,
        TASK_ONE
      )
    })

    expect(MUTATE_ASYNC).toHaveBeenCalledWith({
      id: 'task-1',
      data: {
        date_debut: '2024-01-08',
        echeance: '2024-01-12',
      },
    })

    expect(queryClient.getQueryData(TACHE_KEYS.lists())).toEqual([
      {
        ...TASK_ONE,
        date_debut: '2024-01-08',
        echeance: '2024-01-12',
      },
      TASK_TWO,
    ])

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Tâche déplacée',
      description: '+2 jour(s) → 2024-01-08 - 2024-01-12',
    })
    expect(result.current.draggedTaskId).toBeNull()
    expect(result.current.dragStartInfo).toBeNull()
    expect(result.current.isDragging).toBe(false)
  })

  it('ignore les micro-mouvements et ne lance pas de mutation', async () => {
    const { wrapper } = createWrapper()
    const containerRef = { current: document.createElement('div') }
    const timeline = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
      pixelsPerDay: 20,
    }

    const { result } = renderHook(() => useGanttDragDrop(timeline, containerRef), { wrapper })

    act(() => {
      result.current.handleDragStart('task-1', {
        id: 'task-1',
        date_debut: '2024-01-06',
        echeance: null,
        created_at: '2024-01-02T00:00:00.000Z',
      })
    })

    await act(async () => {
      await result.current.handleDragEnd(
        { delta: { x: 9, y: 0 } } as never,
        {
          id: 'task-1',
          date_debut: '2024-01-06',
          echeance: null,
          created_at: '2024-01-02T00:00:00.000Z',
        }
      )
    })

    expect(MUTATE_ASYNC).not.toHaveBeenCalled()
    expect(TOAST_FN).not.toHaveBeenCalled()
    expect(result.current.draggedTaskId).toBeNull()
    expect(result.current.dragStartInfo).toBeNull()
    expect(result.current.isDragging).toBe(false)
  })

  it('retourne une position projetée snapée au jour le plus proche', () => {
    const { wrapper } = createWrapper()
    const containerRef = { current: document.createElement('div') }
    const timeline = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
      pixelsPerDay: 20,
    }

    const { result } = renderHook(() => useGanttDragDrop(timeline, containerRef), { wrapper })

    expect(result.current.getProjectedPosition(15, 40)).toBe(60)
    expect(result.current.getProjectedPosition(-100, 20)).toBe(0)
    expect(result.current.getProjectedPosition(21, 0)).toBe(20)
  })

  it('gère les erreurs de mutation avec rollback et toast destructif', async () => {
    const { wrapper, queryClient } = createWrapper()
    const containerRef = { current: document.createElement('div') }
    const timeline = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
      pixelsPerDay: 20,
    }

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    MUTATE_ASYNC.mockRejectedValueOnce({ data: null, error: { message: 'x' } })
    SANITIZE_FN.mockReturnValueOnce('x')

    queryClient.setQueryData(TACHE_KEYS.lists(), [
      {
        id: 'task-1',
        date_debut: '2024-01-06',
        echeance: null,
        created_at: '2024-01-02T00:00:00.000Z',
      },
    ])

    const { result } = renderHook(() => useGanttDragDrop(timeline, containerRef), { wrapper })

    await act(async () => {
      await result.current.handleDragEnd(
        { delta: { x: 20, y: 0 } } as never,
        {
          id: 'task-1',
          date_debut: '2024-01-06',
          echeance: null,
          created_at: '2024-01-02T00:00:00.000Z',
        }
      )
    })

    expect(MUTATE_ASYNC).toHaveBeenCalledWith({
      id: 'task-1',
      data: {
        date_debut: '2024-01-07',
      },
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: TACHE_KEYS.lists(),
    })
    expect(SANITIZE_FN).toHaveBeenCalledWith({ data: null, error: { message: 'x' } })
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'x',
      variant: 'destructive',
    })
    expect(result.current.dragStartInfo).toBeNull()
    expect(result.current.draggedTaskId).toBeNull()
    expect(result.current.isDragging).toBe(false)
  })
})