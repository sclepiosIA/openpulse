// @vitest-environment jsdom

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisSmartBriefing } from './JarvisSmartBriefing';

const {
  AUTH_STATE,
  NAVIGATE_MOCK,
  DEBUG_ERROR_MOCK,
  STABLE_INVOICES,
  STABLE_TICKETS,
  STABLE_TASKS,
  STABLE_EMPTY,
  makeBuilder,
  makeRejectingBuilder,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const NAVIGATE_MOCK = vi.fn();
  const DEBUG_ERROR_MOCK = vi.fn();

  const STABLE_INVOICES = [
    {
      id: 'inv-1',
      numero: 'F-001',
      montant_ttc: 1200,
      client_nom: 'Client A',
      date_echeance: '2024-01-01T00:00:00.000Z',
    },
  ];

  const STABLE_TICKETS = [
    {
      id: 'tic-1',
      titre: 'Serveur indisponible',
      priorite: 'critique',
      created_at: '2024-01-02T00:00:00.000Z',
    },
  ];

  const STABLE_TASKS = [
    {
      id: 'task-1',
      titre: 'Relancer dossier',
      echeance: '2024-01-03T00:00:00.000Z',
      priorite: 'Haute',
    },
  ];

  const STABLE_EMPTY: [] = [];

  const baseChain = (builder: any) => ({
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    ne: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    in: vi.fn(() => builder),
    not: vi.fn(() => builder),
    or: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    like: vi.fn(() => builder),
    contains: vi.fn(() => builder),
    overlaps: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => builder.__result),
    maybeSingle: vi.fn(async () => builder.__result),
  });

  const makeBuilder = (result: { data: unknown; error: unknown; count?: number }) => {
    const builder: any = { __result: result };
    Object.assign(builder, baseChain(builder));
    builder.then = (onFulfilled: (value: { data: unknown; error: unknown; count?: number }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected);
    builder.catch = (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected);
    return builder;
  };

  const makeRejectingBuilder = (error: unknown) => {
    const builder: any = {};
    Object.assign(builder, baseChain(builder));
    builder.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.reject(error).then(onFulfilled, onRejected);
    builder.catch = (onRejected: (reason: unknown) => unknown) => Promise.reject(error).catch(onRejected);
    builder.single = vi.fn(async () => {
      throw error;
    });
    builder.maybeSingle = vi.fn(async () => {
      throw error;
    });
    return builder;
  };

  const mockFrom = vi.fn();

  return {
    AUTH_STATE,
    NAVIGATE_MOCK,
    DEBUG_ERROR_MOCK,
    STABLE_INVOICES,
    STABLE_TICKETS,
    STABLE_TASKS,
    STABLE_EMPTY,
    makeBuilder,
    makeRejectingBuilder,
    mockFrom,
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => NAVIGATE_MOCK,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: DEBUG_ERROR_MOCK,
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  },
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    Flame: Icon,
    Lightbulb: Icon,
    BarChart3: Icon,
    Calendar: Icon,
    Mail: Icon,
    AlertTriangle: Icon,
    ChevronRight: Icon,
    RefreshCw: Icon,
    Sparkles: Icon,
    TrendingUp: Icon,
    Clock: Icon,
    Target: Icon,
    ArrowUpRight: Icon,
    Users: Icon,
    Euro: Icon,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 {...props}>{children}</h3>,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, ...props }: { value?: number } & React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="progress" data-value={String(value ?? 0)} {...props} />
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="skeleton" {...props} />,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

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

describe('JarvisSmartBriefing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le skeleton pendant le chargement puis les données métier en succès', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'factures') {
        return makeBuilder({ data: STABLE_INVOICES, error: null });
      }
      if (table === 'support_tickets') {
        return makeBuilder({ data: STABLE_TICKETS, error: null });
      }
      if (table === 'taches') {
        return makeBuilder({ data: STABLE_TASKS, error: null });
      }
      return makeBuilder({ data: STABLE_EMPTY, error: null });
    });

    render(<JarvisSmartBriefing />, { wrapper: createWrapper() });

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);

    await screen.findByText('Briefing Jarvis');

    expect(screen.getByText('Urgences')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Facture F-001 - Client A')).toBeInTheDocument();
    expect(screen.getByText('Serveur indisponible')).toBeInTheDocument();
    expect(screen.getByText('Relancer dossier')).toBeInTheDocument();

    expect(mockFrom).toHaveBeenCalledWith('factures');
    expect(mockFrom).toHaveBeenCalledWith('support_tickets');
    expect(mockFrom).toHaveBeenCalledWith('taches');
  });

  it('navigue vers le lien de l’item cliqué quand onItemClick est absent', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'factures') {
        return makeBuilder({ data: STABLE_INVOICES, error: null });
      }
      if (table === 'support_tickets') {
        return makeBuilder({ data: STABLE_EMPTY, error: null });
      }
      if (table === 'taches') {
        return makeBuilder({ data: STABLE_EMPTY, error: null });
      }
      return makeBuilder({ data: STABLE_EMPTY, error: null });
    });

    render(<JarvisSmartBriefing />, { wrapper: createWrapper() });

    const invoiceButton = await screen.findByText('Facture F-001 - Client A');
    fireEvent.click(invoiceButton);

    expect(NAVIGATE_MOCK).toHaveBeenCalledWith('/tresorerie');
  });

  it('appelle onItemClick avec le type et l’id réels', async () => {
    const onItemClick = vi.fn();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'factures') {
        return makeBuilder({ data: STABLE_INVOICES, error: null });
      }
      if (table === 'support_tickets') {
        return makeBuilder({ data: STABLE_EMPTY, error: null });
      }
      if (table === 'taches') {
        return makeBuilder({ data: STABLE_EMPTY, error: null });
      }
      return makeBuilder({ data: STABLE_EMPTY, error: null });
    });

    render(<JarvisSmartBriefing onItemClick={onItemClick} />, { wrapper: createWrapper() });

    const invoiceButton = await screen.findByText('Facture F-001 - Client A');
    fireEvent.click(invoiceButton);

    expect(onItemClick).toHaveBeenCalledWith('invoice', 'inv-1');
    expect(NAVIGATE_MOCK).not.toHaveBeenCalled();
  });

  it('affiche le mode compact avec les compteurs agrégés', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'factures') {
        return makeBuilder({ data: STABLE_INVOICES, error: null });
      }
      if (table === 'support_tickets') {
        return makeBuilder({ data: STABLE_TICKETS, error: null });
      }
      if (table === 'taches') {
        return makeBuilder({ data: STABLE_EMPTY, error: null });
      }
      return makeBuilder({ data: STABLE_EMPTY, error: null });
    });

    render(<JarvisSmartBriefing compact />, { wrapper: createWrapper() });

    await screen.findByText('Briefing');

    expect(screen.getByText('2 urgences')).toBeInTheDocument();
  });

  it('gère une erreur supabase en journalisant puis en rendant null après chargement', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'factures') {
        return makeRejectingBuilder(new Error('x'));
      }
      return makeBuilder({ data: STABLE_EMPTY, error: null });
    });

    const { container } = render(<JarvisSmartBriefing />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    });

    expect(container).toBeEmptyDOMElement();
    expect(DEBUG_ERROR_MOCK).toHaveBeenCalled();
  });
})