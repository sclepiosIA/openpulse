/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SocialDashboard from './SocialDashboard';

const {
  AUTH_STATE,
  PERMS_LOADING,
  PERMS_ALLOWED,
  PERMS_DENIED,
  BRANDS,
  CONNECTIONS,
  KPIS,
  invokeMock,
  mockFrom,
  toastSuccess,
  toastError,
  pageTitleMock,
  brandsRefetch,
  connsRefetch,
  kpisRefetch,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  PERMS_LOADING: { role: 'marketing', isLoading: true },
  PERMS_ALLOWED: { role: 'marketing', isLoading: false },
  PERMS_DENIED: { role: 'viewer', isLoading: false },
  BRANDS: [
    { id: 'b1', name: 'Alpha', color_hex: '#ff0000' },
    { id: 'b2', name: 'Beta', color_hex: '#00ff00' },
  ],
  CONNECTIONS: [
    { id: 'c1', brand_id: 'b1', provider: 'linkedin' },
    { id: 'c2', brand_id: 'b1', provider: 'facebook' },
    { id: 'c3', brand_id: 'b2', provider: 'instagram' },
  ],
  KPIS: {
    followers: 120,
    engagementRate: 4.2,
    published: 8,
    recent: [
      { id: 'p1', title: 'Post A' },
      { id: 'p2', title: 'Post B' },
    ],
  },
  invokeMock: vi.fn(),
  mockFrom: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  pageTitleMock: vi.fn(),
  brandsRefetch: vi.fn(),
  connsRefetch: vi.fn(),
  kpisRefetch: vi.fn(),
}));

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
  single: vi.fn(async () => ({ data: null, error: null })),
  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
  then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled),
  catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected),
};

mockFrom.mockImplementation(() => builder);

let roleState = PERMS_ALLOWED;
let brandsState = {
  data: BRANDS,
  isLoading: false,
  isError: false,
  error: null as Error | null,
  refetch: brandsRefetch,
};
let connsState = {
  data: CONNECTIONS,
  isLoading: false,
  isError: false,
  error: null as Error | null,
  refetch: connsRefetch,
};
let kpisState = {
  kpis: KPIS,
  isLoading: false,
  refetch: kpisRefetch,
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: pageTitleMock,
}));

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => roleState,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/social/useSocialBrands', () => ({
  useSocialBrands: () => brandsState,
}));

vi.mock('@/hooks/social/useSocialConnections', () => ({
  useSocialConnections: () => connsState,
}));

vi.mock('@/hooks/social/useSocialKpis', () => ({
  useSocialKpis: (activeBrand?: string) => ({
    ...kpisState,
    kpis:
      activeBrand === 'b1'
        ? {
            ...KPIS,
            recent: [{ id: 'p-b1', title: 'Brand One Post' }],
          }
        : kpisState.kpis,
  }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) =>
    React.createElement('a', { href: to }, children),
  useNavigate: () => vi.fn(),
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => React.createElement('svg', { 'data-class': className });
  return {
    Share2: Icon,
    Settings: Icon,
    RefreshCw: Icon,
    Loader2: Icon,
    Inbox: Icon,
    Calendar: Icon,
    PenSquare: Icon,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    asChild,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    asChild?: boolean;
  }) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children);
    }
    return React.createElement('button', { onClick, disabled }, children);
  },
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => React.createElement('div', { 'data-tabs-value': value, 'data-on-change': String(Boolean(onValueChange)) }, children),
  TabsList: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  TabsTrigger: ({
    value,
    children,
    className,
  }: {
    value: string;
    children: React.ReactNode;
    className?: string;
  }) => React.createElement('button', { type: 'button', 'data-value': value, className }, children),
}));

vi.mock('@/components/shared/PageDataState', () => ({
  PageDataState: ({
    isLoading,
    isError,
    error,
    isEmpty,
    emptyTitle,
    loadingLabel,
    children,
  }: {
    isLoading: boolean;
    isError: boolean;
    error?: Error | null;
    isEmpty: boolean;
    emptyTitle: string;
    loadingLabel: string;
    children: React.ReactNode;
  }) => {
    if (isLoading) {
      return React.createElement('div', null, loadingLabel);
    }
    if (isError) {
      return React.createElement('div', null, error?.message ?? 'error');
    }
    if (isEmpty) {
      return React.createElement('div', null, emptyTitle);
    }
    return React.createElement(React.Fragment, null, children);
  },
}));

