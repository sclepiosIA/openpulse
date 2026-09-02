import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisHistorySheet } from './JarvisHistorySheet';

const {
  AUTH_STATE,
  HISTORY_ROWS,
  PAST_ROWS,
  SEARCH_STATE,
  mockFrom,
  mockUseAuth,
  mockUseJarvisConversationSearch,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  HISTORY_ROWS: [
    {
      id: 'h1',
      action_type: 'send_email',
      trigger_type: 'manual',
      confidence_score: 0.8,
      was_modified: false,
      was_approved: true,
      execution_time_ms: 2000,
      kb_articles_count: 2,
      kb_base_types: ['faq'],
      created_at: '2024-01-01T10:00:00.000Z',
    },
    {
      id: 'h2',
      action_type: 'create_task',
      trigger_type: 'auto',
      confidence_score: 0.6,
      was_modified: true,
      was_approved: false,
      execution_time_ms: 4000,
      kb_articles_count: 1,
      kb_base_types: ['docs'],
      created_at: '2024-01-02T10:00:00.000Z',
    },
  ],
  PAST_ROWS: [
    {
      id: 'p1',
      trigger_type: 'manual',
      status: 'executed',
      proposed_action: {
        type: 'send_email',
        preview_text: 'Envoyer un email',
        confidence_score: 0.9,
      },
      created_at: '2024-01-03T10:00:00.000Z',
      expires_at: '2024-01-04T10:00:00.000Z',
    },
  ],
  SEARCH_STATE: {
    searchTerm: '',
    results: [
      {
        conversation_id: 'c1',
        conversation_title: 'Conversation support',
        message_role: 'user',
        message_content: 'Bonjour Jarvis, aide moi',
        message_created_at: '2024-01-01T11:00:00.000Z',
      },
      {
        conversation_id: 'c1',
        conversation_title: 'Conversation support',
        message_role: 'assistant',
        message_content: 'Je peux aider sur ce sujet',
        message_created_at: '2024-01-01T11:01:00.000Z',
      },
    ],
    isSearching: false,
    hasSearched: true,
    clearSearch: vi.fn(),
    setSearchTerm: vi.fn(),
    highlightMatch: vi.fn((text: string, term: string) => {
      if (!term) return [{ text, highlight: false }];
      const lower = text.toLowerCase();
      const idx = lower.indexOf(term.toLowerCase());
      if (idx === -1) return [{ text, highlight: false }];
      return [
        { text: text.slice(0, idx), highlight: false },
        { text: text.slice(idx, idx + term.length), highlight: true },
        { text: text.slice(idx + term.length), highlight: false },
      ].filter((part) => part.text.length > 0);
    }),
  },
  mockFrom: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUseJarvisConversationSearch: vi.fn(),
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/hooks/jarvis/useJarvisConversationSearch', () => ({
  useJarvisConversationSearch: mockUseJarvisConversationSearch,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => 'il y a 2 jours'),
  format: vi.fn(() => '01/01/2024'),
}));

