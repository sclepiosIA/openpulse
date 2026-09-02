// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouteGuard } from './RouteGuard';

const {
  stablePermissions,
  mockUseRolePermissions,
  mockNavigate,
  mockUseLocation,
} = vi.hoisted(() => {
  const stablePermissions = {
    isLoading: false,
    role: 'member',
    team: 'sales',
    isAdmin: false,
    canViewDashboard: false,
    canManageUsers: false,
    canEditSettings: false,
  };

  return {
    stablePermissions,
    mockUseRolePermissions: vi.fn(() => stablePermissions),
    mockNavigate: vi.fn(),
    mockUseLocation: vi.fn(() => ({ pathname: '/protected', search: '', hash: '', state: null, key: 'k1' })),
  };
});

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: mockUseRolePermissions,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockUseLocation(),
    Navigate: ({ to, replace, state }: { to: string; replace?: boolean; state?: unknown }) => (
      <div
        data-testid="navigate"
        data-to={to}
        data-replace={String(Boolean(replace))}
        data-state={JSON.stringify(state)}
      />
    ),
  };
});

vi.mock('@/components/ui/full-page-loader', () => ({
  FullPageLoader: () => <div data-testid="full-page-loader">loading</div>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h1 data-testid="card-title" className={className}>
      {children}
    </h1>
  ),
  CardDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p data-testid="card-description" className={className}>
      {children}
    </p>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: string;
  }) => (
    <button type="button" data-variant={variant} className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Lock: ({ className }: { className?: string }) => <svg data-testid="lock-icon" className={className} />,
  ArrowLeft: ({ className }: { className?: string }) => <svg data-testid="arrow-left-icon" className={className} />,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('RouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stablePermissions.isLoading = false;
    stablePermissions.role = 'member';
    stablePermissions.team = 'sales';
    stablePermissions.isAdmin = false;
    stablePermissions.canViewDashboard = false;
    stablePermissions.canManageUsers = false;
    stablePermissions.canEditSettings = false;
    mockUseRolePermissions.mockImplementation(() => stablePermissions);
    mockUseLocation.mockReturnValue({ pathname: '/protected', search: '', hash: '', state: null, key: 'k1' });
  });

  it('affiche le loader pendant le chargement', () => {
    stablePermissions.isLoading = true;

    renderWithProviders(
      <RouteGuard>
        <div>secret content</div>
      </RouteGuard>
    );

    expect(screen.getByTestId('full-page-loader')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('affiche les enfants quand aucune restriction ne bloque l’accès', () => {
    renderWithProviders(
      <RouteGuard>
        <div>zone autorisée</div>
      </RouteGuard>
    );

    expect(screen.getByText('zone autorisée')).toBeInTheDocument();
    expect(screen.queryByText('Accès refusé')).not.toBeInTheDocument();
  });

  it('autorise si au moins une permission requise est vraie', () => {
    stablePermissions.canManageUsers = true;

    renderWithProviders(
      <RouteGuard requiredPermission={['canViewDashboard', 'canManageUsers']}>
        <div>gestion autorisée</div>
      </RouteGuard>
    );

    expect(screen.getByText('gestion autorisée')).toBeInTheDocument();
  });

  it('refuse quand les permissions requises sont absentes et affiche le message métier', () => {
    renderWithProviders(
      <RouteGuard requiredPermission="canManageUsers">
        <div>gestion autorisée</div>
      </RouteGuard>
    );

    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
    expect(
      screen.getByText("Vous n'avez pas les permissions nécessaires pour accéder à cette page.")
    ).toBeInTheDocument();
    expect(screen.getByText('Votre rôle actuel :')).toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();
    expect(screen.getByText('Votre équipe :')).toBeInTheDocument();
    expect(screen.getByText('sales')).toBeInTheDocument();
  });

  it('refuse un rôle explicitement interdit même si le reste pourrait autoriser', () => {
    stablePermissions.role = 'manager';
    stablePermissions.isAdmin = true;
    stablePermissions.canManageUsers = true;

    renderWithProviders(
      <RouteGuard
        disallowedRoles={['manager']}
        adminOnly
        requiredPermission="canManageUsers"
      >
        <div>admin content</div>
      </RouteGuard>
    );

    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
    expect(screen.getByText("Votre rôle n'a pas accès à cette page.")).toBeInTheDocument();
    expect(screen.queryByText('admin content')).not.toBeInTheDocument();
  });

  it('strictAdminOnly refuse direction et autres rôles non admin', () => {
    stablePermissions.role = 'direction';
    stablePermissions.isAdmin = true;

    renderWithProviders(
      <RouteGuard strictAdminOnly>
        <div>system page</div>
      </RouteGuard>
    );

    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
    expect(screen.getByText('Cette page est réservée aux administrateurs système.')).toBeInTheDocument();
  });

  it('adminOnly autorise un admin et bypass les restrictions d’équipe', () => {
    stablePermissions.role = 'admin';
    stablePermissions.team = 'ops';
    stablePermissions.isAdmin = true;

    renderWithProviders(
      <RouteGuard adminOnly allowedTeams={['sales']}>
        <div>page admin</div>
      </RouteGuard>
    );

    expect(screen.getByText('page admin')).toBeInTheDocument();
    expect(screen.queryByText('Accès refusé')).not.toBeInTheDocument();
  });

  it('refuse une équipe non autorisée pour un non-admin avec le détail des équipes', () => {
    stablePermissions.team = 'ops';
    stablePermissions.isAdmin = false;

    renderWithProviders(
      <RouteGuard allowedTeams={['sales', 'support']}>
        <div>team page</div>
      </RouteGuard>
    );

    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
    expect(screen.getByText('Cette page est réservée aux équipes : sales, support.')).toBeInTheDocument();
    expect(screen.getByText('ops')).toBeInTheDocument();
  });

  it('redirige avec Navigate quand redirectTo est fourni', () => {
    mockUseLocation.mockReturnValue({ pathname: '/current-page', search: '?x=1', hash: '', state: null, key: 'k2' });

    renderWithProviders(
      <RouteGuard requiredPermission="canEditSettings" redirectTo="/forbidden">
        <div>settings page</div>
      </RouteGuard>
    );

    const nav = screen.getByTestId('navigate');
    expect(nav).toHaveAttribute('data-to', '/forbidden');
    expect(nav).toHaveAttribute('data-replace', 'true');
    expect(nav.getAttribute('data-state')).toContain('/current-page');
  });

  it('utilise le message personnalisé de refus', () => {
    renderWithProviders(
      <RouteGuard requiredPermission="canEditSettings" accessDeniedMessage="Message personnalisé">
        <div>settings page</div>
      </RouteGuard>
    );

    expect(screen.getByText('Message personnalisé')).toBeInTheDocument();
  });

  it('déclenche navigate(-1) puis navigate("/") avec les boutons de la page de refus', () => {
    renderWithProviders(
      <RouteGuard requiredPermission="canEditSettings">
        <div>settings page</div>
      </RouteGuard>
    );

    fireEvent.click(screen.getByRole('button', { name: /retour/i }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);

    fireEvent.click(screen.getByRole('button', { name: /tableau de bord/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});