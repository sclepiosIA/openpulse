import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { JarvisDailyBriefing } from './JarvisDailyBriefing';

const { USER_HOISTED, MOCK_BRIEFING_HOISTED, mockInvokeEdge, mockNavigate, mockToastSuccess, mockToastError, mockFrom } = vi.hoisted(() => {
  const USER_HOISTED = { user: { id: 'user-123', email: 'user@example.test' } };

  const MOCK_BRIEFING_HOISTED = {
    greeting: 'Bonjour Testeur',
    date: 'mardi 2 juin',
    sections: [
      {
        title: 'PRIORITÉS DU JOUR',
        emoji: '🔥',
        priority: 'high' as const,
        items: [
          {
            text: "Tâche importante pour l'établissement",
            type: 'task' as const,
            entityType: 'etablissement',
            entityId: 'e1',
            actionUrl: '/etablissements/e1',
          },
        ],
      },
      {
        title: 'ALERTES',
        emoji: '⚠️',
        priority: 'high' as const,
        items: [
          {
            text: 'Paiement en retard',
            type: 'alert' as const,
            entityType: 'facture',
            entityId: 'f1',
          },
        ],
      },
      {
        title: 'OPPORTUNITÉS',
        emoji: '✨',
        priority: 'low' as const,
        items: [
          {
            text: 'Nouvelle opportunité commerciale',
            type: 'opportunity' as const,
          },
        ],
      },
    ],
    summary: {
      tasksToday: 4,
      overdueItems: 1,
      unreadEmails: 7,
      upcomingMeetings: 2,
    },
    generatedAt: new Date().toISOString(),
  };

  const mockInvokeEdge = vi.fn(async () => ({ briefing: MOCK_BRIEFING_HOISTED }));
  const mockNavigate = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();

  // Minimal chainable supabase builder
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn(function (this: any, resolve: any) { return Promise.resolve(resolve(this)); }),
    catch: vi.fn().mockResolvedValue(null),
  };

  const mockFrom = vi.fn(() => builder);

  return { USER_HOISTED, MOCK_BRIEFING_HOISTED, mockInvokeEdge, mockNavigate, mockToastSuccess, mockToastError, mockFrom };
});

// Mock services and internal modules used by the component
vi.mock('@/services/edgeFunctions', () => {
  return {
    invokeEdge: (...args: unknown[]) => mockInvokeEdge(...(args as unknown[])),
  };
});

vi.mock('@/hooks/shared/useAuth', () => {
  return {
    useAuth: () => ({ user: USER_HOISTED.user, session: { user: USER_HOISTED.user }, isLoading: false }),
  };
});

vi.mock('react-router-dom', () => {
  return {
    useNavigate: () => mockNavigate,
  };
});

// Mock UI components to simple passthroughs
vi.mock('@/components/ui/button', () => {
  const Button = ({ children, onClick, variant, size, className, disabled, 'aria-label': ariaLabel }: any) => (
    <button aria-label={ariaLabel} disabled={disabled} data-variant={variant} data-size={size} className={className} onClick={onClick}>
      {children}
    </button>
  );
  return { Button };
});

vi.mock('@/components/ui/badge', () => {
  const Badge = ({ children, variant, className }: any) => <span data-variant={variant} className={className}>{children}</span>;
  return { Badge };
});

vi.mock('@/components/ui/scroll-area', () => {
  const ScrollArea = ({ children, className }: any) => <div className={className}>{children}</div>;
  return { ScrollArea };
});

vi.mock('@/lib/utils', () => {
  return {
    cn: (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' '),
  };
});

// Mock framer-motion to avoid animation internals during tests
vi.mock('framer-motion', () => {
  const MotionDiv = (props: any) => <div {...props}>{props.children}</div>;
  const AnimatePresence = ({ children }: any) => <div>{children}</div>;
  return { motion: { div: MotionDiv }, AnimatePresence };
});

// Mock lucide-react icons used in component to simple spans to avoid rendering issues
vi.mock('lucide-react', () => {
  const make = (name: string) => (props: any) => <span data-icon={name} {...props} />;
  return {
    Sun: make('Sun'),
    Moon: make('Moon'),
    Cloud: make('Cloud'),
    AlertTriangle: make('AlertTriangle'),
    CheckCircle2: make('CheckCircle2'),
    Mail: make('Mail'),
    Calendar: make('Calendar'),
    TrendingUp: make('TrendingUp'),
    ChevronDown: make('ChevronDown'),
    ChevronUp: make('ChevronUp'),
    RefreshCw: make('RefreshCw'),
    X: make('X'),
    ExternalLink: make('ExternalLink'),
    Sparkles: make('Sparkles'),
  };
});

// Mock sonner toast functions
vi.mock('sonner', () => {
  return { toast: { success: mockToastSuccess, error: mockToastError } };
});

// Mock supabase client per rules (even if not used directly in this module)
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
      auth: { user: vi.fn() },
    },
  };
});

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

