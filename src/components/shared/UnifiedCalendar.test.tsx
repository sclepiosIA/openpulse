import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  TASKS_TODAY_MIXED,
  TASKS_NEXT_ONLY,
  ABSENCES_SPANNING_TODAY,
  NO_TASKS,
  NO_ABSENCES,
  mockUseTaches,
  mockUseRHAbsences,
  mockUseRolePermissions,
  mockUseIsMobile,
} = vi.hoisted(() => ({
  TASKS_TODAY_MIXED: [
    {
      id: 't1',
      titre: 'Tâche du jour',
      echeance: '2024-03-10T09:00:00',
      statut: 'En cours',
      priorite: 'Haute',
    },
    {
      id: 't2',
      titre: 'Tâche de demain',
      echeance: '2024-03-11T10:00:00',
      statut: 'Terminé',
      priorite: 'Basse',
    },
  ],
  TASKS_NEXT_ONLY: [
    {
      id: 't3',
      titre: 'Tâche mobile lendemain',
      echeance: '2024-03-11T10:00:00',
      statut: 'En cours',
      priorite: 'Moyenne',
    },
  ],
  ABSENCES_SPANNING_TODAY: [
    {
      id: 'a1',
      date_debut: '2024-03-09T00:00:00',
      date_fin: '2024-03-10T23:59:59',
      type_absence: 'conges_payes',
      profiles: { prenom: 'Alice', nom: 'Dupont' },
    },
    {
      id: 'a2',
      date_debut: '2024-03-15T00:00:00',
      date_fin: '2024-03-16T23:59:59',
      type_absence: 'maladie',
      profiles: { prenom: 'Bob', nom: 'Martin' },
    },
  ],
  NO_TASKS: [],
  NO_ABSENCES: [],
  mockUseTaches: vi.fn(),
  mockUseRHAbsences: vi.fn(),
  mockUseRolePermissions: vi.fn(),
  mockUseIsMobile: vi.fn(),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
  CardTitle: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="card-title" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <span data-testid="badge" {...props}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="calendar" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="scroll-area" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ ...props }: Record<string, unknown>) => <div data-testid="skeleton" {...props} />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.PropsWithChildren<{ onClick?: () => void } & Record<string, unknown>>) => (
    <button data-testid="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('lucide-react', () => {
  const Icon = (name: string) => (props: Record<string, unknown>) => (
    <i data-testid={`icon-${name}`} {...props} />
  )
  return {
    Clock: Icon('clock'),
    Calendar: Icon('calendar'),
    User: Icon('user'),
    ChevronLeft: Icon('chevron-left'),
    ChevronRight: Icon('chevron-right'),
  }
})

vi.mock('@/hooks/tasks/useTaches', () => ({
  useTaches: mockUseTaches,
}))

vi.mock('@/hooks/hr/useRHAbsences', () => ({
  useRHAbsences: mockUseRHAbsences,
}))

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: mockUseRolePermissions,
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: mockUseIsMobile,
}))

import { UnifiedCalendar } from './UnifiedCalendar'

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('UnifiedCalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-03-10T12:00:00'))
    mockUseIsMobile.mockReturnValue(false)
    mockUseRolePermissions.mockReturnValue({ canViewAllAbsences: true })
    mockUseTaches.mockReturnValue({ data: TASKS_TODAY_MIXED, isLoading: false })
    mockUseRHAbsences.mockReturnValue({ absences: ABSENCES_SPANNING_TODAY, isLoading: false })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('affiche les squelettes de chargement quand isLoading est vrai', () => {
    mockUseTaches.mockReturnValue({ data: TASKS_TODAY_MIXED, isLoading: true })
    renderWithClient(<UnifiedCalendar />)
    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('affiche les tâches et absences du jour avec la légende quand le chargement est terminé', () => {
    renderWithClient(<UnifiedCalendar />)
    expect(screen.getByText('Calendrier Unifié')).toBeInTheDocument()

    // Légende
    expect(screen.getByText('Tâches')).toBeInTheDocument()
    expect(screen.getByText('Absences')).toBeInTheDocument()

    // Sections et éléments
    expect(screen.getByText('Tâches (1)')).toBeInTheDocument()
    expect(screen.getByText('Absences (1)')).toBeInTheDocument()

    // Détails tâche
    expect(screen.getByText('Tâche du jour')).toBeInTheDocument()
    expect(screen.getByText('En cours')).toBeInTheDocument()
    expect(screen.getByText('Haute')).toBeInTheDocument()

    // Détails absence
    expect(screen.getByText('Alice Dupont')).toBeInTheDocument()
    expect(screen.getByText('conges_payes')).toBeInTheDocument()

    // Le calendrier n'est visible que sur desktop (isMobile = false)
    expect(screen.getByTestId('calendar')).toBeInTheDocument()
  })

  it("n'affiche pas la section Absences ni la légende associée si l'utilisateur n'a pas la permission", () => {
    mockUseRolePermissions.mockReturnValue({ canViewAllAbsences: false })
    renderWithClient(<UnifiedCalendar />)
    // Légende Tâches présente
    expect(screen.getByText('Tâches')).toBeInTheDocument()
    // Légende Absences absente
    const absLegend = screen.queryByText('Absences')
    expect(absLegend).toBeNull()
    // Section Absences absente
    const absSection = screen.queryByText(/Absences \(/)
    expect(absSection).toBeNull()
    // Les tâches sont toujours affichées
    expect(screen.getByText('Tâches (1)')).toBeInTheDocument()
  })

  it('en mode mobile, affiche les boutons de navigation et permet de naviguer aux événements du lendemain', () => {
    mockUseIsMobile.mockReturnValue(true)
    mockUseTaches.mockReturnValue({ data: TASKS_NEXT_ONLY, isLoading: false })
    mockUseRHAbsences.mockReturnValue({ absences: NO_ABSENCES, isLoading: false })

    renderWithClient(<UnifiedCalendar />)

    // Pas de calendrier en mode mobile
    expect(screen.queryByTestId('calendar')).toBeNull()

    // Au départ aucun événement pour la date courante
    expect(screen.getByText('Aucun événement pour cette date')).toBeInTheDocument()

    // Boutons de navigation présents
    const buttons = screen.getAllByTestId('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)

    // Clic sur "next" (second bouton)
    fireEvent.click(buttons[1])

    // Après navigation, la tâche du lendemain apparaît
    expect(screen.getByText('Tâches (1)')).toBeInTheDocument()
    expect(screen.getByText('Tâche mobile lendemain')).toBeInTheDocument()
  })

  it("gère l'absence de données (erreur simulée) sans planter et affiche le message d'absence d'événements", () => {
    mockUseTaches.mockReturnValue({ data: null, isLoading: false, error: { message: 'x' } })
    mockUseRHAbsences.mockReturnValue({ absences: null, isLoading: false, error: { message: 'y' } })
    renderWithClient(<UnifiedCalendar />)
    expect(screen.getByText('Aucun événement pour cette date')).toBeInTheDocument()
    expect(screen.getByText('Tâches')).toBeInTheDocument()
  })
})
