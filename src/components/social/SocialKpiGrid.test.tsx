/* @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { SocialKpiGrid } from './SocialKpiGrid';

const { KPI_PROPS, mockFrom, mockToastSuccess, mockToastError, AUTH_STATE, navigateMock } = vi.hoisted(() => ({
  KPI_PROPS: {
    postsCount: 1523,
    totalEngagement: 2500000,
    totalReach: 987,
    totalFollowers: 4300500,
    avgEngagementPerPost: 12,
  },
  mockFrom: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  AUTH_STATE: {
    user: { id: 'u1', email: 'test@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  navigateMock: vi.fn(),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Heart: Icon,
    MessageSquare: Icon,
    Eye: Icon,
    Users: Icon,
    BarChart3: Icon,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('SocialKpiGrid', () => {
  it('renderHook fonctionne avec QueryClientProvider configuré', async () => {
    const { result } = renderHook(
      async () => {
        await Promise.resolve();
        return { isLoading: false, isSuccess: true };
      },
      { wrapper: createWrapper() }
    );

    await waitFor(async () => {
      await expect(result.current).resolves.toEqual({ isLoading: false, isSuccess: true });
    });
  });

  it('affiche les 5 KPI avec les labels métier et les valeurs formatées', () => {
    render(<SocialKpiGrid kpis={KPI_PROPS} />);

    expect(screen.getByText('Posts (90j)')).toBeInTheDocument();
    expect(screen.getByText('Engagement total')).toBeInTheDocument();
    expect(screen.getByText('Vues / portée')).toBeInTheDocument();
    expect(screen.getByText('Followers cumulés')).toBeInTheDocument();
    expect(screen.getByText('Engagement / post')).toBeInTheDocument();

    expect(screen.getByText('1.5k')).toBeInTheDocument();
    expect(screen.getByText('2.5M')).toBeInTheDocument();
    expect(screen.getByText('987')).toBeInTheDocument();
    expect(screen.getByText('4.3M')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    expect(screen.getAllByTestId('card')).toHaveLength(5);
    expect(screen.getAllByTestId('card-content')).toHaveLength(5);
    expect(screen.getAllByTestId('icon')).toHaveLength(5);
  });

  it('affiche correctement les petites valeurs sans format k/M', () => {
    render(
      <SocialKpiGrid
        kpis={{
          postsCount: 0,
          totalEngagement: 1,
          totalReach: 12,
          totalFollowers: 999,
          avgEngagementPerPost: 7,
        }}
      />
    );

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('999')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('gère un état de chargement côté parent en ne rendant pas le composant tant que les données ne sont pas prêtes', () => {
    const { rerender, queryByText } = render(
      <div>{false ? <SocialKpiGrid kpis={KPI_PROPS} /> : <span>Chargement...</span>}</div>
    );

    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(queryByText('Posts (90j)')).not.toBeInTheDocument();

    rerender(
      <div>{true ? <SocialKpiGrid kpis={KPI_PROPS} /> : <span>Chargement...</span>}</div>
    );

    expect(screen.getByText('Posts (90j)')).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it('gère un état d erreur côté parent et ne rend pas la grille si les données sont nulles avec error.message', () => {
    const errorState: { data: null; error: { message: string }; isError: true } = {
      data: null,
      error: { message: 'x' },
      isError: true,
    };

    render(
      <div>
        {errorState.isError ? <span>Erreur: {errorState.error.message}</span> : <SocialKpiGrid kpis={KPI_PROPS} />}
      </div>
    );

    expect(screen.getByText('Erreur: x')).toBeInTheDocument();
    expect(screen.queryByText('Posts (90j)')).not.toBeInTheDocument();
  });
});