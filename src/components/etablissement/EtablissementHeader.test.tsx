import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { EtablissementHeader } from './EtablissementHeader'

const {
  GROUPES_DATA,
  AUTH_STATE,
  mockFrom,
  mockUseGroupesForEtablissement,
  mockMutateAsync,
  mockUseUpdateEtablissement,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  GROUPES_DATA: [
    {
      groupe: {
        nom: 'Groupe Horizon',
        logo_url: 'https://img/logo.png',
      },
    },
  ],
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockUseGroupesForEtablissement: vi.fn(),
  mockMutateAsync: vi.fn(),
  mockUseUpdateEtablissement: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
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
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    }
    return builder
  }

  mockFrom.mockImplementation(() => createBuilder())

  return {
    supabase: {
      from: mockFrom,
    },
  }
})

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    type,
  }: {
    children?: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    className?: string
    type?: 'button' | 'submit' | 'reset'
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}))

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>()
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />
  return {
    ...actual,
    MapPin: Icon,
    ChevronRight: Icon,
    Home: Icon,
    ChevronDown: Icon,
    Check: Icon,
    TrendingUp: Icon,
    CheckCircle2: Icon,
    Users: Icon,
    Circle: Icon,
    Clock: Icon,
    AlertTriangle: Icon,
    Sparkles: Icon,
    CheckCircle: Icon,
    XCircle: Icon,
  }
})

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className }: { children?: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}))

vi.mock('@/components/ui/breadcrumb', () => ({
  Breadcrumb: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <nav className={className}>{children}</nav>
  ),
  BreadcrumbItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  BreadcrumbLink: ({ children, asChild }: { children?: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <a>{children}</a>,
  BreadcrumbList: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  BreadcrumbPage: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
  BreadcrumbSeparator: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/etablissement/QuickActionsBar', () => ({
  QuickActionsBar: () => <div data-testid="quick-actions-bar" />,
}))

vi.mock('@/components/notifications/NotificationsBell', () => ({
  NotificationsBell: () => <div data-testid="notifications-bell" />,
}))

vi.mock('@/components/search/GlobalSearchDialog', () => ({
  GlobalSearchDialog: () => <div data-testid="global-search-dialog" />,
}))

vi.mock('@/components/ui/EntityAvatar', () => ({
  EntityAvatar: ({
    name,
    logoUrl,
    size,
    className,
  }: {
    name: string
    logoUrl?: string | null
    size?: string
    className?: string
  }) => (
    <div data-testid="entity-avatar" data-name={name} data-logo={logoUrl ?? ''} data-size={size} className={className} />
  ),
}))

vi.mock('@/hooks/crm/useEtablissementGroupes', () => ({
  useGroupesForEtablissement: (id: string) => mockUseGroupesForEtablissement(id),
}))

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useUpdateEtablissement: () => mockUseUpdateEtablissement(),
}))