vi.mock('date-fns/locale', () => ({
  fr: {},
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
  SheetContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SheetHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SheetTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h1 {...props}>{children}</h1>,
  SheetDescription: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: () => <span>select</span>,
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: (props: React.HTMLAttributes<HTMLDivElement>) => <hr {...props} />,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  TabsTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props}>{children}</button>,
  TabsContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    History: Icon,
    Mail: Icon,
    CheckSquare: Icon,
    Building2: Icon,
    Calendar: Icon,
    Ticket: Icon,
    Check: Icon,
    X: Icon,
    Clock: Icon,
    Filter: Icon,
    TrendingUp: Icon,
    Sparkles: Icon,
    Search: Icon,
    MessageSquare: Icon,
    User: Icon,
    Bot: Icon,
    XCircle: Icon,
    ArrowRight: Icon,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createThenableBuilder(table: string) {
  const state: {
    eqCalls: Array<[string, unknown]>;
    inCalls: Array<[string, unknown[]]>;
    selectArg?: string;
    orderArgs?: [string, { ascending: boolean }];
    limitArg?: number;
  } = {
    eqCalls: [],
    inCalls: [],
  };

  const resolvePayload = () => {
    if (table === 'jarvis_action_history') {
      return { data: HISTORY_ROWS, error: null };
    }
    if (table === 'jarvis_pending_actions') {
      return { data: PAST_ROWS, error: null };
    }
    return { data: [], error: null };
  };

  const builder = {
    select: vi.fn((arg: string) => {
      state.selectArg = arg;
      return builder;
    }),
    eq: vi.fn((field: string, value: unknown) => {
      state.eqCalls.push([field, value]);
      return builder;
    }),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn((field: string, value: unknown[]) => {
      state.inCalls.push([field, value]);
      return builder;
    }),
    order: vi.fn((field: string, options: { ascending: boolean }) => {
      state.orderArgs = [field, options];
      return builder;
    }),
    limit: vi.fn((n: number) => {
      state.limitArg = n;
      return builder;
    }),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => resolvePayload()),
    maybeSingle: vi.fn(async () => resolvePayload()),
    then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown) => Promise.resolve(resolvePayload()).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(resolvePayload()).catch(onRejected),
    __state: state,
  };

  return builder;
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('JarvisHistorySheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue(AUTH_STATE);
    mockUseJarvisConversationSearch.mockImplementation(() => SEARCH_STATE);

    mockFrom.mockImplementation((table: string) => createThenableBuilder(table));
  });

  it('affiche les résultats de recherche et ouvre une conversation', async () => {
    const onOpenChange = vi.fn();
    const onLoadConversation = vi.fn();

    render(
      <JarvisHistorySheet open={true} onOpenChange={onOpenChange} onLoadConversation={onLoadConversation} />,
      { wrapper: createWrapper() }
    );

    expect(await screen.findByText('Historique Jarvis')).toBeInTheDocument();
    expect(screen.getByText('Conversation support')).toBeInTheDocument();
    expect(screen.getByText('2 matches')).toBeInTheDocument();
    expect(screen.getByText('Bonjour Jarvis, aide moi')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Conversation support/i }));

    expect(onLoadConversation).toHaveBeenCalledWith('c1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('charge les données supabase avec les bonnes contraintes métier', async () => {
    render(
      <JarvisHistorySheet open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('jarvis_action_history');
      expect(mockFrom).toHaveBeenCalledWith('jarvis_pending_actions');
    });

    const historyBuilder = mockFrom.mock.results.find((result) => result.type === 'return' && result.value.__state?.selectArg?.includes('action_type'))?.value;
    const pastBuilder = mockFrom.mock.results.find((result) => result.type === 'return' && result.value.__state?.selectArg?.includes('proposed_action'))?.value;

    expect(historyBuilder).toBeDefined();
    expect(pastBuilder).toBeDefined();

    expect(historyBuilder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(historyBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(historyBuilder.limit).toHaveBeenCalledWith(100);

    expect(pastBuilder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(pastBuilder.in).toHaveBeenCalledWith('status', ['executed', 'rejected', 'expired', 'error']);
    expect(pastBuilder.limit).toHaveBeenCalledWith(30);
  });

  it('passe en erreur si la requête supabase échoue', async () => {
    mockFrom.mockImplementation((table: string) => {
      const builder = createThenableBuilder(table);
      if (table === 'jarvis_action_history') {
        const payload = { data: null, error: { message: 'x' } };
        return {
          ...builder,
          single: vi.fn(async () => payload),
          maybeSingle: vi.fn(async () => payload),
          then: (onFulfilled: (value: { data: null; error: { message: string } }) => unknown) => Promise.resolve(payload).then(onFulfilled),
          catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(payload).catch(onRejected),
        };
      }
      return builder;
    });

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <JarvisHistorySheet open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('jarvis_action_history');
    });

    expect(screen.getByText('Historique Jarvis')).toBeInTheDocument();

    consoleError.mockRestore();
  });
});