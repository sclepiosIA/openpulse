import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import {
  PriseEnMainNavigationPreview,
  GroupesPartenairesPreview,
  AnalyseGeoMapPreview,
  RapportsChartPreview,
  ForumThreadsPreview,
} from './AutresPreviews'

const { countUpValues } = vi.hoisted(() => ({
  countUpValues: [] as number[],
}))

vi.mock('framer-motion', () => {
  const ReactModule = React
  const createMotionComponent = (tag: keyof JSX.IntrinsicElements) =>
    ReactModule.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ children, ...props }, ref) =>
      ReactModule.createElement(tag, { ...props, ref }, children),
    )

  return {
    motion: {
      div: createMotionComponent('div'),
      circle: (props: React.SVGProps<SVGCircleElement>) => ReactModule.createElement('circle', props),
    },
  }
})

vi.mock('lucide-react', () => {
  const ReactModule = React
  const Icon = ({ className }: { className?: string }) =>
    ReactModule.createElement('svg', { 'data-testid': 'icon', className })
  return {
    Home: Icon,
    Mail: Icon,
    Building2: Icon,
    Users: Icon,
    FileText: Icon,
    Settings: Icon,
    ChevronRight: Icon,
    MapPin: Icon,
    BarChart3: Icon,
    MessageSquare: Icon,
    Eye: Icon,
    TrendingUp: Icon,
    TrendingDown: Icon,
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
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value?: number; className?: string }) => (
    <div data-testid="progress" data-value={String(value)} className={className} />
  ),
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="avatar" className={className}>
      {children}
    </div>
  ),
  AvatarFallback: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="avatar-fallback" className={className}>
      {children}
    </div>
  ),
}))

vi.mock('../TutorielCountUpAnimation', () => ({
  TutorielCountUpAnimation: ({ value }: { value: number; duration?: number }) => {
    countUpValues.push(value)
    return <span data-testid="count-up">{value}</span>
  },
}))

describe('AutresPreviews', () => {
  beforeEach(() => {
    countUpValues.length = 0
  })

  it('render PriseEnMainNavigationPreview avec les éléments de navigation et le badge emails', () => {
    render(<PriseEnMainNavigationPreview />)

    expect(screen.getByText('Navigation principale')).toBeInTheDocument()
    expect(screen.getByText('OpenPulse')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Emails')).toBeInTheDocument()
    expect(screen.getByText('Établissements')).toBeInTheDocument()
    expect(screen.getByText('People')).toBeInTheDocument()
    expect(screen.getByText('Projets')).toBeInTheDocument()
    expect(screen.getByText('Paramètres')).toBeInTheDocument()

    const badges = screen.getAllByTestId('badge')
    expect(badges).toHaveLength(1)
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(badges[0]).toHaveAttribute('data-variant', 'default')
  })

  it('render GroupesPartenairesPreview avec les groupes et leurs initiales', () => {
    render(<GroupesPartenairesPreview />)

    expect(screen.getByText("Groupes d'organisations")).toBeInTheDocument()
    expect(screen.getByText('Groupement Nord-Alsace')).toBeInTheDocument()
    expect(screen.getByText('Groupe Ramsay')).toBeInTheDocument()
    expect(screen.getByText('Réseau Santé Bretagne')).toBeInTheDocument()

    expect(screen.getByText('5 établissements')).toBeInTheDocument()
    expect(screen.getByText('12 établissements')).toBeInTheDocument()
    expect(screen.getByText('8 établissements')).toBeInTheDocument()

    const fallbacks = screen.getAllByTestId('avatar-fallback')
    expect(fallbacks).toHaveLength(3)
    expect(fallbacks[0]).toHaveTextContent('GN')
    expect(fallbacks[1]).toHaveTextContent('GR')
    expect(fallbacks[2]).toHaveTextContent('RS')

    expect(screen.getByText('Groupement')).toBeInTheDocument()
    expect(screen.getByText('Groupe privé')).toBeInTheDocument()
    expect(screen.getByText('Réseau')).toBeInTheDocument()
  })

  it('render AnalyseGeoMapPreview avec les régions, les progressions et le total établissements', () => {
    const { container } = render(<AnalyseGeoMapPreview />)

    expect(screen.getByText('Répartition géographique')).toBeInTheDocument()
    expect(screen.getByText('Île-de-France')).toBeInTheDocument()
    expect(screen.getByText('Auvergne-Rhône-Alpes')).toBeInTheDocument()
    expect(screen.getByText('Occitanie')).toBeInTheDocument()
    expect(screen.getByText('Nouvelle-Aquitaine')).toBeInTheDocument()
    expect(screen.getByText('Autres')).toBeInTheDocument()

    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('32')).toBeInTheDocument()
    expect(screen.getByText('28')).toBeInTheDocument()
    expect(screen.getByText('22')).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()

    const progressBars = screen.getAllByTestId('progress')
    expect(progressBars).toHaveLength(5)
    expect(progressBars.map((node) => node.getAttribute('data-value'))).toEqual(['30', '21', '19', '15', '15'])

    const circles = container.querySelectorAll('circle')
    expect(circles).toHaveLength(6)
    expect(screen.getByText('établissements')).toBeInTheDocument()
    expect(countUpValues).toContain(150)
  })

  it('render RapportsChartPreview avec les KPI, tendances et graphique mensuel', () => {
    const { container } = render(<RapportsChartPreview />)

    expect(screen.getByText("Rapports d'activité")).toBeInTheDocument()
    expect(screen.getByText('Prospects')).toBeInTheDocument()
    expect(screen.getByText('Contrats')).toBeInTheDocument()
    expect(screen.getByText('Churn')).toBeInTheDocument()

    expect(screen.getByText('+12%')).toBeInTheDocument()
    expect(screen.getByText('+3')).toBeInTheDocument()
    expect(screen.getByText('-1%')).toBeInTheDocument()

    expect(screen.getByText('Évolution mensuelle')).toBeInTheDocument()
    expect(screen.getByText('Jan')).toBeInTheDocument()
    expect(screen.getByText('Juin')).toBeInTheDocument()
    expect(screen.getByText('Déc')).toBeInTheDocument()

    expect(countUpValues).toEqual([45, 8, 2])

    const bars = container.querySelectorAll('.bg-primary.rounded-t')
    expect(bars).toHaveLength(12)
  })

  it('render ForumThreadsPreview avec discussions, état résolu et métriques', () => {
    render(<ForumThreadsPreview />)

    expect(screen.getByText('Forum communautaire')).toBeInTheDocument()

    expect(screen.getByText("Comment optimiser l'import Excel ?")).toBeInTheDocument()
    expect(screen.getByText('Problème de synchronisation emails')).toBeInTheDocument()
    expect(screen.getByText('Nouvelle fonctionnalité Gantt')).toBeInTheDocument()

    expect(screen.getByText('par Marie D.')).toBeInTheDocument()
    expect(screen.getByText('par Thomas L.')).toBeInTheDocument()
    expect(screen.getByText('par Admin')).toBeInTheDocument()

    const resolvedBadges = screen.getAllByText('Résolu')
    expect(resolvedBadges).toHaveLength(2)

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('156')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('89')).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()
    expect(screen.getByText('312')).toBeInTheDocument()
  })
})