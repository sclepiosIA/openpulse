import { render, screen } from '@testing-library/react'
import { TasksAnalyticsView } from './TasksAnalyticsView'
import type { TaskForAnalytics } from '@/types/taches-analytics'

const {
  ETABLISSEMENTS,
  CATEGORIES,
  PROFILES,
  mockUseEtablissements,
  mockUseCategories,
  mockUseProfiles,
  mockUseIsMobile,
} = vi.hoisted(() => {
  const ETABLISSEMENTS = [
    { id: 'e1', nom: 'Etablissement Alpha' },
    { id: 'e2', nom: 'Etablissement Beta' },
  ]
  const CATEGORIES = [
    { id: 'c1', nom: 'Commercial', couleur: '#111111' },
    { id: 'c2', nom: 'Technique', couleur: '#222222' },
  ]
  const PROFILES = [
    { id: 'p1', prenom: 'Jean', nom: 'Dupont' },
    { id: 'p2', prenom: 'Marie', nom: 'Curie' },
  ]
  return {
    ETABLISSEMENTS,
    CATEGORIES,
    PROFILES,
    mockUseEtablissements: vi.fn(() => ({ data: ETABLISSEMENTS })),
    mockUseCategories: vi.fn(() => ({ data: CATEGORIES })),
    mockUseProfiles: vi.fn(() => ({ data: PROFILES })),
    mockUseIsMobile: vi.fn(() => false),
  }
})

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissements: mockUseEtablissements,
}))

vi.mock('@/hooks/catalogue/useCategories', () => ({
  useCategories: mockUseCategories,
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: mockUseProfiles,
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: mockUseIsMobile,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <h3>{children}</h3>,
}))

vi.mock('lucide-react', () => ({
  CheckCircle2: () => null,
  Clock: () => null,
  AlertCircle: () => null,
  TrendingUp: () => null,
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
  PieChart: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Cell: () => null,
}))

const pastDate = '2020-01-01T00:00:00.000Z'

const TACHES: TaskForAnalytics[] = [
  {
    id: 't1',
    statut: 'Terminé',
    priorite: 'high',
    categorie_id: 'c1',
    responsable_id: 'p1',
    etablissement_id: 'e1',
    echeance: null,
  },
  {
    id: 't2',
    statut: 'En cours',
    priorite: 'medium',
    categorie_id: 'c1',
    responsable_id: 'p1',
    etablissement_id: 'e1',
    echeance: null,
  },
  {
    id: 't3',
    statut: 'A faire',
    priorite: 'high',
    categorie_id: 'c2',
    responsable_id: 'p2',
    etablissement_id: 'e2',
    echeance: pastDate,
  },
  {
    id: 't4',
    statut: 'Bloqué',
    priorite: 'low',
    categorie_id: 'c2',
    responsable_id: 'p2',
    etablissement_id: 'e2',
    echeance: null,
  },
] as unknown as TaskForAnalytics[]

describe('TasksAnalyticsView', () => {
  it('affiche les statistiques générales correctes', () => {
    render(<TasksAnalyticsView taches={TACHES} />)

    expect(screen.getByText('Total')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText('Terminées')).toBeTruthy()
    expect(screen.getByText('En cours')).toBeTruthy()
    expect(screen.getByText('En retard')).toBeTruthy()
    // "1" apparaît 5 fois : stats Terminées=1, En cours=1, En retard=1
    // + légende priorité (Moyenne=1, Basse=1)
    expect(screen.getAllByText('1')).toHaveLength(5)
    // Catégories : Commercial=2 et Technique=2 dans la légende
    expect(screen.getAllByText('2')).toHaveLength(3)
  })

  it('affiche les graphiques de distribution avec les légendes métier', () => {
    render(<TasksAnalyticsView taches={TACHES} />)

    expect(screen.getByText('Distribution par Catégorie')).toBeTruthy()
    expect(screen.getByText('Distribution par Priorité')).toBeTruthy()

    // Légende catégories : Commercial = 2 tâches, Technique = 2 tâches → 50.0% chacune
    expect(screen.getByText('Commercial')).toBeTruthy()
    expect(screen.getByText('Technique')).toBeTruthy()
    expect(screen.getAllByText('(50.0%)').length).toBeGreaterThanOrEqual(3)

    // Légende priorités : Haute=2, Moyenne=1, Basse=1
    expect(screen.getByText('Haute')).toBeTruthy()
    expect(screen.getByText('Moyenne')).toBeTruthy()
    expect(screen.getByText('Basse')).toBeTruthy()
    expect(screen.getAllByText('(25.0%)')).toHaveLength(2)
  })

  it('affiche la charge de travail par personne et le taux de complétion par établissement', () => {
    render(<TasksAnalyticsView taches={TACHES} />)

    expect(screen.getByText('Charge de Travail par Personne')).toBeTruthy()
    expect(screen.getByText('Taux de Complétion par Établissement (Top 10)')).toBeTruthy()
    expect(screen.getAllByText('Distribution par Catégorie')).toHaveLength(1)
  })

  it('masque tous les graphiques et affiche des stats à zéro quand il n y a pas de tâches', () => {
    render(<TasksAnalyticsView taches={[]} />)

    // total, terminées, en cours, en retard → 4 zéros
    expect(screen.getAllByText('0')).toHaveLength(4)
    expect(screen.queryByText('Distribution par Catégorie')).toBeNull()
    expect(screen.queryByText('Distribution par Priorité')).toBeNull()
    expect(screen.queryByText('Charge de Travail par Personne')).toBeNull()
    expect(screen.queryByText('Taux de Complétion par Établissement (Top 10)')).toBeNull()
  })

  it('gère des données de hooks absentes (data undefined) sans crash', () => {
    mockUseEtablissements.mockReturnValueOnce({ data: undefined } as unknown as ReturnType<
      typeof mockUseEtablissements
    >)
    mockUseCategories.mockReturnValueOnce({ data: undefined } as unknown as ReturnType<
      typeof mockUseCategories
    >)
    mockUseProfiles.mockReturnValueOnce({ data: undefined } as unknown as ReturnType<
      typeof mockUseProfiles
    >)

    render(<TasksAnalyticsView taches={TACHES} />)

    expect(screen.getByText('Total')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.queryByText('Distribution par Catégorie')).toBeNull()
    expect(screen.queryByText('Charge de Travail par Personne')).toBeNull()
    // La distribution par priorité ne dépend pas des hooks → toujours visible
    expect(screen.getByText('Distribution par Priorité')).toBeTruthy()
  })
})
