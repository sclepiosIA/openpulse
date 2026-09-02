import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  TUTORIEL_WRAPPER,
  CardWrapper,
  CardHeader,
  CardContent,
  CardTitle,
  BadgeMock,
  AvatarMock,
  AvatarFallbackMock,
  Icons,
  cnMock,
} = vi.hoisted(() => {
  const ReactInner = require('react')
  const TUTORIEL_WRAPPER = ({ children }: any) =>
    ReactInner.createElement('div', { 'data-testid': 'tutoriel' }, children)

  const CardWrapper = ({ children, ...props }: any) =>
    ReactInner.createElement('div', { 'data-testid': 'card', ...props }, children)
  const CardHeader = ({ children, ...props }: any) =>
    ReactInner.createElement('div', { 'data-testid': 'card-header', ...props }, children)
  const CardContent = ({ children, ...props }: any) =>
    ReactInner.createElement('div', { 'data-testid': 'card-content', ...props }, children)
  const CardTitle = ({ children, ...props }: any) =>
    ReactInner.createElement('div', { 'data-testid': 'card-title', ...props }, children)

  const BadgeMock = ({ children, variant, className, style, ...props }: any) =>
    ReactInner.createElement(
      'div',
      { 'data-testid': 'badge', 'data-variant': variant, className, style, ...props },
      children
    )

  const AvatarMock = ({ children, className, ...props }: any) =>
    ReactInner.createElement('div', { 'data-testid': 'avatar', className, ...props }, children)
  const AvatarFallbackMock = ({ children, className, ...props }: any) =>
    ReactInner.createElement('div', { 'data-testid': 'avatar-fallback', className, ...props }, children)

  const makeIcon = (name: string) => ({ className }: any) =>
    ReactInner.createElement('svg', { 'data-icon': name, 'data-testid': `icon-${name}`, className }, null)

  const Icons = {
    BarChart3: makeIcon('BarChart3'),
    Calendar: makeIcon('Calendar'),
    Filter: makeIcon('Filter'),
    ZoomIn: makeIcon('ZoomIn'),
    ZoomOut: makeIcon('ZoomOut'),
    Download: makeIcon('Download'),
    ChevronRight: makeIcon('ChevronRight'),
    GripVertical: makeIcon('GripVertical'),
    CheckCircle2: makeIcon('CheckCircle2'),
  }

  const cnMock = (...args: any[]) => args.filter(Boolean).join(' ')

  return {
    TUTORIEL_WRAPPER,
    CardWrapper,
    CardHeader,
    CardContent,
    CardTitle,
    BadgeMock,
    AvatarMock,
    AvatarFallbackMock,
    Icons,
    cnMock,
  }
})

vi.mock('../TutorielMockProviders', () => ({ TutorielPreviewWrapper: TUTORIEL_WRAPPER }))
vi.mock('@/components/ui/card', () => ({
  Card: CardWrapper,
  CardHeader,
  CardContent,
  CardTitle,
}))
vi.mock('@/components/ui/badge', () => ({ Badge: BadgeMock }))
vi.mock('@/components/ui/avatar', () => ({
  Avatar: AvatarMock,
  AvatarFallback: AvatarFallbackMock,
}))
vi.mock('lucide-react', () => Icons)
vi.mock('@/lib/utils', () => ({ cn: cnMock }))

import {
  GanttChartPreview,
  GanttTaskBarPreview,
  GanttFiltersPreview,
  mockGanttTasks,
} from './GanttPreviews'

