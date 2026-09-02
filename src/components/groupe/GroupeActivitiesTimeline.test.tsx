/* @vitest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GroupeActivitiesTimeline } from './GroupeActivitiesTimeline'

const {
  ACTIVITIES,
  EMPTY_ACTIVITIES,
  STATS,
  ZERO_STATS,
  hookState,
  stableAuth,
  mockFrom,
  mockNavigate,
} = vi.hoisted(() => ({
  ACTIVITIES: [
    {
      id: 'a1',
      title: 'QBR trimestriel',
      activity_type: 'qbr',
      activity_date: '2024-01-10T10:00:00.000Z',
      etablissement_id: 'e1',
      etablissement_nom: 'Clinique Paris',
      status: 'completed',
      description: 'Revue trimestrielle effectuée',
    },
    {
      id: 'a2',
      title: 'Session de formation',
      activity_type: 'training',
      activity_date: '2024-01-15T11:00:00.000Z',
      etablissement_id: 'e2',
      etablissement_nom: 'Hôpital Lyon',
      status: 'in_progress',
      description: 'Formation en cours pour les équipes',
    },
    {
      id: 'a3',
      title: 'Incident critique',
      activity_type: 'incident',
      activity_date: '2024-01-20T12:00:00.000Z',
      etablissement_id: 'e3',
      etablissement_nom: 'Centre Lille',
      status: 'scheduled',
      description: '',
    },
  ],
  EMPTY_ACTIVITIES: [],
  STATS: {
    total: 3,
    recentCount: 2,
    byStatus: {
      completed: 1,
      in_progress: 1,
      scheduled: 1,
    },
  },
  ZERO_STATS: {
    total: 0,
    recentCount: 0,
    byStatus: {
      completed: 0,
      in_progress: 0,
      scheduled: 0,
    },
  },
  hookState: {
    activitiesData: [] as Array<{
      id: string
      title: string
      activity_type: string
      activity_date: string
      etablissement_id: string
      etablissement_nom: string
      status: string
      description: string
    }> | null,
    isLoading: false,
    isError: false,
    error: null as { message: string } | null,
    stats: {
      total: 0,
      recentCount: 0,
      byStatus: {
        completed: 0,
        in_progress: 0,
        scheduled: 0,
      },
    },
  },
  stableAuth: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
}))

vi.mock('@/hooks/crm/useGroupeActivities', () => ({
  useGroupeActivities: vi.fn((_groupeId: string, _options: { limit: number }) => ({
    data: hookState.activitiesData,
    isLoading: hookState.isLoading,
    isError: hookState.isError,
    error: hookState.error,
  })),
  useGroupeActivityStats: vi.fn((_groupeId: string) => ({
    stats: hookState.stats,
  })),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
  ),
  CardDescription: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <p data-testid="card-description" className={className}>
      {children}
    </p>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children?: React.ReactNode
    className?: string
    variant?: string
  }) => (
    <span data-testid={`badge-${variant ?? 'default'}`} className={className}>
      {children}
    </span>
  ),
}))

vi.mock('lucide-react', () => ({
  Calendar: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-calendar" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
  Building2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-building" {...props} />,
  Users: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-users" {...props} />,
}))

vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn((date: Date) => {
    const iso = date.toISOString()
    if (iso === '2024-01-10T10:00:00.000Z') return 'il y a 5 jours'
    if (iso === '2024-01-15T11:00:00.000Z') return 'il y a 2 jours'
    if (iso === '2024-01-20T12:00:00.000Z') return 'dans 1 jour'
    return 'il y a quelque temps'
  }),
}))

vi.mock('date-fns/locale', () => ({
  fr: {},
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => stableAuth,
  AuthProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableAuth,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableAuth,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/integrations/supabase/client', () => {
  const result = { data: null, error: null }
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(onFulfilled(result)),
    catch: vi.fn(),
  }
  mockFrom.mockReturnValue(builder)
  return {
    supabase: {
      from: mockFrom,
    },
  }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children?: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
}

describe('GroupeActivitiesTimeline', () => {
  beforeEach(() => {
    hookState.activitiesData = EMPTY_ACTIVITIES
    hookState.isLoading = false
    hookState.isError = false
    hookState.error = null
    hookState.stats = ZERO_STATS
    mockFrom.mockClear()
    mockNavigate.mockClear()
  })

  it('affiche un loader pendant le chargement', () => {
    hookState.isLoading = true
    hookState.activitiesData = null
    hookState.stats = ZERO_STATS

    render(<GroupeActivitiesTimeline groupeId="g1" />, { wrapper: createWrapper() })

    expect(screen.getByTestId('icon-loader')).toBeInTheDocument()
    expect(screen.queryByText('Historique Groupe')).not.toBeInTheDocument()
  })

  it('affiche les statistiques et la liste des activités avec les libellés métier', () => {
    hookState.activitiesData = ACTIVITIES
    hookState.stats = STATS

    render(<GroupeActivitiesTimeline groupeId="g1" />, { wrapper: createWrapper() })

    expect(screen.getByText('Historique Groupe')).toBeInTheDocument()
    expect(screen.getByText('Activités consolidées de tous les établissements')).toBeInTheDocument()

    expect(screen.getByText('3 activités')).toBeInTheDocument()
    expect(screen.getByText('2 ce mois')).toBeInTheDocument()

    expect(screen.getByText('30 derniers jours')).toBeInTheDocument()
    expect(screen.getByText('QBR trimestriel')).toBeInTheDocument()
    expect(screen.getByText('Session de formation')).toBeInTheDocument()
    expect(screen.getByText('Incident critique')).toBeInTheDocument()

    expect(screen.getByText('QBR')).toBeInTheDocument()
    expect(screen.getByText('Formation')).toBeInTheDocument()
    expect(screen.getByText('Incident')).toBeInTheDocument()

    expect(screen.getByText('Terminé')).toBeInTheDocument()
    expect(screen.getByText('Planifié')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /Clinique Paris/i })).toHaveAttribute('href', '/etablissements/e1')
    expect(screen.getByRole('link', { name: /Hôpital Lyon/i })).toHaveAttribute('href', '/etablissements/e2')
    expect(screen.getByRole('link', { name: /Centre Lille/i })).toHaveAttribute('href', '/etablissements/e3')

    expect(screen.getByText('Revue trimestrielle effectuée')).toBeInTheDocument()
    expect(screen.getByText('Formation en cours pour les équipes')).toBeInTheDocument()

    expect(screen.getByText('il y a 5 jours')).toBeInTheDocument()
    expect(screen.getByText('il y a 2 jours')).toBeInTheDocument()
    expect(screen.getByText('dans 1 jour')).toBeInTheDocument()

    const completedValue = screen.getByText('Terminées').previousElementSibling
    const inProgressMatches = screen.getAllByText('En cours')
    const inProgressStatValue = inProgressMatches[0].previousElementSibling
    const scheduledValue = screen.getByText('Planifiées').previousElementSibling
    const recentValue = screen.getByText('30 derniers jours').previousElementSibling

    expect(completedValue).toHaveTextContent('1')
    expect(inProgressStatValue).toHaveTextContent('1')
    expect(scheduledValue).toHaveTextContent('1')
    expect(recentValue).toHaveTextContent('2')

    expect(screen.getAllByText('En cours')).toHaveLength(2)
  })

  it('affiche l’état vide quand aucune activité n’est disponible', () => {
    hookState.activitiesData = EMPTY_ACTIVITIES
    hookState.stats = ZERO_STATS

    render(<GroupeActivitiesTimeline groupeId="g1" />, { wrapper: createWrapper() })

    expect(screen.getByText('Historique Groupe')).toBeInTheDocument()
    expect(screen.getByText('0 activité')).toBeInTheDocument()
    expect(screen.queryByText('0 ce mois')).not.toBeInTheDocument()
    expect(screen.getByTestId('icon-users')).toBeInTheDocument()
    expect(
      screen.getByText('Aucune activité enregistrée pour les établissements de ce groupe'),
    ).toBeInTheDocument()
  })

  it('ignore l’état isError du hook et continue de rendre le composant avec les stats disponibles', () => {
    hookState.isError = true
    hookState.error = { message: 'x' }
    hookState.activitiesData = EMPTY_ACTIVITIES
    hookState.stats = ZERO_STATS

    render(<GroupeActivitiesTimeline groupeId="g1" />, { wrapper: createWrapper() })

    expect(screen.getByText('Historique Groupe')).toBeInTheDocument()
    expect(screen.getByText('0 activité')).toBeInTheDocument()
    expect(
      screen.getByText('Aucune activité enregistrée pour les établissements de ce groupe'),
    ).toBeInTheDocument()
    expect(screen.queryByText('x')).not.toBeInTheDocument()
  })
})