import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  USER,
  METRICS_OK,
  TEAM_TOTALS_OK,
  invokeEdgeMock,
  useAuthMock,
  mockFrom,
} = vi.hoisted(() => {
  const USER = { id: 'u1', email: 't@t.co' };

  const METRICS_OK = [
    {
      agentId: 'sophia',
      totalInteractions: 42,
      avgResponseTimeMs: 180,
      successRate: 0.9,
      satisfactionScore: 4.6,
      topTools: [
        { name: 'web_search', count: 7 },
        { name: 'calendar', count: 3 },
        { name: 'email_send', count: 2 },
      ],
      recentActivity: [
        { date: '2026-01-01', count: 2 },
        { date: '2026-01-02', count: 4 },
      ],
      domainKPIs: { leadsCreated: 12, conversionRate: '18%' },
    },
  ];

  const TEAM_TOTALS_OK = {
    totalInteractions: 120,
    avgResponseTimeMs: 250,
    avgSuccessRate: 0.875,
    avgSatisfaction: 4.2,
  };

  const invokeEdgeMock = vi.fn();

  const useAuthMock = vi.fn(() => ({
    user: USER,
    session: { user: USER },
    isLoading: false,
  }));

  const mockFrom = vi.fn();

  return { USER, METRICS_OK, TEAM_TOTALS_OK, invokeEdgeMock, useAuthMock, mockFrom };
});

vi.mock('@/integrations/supabase/client', () => {
  const createThenableBuilder = () => {
    let resolved: { data: unknown; error: unknown } = { data: null, error: null };

    const builder: Record<string, unknown> = {
      __setResolved: (v: { data: unknown; error: unknown }) => {
        resolved = v;
        return builder;
      },
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => resolved),
      single: vi.fn(async () => resolved),
      then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(resolved).then(onFulfilled, onRejected),
      catch: (onRejected?: (e: unknown) => unknown) => Promise.resolve(resolved).catch(onRejected),
      finally: (onFinally?: () => void) => Promise.resolve(resolved).finally(onFinally),
    };

    return builder;
  };

  mockFrom.mockImplementation(() => createThenableBuilder());

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } }, error: null })),
      },
    },
  };
});

vi.mock('@/services/edgeFunctions', () => ({
  invokeEdge: invokeEdgeMock,
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | undefined | null | false>) => args.filter(Boolean).join(' '),
}));

vi.mock('@/lib/jarvis-agents-config', () => ({
  JARVIS_AGENTS: {
    sophia: { id: 'sophia', name: 'Sophia', emoji: 'S', shortDescription: 'Assistante' },
    marcus: { id: 'marcus', name: 'Marcus', emoji: 'M', shortDescription: 'Analyste' },
    olivia: { id: 'olivia', name: 'Olivia', emoji: 'O', shortDescription: 'Support' },
    noah: { id: 'noah', name: 'Noah', emoji: 'N', shortDescription: 'Ops' },
    emma: { id: 'emma', name: 'Emma', emoji: 'E', shortDescription: 'CRM' },
    alex: { id: 'alex', name: 'Alex', emoji: 'A', shortDescription: 'Dev' },
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  },
}));

