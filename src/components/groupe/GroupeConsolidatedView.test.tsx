import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'

const {
  MockCard,
  MockCardContent,
  MockCardDescription,
  MockCardHeader,
  MockCardTitle,
  MockBadge,
  MockProgress,
  MockLink,
  MockResponsiveContainer,
  MockBarChart,
  MockBar,
  MockPieChart,
  MockPie,
  MockCell,
  MockXAxis,
  MockYAxis,
  MockCartesianGrid,
  MockTooltip,
  MockLegend,
  MockIcon,
  MockTimeline,
} = vi.hoisted(() => {
  const passthrough =
    (Tag: keyof JSX.IntrinsicElements = 'div', extraProps: Record<string, unknown> = {}) =>
    ({ children, ...props }: any) =>
      React.createElement(Tag, { ...extraProps, ...props }, children)

  const MockCard = passthrough('section')
  const MockCardContent = passthrough('div')
  const MockCardDescription = passthrough('p')
  const MockCardHeader = passthrough('header')
  const MockCardTitle = passthrough('h2')
  const MockBadge = ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>
  const MockProgress = ({ value, ...props }: any) => <div data-testid="progress" data-value={value} {...props} />
  const MockLink = ({ to, children, ...props }: any) => <a href={typeof to === 'string' ? to : String(to)} {...props}>{children}</a>

  const MockResponsiveContainer = ({ children }: any) => <div data-testid="recharts-responsive">{children}</div>
  const MockBarChart = passthrough('div', { 'data-testid': 'recharts-bar-chart' })
  const MockBar = passthrough('div', { 'data-testid': 'recharts-bar' })
  const MockPieChart = passthrough('div', { 'data-testid': 'recharts-pie-chart' })
  const MockPie = passthrough('div', { 'data-testid': 'recharts-pie' })
  const MockCell = () => null
  const MockXAxis = () => null
  const MockYAxis = () => null
  const MockCartesianGrid = () => null
  const MockTooltip = () => null
  const MockLegend = () => null

  const MockIcon = (props: any) => <svg role="img" aria-hidden="true" {...props} />

  const MockTimeline = () => null

  return {
    MockCard,
    MockCardContent,
    MockCardDescription,
    MockCardHeader,
    MockCardTitle,
    MockBadge,
    MockProgress,
    MockLink,
    MockResponsiveContainer,
    MockBarChart,
    MockBar,
    MockPieChart,
    MockPie,
    MockCell,
    MockXAxis,
    MockYAxis,
    MockCartesianGrid,
    MockTooltip,
    MockLegend,
    MockIcon,
    MockTimeline,
  }
})

vi.mock('@/components/ui/card', () => ({
  Card: MockCard,
  CardContent: MockCardContent,
  CardDescription: MockCardDescription,
  CardHeader: MockCardHeader,
  CardTitle: MockCardTitle,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: MockBadge,
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: MockProgress,
}))

vi.mock('lucide-react', () => ({
  Building2: MockIcon,
  Package: MockIcon,
  FileText: MockIcon,
  TrendingUp: MockIcon,
  Activity: MockIcon,
}))

vi.mock('react-router-dom', () => ({
  Link: MockLink,
}))

vi.mock('recharts', () => ({
  BarChart: MockBarChart,
  Bar: MockBar,
  PieChart: MockPieChart,
  Pie: MockPie,
  Cell: MockCell,
  XAxis: MockXAxis,
  YAxis: MockYAxis,
  CartesianGrid: MockCartesianGrid,
  Tooltip: MockTooltip,
  Legend: MockLegend,
  ResponsiveContainer: MockResponsiveContainer,
}))

vi.mock('./GroupeActivitiesTimeline', () => ({
  GroupeActivitiesTimeline: MockTimeline,
}))

import { GroupeConsolidatedView } from './GroupeConsolidatedView'