describe('GanttPreviews components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders GanttChartPreview with timeline, tasks, badges and correct bar widths', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })
    const Wrapper = ({ children }: { children?: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )

    // satisfy rule: use renderHook inside QueryClientProvider wrapper
    renderHook(() => ({}), { wrapper: Wrapper })

    render(<GanttChartPreview />, { wrapper: Wrapper })

    // Timeline labels: first and last
    expect(screen.getByText('J1')).toBeTruthy()
    expect(screen.getByText('J14')).toBeTruthy()

    // Task titles present
    const taskTitle = screen.getByText('Formation utilisateurs')
    expect(taskTitle).toBeTruthy()

    // Progress text for that task should be visible (60%)
    const progressSpan = screen.getByText('60%')
    expect(progressSpan).toBeTruthy()

    // its parent bar should have inline style width corresponding to duration/totalDays
    const taskIndex = mockGanttTasks.findIndex((t) => t.title === 'Formation utilisateurs')
    expect(taskIndex).toBeGreaterThanOrEqual(0)
    const expectedWidth = ((mockGanttTasks[taskIndex].duration / 14) * 100).toFixed(3)
    const barElement = progressSpan.parentElement
    expect(barElement).toBeTruthy()
    // style.width should include the integer portion of expected width (e.g. '35' for 35.714)
    expect(barElement!.style.width).toContain(expectedWidth.split('.')[0])

    // Critique badge should be rendered for Go-live
    expect(screen.getByText('Critique')).toBeTruthy()

    // Before hover, the bar for task with status 'done' should NOT include ring class
    const doneTaskTitle = screen.getByText('Configuration environnement')
    let node = doneTaskTitle as HTMLElement
    while (node && !node.className.includes('transition-all')) {
      node = node.parentElement as HTMLElement
      if (!node) break
    }
    expect(node).toBeTruthy()
    const doneRow = node as HTMLElement
    const doneBar = Array.from(doneRow.querySelectorAll('div')).find((d) =>
      (d.className || '').includes('bg-success')
    ) as HTMLElement | undefined
    expect(doneBar).toBeTruthy()
    expect(doneBar?.className).not.toContain('ring-2')

    // simulate hover
    act(() => {
      fireEvent.mouseEnter(doneRow)
    })

    // after hover, bar should include ring classes
    const doneBarAfter = Array.from(doneRow.querySelectorAll('div')).find((d) =>
      (d.className || '').includes('bg-success')
    ) as HTMLElement | undefined
    expect(doneBarAfter).toBeTruthy()
    expect(doneBarAfter?.className).toContain('ring-2')
  })

  it('GanttTaskBarPreview toggles resizing message and updates width over time', async () => {
    vi.useFakeTimers()
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })
    const Wrapper = ({ children }: { children?: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )

    // renderHook per rule
    renderHook(() => ({}), { wrapper: Wrapper })

    render(<GanttTaskBarPreview />, { wrapper: Wrapper })

    // initial message before resizing starts
    expect(screen.getByText('Glissez les bords pour ajuster la durée')).toBeTruthy()

    // advance to trigger the initial setTimeout that sets isResizing true after 1000ms
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // advance one interval tick (100ms) to apply first increment
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // after timeout+one tick, the status text should switch to resizing message
    expect(screen.getByText('Redimensionnement en cours...')).toBeTruthy()

    // find the inner bar element (absolute with bg-primary)
    const bar = Array.from(screen.getAllByTestId('card-content')).flatMap((c) =>
      Array.from(c.querySelectorAll('div'))
    ).find((d) => (d.className || '').includes('bg-primary') && (d.className || '').includes('absolute')) as HTMLElement | undefined

    expect(bar).toBeTruthy()

    // after one interval tick, width should have increased from 30 to 32
    expect(bar!.style.width).toContain('32')

    // fast-forward until it resets: need 16 ticks after start (to reset back to 30)
    // total time to reset = initial 1000ms delay + 16 * 100ms = 2600ms
    act(() => {
      vi.advanceTimersByTime(2600 - 1100) // we've already advanced 1100ms (1000 + 100)
    })

    // allow any pending timers to run
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // width should be back to 30% after reset
    expect(bar!.style.width).toContain('30')

    vi.useRealTimers()
  })

  it('GanttFiltersPreview shows filters and active indicators', () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })
    const Wrapper = ({ children }: { children?: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )

    // satisfy rule
    renderHook(() => ({}), { wrapper: Wrapper })

    render(<GanttFiltersPreview />, { wrapper: Wrapper })

    // There should be four badges (one per filter)
    const badges = screen.getAllByTestId('badge')
    expect(badges.length).toBe(4)

    // Active filters are 'Par statut' and 'Par priorité' and should include ChevronRight icon
    const statutBadge = screen.getByText('Par statut').closest('[data-testid="badge"]') as HTMLElement
    const priorityBadge = screen.getByText('Par priorité').closest('[data-testid="badge"]') as HTMLElement
    expect(statutBadge).toBeTruthy()
    expect(priorityBadge).toBeTruthy()

    // check data-variant prop: active ones use "default" variant per component implementation
    expect(statutBadge.getAttribute('data-variant')).toBe('default')
    expect(priorityBadge.getAttribute('data-variant')).toBe('default')

    // ChevronRight icon should be inside active badges
    expect(statutBadge.querySelector('[data-icon="ChevronRight"]')).toBeTruthy()
    expect(priorityBadge.querySelector('[data-icon="ChevronRight"]')).toBeTruthy()

    // inactive filter 'Par responsable' should not have chevron and variant should be 'outline'
    const assigneeBadge = screen.getByText('Par responsable').closest('[data-testid="badge"]') as HTMLElement
    expect(assigneeBadge).toBeTruthy()
    expect(assigneeBadge.getAttribute('data-variant')).toBe('outline')
    expect(assigneeBadge.querySelector('[data-icon="ChevronRight"]')).toBeNull()
  })
})