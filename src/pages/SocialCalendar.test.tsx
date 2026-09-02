import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SocialCalendar from './SocialCalendar';

const {
  BRANDS,
  POSTS,
  DELETE_SUCCESS,
  DELETE_ERROR,
  mockUsePageTitle,
  mockUseRolePermissions,
  mockUseSocialBrands,
  mockUseScheduledPosts,
  mockToastSuccess,
  mockToastError,
  mockInvalidateQueries,
  mockFrom,
  mockBuilderFactory,
  mockConfirm,
} = vi.hoisted(() => {
  const BRANDS = [
    { id: 'b1', name: 'Marque Alpha' },
    { id: 'b2', name: 'Marque Beta' },
  ] as const;

  const POSTS = [
    {
      id: 'p1',
      brand_id: 'b1',
      status: 'scheduled',
      scheduled_at: '2025-02-14T09:30:00.000Z',
      message: 'Message planifié important',
      target_account_ids: ['a1', 'a2'],
      attempt_count: 2,
      error_message: '',
    },
    {
      id: 'p2',
      brand_id: 'b2',
      status: 'published',
      scheduled_at: null,
      message: 'Post déjà publié',
      target_account_ids: ['a3'],
      attempt_count: 0,
      error_message: '',
    },
    {
      id: 'p3',
      brand_id: 'missing',
      status: 'failed',
      scheduled_at: null,
      message: 'Post en échec',
      target_account_ids: ['a4', 'a5', 'a6'],
      attempt_count: 1,
      error_message: 'Erreur API',
    },
    {
      id: 'p4',
      brand_id: 'b1',
      status: 'processing',
      scheduled_at: null,
      message: 'Traitement en cours',
      target_account_ids: [],
      attempt_count: 0,
      error_message: '',
    },
    {
      id: 'p5',
      brand_id: 'b2',
      status: 'draft',
      scheduled_at: null,
      message: 'Brouillon interne',
      target_account_ids: ['a7'],
      attempt_count: 0,
      error_message: '',
    },
  ] as const;

  const DELETE_SUCCESS = { data: null, error: null };
  const DELETE_ERROR = { data: null, error: { message: 'x' } };

  const mockUsePageTitle = vi.fn();
  const mockUseRolePermissions = vi.fn(() => ({ role: 'marketing', isLoading: false }));
  const mockUseSocialBrands = vi.fn(() => ({ data: BRANDS, isLoading: false, isError: false, error: null }));
  const mockUseScheduledPosts = vi.fn(() => ({
    data: POSTS,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }));

  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockInvalidateQueries = vi.fn();
  const mockConfirm = vi.fn(() => true);

  const mockBuilderFactory = (result: { data: null; error: null | { message: string } }) => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      then: (onFulfilled?: ((value: typeof result) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) =>
        Promise.resolve(result).then(onFulfilled ?? undefined, onRejected ?? undefined),
      catch: (onRejected?: ((reason: unknown) => unknown) | null) =>
        Promise.resolve(result).catch(onRejected ?? undefined),
    };

    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.gte.mockReturnValue(builder);
    builder.lte.mockReturnValue(builder);
    builder.in.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.limit.mockReturnValue(builder);
    builder.insert.mockReturnValue(builder);
    builder.update.mockReturnValue(builder);
    builder.delete.mockReturnValue(builder);
    builder.single.mockResolvedValue(result);
    builder.maybeSingle.mockResolvedValue(result);

    return builder;
  };

  const mockFrom = vi.fn(() => mockBuilderFactory(DELETE_SUCCESS));

  return {
    BRANDS,
    POSTS,
    DELETE_SUCCESS,
    DELETE_ERROR,
    mockUsePageTitle,
    mockUseRolePermissions,
    mockUseSocialBrands,
    mockUseScheduledPosts,
    mockToastSuccess,
    mockToastError,
    mockInvalidateQueries,
    mockFrom,
    mockBuilderFactory,
    mockConfirm,
  };
});

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: mockUsePageTitle,
}));

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: mockUseRolePermissions,
}));

vi.mock('@/hooks/social/useSocialBrands', () => ({
  useSocialBrands: mockUseSocialBrands,
}));

vi.mock('@/hooks/social/useScheduledPosts', () => ({
  useScheduledPosts: mockUseScheduledPosts,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, asChild, ...props }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
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
    error: Error | null;
    isEmpty: boolean;
    emptyTitle: string;
    loadingLabel: string;
    children: React.ReactNode;
  }) => {
    if (isLoading) return <div>{loadingLabel}</div>;
    if (isError) return <div>Erreur: {error?.message}</div>;
    if (isEmpty) return <div>{emptyTitle}</div>;
    return <div>{children}</div>;
  },
}));

