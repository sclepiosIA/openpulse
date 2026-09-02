/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { AIEstablishmentHoverCard } from './AIEstablishmentHoverCard';

const {
  ETABLISSEMENT_ROW,
  CSM_ROW,
  TASKS_ROWS,
  CHILD_TEXT,
  mockFrom,
  hoverCardContentProps,
} = vi.hoisted(() => ({
  ETABLISSEMENT_ROW: {
    nom: 'Clinique du Lac',
    ville: 'Lyon',
    statut: 'Production',
    progression: 72,
    relationship_status: 'active',
    engagement_score: 88,
    csm_principal: 'csm-1',
  },
  CSM_ROW: {
    nom: 'Martin',
    prenom: 'Alice',
  },
  TASKS_ROWS: [
    {
      id: 'task-1',
      titre: 'Planifier la réunion de lancement',
      echeance: '2025-03-15T00:00:00.000Z',
      priorite: 'haute',
    },
  ],
  CHILD_TEXT: 'Voir établissement',
  mockFrom: vi.fn(),
  hoverCardContentProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/components/ui/hover-card', () => {
  const ReactModule = React;
  return {
    HoverCard: ({ children }: { children: React.ReactNode; openDelay?: number }) => (
      <div data-testid="hover-card">{children}</div>
    ),
    HoverCardTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
      <div data-testid="hover-trigger">{children}</div>
    ),
    HoverCardContent: ({ children, ...props }: { children: React.ReactNode; className?: string; side?: string; align?: string }) => {
      hoverCardContentProps.push(props as Record<string, unknown>);
      return <div data-testid="hover-content">{children}</div>;
    },
  };
});

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress" data-value={String(value)} className={className} />
  ),
}));

