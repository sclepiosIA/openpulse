import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  jarvisState,
  mockOpenPanel,
  mockClosePanel,
  mockClearMinimizedState,
  mockMinimizePanel,
  mockUseJarvisKeyboardShortcuts,
  mockUseMediaQuery,
  mockUseJarvis,
  mockUseJarvisSmartTriggers,
  mockUseJarvisIntentPrediction,
  STABLE_TRIGGERS,
  STABLE_PREDICTIONS,
} = vi.hoisted(() => {
  const mockOpenPanel = vi.fn();
  const mockClosePanel = vi.fn();
  const mockClearMinimizedState = vi.fn();
  const mockMinimizePanel = vi.fn();

  const jarvisState = {
    isPanelOpen: false,
    isMinimized: false,
    streamState: { isStreaming: false },
    isTyping: false,
    pendingActions: [] as Array<unknown>,
  };

  const mockUseJarvisKeyboardShortcuts = vi.fn();
  const mockUseMediaQuery = vi.fn<(query: string) => boolean>();

  const mockUseJarvis = vi.fn<() => { isEnabled: boolean; pendingCount: number }>(() => ({
    isEnabled: true,
    pendingCount: 0,
  }));

  const STABLE_TRIGGERS = [
    { id: 't1', type: 'urgent', title: 'Urgent: Ticket', message: 'Répondre au client' },
    { id: 't2', type: 'insight', title: 'Insight: KPI', message: 'Hausse du taux de conversion' },
  ] as const;

  const STABLE_PREDICTIONS = [{ id: 'p1', intent: 'daily_briefing', reasoning: 'Vous ouvrez souvent le briefing le matin' }] as const;

  const mockUseJarvisSmartTriggers = vi.fn<
    (args: { enabled: boolean }) => { triggers: Array<(typeof STABLE_TRIGGERS)[number]>; hasUrgent: boolean }
  >(() => ({ triggers: [], hasUrgent: false }));

  const mockUseJarvisIntentPrediction = vi.fn<
    (args: { enabled: boolean }) => { highConfidencePredictions: Array<(typeof STABLE_PREDICTIONS)[number]> | null }
  >(() => ({ highConfidencePredictions: null }));

  return {
    jarvisState,
    mockOpenPanel,
    mockClosePanel,
    mockClearMinimizedState,
    mockMinimizePanel,
    mockUseJarvisKeyboardShortcuts,
    mockUseMediaQuery,
    mockUseJarvis,
    mockUseJarvisSmartTriggers,
    mockUseJarvisIntentPrediction,
    STABLE_TRIGGERS,
    STABLE_PREDICTIONS,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const mkBuilder = () => {
    const builder: Record<string, unknown> = {};

    const methods = [
      'select',
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'in',
      'order',
      'limit',
      'range',
      'insert',
      'update',
      'upsert',
      'delete',
      'maybeSingle',
      'single',
    ] as const;

    for (const m of methods) builder[m] = () => builder;

    builder.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(onFulfilled);
    builder.catch = (onRejected: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected);

    return builder;
  };

  const mockFrom = vi.fn(() => mkBuilder());

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  };
});

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: { children?: React.ReactNode }) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children?: React.ReactNode }) => <div data-testid="sheet">{children}</div>,
  SheetContent: ({ children }: { children?: React.ReactNode }) => <div data-testid="sheet-content">{children}</div>,
  SheetTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/hover-card', () => ({
  HoverCard: ({ children }: { children?: React.ReactNode }) => <div data-testid="hovercard">{children}</div>,
  HoverCardTrigger: ({ children }: { children?: React.ReactNode }) => <div data-testid="hovercard-trigger">{children}</div>,
  HoverCardContent: ({ children }: { children?: React.ReactNode }) => <div data-testid="hovercard-content">{children}</div>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipTrigger: ({ children }: { children?: React.ReactNode }) => <div data-testid="tooltip-trigger">{children}</div>,
  TooltipContent: ({ children }: { children?: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<unknown>) => args.filter(Boolean).join(' '),
}));

