import { render, screen, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { DeploymentGanttView } from './DeploymentGanttView'

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/components/etablissement-gantt/GanttDualLayout', () => ({
  GanttDualLayout: ({
    fixedContent,
    scrollableContent,
  }: {
    fixedContent: React.ReactNode
    scrollableContent: React.ReactNode
  }) => (
    <div data-testid="gantt-dual-layout">
      <div data-testid="gantt-fixed">{fixedContent}</div>
      <div data-testid="gantt-scrollable">{scrollableContent}</div>
    </div>
  ),
}))

vi.mock('@/components/ui/EntityAvatar', () => ({
  EntityAvatar: () => <div data-testid="entity-avatar" />,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children?: React.ReactNode
    onClick?: () => void
    'aria-label'?: string
  }) => (
    <button onClick={onClick} aria-label={rest['aria-label']}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/toggle-group', () => ({
  ToggleGroup: ({ children }: { children?: React.ReactNode }) => <div role="group">{children}</div>,
  ToggleGroupItem: ({ children, value }: { children?: React.ReactNode; value: string }) => (
    <button data-value={value}>{children}</button>
  ),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', () => ({
  ChevronLeft: () => null,
  ChevronRight: () => null,
  CalendarDays: () => null,
  ZoomIn: () => null,
  ZoomOut: () => null,
  Building2: () => null,
  Calendar: () => null,
}))

type Props = ComponentProps<typeof DeploymentGanttView>
type EtabList = Props['etablissements']

const ETABLISSEMENTS = [
  {
    id: 'etab-1',
    nom: 'Clinique Alpha',
    statut: 'Déploiement',
    progression: 45,
    date_signature: '2024-01-10',
    created_at: '2024-01-01',
    date_fin_contrat: null,
    logo_url: null,
  },
  {
    id: 'etab-2',
    nom: 'Hopital Beta',
    statut: 'Prospect',
    progression: 0,
    date_signature: null,
    created_at: '2024-03-15',
    date_fin_contrat: '2024-09-15',
    logo_url: null,
  },
] as unknown as EtabList

// Le texte "45%" est rendu en nœuds de texte séparés ({valeur}%),
// donc on matche sur le textContent complet d'un élément feuille.
const leafText = (expected: string) => (_: string, element: Element | null) =>
  element !== null &&
  element.children.length === 0 &&
  element.textContent === expected

describe('DeploymentGanttView', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('affiche un état vide quand aucun établissement', () => {
    render(<DeploymentGanttView etablissements={[] as unknown as EtabList} />)

    expect(
      screen.getByText('Aucun établissement avec date de signature')
    ).toBeTruthy()
    expect(screen.queryByTestId('gantt-dual-layout')).toBeNull()
  })

  it('rend le gantt avec les noms, progression et compteur des établissements', () => {
    render(<DeploymentGanttView etablissements={ETABLISSEMENTS} />)

    expect(screen.getByTestId('gantt-dual-layout')).toBeTruthy()
    expect(screen.getByText('Clinique Alpha')).toBeTruthy()
    expect(screen.getByText('Hopital Beta')).toBeTruthy()

    // Compteur dans le header de la colonne fixe
    expect(screen.getByText('Établissements')).toBeTruthy()
    expect(screen.getByText(leafText('2'))).toBeTruthy()

    // Progression : 45% apparaît dans le label ET dans la barre (texte fragmenté)
    expect(screen.getAllByText(leafText('45%')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(leafText('0%')).length).toBeGreaterThanOrEqual(1)

    // Statuts des établissements (peuvent apparaître plusieurs fois : badge + légendes)
    expect(screen.getAllByText('Déploiement').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Prospect').length).toBeGreaterThanOrEqual(1)

    // Pas d'état "Aucune donnée"
    expect(screen.queryByText('Aucune donnée')).toBeNull()
  })

  it('affiche les contrôles de navigation et la légende des phases', () => {
    render(<DeploymentGanttView etablissements={ETABLISSEMENTS} />)

    expect(screen.getByLabelText('Précédent')).toBeTruthy()
    expect(screen.getByLabelText('Suivant')).toBeTruthy()

    // Marqueur "Aujourd'hui" + bouton "Aujourd'hui"
    expect(screen.getAllByText("Aujourd'hui").length).toBeGreaterThanOrEqual(1)

    // Légende des phases (présente en version desktop ET possiblement mobile → getAllByText)
    expect(screen.getAllByText('Contractuel').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Conformité').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Formation').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Go-Live').length).toBeGreaterThanOrEqual(1)

    // Options de zoom
    expect(screen.getByText('Sem')).toBeTruthy()
    expect(screen.getByText('Mois')).toBeTruthy()
    expect(screen.getByText('Trim')).toBeTruthy()
  })

  it('navigue vers la fiche établissement au clic sur une ligne', () => {
    render(<DeploymentGanttView etablissements={ETABLISSEMENTS} />)

    fireEvent.click(screen.getByText('Clinique Alpha'))

    expect(mockNavigate).toHaveBeenCalledWith('/etablissements/etab-1')
  })

  it('les boutons de navigation de période ne plantent pas sans ref scrollable', () => {
    render(<DeploymentGanttView etablissements={ETABLISSEMENTS} />)

    fireEvent.click(screen.getByLabelText('Précédent'))
    fireEvent.click(screen.getByLabelText('Suivant'))

    // Le clic ne déclenche pas de navigation route
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})