import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  return { mockFrom }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}))

vi.mock('../TutorielMockProviders', () => ({
  TutorielPreviewWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tutoriel-preview-wrapper">{children}</div>
  ),
}))

vi.mock('../TutorielCountUpAnimation', () => ({
  TutorielCountUpAnimation: ({
    value,
    suffix = '',
  }: {
    value: number
    suffix?: string
    delay?: number
  }) => <span data-testid="countup">{`${value}${suffix}`}</span>,
  TutorielProgressBar: ({
    value,
    maxValue,
  }: {
    value: number
    maxValue: number
    delay?: number
    color?: string
  }) => (
    <div
      data-testid="progressbar"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={maxValue}
    />
  ),
  TutorielChartBar: ({
    value,
    maxValue,
    label,
    className,
  }: {
    value: number
    maxValue: number
    label: string
    delay?: number
    className?: string
  }) => (
    <div data-testid="chartbar" data-label={label} data-value={value} data-max={maxValue} className={className}>
      {label}:{value}/{maxValue}
    </div>
  ),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <section data-testid="card" className={className}>
      {children}
    </section>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <header data-testid="card-header" className={className}>
      {children}
    </header>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 data-testid="card-title" className={className}>
      {children}
    </h3>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
    variant?: string
  }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="avatar" className={className}>
      {children}
    </span>
  ),
  AvatarFallback: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="avatar-fallback" className={className}>
      {children}
    </span>
  ),
}))

vi.mock('lucide-react', () => {
  const Icon =
    (name: string) =>
    ({ className }: { className?: string }) => (
      <svg data-testid={`icon-${name}`} className={className} aria-hidden="true" />
    )
  return {
    Rocket: Icon('Rocket'),
    Target: Icon('Target'),
    TrendingUp: Icon('TrendingUp'),
    Clock: Icon('Clock'),
    Sparkles: Icon('Sparkles'),
    GripVertical: Icon('GripVertical'),
    CheckCircle2: Icon('CheckCircle2'),
  }
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('RDPreviews', () => {
  it('RDDashboardPreview affiche les KPIs et le sprint', async () => {
    const mod = await import('./RDPreviews')
    renderWithClient(<mod.RDDashboardPreview />)

    expect(screen.getByTestId('tutoriel-preview-wrapper')).toBeInTheDocument()
    expect(screen.getByText(mod.mockSprintData.name)).toBeInTheDocument()
    expect(screen.getByText(`${mod.mockSprintData.completedPoints}/${mod.mockSprintData.totalPoints} pts`)).toBeInTheDocument()

    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', String(mod.mockSprintData.completedPoints))
    expect(progressbar).toHaveAttribute('aria-valuemax', String(mod.mockSprintData.totalPoints))

    const countups = screen.getAllByTestId('countup').map(n => n.textContent)
    expect(countups).toContain(`${mod.mockRDKPIs.sprintProgress}%`)
    expect(countups).toContain(String(mod.mockRDKPIs.storiesTerminees))
    expect(countups).toContain(String(mod.mockRDKPIs.storiesEnCours))
    expect(countups).toContain(`${mod.mockRDKPIs.velociteMoyenne} pts`)
  })

  it('RDSprintBoardPreview affiche les colonnes et les compteurs par statut', async () => {
    const mod = await import('./RDPreviews')
    renderWithClient(<mod.RDSprintBoardPreview />)

    expect(screen.getByText('Sprint Board')).toBeInTheDocument()

    const countsByColumn: Record<string, number> = {
      Backlog: mod.mockUserStories.filter(s => s.status === 'backlog').length,
      'To Do': mod.mockUserStories.filter(s => s.status === 'todo').length,
      'En cours': mod.mockUserStories.filter(s => s.status === 'in_progress').length,
      Review: mod.mockUserStories.filter(s => s.status === 'review').length,
      Done: mod.mockUserStories.filter(s => s.status === 'done').length,
    }

    for (const [col, cnt] of Object.entries(countsByColumn)) {
      expect(screen.getByText(col)).toBeInTheDocument()
      expect(screen.getAllByTestId('badge').some(b => b.textContent === String(cnt))).toBe(true)
    }

    expect(screen.getByText('Intégration API Qonto')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Rapports')).toBeInTheDocument()
    expect(screen.getByText('Mobile')).toBeInTheDocument()
    expect(screen.getByText('Performance')).toBeInTheDocument()
  })

  it('RDBurndownPreview affiche les repères et les jours', async () => {
    const mod = await import('./RDPreviews')
    renderWithClient(<mod.RDBurndownPreview />)

    expect(screen.getByText('Burndown Chart')).toBeInTheDocument()
    expect(screen.getByText('Idéal')).toBeInTheDocument()
    expect(screen.getByText('Réel')).toBeInTheDocument()

    for (const d of mod.mockSprintData.days) {
      expect(screen.getByText(`J${d.day}`)).toBeInTheDocument()
    }
  })

  it('RDVelocityPreview affiche les barres et la moyenne', async () => {
    const mod = await import('./RDPreviews')
    renderWithClient(<mod.RDVelocityPreview />)

    expect(screen.getByText('Vélocité')).toBeInTheDocument()

    const maxPoints = Math.max(...mod.mockVelocity.map(v => v.points))
    const bars = screen.getAllByTestId('chartbar')
    expect(bars).toHaveLength(mod.mockVelocity.length)

    for (const v of mod.mockVelocity) {
      const bar = bars.find(b => b.getAttribute('data-label') === v.sprint)
      expect(bar?.getAttribute('data-value')).toBe(String(v.points))
      expect(bar?.getAttribute('data-max')).toBe(String(maxPoints))
    }

    const countups = screen.getAllByTestId('countup').map(n => n.textContent)
    expect(countups).toContain(String(mod.mockRDKPIs.velociteMoyenne))
  })

  it('RDSprintBoardPreview déclenche l’animation de drag via setInterval', async () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    const mod = await import('./RDPreviews')
    const { unmount } = renderWithClient(<mod.RDSprintBoardPreview />)

    expect(setIntervalSpy).toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(3100)
    })

    unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()

    vi.useRealTimers()
  })
})