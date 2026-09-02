/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  DeploiementPhasesPreview,
  DeploiementKanbanPreview,
  DeploiementGanttPreview,
  DeploiementAlertesPreview,
} from './DeploiementPreviews'

const { countUpSpy } = vi.hoisted(() => ({
  countUpSpy: vi.fn((props: { value: number; duration: number }) => (
    <span data-testid={`countup-${props.value}`}>{props.value}</span>
  )),
}))

vi.mock('framer-motion', () => {
  const createMotion = (tag: keyof JSX.IntrinsicElements) =>
    React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ children, ...props }, ref) =>
      React.createElement(tag, { ...props, ref }, children),
    )

  return {
    motion: {
      div: createMotion('div'),
    },
  }
})

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />
  return {
    Building2: Icon,
    CheckCircle2: Icon,
    Clock: Icon,
    PlayCircle: Icon,
    Users: Icon,
    AlertTriangle: Icon,
  }
})

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode
    className?: string
    variant?: string
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div role="progressbar" aria-valuenow={value} className={className}>
      {value}%
    </div>
  ),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}))

vi.mock('../TutorielCountUpAnimation', () => ({
  TutorielCountUpAnimation: (props: { value: number; duration: number }) => countUpSpy(props),
}))

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('DeploiementPreviews', () => {
  it('rend la preview des phases avec la timeline, le badge client et la progression active', () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <DeploiementPhasesPreview />
      </Wrapper>,
    )

    expect(screen.getByText('Phases de déploiement')).toBeInTheDocument()
    expect(screen.getByText('Groupe Vallois')).toBeInTheDocument()

    expect(screen.getByText('Cadrage')).toBeInTheDocument()
    expect(screen.getByText('Formation')).toBeInTheDocument()
    expect(screen.getByText('Paramétrage')).toBeInTheDocument()
    expect(screen.getByText('Recette')).toBeInTheDocument()
    expect(screen.getByText('Go-Live')).toBeInTheDocument()

    expect(screen.getByText('5j')).toBeInTheDocument()
    expect(screen.getByText('10j')).toBeInTheDocument()
    expect(screen.getByText('8j')).toBeInTheDocument()
    expect(screen.getByText('7j')).toBeInTheDocument()
    expect(screen.getByText('3j')).toBeInTheDocument()

    const progress = screen.getByRole('progressbar')
    expect(progress).toHaveAttribute('aria-valuenow', '60')
    expect(progress).toHaveTextContent('60%')

    expect(screen.getByText('Jours écoulés')).toBeInTheDocument()
    expect(screen.getByText('Jours restants')).toBeInTheDocument()
    expect(screen.getByText('Progression')).toBeInTheDocument()
    expect(screen.getByText('45%')).toBeInTheDocument()

    expect(screen.getByTestId('countup-15')).toHaveTextContent('15')
    expect(screen.getByTestId('countup-18')).toHaveTextContent('18')
    expect(countUpSpy).toHaveBeenCalledWith({ value: 15, duration: 1200 })
    expect(countUpSpy).toHaveBeenCalledWith({ value: 18, duration: 1200 })
  })

  it('rend la vue kanban avec les colonnes, badges de compte et cartes de tâches', () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <DeploiementKanbanPreview />
      </Wrapper>,
    )

    expect(screen.getByText('Vue Kanban')).toBeInTheDocument()

    const cadrageHeading = screen.getByText('Cadrage')
    const formationHeading = screen.getByText('Formation')
    const parametrageHeading = screen.getByText('Paramétrage')

    expect(cadrageHeading).toBeInTheDocument()
    expect(formationHeading).toBeInTheDocument()
    expect(parametrageHeading).toBeInTheDocument()

    expect(screen.getByText('Réunion kickoff')).toBeInTheDocument()
    expect(screen.getByText('Analyse besoins')).toBeInTheDocument()
    expect(screen.getByText('Formation admins')).toBeInTheDocument()
    expect(screen.getByText('Formation users')).toBeInTheDocument()
    expect(screen.getByText('Config modules')).toBeInTheDocument()
    expect(screen.getByText('Import données')).toBeInTheDocument()

    const badges = screen.getAllByTestId('badge')
    const kanbanBadges = badges.filter((badge) => badge.textContent === '2')
    expect(kanbanBadges).toHaveLength(3)
  })

  it('rend le diagramme de gantt avec les tâches et la légende des mois', () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <DeploiementGanttPreview />
      </Wrapper>,
    )

    expect(screen.getByText('Diagramme de Gantt')).toBeInTheDocument()

    expect(screen.getByText('Cadrage')).toBeInTheDocument()
    expect(screen.getByText('Formation')).toBeInTheDocument()
    expect(screen.getByText('Paramétrage')).toBeInTheDocument()
    expect(screen.getByText('Recette')).toBeInTheDocument()
    expect(screen.getByText('Go-Live')).toBeInTheDocument()

    expect(screen.getByText('Jan')).toBeInTheDocument()
    expect(screen.getByText('Fév')).toBeInTheDocument()
    expect(screen.getByText('Mar')).toBeInTheDocument()
    expect(screen.getByText('Avr')).toBeInTheDocument()

    const goLiveLabel = screen.getByText('Go-Live')
    const row = goLiveLabel.parentElement
    expect(row).not.toBeNull()
    if (row) {
      expect(within(row).getByText('Go-Live')).toBeInTheDocument()
    }
  })

  it('rend les alertes et blocages avec les trois statuts métier attendus', () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <DeploiementAlertesPreview />
      </Wrapper>,
    )

    expect(screen.getByText('Alertes & Blocages')).toBeInTheDocument()

    expect(screen.getByText('Retard sur la formation')).toBeInTheDocument()
    expect(screen.getByText('2 sessions reportées - Impact Go-Live estimé')).toBeInTheDocument()

    expect(screen.getByText('Validation en attente')).toBeInTheDocument()
    expect(screen.getByText('Spécifications techniques à valider par DSI')).toBeInTheDocument()

    expect(screen.getByText('Cadrage terminé')).toBeInTheDocument()
    expect(screen.getByText('Toutes les étapes validées')).toBeInTheDocument()

    expect(screen.getAllByTestId('icon')).toHaveLength(3)
  })
})