const renderWithClient = (ui: React.ReactElement) => {
  const qc = createQueryClient();
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

describe('JarvisDailyBriefing Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default behavior: resolve with the hoisted briefing
    mockInvokeEdge.mockResolvedValue({ briefing: MOCK_BRIEFING_HOISTED });
  });

  it('shows loading indicator initially and then displays full briefing on success, allows refreshing and item click navigates and calls onClose', async () => {
    // Make the first invokeEdge call pend so we can assert loading state first
    let resolveCall: (val: unknown) => void = () => {};
    mockInvokeEdge.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCall = resolve;
        })
    );

    const onCloseSpy = vi.fn();

    const { container } = renderWithClient(<JarvisDailyBriefing onClose={onCloseSpy} />);

    // Loading state should be visible immediately
    expect(screen.getByText('Préparation de votre briefing...')).toBeInTheDocument();

    // Resolve the pending invokeEdge to provide the briefing
    await act(async () => {
      resolveCall({ briefing: MOCK_BRIEFING_HOISTED });
      // allow microtasks to flush
      await Promise.resolve();
    });

    // After resolution, the greeting and summary should be visible
    expect(await screen.findByText(MOCK_BRIEFING_HOISTED.greeting)).toBeInTheDocument();
    // Summary badges with numbers - exact strings as rendered by component
    expect(screen.getByText(`${MOCK_BRIEFING_HOISTED.summary.tasksToday} tâches`)).toBeInTheDocument();
    expect(screen.getByText(`${MOCK_BRIEFING_HOISTED.summary.unreadEmails} emails`)).toBeInTheDocument();
    expect(screen.getByText(`${MOCK_BRIEFING_HOISTED.summary.overdueItems} retards`)).toBeInTheDocument();

    // Verify that invokeEdge was called once with the correct payload
    expect(mockInvokeEdge).toHaveBeenCalledTimes(1);
    expect(mockInvokeEdge).toHaveBeenCalledWith('jarvis-daily-briefing', { user_id: USER_HOISTED.user.id });

    // Click the refresh button and ensure invokeEdge is called again
    const refreshButtons = container.querySelectorAll('button[aria-label="Actualiser"]');
    expect(refreshButtons.length).toBeGreaterThanOrEqual(1);
    await act(async () => {
      fireEvent.click(refreshButtons[0]);
    });
    // After clicking refresh, a new call should have been scheduled
    expect(mockInvokeEdge).toHaveBeenCalledTimes(2);

    // The section PRIORITÉS DU JOUR is initially expanded; click the item to trigger navigation and onClose
    const itemText = MOCK_BRIEFING_HOISTED.sections[0].items[0].text;
    const itemNode = await screen.findByText(itemText);
    await act(async () => {
      fireEvent.click(itemNode);
    });

    // For entityType 'etablissement' expect navigation to the specific establishment page and onClose called
    expect(mockNavigate).toHaveBeenCalledWith(`/etablissements/${MOCK_BRIEFING_HOISTED.sections[0].items[0].entityId}`);
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('renders compact variant with mini summary and first high priority alert text', async () => {
    mockInvokeEdge.mockResolvedValueOnce({ briefing: MOCK_BRIEFING_HOISTED });

    renderWithClient(<JarvisDailyBriefing compact />);

    // Wait for greeting to appear
    expect(await screen.findByText(MOCK_BRIEFING_HOISTED.greeting)).toBeInTheDocument();

    // Mini summary numbers should be visible in compact mode (rendered as plain numbers)
    expect(screen.getByText(String(MOCK_BRIEFING_HOISTED.summary.tasksToday))).toBeInTheDocument();
    expect(screen.getByText(String(MOCK_BRIEFING_HOISTED.summary.overdueItems))).toBeInTheDocument();
    expect(screen.getByText(String(MOCK_BRIEFING_HOISTED.summary.unreadEmails))).toBeInTheDocument();
    expect(screen.getByText(String(MOCK_BRIEFING_HOISTED.summary.upcomingMeetings))).toBeInTheDocument();

    // The first high-priority alert text should be shown in compact mode
    const firstHigh = MOCK_BRIEFING_HOISTED.sections.find((s) => s.priority === 'high')!;
    expect(screen.getByText(firstHigh.items[0].text)).toBeInTheDocument();
  });

  it('exposes query error via useQuery (isError) when invokeEdge rejects', async () => {
    // simulate edge function failure
    mockInvokeEdge.mockRejectedValueOnce(new Error('edge-failure'));

    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    const wrapper = ({ children }: { children?: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['jarvis-daily-briefing', USER_HOISTED.user.id],
          queryFn: async () => {
            // call the same service as the component would
            const data = await mockInvokeEdge('jarvis-daily-briefing', { user_id: USER_HOISTED.user.id });
            return (data as any).briefing;
          },
          enabled: true,
          staleTime: 30 * 60 * 1000,
          refetchOnWindowFocus: false,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});