vi.mock('lucide-react', () => ({
  Activity: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-activity" {...props} />,
  Clock: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-clock" {...props} />,
  CheckCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-check" {...props} />,
  Star: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-star" {...props} />,
  Users: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-users" {...props} />,
  Zap: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-zap" {...props} />,
  BarChart3: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-barchart" {...props} />,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children?: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  CardHeader: ({ children, ...props }: { children?: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  CardTitle: ({ children, ...props }: { children?: React.ReactNode } & React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 {...props}>{children}</h3>
  ),
  CardDescription: ({ children, ...props }: { children?: React.ReactNode } & React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props}>{children}</p>
  ),
  CardContent: ({ children, ...props }: { children?: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    ...props
  }: { children?: React.ReactNode; variant?: string } & React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, ...props }: { value?: number } & React.HTMLAttributes<HTMLDivElement>) => (
    <div aria-label="progress" data-value={String(value ?? '')} {...props} />
  ),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({
    children,
    value,
    onValueChange,
  }: {
    children?: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <div data-testid="tabs" data-value={value ?? ''} data-onvaluechange={String(Boolean(onValueChange))}>
      {React.Children.map(children, child => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, { 'data-tabs-current': value ?? '', onValueChange });
      })}
    </div>
  ),
  TabsList: ({
    children,
    onValueChange,
    'data-tabs-current': current,
    ...props
  }: { children?: React.ReactNode; onValueChange?: (v: string) => void; 'data-tabs-current'?: string } & React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>
      {React.Children.map(children, child => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, { onValueChange, 'data-tabs-current': current ?? '' });
      })}
    </div>
  ),
  TabsTrigger: ({
    children,
    value,
    onValueChange,
    ...props
  }: {
    children?: React.ReactNode;
    value: string;
    onValueChange?: (v: string) => void;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
      type="button"
      data-tab-value={value}
      onClick={(e) => {
        props.onClick?.(e);
        onValueChange?.(value);
      }}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: { children?: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  AvatarFallback: ({ children, ...props }: { children?: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="skeleton" {...props} />,
}));

import { JarvisAgentAnalytics } from './JarvisAgentAnalytics';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('JarvisAgentAnalytics', () => {
  it('affiche le chargement puis les métriques (succès) et appelle invokeEdge avec userId + days', async () => {
    invokeEdgeMock.mockResolvedValueOnce({ metrics: METRICS_OK, teamTotals: TEAM_TOTALS_OK });

    renderWithClient(<JarvisAgentAnalytics />);

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText("Performance de l'équipe JARVIS")).toBeTruthy();
    });

    await waitFor(() => {
      expect(invokeEdgeMock).toHaveBeenCalledWith('jarvis-agent-metrics', { userId: USER.id, days: 30 });
    });

    expect(screen.getByText('Interactions')).toBeTruthy();
    expect(screen.getByText('120')).toBeTruthy();

    expect(screen.getByText('Temps moyen')).toBeTruthy();
    expect(screen.getByText('250ms')).toBeTruthy();

    expect(screen.getByText('Taux succès')).toBeTruthy();
    expect(screen.getByText('88%')).toBeTruthy();

    expect(screen.getByText('Satisfaction')).toBeTruthy();
    expect(screen.getByText('4.2/5')).toBeTruthy();

    expect(screen.getByText('Sophia')).toBeTruthy();
    expect(screen.getByText('42 int.')).toBeTruthy();
    expect(screen.getByText('180ms')).toBeTruthy();
    expect(screen.getAllByText('90%').length).toBeGreaterThan(0);

    expect(screen.getByText('KPIs Métier')).toBeTruthy();
    expect(screen.getByText(/leads created:/i)).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText(/conversion rate:/i)).toBeTruthy();
    expect(screen.getByText('18%')).toBeTruthy();

    expect(screen.getByText('Outils favoris')).toBeTruthy();
    expect(screen.getByText('web search (7)')).toBeTruthy();
    expect(screen.getByText('calendar (3)')).toBeTruthy();
    expect(screen.getByText('email send (2)')).toBeTruthy();

    expect(invokeEdgeMock).toHaveBeenCalledTimes(1);
  });

  it('permet de changer la période (7j) et relance invokeEdge avec days=7', async () => {
    invokeEdgeMock.mockImplementation(async (_fnName: string, payload: { userId: string; days: number }) => {
      return { metrics: METRICS_OK, teamTotals: { ...TEAM_TOTALS_OK, totalInteractions: payload.days } };
    });

    renderWithClient(<JarvisAgentAnalytics />);

    await waitFor(() => {
      expect(screen.getByText("Performance de l'équipe JARVIS")).toBeTruthy();
    });

    await waitFor(() => {
      expect(invokeEdgeMock).toHaveBeenCalledWith('jarvis-agent-metrics', { userId: USER.id, days: 30 });
    });

    const user = userEvent.setup();
    const trigger7 = screen.getByRole('button', { name: '7j' });

    await act(async () => {
      await user.click(trigger7);
    });

    await waitFor(() => {
      expect(invokeEdgeMock).toHaveBeenCalledWith('jarvis-agent-metrics', { userId: USER.id, days: 7 });
    });
  });

  it("affiche une erreur si la requête échoue", async () => {
    invokeEdgeMock.mockRejectedValueOnce(new Error('x'));

    renderWithClient(<JarvisAgentAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Erreur lors du chargement des métriques')).toBeTruthy();
    });
  });
});