vi.mock('@/config/phases', () => ({
  PHASE_GROUPS: {
    commercial: { statuts: ['Prospect', 'Contractuel'] },
    deploiement: { statuts: ['Déploiement', 'Formation'] },
    production: { statuts: ['Go-Live', 'Production'] },
  },
}))

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onOpenChange,
  }: {
    open?: boolean
    onConfirm?: () => void
    onOpenChange?: (open: boolean) => void
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <button onClick={onConfirm}>Confirmer</button>
        <button onClick={() => onOpenChange?.(false)}>Fermer</button>
      </div>
    ) : null,
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({
    children,
  }: {
    children?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) => <div>{children}</div>,
  PopoverTrigger: ({ children, asChild }: { children?: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <button>{children}</button>,
  PopoverContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: ({ className }: { className?: string }) => <hr className={className} />,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value?: number }) => <div data-testid="progress" data-value={value ?? 0} />,
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper() {
  const queryClient = createQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const baseEtablissement = {
  id: 'eta-1',
  nom: 'Clinique du Lac',
  ville: 'Annecy',
  region: 'Auvergne-Rhône-Alpes',
  statut: 'Contractuel',
  logo_url: null,
  enrichment_status: 'done',
  enrichment_at: '2024-05-01',
  commercial: { id: 'c1', prenom: 'Alice', nom: 'Martin' },
  chef_projet: { id: 'cp1', prenom: 'Jean', nom: 'Dupont' },
  csm: { id: 'csm1', prenom: 'Lina', nom: 'Bernard' },
}

describe('EtablissementHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseGroupesForEtablissement.mockReturnValue({ data: GROUPES_DATA, isLoading: false, isError: false, error: null })
    mockUseUpdateEtablissement.mockReturnValue({
      mutateAsync: mockMutateAsync.mockResolvedValue({ id: 'eta-1' }),
      isPending: false,
      isError: false,
      error: null,
    })
  })

  it('utilise renderHook avec QueryClientProvider sans erreur', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => mockUseGroupesForEtablissement('eta-1'), { wrapper })
    expect(result.current.data).toEqual(GROUPES_DATA)
    expect(mockUseGroupesForEtablissement).toHaveBeenCalledWith('eta-1')
  })

  it('affiche les informations métier réelles du header avec le logo du groupe par défaut', () => {
    render(
      <EtablissementHeader
        etablissement={baseEtablissement}
        onEdit={vi.fn()}
        progression={64}
        tasksCompleted={8}
        tasksTotal={12}
        upcomingDeadlines={3}
        tasksStatusBreakdown={{ aFaire: 2, enCours: 4, bloque: 1, termine: 8 }}
        aiSuggestions={[
          {
            id: 'ai-1',
            status: 'pending',
            confidence_score: 0.87,
            action_type: 'create_task',
            action_data: { title: 'Relancer le client' },
          } as {
            id: string
            status: string
            confidence_score: number
            action_type: string
            action_data: Record<string, string>
          },
        ]}
      />
    )

    expect(screen.getAllByText('Clinique du Lac')[0]).toBeInTheDocument()
    expect(screen.getByText('Établissements')).toBeInTheDocument()
    expect(screen.getAllByText('Contractuel').length).toBeGreaterThan(0)
    expect(screen.getByText('Annecy, Auvergne-Rhône-Alpes')).toBeInTheDocument()

    const avatar = screen.getByTestId('entity-avatar')
    expect(avatar.getAttribute('data-name')).toBe('Clinique du Lac')
    expect(avatar.getAttribute('data-logo')).toBe('https://img/logo.png')
    expect(avatar.getAttribute('data-size')).toBe('xl')

    expect(screen.getByTestId('notifications-bell')).toBeInTheDocument()
    expect(screen.getByTestId('global-search-dialog')).toBeInTheDocument()
    expect(mockUseGroupesForEtablissement).toHaveBeenCalledWith('eta-1')
  })

  it('gère un état de chargement du hook groupes puis un succès', async () => {
    mockUseGroupesForEtablissement
      .mockReturnValueOnce({ data: undefined, isLoading: true, isError: false, error: null })
      .mockReturnValue({ data: GROUPES_DATA, isLoading: false, isError: false, error: null })

    const { rerender } = render(
      <EtablissementHeader etablissement={baseEtablissement} onEdit={vi.fn()} />
    )

    expect(screen.getByTestId('entity-avatar').getAttribute('data-logo')).toBe('')

    rerender(<EtablissementHeader etablissement={baseEtablissement} onEdit={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('entity-avatar').getAttribute('data-logo')).toBe('https://img/logo.png')
    })
  })

  it('déclenche la mutation de changement de statut avec les bonnes données après confirmation', async () => {
    render(<EtablissementHeader etablissement={baseEtablissement} onEdit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /déploiement/i }))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /confirmer/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: 'eta-1',
        data: { statut: 'Déploiement' },
      })
    })
  })

  it('ne déclenche pas de mutation si on sélectionne le statut courant', () => {
    render(<EtablissementHeader etablissement={baseEtablissement} onEdit={vi.fn()} />)

    const currentStatusButtons = screen.getAllByRole('button', { name: /contractuel/i })
    fireEvent.click(currentStatusButtons[currentStatusButtons.length - 1])

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it('reste rendable quand le hook groupes renvoie une erreur', () => {
    mockUseGroupesForEtablissement.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
    })

    render(<EtablissementHeader etablissement={baseEtablissement} onEdit={vi.fn()} />)

    expect(screen.getAllByText('Clinique du Lac')[0]).toBeInTheDocument()
    expect(screen.getByText('Annecy, Auvergne-Rhône-Alpes')).toBeInTheDocument()
    expect(screen.getByTestId('entity-avatar').getAttribute('data-logo')).toBe('')
  })
})