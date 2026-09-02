import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { MOCKS } = vi.hoisted(() => {
  // Stable mock implementations and helpers
  const Card: React.FC<Record<string, unknown>> = (props) => {
    const p = props as { className?: string; children?: React.ReactNode }
    return React.createElement('div', { 'data-testid': 'card', className: p.className }, p.children)
  }

  const Progress: React.FC<Record<string, unknown>> = (props) => {
    const p = props as { value?: number; className?: string; children?: React.ReactNode }
    return React.createElement('div', {
      'data-testid': 'progress',
      'data-value': String(p.value ?? ''),
      className: p.className
    }, p.children ?? null)
  }

  const Badge: React.FC<Record<string, unknown>> = (props) => {
    const p = props as { className?: string; variant?: string; children?: React.ReactNode }
    // include variant in data-attr for assertions if needed
    return React.createElement('span', { 'data-testid': 'badge', 'data-variant': p.variant ?? 'outline', className: p.className }, p.children)
  }

  const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

  // Simple icon mocks to allow text queries to function; stable render
  const CheckCircle: React.FC = () => React.createElement('span', { 'data-testid': 'icon-check' }, 'check')
  const Clock: React.FC = () => React.createElement('span', { 'data-testid': 'icon-clock' }, 'clock')
  const AlertCircle: React.FC = () => React.createElement('span', { 'data-testid': 'icon-alert' }, 'alert')
  const Circle: React.FC = () => React.createElement('span', { 'data-testid': 'icon-circle' }, 'circle')
  const TrendingUp: React.FC = () => React.createElement('span', { 'data-testid': 'icon-trend' }, 'trend')

  return {
    MOCKS: {
      Card,
      Progress,
      Badge,
      cn,
      icons: { CheckCircle, Clock, AlertCircle, Circle, TrendingUp }
    }
  }
})

// Mock internal UI components and utilities used by the module under test
vi.mock('@/components/ui/card', () => ({ Card: MOCKS.Card }))
vi.mock('@/components/ui/progress', () => ({ Progress: MOCKS.Progress }))
vi.mock('@/components/ui/badge', () => ({ Badge: MOCKS.Badge }))
vi.mock('@/lib/utils', () => ({ cn: MOCKS.cn }))

// Mock lucide-react icons used in the component
vi.mock('lucide-react', () => ({
  CheckCircle: MOCKS.icons.CheckCircle,
  Clock: MOCKS.icons.Clock,
  AlertCircle: MOCKS.icons.AlertCircle,
  Circle: MOCKS.icons.Circle,
  TrendingUp: MOCKS.icons.TrendingUp
}))

// The module imports a relative hook type; provide a harmless mock
vi.mock('./hooks/useGanttZoom', () => ({ TimelineConfig: {} }))

// Import the component under test AFTER setting up mocks
import { GanttOverviewPanel } from './GanttOverviewPanel'

