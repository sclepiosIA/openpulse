/* @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RHPlanningAbsences } from './RHPlanningAbsences';

const {
  stableLoadingState,
  stableDataState,
  stableEmptyState,
  stableErrorState,
  mockUseRHAbsences,
  mockFrom,
  mockNavigate,
} = vi.hoisted(() => ({
  stableLoadingState: {
    absences: [],
    isLoading: true,
    isError: false,
    error: null,
  },
  stableDataState: {
    absences: [
      {
        id: 'abs-1',
        type_absence: 'Congés payés',
        statut: 'Validé',
        date_debut: '2024-05-10',
        date_fin: '2024-05-12',
        motif: 'Vacances en famille',
        profiles: {
          prenom: 'Marie',
          nom: 'Dupont',
        },
      },
      {
        id: 'abs-2',
        type_absence: 'Congé maladie',
        statut: 'Refusé',
        date_debut: '2024-06-01',
        date_fin: '2024-06-01',
        motif: '',
        profiles: {
          prenom: 'Jean',
          nom: 'Martin',
        },
      },
      {
        id: 'abs-3',
        type_absence: 'RTT',
        statut: 'En attente',
        date_debut: '2024-07-20',
        date_fin: '2024-07-21',
        motif: 'Week-end prolongé',
        profiles: {
          prenom: 'Sophie',
          nom: 'Bernard',
        },
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
  },
  stableEmptyState: {
    absences: [],
    isLoading: false,
    isError: false,
    error: null,
  },
  stableErrorState: {
    absences: null,
    isLoading: false,
    isError: true,
    error: { message: 'x' },
  },
  mockUseRHAbsences: vi.fn(),
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('@/hooks/hr/useRHAbsences', () => ({
  useRHAbsences: mockUseRHAbsences,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
  }) => (
    <span data-testid="badge" data-variant={variant ?? ''} data-class={className ?? ''}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" data-class={className ?? ''} />
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/integrations/supabase/client', () => {
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
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
  };

  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
    },
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

describe('RHPlanningAbsences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche l’état de chargement avec 5 skeletons et les titres', () => {
    mockUseRHAbsences.mockReturnValue(stableLoadingState);

    render(<RHPlanningAbsences />, { wrapper: createWrapper() });

    expect(screen.getByText('Planning des absences')).toBeInTheDocument();
    expect(screen.getByText("Congés et absences de l'équipe")).toBeInTheDocument();
    expect(screen.getAllByTestId('skeleton')).toHaveLength(5);
    expect(screen.queryByText('Aucune absence enregistrée')).not.toBeInTheDocument();
  });

  it('affiche les absences avec les informations métier, badges et durées calculées', () => {
    mockUseRHAbsences.mockReturnValue(stableDataState);

    render(<RHPlanningAbsences />, { wrapper: createWrapper() });

    expect(screen.getByText('Marie Dupont')).toBeInTheDocument();
    expect(screen.getByText('Jean Martin')).toBeInTheDocument();
    expect(screen.getByText('Sophie Bernard')).toBeInTheDocument();

    expect(screen.getByText('Vacances en famille')).toBeInTheDocument();
    expect(screen.getByText('Week-end prolongé')).toBeInTheDocument();

    expect(screen.getByText('Congés payés')).toBeInTheDocument();
    expect(screen.getByText('Congé maladie')).toBeInTheDocument();
    expect(screen.getByText('RTT')).toBeInTheDocument();

    expect(screen.getByText('Validé')).toBeInTheDocument();
    expect(screen.getByText('Refusé')).toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();

    expect(screen.getByText('Du 10 mai 2024 au 12 mai 2024')).toBeInTheDocument();
    expect(screen.getByText('Du 01 juin 2024 au 01 juin 2024')).toBeInTheDocument();
    expect(screen.getByText('Du 20 juil. 2024 au 21 juil. 2024')).toBeInTheDocument();

    expect(screen.getByText('3 jour(s)')).toBeInTheDocument();
    expect(screen.getByText('1 jour(s)')).toBeInTheDocument();
    expect(screen.getByText('2 jour(s)')).toBeInTheDocument();

    const badges = screen.getAllByTestId('badge');
    expect(badges).toHaveLength(6);

    expect(screen.getByText('Congés payés')).toHaveAttribute('data-class', 'bg-blue-500');
    expect(screen.getByText('Congé maladie')).toHaveAttribute('data-class', 'bg-red-500');
    expect(screen.getByText('RTT')).toHaveAttribute('data-class', 'bg-green-500');

    expect(screen.getByText('Validé')).toHaveAttribute('data-variant', 'default');
    expect(screen.getByText('Refusé')).toHaveAttribute('data-variant', 'destructive');
    expect(screen.getByText('En attente')).toHaveAttribute('data-variant', 'default');
  });

  it('affiche le message vide quand aucune absence n’est enregistrée', () => {
    mockUseRHAbsences.mockReturnValue(stableEmptyState);

    render(<RHPlanningAbsences />, { wrapper: createWrapper() });

    expect(screen.getByText('Aucune absence enregistrée')).toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('gère un état d’erreur du hook sans figer le rendu et affiche le fallback vide', () => {
    mockUseRHAbsences.mockReturnValue(stableErrorState);

    render(<RHPlanningAbsences />, { wrapper: createWrapper() });

    expect(screen.getByText('Planning des absences')).toBeInTheDocument();
    expect(screen.getByText('Aucune absence enregistrée')).toBeInTheDocument();
    expect(mockUseRHAbsences).toHaveBeenCalledTimes(1);
  });
});