vi.mock('framer-motion', () => {
   
  const React = require('react') as typeof import('react');
  const passthrough = (Tag: keyof JSX.IntrinsicElements) =>
    React.forwardRef<HTMLElement, Record<string, unknown> & { children?: React.ReactNode }>((props, ref) =>
      React.createElement(Tag, { ...props, ref }, props.children)
    );

  return {
    motion: {
      button: passthrough('button'),
      div: passthrough('div'),
      img: passthrough('img'),
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('lucide-react', () => {
   
  const React = require('react') as typeof import('react');
  const Icon = ({ 'data-icon': dataIcon, ...props }: { 'data-icon': string } & React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${dataIcon}`} {...props} />
  );
  return {
    Bot: (p: React.SVGProps<SVGSVGElement>) => <Icon data-icon="Bot" {...p} />,
    Sparkles: (p: React.SVGProps<SVGSVGElement>) => <Icon data-icon="Sparkles" {...p} />,
    Zap: (p: React.SVGProps<SVGSVGElement>) => <Icon data-icon="Zap" {...p} />,
    ArrowRight: (p: React.SVGProps<SVGSVGElement>) => <Icon data-icon="ArrowRight" {...p} />,
    AlertTriangle: (p: React.SVGProps<SVGSVGElement>) => <Icon data-icon="AlertTriangle" {...p} />,
    Lightbulb: (p: React.SVGProps<SVGSVGElement>) => <Icon data-icon="Lightbulb" {...p} />,
    TrendingUp: (p: React.SVGProps<SVGSVGElement>) => <Icon data-icon="TrendingUp" {...p} />,
    Bell: (p: React.SVGProps<SVGSVGElement>) => <Icon data-icon="Bell" {...p} />,
    BrainCircuit: (p: React.SVGProps<SVGSVGElement>) => <Icon data-icon="BrainCircuit" {...p} />,
  };
});

vi.mock('@/hooks/jarvis/useJarvis', () => ({
  useJarvis: () => mockUseJarvis(),
}));

vi.mock('@/hooks/shared/use-media-query', () => ({
  useMediaQuery: (query: string) => mockUseMediaQuery(query),
}));

vi.mock('@/hooks/jarvis/useJarvisKeyboardShortcuts', () => ({
  useJarvisKeyboardShortcuts: (args: { isOpen: boolean; onToggle: () => void; onClose: () => void; enabled: boolean }) =>
    mockUseJarvisKeyboardShortcuts(args),
}));

vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  useJarvisUnifiedOptional: () => ({
    get isPanelOpen() {
      return jarvisState.isPanelOpen;
    },
    get isMinimized() {
      return jarvisState.isMinimized;
    },
    streamState: jarvisState.streamState,
    isTyping: jarvisState.isTyping,
    pendingActions: jarvisState.pendingActions,
    openPanel: (...args: unknown[]) => mockOpenPanel(...args),
    closePanel: (...args: unknown[]) => mockClosePanel(...args),
    clearMinimizedState: (...args: unknown[]) => mockClearMinimizedState(...args),
    minimizePanel: (...args: unknown[]) => mockMinimizePanel(...args),
  }),
}));

vi.mock('@/hooks/jarvis/useJarvisSmartTriggers', () => ({
  useJarvisSmartTriggers: (args: { enabled: boolean }) => mockUseJarvisSmartTriggers(args),
}));

vi.mock('@/hooks/jarvis/useJarvisIntentPrediction', () => ({
  useJarvisIntentPrediction: (args: { enabled: boolean }) => mockUseJarvisIntentPrediction(args),
}));

vi.mock('./JarvisPremiumPanel', () => ({
  JarvisPremiumPanel: ({ onClose, onMinimize }: { onClose: () => void; onMinimize: () => void }) => (
    <div data-testid="jarvis-premium-panel">
      <button type="button" onClick={onClose}>
        close
      </button>
      <button type="button" onClick={onMinimize}>
        minimize
      </button>
    </div>
  ),
}));

vi.mock('@/assets/marque/logo.png', () => ({
  default: 'croix-marque.png',
}));

import { JarvisLogoTrigger } from './JarvisLogoTrigger';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createTestQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('JarvisLogoTrigger', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    jarvisState.isPanelOpen = false;
    jarvisState.isMinimized = false;
    jarvisState.streamState.isStreaming = false;
    jarvisState.isTyping = false;
    jarvisState.pendingActions = [];

    mockUseMediaQuery.mockImplementation((query: string) => {
      if (query.includes('767')) return false;
      if (query.includes('1024')) return false;
      return false;
    });

    mockUseJarvis.mockReturnValue({ isEnabled: true, pendingCount: 0 });
    mockUseJarvisSmartTriggers.mockReturnValue({ triggers: [], hasUrgent: false });
    mockUseJarvisIntentPrediction.mockReturnValue({ highConfidencePredictions: null });
  });

  it('rendu initial -> succès (badge 9+ et suggestions) -> erreur (désactivé, ne doit pas ouvrir)', async () => {
    renderWithClient(<JarvisLogoTrigger />);

    expect(screen.getByRole('button', { name: 'Ouvrir Jarvis - Assistant IA' })).toBeInTheDocument();
    expect(mockUseJarvisKeyboardShortcuts).toHaveBeenCalledWith(
      expect.objectContaining({
        isOpen: false,
        enabled: true,
        onToggle: expect.any(Function),
        onClose: expect.any(Function),
      })
    );

    cleanup();
    mockUseJarvis.mockReturnValue({ isEnabled: true, pendingCount: 8 });
    mockUseJarvisSmartTriggers.mockReturnValue({ triggers: STABLE_TRIGGERS.slice(), hasUrgent: true });
    mockUseJarvisIntentPrediction.mockReturnValue({ highConfidencePredictions: STABLE_PREDICTIONS.slice() });

    renderWithClient(<JarvisLogoTrigger />);

    expect(screen.getByText('9+')).toBeInTheDocument();
    expect(screen.getByText('Suggestions Jarvis')).toBeInTheDocument();
    expect(screen.getByText('Urgent: Ticket')).toBeInTheDocument();
    expect(screen.getByText('Insight: KPI')).toBeInTheDocument();
    expect(screen.getByText('Briefing du jour')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Urgent: Ticket'));
    fireEvent.click(screen.getByText('Briefing du jour'));
    fireEvent.click(screen.getByText('Ouvrir Jarvis →'));
    expect(mockOpenPanel).toHaveBeenCalledTimes(3);

    cleanup();
    mockUseJarvis.mockReturnValue({ isEnabled: false, pendingCount: 2 });

    renderWithClient(<JarvisLogoTrigger />);

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir Jarvis - Assistant IA' }));
    expect(mockOpenPanel).toHaveBeenCalledTimes(3);
  });

  it('desktop: backdrop ferme le panel sauf si streaming ou actions en attente; évènement jarvis:close', async () => {
    jarvisState.isPanelOpen = true;

    renderWithClient(<JarvisLogoTrigger />);

    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/40') as HTMLElement | null;
    expect(backdrop).not.toBeNull();

    fireEvent.click(backdrop as HTMLElement);
    expect(mockClosePanel).toHaveBeenCalledTimes(1);
    expect(mockClearMinimizedState).toHaveBeenCalledTimes(1);

    cleanup();
    vi.clearAllMocks();
    jarvisState.isPanelOpen = true;
    jarvisState.isMinimized = false;
    jarvisState.streamState.isStreaming = true;
    jarvisState.pendingActions = [];

    renderWithClient(<JarvisLogoTrigger />);
    const backdrop2 = document.querySelector('.fixed.inset-0.bg-black\\/40') as HTMLElement | null;
    expect(backdrop2).not.toBeNull();

    fireEvent.click(backdrop2 as HTMLElement);
    expect(mockClosePanel).toHaveBeenCalledTimes(0);
    expect(mockClearMinimizedState).toHaveBeenCalledTimes(0);

    cleanup();
    vi.clearAllMocks();
    jarvisState.isPanelOpen = true;
    jarvisState.isMinimized = false;
    jarvisState.streamState.isStreaming = false;
    jarvisState.pendingActions = [{}];

    renderWithClient(<JarvisLogoTrigger />);
    const backdrop3 = document.querySelector('.fixed.inset-0.bg-black\\/40') as HTMLElement | null;
    expect(backdrop3).not.toBeNull();

    fireEvent.click(backdrop3 as HTMLElement);
    expect(mockClosePanel).toHaveBeenCalledTimes(0);

    cleanup();
    vi.clearAllMocks();
    jarvisState.isPanelOpen = true;
    jarvisState.isMinimized = false;
    jarvisState.streamState.isStreaming = false;
    jarvisState.pendingActions = [];

    renderWithClient(<JarvisLogoTrigger />);

    window.dispatchEvent(new Event('jarvis:close'));
    await waitFor(() => {
      expect(mockClosePanel).toHaveBeenCalledTimes(1);
    });
  });

  it('mobile: Sheet est rendu, minimise via panel, et conserve le panel monté en mode minimized', async () => {
    mockUseMediaQuery.mockImplementation((query: string) => {
      if (query.includes('767')) return true;
      if (query.includes('1024')) return true;
      return false;
    });

    jarvisState.isPanelOpen = true;

    renderWithClient(<JarvisLogoTrigger />);

    expect(screen.getByTestId('sheet')).toBeInTheDocument();
    expect(screen.getByTestId('jarvis-premium-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'minimize' }));
    expect(mockMinimizePanel).toHaveBeenCalledTimes(1);

    cleanup();
    jarvisState.isPanelOpen = false;
    jarvisState.isMinimized = true;

    renderWithClient(<JarvisLogoTrigger />);

    const hiddenKeepAlive = document.querySelector('[aria-hidden="true"]');
    expect(hiddenKeepAlive).not.toBeNull();
    expect(screen.getAllByTestId('jarvis-premium-panel').length).toBeGreaterThan(0);
  });
});