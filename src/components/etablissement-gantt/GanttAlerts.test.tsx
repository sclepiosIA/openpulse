import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { GanttAlerts } from './GanttAlerts'

const fixedNow = new Date('2024-01-10T12:00:00.000Z')

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: string }) => (
    <div data-testid="alert" data-variant={variant} className={className}>
      {children}
    </div>
  ),
  AlertTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  AlertDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    onClick,
    className,
    variant,
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
    variant?: string
  }) => (
    <button type="button" data-testid="badge" data-variant={variant} className={className} onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    variant,
    size,
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
    variant?: string
    size?: string
  }) => (
    <button type="button" data-variant={variant} data-size={size} className={className} onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />
  return {
    AlertTriangle: Icon,
    AlertCircle: Icon,
    Info: Icon,
    CheckCircle2: Icon,
    X: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

describe('GanttAlerts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(fixedNow)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('n’affiche rien quand aucune alerte n’est générée', () => {
    const tasks = [
      {
        id: 't1',
        statut: 'En cours',
        echeance: '2024-01-20T12:00:00.000Z',
        updated_at: '2024-01-09T12:00:00.000Z',
      },
      {
        id: 't2',
        statut: 'Terminé',
        echeance: '2024-01-05T12:00:00.000Z',
        updated_at: '2024-01-09T12:00:00.000Z',
      },
    ]

    const { container } = render(<GanttAlerts tasks={tasks} />)

    expect(container.firstChild).toBeNull()
  })

  it('affiche toutes les alertes métier attendues avec les bons messages quand déplié', () => {
    const onTaskClick = vi.fn()
    const tasks = [
      {
        id: 'over-1',
        statut: 'En cours',
        echeance: '2023-12-30T12:00:00.000Z',
        updated_at: '2024-01-09T12:00:00.000Z',
      },
      {
        id: 'over-2',
        statut: 'Bloqué',
        echeance: '2023-12-31T12:00:00.000Z',
        updated_at: '2024-01-05T12:00:00.000Z',
      },
      {
        id: 'soon-1',
        statut: 'En cours',
        echeance: '2024-01-11T12:00:00.000Z',
        updated_at: '2024-01-09T12:00:00.000Z',
      },
      {
        id: 'done-1',
        statut: 'Terminé',
        categorie_id: 'cat-a',
        categories_taches: { id: 'cat-a', nom: 'Phase Alpha' },
      },
      {
        id: 'done-2',
        statut: 'Terminé',
        categorie_id: 'cat-a',
        categories_taches: { id: 'cat-a', nom: 'Phase Alpha' },
      },
      {
        id: 'done-3',
        statut: 'Terminé',
        categorie_id: 'cat-a',
        categories_taches: { id: 'cat-a', nom: 'Phase Alpha' },
      },
    ]

    render(<GanttAlerts tasks={tasks} onTaskClick={onTaskClick} defaultCollapsed={false} />)

    expect(screen.getByText('Alertes (4)')).toBeInTheDocument()
    expect(screen.getByText('Tâches critiques en retard')).toBeInTheDocument()
    expect(screen.getByText('2 tâches en retard de plus de 7 jours')).toBeInTheDocument()
    expect(screen.getByText('Tâches bloquées')).toBeInTheDocument()
    expect(screen.getByText('1 tâche bloquée depuis plus de 3 jours')).toBeInTheDocument()
    expect(screen.getByText('Deadlines imminentes')).toBeInTheDocument()
    expect(screen.getByText('1 tâche à terminer dans les 48h')).toBeInTheDocument()
    expect(screen.getByText('Phase complétée')).toBeInTheDocument()
    expect(screen.getByText('Phase Alpha : toutes les tâches sont terminées (3/3)')).toBeInTheDocument()

    const alerts = screen.getAllByTestId('alert')
    expect(alerts).toHaveLength(4)
    expect(alerts[0]).toHaveAttribute('data-variant', 'destructive')
    expect(alerts[1]).toHaveAttribute('data-variant', 'destructive')
    expect(alerts[2]).toHaveAttribute('data-variant', 'default')
    expect(alerts[3]).toHaveAttribute('data-variant', 'default')

    const badges = screen.getAllByRole('button', { name: 'Voir les tâches' })
    expect(badges).toHaveLength(3)

    fireEvent.click(badges[0])
    expect(onTaskClick).toHaveBeenCalledWith('over-1')
  })

  it('respecte l’état collapsed par défaut et permet de déplier/replier', () => {
    const tasks = [
      {
        id: 'over-1',
        statut: 'En cours',
        echeance: '2023-12-30T12:00:00.000Z',
      },
    ]

    render(<GanttAlerts tasks={tasks} defaultCollapsed />)

    expect(screen.getByText('Alertes (1)')).toBeInTheDocument()
    expect(screen.queryByText('Tâches critiques en retard')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /alertes \(1\)/i }))
    expect(screen.getByText('Tâches critiques en retard')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /alertes \(1\)/i }))
    expect(screen.queryByText('Tâches critiques en retard')).not.toBeInTheDocument()
  })

  it('permet de dismiss une alerte et met à jour le compteur visible', () => {
    const tasks = [
      {
        id: 'over-1',
        statut: 'En cours',
        echeance: '2023-12-30T12:00:00.000Z',
      },
      {
        id: 'soon-1',
        statut: 'En cours',
        echeance: '2024-01-11T12:00:00.000Z',
      },
    ]

    render(<GanttAlerts tasks={tasks} defaultCollapsed={false} />)

    expect(screen.getByText('Alertes (2)')).toBeInTheDocument()
    expect(screen.getByText('Tâches critiques en retard')).toBeInTheDocument()
    expect(screen.getByText('Deadlines imminentes')).toBeInTheDocument()

    const allButtons = screen.getAllByRole('button')
    fireEvent.click(allButtons[1])

    expect(screen.getByText('Alertes (1)')).toBeInTheDocument()
    expect(screen.queryByText('Tâches critiques en retard')).not.toBeInTheDocument()
    expect(screen.getByText('Deadlines imminentes')).toBeInTheDocument()
  })

  it('ne crée pas d’alerte success pour une catégorie avec moins de 3 tâches', () => {
    const tasks = [
      {
        id: 'done-1',
        statut: 'Terminé',
        categorie_id: 'cat-b',
        categories_taches: { id: 'cat-b', nom: 'Phase Beta' },
      },
      {
        id: 'done-2',
        statut: 'Terminé',
        categorie_id: 'cat-b',
        categories_taches: { id: 'cat-b', nom: 'Phase Beta' },
      },
    ]

    const { container } = render(<GanttAlerts tasks={tasks} defaultCollapsed={false} />)

    expect(container.firstChild).toBeNull()
    expect(screen.queryByText('Phase complétée')).not.toBeInTheDocument()
  })
})