describe('GroupeConsolidatedView', () => {
  it('affiche les KPIs et les agrégations de modules', () => {
    const props = {
      groupe: {
        nombre_etablissements: 2,
        modules_deployes: ['Admissions', 'Imagerie', 'Bloc'],
        progression_moyenne: 72.3,
        total_passages_urgences_annuel: 987,
      },
      etablissements: [
        {
          id: 'eg1',
          est_etablissement_principal: true,
          etablissement: {
            id: 'et1',
            nom: 'CHU Alpha',
            ville: 'Paris',
            region: 'IDF',
            statut: 'Production',
            type: 'CHU',
            modules_proposes: ['Admissions', 'Imagerie'],
            dpi: 'Dedalus',
            nombre_passages_urgences_annuel: 700,
            progression: 80,
          },
        },
        {
          id: 'eg2',
          est_etablissement_principal: false,
          etablissement: {
            id: 'et2',
            nom: 'Clinique Beta',
            ville: 'Lyon',
            region: 'ARA',
            statut: 'Déploiement',
            type: 'Clinique',
            modules_proposes: ['Admissions'],
            dpi: 'Mediboard',
            nombre_passages_urgences_annuel: 287,
            progression: 60,
          },
        },
      ],
      contacts: [],
      taches: [
        { id: 't1', statut: 'Terminé' },
        { id: 't2', statut: 'En cours' },
        { id: 't3', statut: 'A faire' },
      ],
    }

    render(<GroupeConsolidatedView {...props} />)

    // Sections KPI présentes
    expect(screen.getByText('Établissements')).toBeInTheDocument()
    expect(screen.getByText('Modules déployés')).toBeInTheDocument()
    expect(screen.getByText('Progression moyenne')).toBeInTheDocument()
    expect(screen.getByText('Passages aux urgences/an')).toBeInTheDocument()
    expect(screen.getByText('Tâches communes')).toBeInTheDocument()

    // Valeurs KPI spécifiques
    expect(screen.getByText('72.3%')).toBeInTheDocument()
    expect(screen.getByText('987')).toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()

    // Agrégation des modules par établissements
    expect(screen.getByText(/Admissions \(2\)/)).toBeInTheDocument()
    expect(screen.getByText(/Imagerie \(1\)/)).toBeInTheDocument()

    // Badges DPI avec classes de couleur attendues
    const dedalusBadge = screen.getAllByText('Dedalus')[0]
    expect(dedalusBadge).toHaveClass('bg-blue-100')

    // Lien vers la page établissement
    const link = screen.getByRole('link', { name: 'CHU Alpha' })
    expect(link.getAttribute('href')).toContain('/etablissements/et1')

    // Composants Recharts rendus (mocks)
    expect(screen.getAllByTestId('recharts-bar-chart').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('recharts-pie-chart').length).toBeGreaterThan(0)
  })

  it("affiche 'Aucun' pour les modules lorsqu'aucun n'est proposé et 'N/A' pour DPI absent", () => {
    const props = {
      groupe: {
        nombre_etablissements: 1,
        modules_deployes: [],
        progression_moyenne: 0,
        total_passages_urgences_annuel: 0,
      },
      etablissements: [
        {
          id: 'eg1',
          est_etablissement_principal: false,
          etablissement: {
            id: 'et3',
            nom: 'Hôpital Gamma',
            ville: 'Nice',
            region: 'PACA',
            statut: 'Prospect',
            type: 'Hôpital',
            modules_proposes: [],
            dpi: null,
            nombre_passages_urgences_annuel: 0,
            progression: 0,
          },
        },
      ],
      contacts: [],
      taches: [],
    }

    render(<GroupeConsolidatedView {...props} />)

    // "Aucun" peut apparaître à plusieurs endroits : on vérifie au moins une occurrence
    expect(screen.getAllByText('Aucun').length).toBeGreaterThan(0)
    // DPI non renseigné -> affiche "N/A"
    expect(screen.getByText('N/A')).toBeInTheDocument()
  })

  it('affiche correctement les badges "Principal" et les couleurs DPI', () => {
    const props = {
      groupe: {
        nombre_etablissements: 2,
        modules_deployes: ['Module X'],
        progression_moyenne: 10.5,
        total_passages_urgences_annuel: 12,
      },
      etablissements: [
        {
          id: 'eg1',
          est_etablissement_principal: true,
          etablissement: {
            id: 'et10',
            nom: 'Centre Delta',
            ville: 'Bordeaux',
            region: 'NAQ',
            statut: 'Contractuel',
            type: 'Centre',
            modules_proposes: ['Module X'],
            dpi: 'MAINCARE',
            nombre_passages_urgences_annuel: 12,
            progression: 10,
          },
        },
        {
          id: 'eg2',
          est_etablissement_principal: false,
          etablissement: {
            id: 'et11',
            nom: 'Clinique Epsilon',
            ville: 'Toulouse',
            region: 'OCC',
            statut: 'Formation',
            type: 'Clinique',
            modules_proposes: [],
            dpi: 'Crossway',
            nombre_passages_urgences_annuel: 0,
            progression: 5,
          },
        },
      ],
      contacts: [],
      taches: [{ id: 't1', statut: 'Terminé' }],
    }

    render(<GroupeConsolidatedView {...props} />)

    // Badge "Principal" présent
    expect(screen.getByText('Principal')).toBeInTheDocument()

    // Statuts affichés via badges d'établissement
    expect(screen.getAllByText('Contractuel').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Formation').length).toBeGreaterThan(0)

    // Couleurs DPI mappées via classes
    const maincareBadge = screen.getAllByText('MAINCARE')[0]
    expect(maincareBadge).toHaveClass('bg-green-100')
    const crosswayBadge = screen.getAllByText('Crossway')[0]
    expect(crosswayBadge).toHaveClass('bg-pink-100')
  })
})