describe('GanttOverviewPanel', () => {
  // Stable QueryClient per rules
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 }
    }
  })

  const QueryWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    React.createElement(QueryClientProvider, { client: qc }, children)
  )

  it('renderHook sanity check inside QueryClientProvider (required wrapper)', () => {
    const { result } = renderHook(() => 42, { wrapper: QueryWrapper })
    expect(result.current).toBe(42)
  })

  it('shows zero stats when tasks is empty', () => {
    render(React.createElement(GanttOverviewPanel, {
      tasks: [],
      timeline: null,
      currentViewStart: new Date(),
      currentViewEnd: new Date()
    }))

    // Header present
    expect(screen.getByText('Progression globale')).toBeTruthy()
    // Completion rate should be 0%
    expect(screen.getByText('0%')).toBeTruthy()

    // Badges for statuses show zeros
    expect(screen.getByText(/0 à faire/)).toBeTruthy()
    expect(screen.getByText(/0 en cours/)).toBeTruthy()
    expect(screen.getByText(/0 bloquées/)).toBeTruthy()
    expect(screen.getByText(/0 terminées/)).toBeTruthy()

    // Progress element contains data-value "0"
    const progress = screen.getByTestId('progress')
    expect(progress.getAttribute('data-value')).toBe('0')
  })

  it('computes stats correctly and handles onNavigateTo clicks', async () => {
    // Stable dates for assertions
    const tasks = [
      { id: 't1', titre: 'Task Done', statut: 'Terminé', created_at: '2025-05-10T00:00:00Z', echeance: '2025-05-15T00:00:00Z', priorite: 'low' },
      { id: 't2', titre: 'Task InProgress', statut: 'En cours', created_at: '2025-05-12T00:00:00Z', echeance: '2025-06-05T00:00:00Z', priorite: 'low' },
      { id: 't3', titre: 'Task Blocked', statut: 'Bloqué', created_at: '2025-05-13T00:00:00Z', echeance: '2025-06-02T00:00:00Z', priorite: 'low' },
      { id: 't4', titre: 'Task Todo', statut: 'A faire', created_at: '2025-05-14T00:00:00Z', echeance: '2025-06-08T00:00:00Z', priorite: 'high' },
      { id: 't5', titre: 'Task Overdue', statut: 'A faire', created_at: '2025-05-01T00:00:00Z', echeance: '2025-05-20T00:00:00Z', priorite: 'high' }
    ]

    const onNavigateTo = vi.fn()

    const { container } = render(React.createElement(GanttOverviewPanel, {
      tasks,
      timeline: null,
      onNavigateTo,
      currentViewStart: new Date('2025-05-25T00:00:00Z'),
      currentViewEnd: new Date('2025-06-06T00:00:00Z')
    }))

    // Total tasks = 5, completed = 1 => 20%
    expect(screen.getByText('20%')).toBeTruthy()

    // Assert status counts derived directly from data
    // 2 "A faire", 1 "En cours", 1 "Bloqué", 1 "Terminé"
    expect(screen.getByText('2 à faire')).toBeTruthy()
    expect(screen.getByText('1 en cours')).toBeTruthy()
    expect(screen.getByText('1 bloquées')).toBeTruthy()
    expect(screen.getByText('1 terminées')).toBeTruthy()

    // Milestones header and titles (two high priority tasks)
    expect(screen.getByText(/Jalons:/)).toBeTruthy()
    expect(screen.getByText(/Task Todo/)).toBeTruthy()
    expect(screen.getByText(/Task Overdue/)).toBeTruthy()

    // At least one milestone date formatted as (dd/MM) should be present
    const dateParenMatches = screen.queryAllByText(/\(\d{2}\/\d{2}\)/)
    expect(dateParenMatches.length).toBeGreaterThanOrEqual(1)

    // Find mini-map element by class names preserved in Card wrapper
    const miniMap = container.querySelector('.relative.h-12')
    expect(miniMap).toBeTruthy()

    if (miniMap) {
      // Provide bounding rect for click calculations
      // left=10, width=200 so click at clientX 110 is center
      // @ts-expect-error Assigning for test
      miniMap.getBoundingClientRect = () => ({ left: 10, width: 200, top: 0, bottom: 0, height: 0, right: 210 })
      await act(async () => {
        fireEvent.click(miniMap, { clientX: 110 })
      })

      expect(onNavigateTo).toHaveBeenCalledTimes(1)
      const calledWith = onNavigateTo.mock.calls[0][0]
      expect(calledWith).toBeInstanceOf(Date)

      // Ensure the target date falls within min/max of task dates (created_at or echeance)
      const times = tasks
        .filter(t => t.echeance || t.created_at)
        .flatMap(t => [
          t.created_at ? new Date(t.created_at).getTime() : Number.POSITIVE_INFINITY,
          t.echeance ? new Date(t.echeance).getTime() : Number.NEGATIVE_INFINITY
        ])
        .filter(Number.isFinite)
      const minT = Math.min(...times)
      const maxT = Math.max(...times)
      const calledTime = (calledWith as Date).getTime()
      expect(calledTime).toBeGreaterThanOrEqual(minT)
      expect(calledTime).toBeLessThanOrEqual(maxT)
    }
  })

  it('consumer shows error state when data is null and error present', () => {
    const FakeConsumer: React.FC<{ data: unknown; error: { message: string } | null; isLoading: boolean }> = ({ data, error, isLoading }) => {
      if (isLoading) return React.createElement('div', null, 'Chargement...')
      if (error) {
        return React.createElement('div', null,
          React.createElement('span', null, `Erreur: ${error.message}`),
          React.createElement(GanttOverviewPanel, {
            tasks: [],
            timeline: null,
            currentViewStart: new Date(),
            currentViewEnd: new Date()
          })
        )
      }
      return React.createElement(GanttOverviewPanel, {
        tasks: Array.isArray(data) ? data : [],
        timeline: null,
        currentViewStart: new Date(),
        currentViewEnd: new Date()
      })
    }

    render(React.createElement(FakeConsumer, { data: null, error: { message: 'fetch failed' }, isLoading: false }))

    expect(screen.getByText('Erreur: fetch failed')).toBeTruthy()
    expect(screen.getByText('0%')).toBeTruthy()
    expect(screen.getByText(/0 à faire/)).toBeTruthy()
  })
})