vi.mock('lucide-react', () => ({
  Calendar: () => <svg data-testid="icon-calendar" />,
  Plus: () => <svg data-testid="icon-plus" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  AlertTriangle: () => <svg data-testid="icon-alert" />,
  CheckCircle2: () => <svg data-testid="icon-check" />,
  Clock: () => <svg data-testid="icon-clock" />,
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderComponent() {
  const client = createClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SocialCalendar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SocialCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRolePermissions.mockReturnValue({ role: 'marketing', isLoading: false });
    mockUseSocialBrands.mockReturnValue({ data: BRANDS, isLoading: false, isError: false, error: null });
    mockUseScheduledPosts.mockReturnValue({
      data: POSTS,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mockFrom.mockImplementation(() => mockBuilderFactory(DELETE_SUCCESS));
    mockConfirm.mockReturnValue(true);
    vi.stubGlobal('confirm', mockConfirm);
  });

  it('affiche le chargement quand les données sont en cours de récupération', () => {
    mockUseScheduledPosts.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderComponent();

    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.getByText('Calendrier éditorial')).toBeInTheDocument();
  });

  it('affiche les posts avec les informations métier réelles', () => {
    renderComponent();

    expect(mockUsePageTitle).toHaveBeenCalledWith('Calendrier social');
    expect(screen.getByRole('heading', { name: 'Calendrier éditorial' })).toBeInTheDocument();
    expect(screen.getByText('Posts planifiés et historique.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nouveau post/i })).toHaveAttribute('href', '/social/composer');

    expect(screen.getByText('Message planifié important')).toBeInTheDocument();
    expect(screen.getByText('Post déjà publié')).toBeInTheDocument();
    expect(screen.getByText('Post en échec')).toBeInTheDocument();
    expect(screen.getByText('Traitement en cours')).toBeInTheDocument();
    expect(screen.getByText('Brouillon interne')).toBeInTheDocument();

    expect(screen.getAllByText('Marque Alpha')).toHaveLength(2);
    expect(screen.getAllByText('Marque Beta')).toHaveLength(2);
    expect(screen.getByText('—')).toBeInTheDocument();

    expect(screen.getByText('Planifié')).toBeInTheDocument();
    expect(screen.getByText('Publié')).toBeInTheDocument();
    expect(screen.getByText('Échec')).toBeInTheDocument();
    expect(screen.getByText('En cours…')).toBeInTheDocument();
    expect(screen.getByText('Brouillon')).toBeInTheDocument();

    expect(screen.getByText('2 compte(s) ciblé(s) · 2 tentative(s)')).toBeInTheDocument();
    expect(screen.getAllByText('1 compte(s) ciblé(s)')).toHaveLength(2);
    expect(screen.getByText('3 compte(s) ciblé(s) · 1 tentative(s)')).toBeInTheDocument();
    expect(screen.getByText('0 compte(s) ciblé(s)')).toBeInTheDocument();
    expect(screen.getByText('Erreur API')).toBeInTheDocument();

    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(5);

    const publishedCard = screen.getByText('Post déjà publié').closest('[data-testid="card"]');
    expect(publishedCard).not.toBeNull();
    if (publishedCard) {
      expect(within(publishedCard).queryByRole('button')).not.toBeInTheDocument();
    }

    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('supprime un post non publié et invalide la query en cas de succès', async () => {
    renderComponent();

    const deleteButtons = screen.getAllByRole('button');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith('Supprimer ce post planifié ?');
      expect(mockFrom).toHaveBeenCalledWith('social_scheduled_posts');
      const builder = mockFrom.mock.results[0]?.value as ReturnType<typeof mockBuilderFactory>;
      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('id', 'p1');
      expect(mockToastSuccess).toHaveBeenCalledWith('Supprimé');
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['social', 'scheduled'] });
    });
  });

  it('affiche une erreur toast quand la suppression échoue', async () => {
    mockFrom.mockImplementation(() => mockBuilderFactory(DELETE_ERROR));

    renderComponent();

    const deleteButtons = screen.getAllByRole('button');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Suppression impossible');
    });

    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it("n'appelle pas la suppression si l'utilisateur annule la confirmation", async () => {
    mockConfirm.mockReturnValue(false);

    renderComponent();

    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith('Supprimer ce post planifié ?');
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("affiche l'erreur d'accès quand le rôle n'est pas autorisé", () => {
    mockUseRolePermissions.mockReturnValue({ role: 'user', isLoading: false });

    renderComponent();

    expect(screen.getByText('Erreur: Accès réservé.')).toBeInTheDocument();
  });

  it("affiche l'état d'erreur quand la requête des posts échoue", () => {
    mockUseScheduledPosts.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('x'),
      refetch: vi.fn(),
    });

    renderComponent();

    expect(screen.getByText('Erreur: x')).toBeInTheDocument();
  });
});