vi.mock('@/components/social/BrandCard', () => ({
  BrandCard: ({
    brand,
    connections,
  }: {
    brand: { id: string; name: string };
    connections: Array<{ id: string }>;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': `brand-card-${brand.id}` },
      `${brand.name}:${connections.length}`
    ),
}));

vi.mock('@/components/social/SocialKpiGrid', () => ({
  SocialKpiGrid: ({ kpis }: { kpis: { followers: number; engagementRate: number; published: number } }) =>
    React.createElement(
      'div',
      { 'data-testid': 'kpi-grid' },
      `followers=${kpis.followers};engagement=${kpis.engagementRate};published=${kpis.published}`
    ),
}));

vi.mock('@/components/social/SocialFeedTimeline', () => ({
  SocialFeedTimeline: ({ posts }: { posts: Array<{ id: string; title: string }> }) =>
    React.createElement(
      'div',
      { 'data-testid': 'feed-timeline' },
      posts.map((p) => p.title).join('|')
    ),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('SocialDashboard', () => {
  beforeEach(() => {
    roleState = PERMS_ALLOWED;
    brandsState = {
      data: BRANDS,
      isLoading: false,
      isError: false,
      error: null,
      refetch: brandsRefetch,
    };
    connsState = {
      data: CONNECTIONS,
      isLoading: false,
      isError: false,
      error: null,
      refetch: connsRefetch,
    };
    kpisState = {
      kpis: KPIS,
      isLoading: false,
      refetch: kpisRefetch,
    };
    invokeMock.mockReset();
    mockFrom.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
    pageTitleMock.mockClear();
    brandsRefetch.mockClear();
    connsRefetch.mockClear();
    kpisRefetch.mockClear();
  });

  it('affiche l’état de chargement quand les permissions ou les requêtes chargent', () => {
    roleState = PERMS_LOADING;

    render(React.createElement(SocialDashboard), { wrapper: createWrapper() });

    expect(screen.getByText('Chargement des marques…')).toBeInTheDocument();
    expect(pageTitleMock).toHaveBeenCalledWith('Social Dashboard');
  });

  it('affiche les données métier au succès', () => {
    render(React.createElement(SocialDashboard), { wrapper: createWrapper() });

    expect(screen.getByText('Social Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Toutes les marques')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();

    expect(screen.getByTestId('kpi-grid')).toHaveTextContent('followers=120;engagement=4.2;published=8');
    expect(screen.getByTestId('feed-timeline')).toHaveTextContent('Post A|Post B');

    expect(screen.getByTestId('brand-card-b1')).toHaveTextContent('Alpha:2');
    expect(screen.getByTestId('brand-card-b2')).toHaveTextContent('Beta:1');

    expect(screen.getByRole('link', { name: /composer/i })).toHaveAttribute('href', '/social/composer');
    expect(screen.getByRole('link', { name: /calendrier/i })).toHaveAttribute('href', '/social/calendrier');
    expect(screen.getByRole('link', { name: /inbox/i })).toHaveAttribute('href', '/social/inbox');
    expect(screen.getByRole('link', { name: /connexions/i })).toHaveAttribute('href', '/parametres/social');
  });

  it('affiche une erreur d’accès si le rôle n’est pas autorisé', () => {
    roleState = PERMS_DENIED;

    render(React.createElement(SocialDashboard), { wrapper: createWrapper() });

    expect(
      screen.getByText('Accès réservé aux équipes commerciale, marketing et direction.')
    ).toBeInTheDocument();
  });

  it('affiche une erreur quand une requête remonte une erreur', () => {
    brandsState = {
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('x'),
      refetch: brandsRefetch,
    };

    render(React.createElement(SocialDashboard), { wrapper: createWrapper() });

    expect(screen.getByText('x')).toBeInTheDocument();
  });

  it('déclenche la synchronisation et rafraîchit les KPI et connexions', async () => {
    invokeMock.mockResolvedValue({ data: { connections: 3 }, error: null });

    render(React.createElement(SocialDashboard), { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /synchroniser/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('social-sync', { body: {} });
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Synchronisation terminée — 3 connexion(s)');
    });

    expect(kpisRefetch).toHaveBeenCalledTimes(1);
    expect(connsRefetch).toHaveBeenCalledTimes(1);
  });

  it('affiche une erreur toast si la synchronisation échoue', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'x' } });

    render(React.createElement(SocialDashboard), { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /synchroniser/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('x');
    });

    expect(kpisRefetch).not.toHaveBeenCalled();
    expect(connsRefetch).not.toHaveBeenCalled();
  });
});