vi.mock('lucide-react', () => ({
  Building2: () => <svg data-testid="icon-building" />,
  TrendingUp: () => <svg data-testid="icon-trending" />,
  Calendar: () => <svg data-testid="icon-calendar" />,
  Target: () => <svg data-testid="icon-target" />,
  MapPin: () => <svg data-testid="icon-mappin" />,
  Users: () => <svg data-testid="icon-users" />,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createThenableResult<T>(result: T) {
  return {
    then: (resolve: (value: T) => unknown) => Promise.resolve(resolve(result)),
    catch: () => Promise.resolve(result),
  };
}

function createBuilder(tableResponses: Record<string, unknown>) {
  let tableName = '';
  const builder = {
    select: vi.fn().mockImplementation(() => builder),
    eq: vi.fn().mockImplementation(() => builder),
    gte: vi.fn().mockImplementation(() => builder),
    lte: vi.fn().mockImplementation(() => builder),
    in: vi.fn().mockImplementation(() => builder),
    order: vi.fn().mockImplementation(() => builder),
    limit: vi.fn().mockImplementation(() => Promise.resolve(tableResponses[tableName])),
    insert: vi.fn().mockImplementation(() => builder),
    update: vi.fn().mockImplementation(() => builder),
    delete: vi.fn().mockImplementation(() => builder),
    single: vi.fn().mockImplementation(() => Promise.resolve(tableResponses[tableName])),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(tableResponses[tableName])),
    then: vi.fn().mockImplementation((resolve: (value: unknown) => unknown) =>
      createThenableResult(tableResponses[tableName]).then(resolve),
    ),
    catch: vi.fn().mockImplementation((reject: (reason: unknown) => unknown) =>
      createThenableResult(tableResponses[tableName]).catch(reject),
    ),
    __setTable: (name: string) => {
      tableName = name;
      return builder;
    },
  };
  return builder;
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('AIEstablishmentHoverCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoverCardContentProps.length = 0;
  });

  it('affiche seulement les enfants pendant le chargement puis charge les données métier complètes', async () => {
    const tableResponses = {
      etablissements: { data: ETABLISSEMENT_ROW, error: null },
      profiles: { data: CSM_ROW, error: null },
      taches: { data: TASKS_ROWS, error: null },
    };

    const builder = createBuilder(tableResponses);
    mockFrom.mockImplementation((table: string) => builder.__setTable(table));

    render(
      <QueryClientProvider client={createQueryClient()}>
        <AIEstablishmentHoverCard etablissementId="eta-1">
          <button>{CHILD_TEXT}</button>
        </AIEstablishmentHoverCard>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('button', { name: CHILD_TEXT })).toBeInTheDocument();
    expect(screen.queryByTestId('hover-content')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('hover-content')).toBeInTheDocument();
    });

    expect(screen.getByText('Clinique du Lac')).toBeInTheDocument();
    expect(screen.getByText('Lyon')).toBeInTheDocument();
    expect(screen.getByTestId('badge')).toHaveTextContent('Production');
    expect(screen.getByTestId('badge').className).toContain('bg-emerald-100');
    expect(screen.getByText('CSM:')).toBeInTheDocument();
    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '72');
    expect(screen.getByText('Engagement:')).toBeInTheDocument();
    expect(screen.getByText('88/100')).toBeInTheDocument();
    expect(screen.getByText('Prochaine étape:')).toBeInTheDocument();
    expect(screen.getByText('Planifier la réunion de lancement')).toBeInTheDocument();
    expect(screen.getByText('Échéance: 15 mars 2025')).toBeInTheDocument();

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'etablissements');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'profiles');
    expect(mockFrom).toHaveBeenNthCalledWith(3, 'taches');

    expect(builder.eq).toHaveBeenCalledWith('id', 'eta-1');
    expect(builder.eq).toHaveBeenCalledWith('id', 'csm-1');
    expect(builder.eq).toHaveBeenCalledWith('etablissement_id', 'eta-1');
    expect(builder.eq).toHaveBeenCalledWith('statut', 'A faire');
    expect(builder.order).toHaveBeenCalledWith('echeance', { ascending: true });
    expect(builder.limit).toHaveBeenCalledWith(1);

    expect(hoverCardContentProps[0]).toMatchObject({
      className: 'w-80',
      side: 'right',
      align: 'start',
    });
  });

  it('retourne isLoading puis succès avec renderHook dans un wrapper QueryClientProvider', async () => {
    const tableResponses = {
      etablissements: { data: ETABLISSEMENT_ROW, error: null },
      profiles: { data: CSM_ROW, error: null },
      taches: { data: TASKS_ROWS, error: null },
    };

    const builder = createBuilder(tableResponses);
    mockFrom.mockImplementation((table: string) => builder.__setTable(table));

    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['component-mounted'],
          queryFn: async () => {
            render(
              <QueryClientProvider client={createQueryClient()}>
                <AIEstablishmentHoverCard etablissementId="eta-1">
                  <span>{CHILD_TEXT}</span>
                </AIEstablishmentHoverCard>
              </QueryClientProvider>,
            );
            return 'mounted';
          },
        }),
      { wrapper },
    );

    expect(result.current.isLoading || result.current.isPending).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByText('Clinique du Lac')).toBeInTheDocument();
    });

    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.getByText('88/100')).toBeInTheDocument();
  });

  it('reste sur les enfants seuls quand aucun établissement n’est trouvé', async () => {
    const tableResponses = {
      etablissements: { data: null, error: null },
      profiles: { data: null, error: null },
      taches: { data: [], error: null },
    };

    const builder = createBuilder(tableResponses);
    mockFrom.mockImplementation((table: string) => builder.__setTable(table));

    render(
      <QueryClientProvider client={createQueryClient()}>
        <AIEstablishmentHoverCard etablissementId="eta-missing">
          <span>{CHILD_TEXT}</span>
        </AIEstablishmentHoverCard>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('etablissements');
    });

    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
    expect(screen.queryByText('Clinique du Lac')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hover-content')).not.toBeInTheDocument();
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('passe en erreur quand la requête renvoie une erreur supabase explicite', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['error-case'],
          queryFn: async () => {
            const { data, error } = await Promise.resolve({
              data: null,
              error: { message: 'x' },
            });
            if (error) {
              throw new Error(error.message);
            }
            return data;
          },
        }),
      { wrapper },
    );

    expect(result.current.isLoading || result.current.isPending).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('x');
  });
});