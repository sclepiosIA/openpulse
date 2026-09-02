/* @vitest-environment jsdom */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisProactive } from './useJarvisProactive';

const {
  AUTH_STATE,
  TOAST_STATE,
  DEBUG_STATE,
  LOCATION_STATE,
  ACTIONS_ROWS,
  EMAIL_THREADS_ROWS,
  OVERDUE_TASKS_ROWS,
  SUPPORT_TICKETS_ROWS,
  ACTIONS_RESULT,
  EMAILS_RESULT,
  OVERDUE_RESULT,
  DUE_TODAY_RESULT,
  TOTAL_PENDING_RESULT,
  SUPPORT_RESULT,
  EMPTY_RESULT,
  ERROR_PAYLOAD,
  mockFrom,
  mockNavigate,
} = vi.hoisted(() => {
  const actionsRows = [
    {
      trigger_type: 'manual',
      proposed_action: { type: 'reply' },
      created_at: '2024-01-01T09:00:00.000',
      status: 'done',
    },
    {
      trigger_type: 'auto',
      proposed_action: { type: 'reply' },
      created_at: '2024-01-02T09:30:00.000',
      status: 'done',
    },
    {
      trigger_type: 'manual',
      proposed_action: { type: 'summarize' },
      created_at: '2024-01-03T14:00:00.000',
      status: 'pending',
    },
    {
      trigger_type: 'auto',
      proposed_action: { type: 'prioritize' },
      created_at: '2024-01-04T14:15:00.000',
      status: 'pending',
    },
  ];

  const emailThreadsRows = [
    {
      id: 'e1',
      subject: 'Urgent',
      ai_generated_title: 'Urgent',
      last_message_date: '2024-01-05T08:00:00.000',
    },
  ];

  const overdueTasksRows = [
    {
      id: 't1',
      titre: 'Relancer client',
      echeance: '2024-01-04T09:00:00.000',
      priorite: 'haute',
    },
  ];

  const supportTicketsRows = [{ id: 's1' }];

  return {
    AUTH_STATE: {
      user: { id: 'u1', email: 'user@test.dev' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    TOAST_STATE: { toast: vi.fn() },
    DEBUG_STATE: { error: vi.fn() },
    LOCATION_STATE: { pathname: '/' },
    ACTIONS_ROWS: actionsRows,
    EMAIL_THREADS_ROWS: emailThreadsRows,
    OVERDUE_TASKS_ROWS: overdueTasksRows,
    SUPPORT_TICKETS_ROWS: supportTicketsRows,
    ACTIONS_RESULT: { data: actionsRows, count: null, error: null },
    EMAILS_RESULT: { data: emailThreadsRows, count: 11, error: null },
    OVERDUE_RESULT: { data: overdueTasksRows, count: 2, error: null },
    DUE_TODAY_RESULT: { data: null, count: 3, error: null },
    TOTAL_PENDING_RESULT: { data: null, count: 7, error: null },
    SUPPORT_RESULT: { data: supportTicketsRows, count: 6, error: null },
    EMPTY_RESULT: { data: null, count: 0, error: null },
    ERROR_PAYLOAD: { data: null, error: { message: 'x' } },
    mockFrom: vi.fn(),
    mockNavigate: vi.fn(),
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
  useSession: () => AUTH_STATE,
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
  useSession: () => AUTH_STATE,
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => TOAST_STATE,
}));

vi.mock('@/lib/debug', () => ({
  debug: DEBUG_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => LOCATION_STATE,
  useNavigate: () => mockNavigate,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

type QueryError = { message: string };
type QueryResult = {
  data: unknown;
  count?: number | null;
  error?: QueryError | null;
};

type Fulfilled<TResult> = ((value: QueryResult) => TResult | PromiseLike<TResult>) | null | undefined;
type Rejected<TResult> = ((reason: unknown) => TResult | PromiseLike<TResult>) | null | undefined;

interface SupabaseBuilder {
  select: (columns?: string, options?: Record<string, unknown>) => SupabaseBuilder;
  eq: (column: string, value: unknown) => SupabaseBuilder;
  neq: (column: string, value: unknown) => SupabaseBuilder;
  gt: (column: string, value: unknown) => SupabaseBuilder;
  gte: (column: string, value: unknown) => SupabaseBuilder;
  lt: (column: string, value: unknown) => SupabaseBuilder;
  lte: (column: string, value: unknown) => SupabaseBuilder;
  in: (column: string, values: unknown[]) => SupabaseBuilder;
  not: (column: string, operator: string, value: unknown) => SupabaseBuilder;
  is: (column: string, value: unknown) => SupabaseBuilder;
  order: (column: string, options?: Record<string, unknown>) => SupabaseBuilder;
  limit: (count: number) => SupabaseBuilder;
  range: (from: number, to: number) => SupabaseBuilder;
  insert: (values: unknown) => SupabaseBuilder;
  update: (values: unknown) => SupabaseBuilder;
  upsert: (values: unknown) => SupabaseBuilder;
  delete: () => SupabaseBuilder;
  single: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
  then: <TResult1 = QueryResult, TResult2 = never>(
    onFulfilled?: Fulfilled<TResult1>,
    onRejected?: Rejected<TResult2>,
  ) => Promise<TResult1 | TResult2>;
  catch: <TResult = never>(onRejected?: Rejected<TResult>) => Promise<QueryResult | TResult>;
}

function createThenableBuilder(result: QueryResult, rejection?: unknown): SupabaseBuilder {
  let builder: SupabaseBuilder;

  const toPromise = () => {
    if (rejection === undefined) {
      return Promise.resolve(result);
    }

    return Promise.reject(rejection);
  };

  const chain = () => builder;

  builder = {
    select: vi.fn(chain),
    eq: vi.fn(chain),
    neq: vi.fn(chain),
    gt: vi.fn(chain),
    gte: vi.fn(chain),
    lt: vi.fn(chain),
    lte: vi.fn(chain),
    in: vi.fn(chain),
    not: vi.fn(chain),
    is: vi.fn(chain),
    order: vi.fn(chain),
    limit: vi.fn(chain),
    range: vi.fn(chain),
    insert: vi.fn(chain),
    update: vi.fn(chain),
    upsert: vi.fn(chain),
    delete: vi.fn(chain),
    single: vi.fn(() => toPromise()),
    maybeSingle: vi.fn(() => toPromise()),
    then: <TResult1 = QueryResult, TResult2 = never>(
      onFulfilled?: Fulfilled<TResult1>,
      onRejected?: Rejected<TResult2>,
    ) => toPromise().then(onFulfilled, onRejected),
    catch: <TResult = never>(onRejected?: Rejected<TResult>) => toPromise().catch(onRejected),
  };

  return builder;
}

function setSupabaseSuccessMocks() {
  let taskQueryIndex = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === 'jarvis_pending_actions') {
      return createThenableBuilder(ACTIONS_RESULT);
    }

    if (table === 'email_threads') {
      return createThenableBuilder(EMAILS_RESULT);
    }

    if (table === 'taches') {
      taskQueryIndex += 1;

      if (taskQueryIndex === 1) {
        return createThenableBuilder(OVERDUE_RESULT);
      }

      if (taskQueryIndex === 2) {
        return createThenableBuilder(DUE_TODAY_RESULT);
      }

      return createThenableBuilder(TOTAL_PENDING_RESULT);
    }

    if (table === 'support_tickets') {
      return createThenableBuilder(SUPPORT_RESULT);
    }

    return createThenableBuilder(EMPTY_RESULT);
  });
}

function setSupabaseRejectingMocks() {
  mockFrom.mockImplementation(() => createThenableBuilder(EMPTY_RESULT, ERROR_PAYLOAD));
}

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

async function settleAsyncUpdates() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useJarvisProactive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 5, 9, 0, 0));
    localStorage.clear();
    mockFrom.mockReset();
    mockNavigate.mockReset();
    TOAST_STATE.toast.mockReset();
    DEBUG_STATE.error.mockReset();
    LOCATION_STATE.pathname = '/';
    setSupabaseSuccessMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('analyse les patterns de travail au montage et expose un état initial sans suggestion', async () => {
    const { result } = renderHook(() => useJarvisProactive(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.hasSuggestions).toBe(false);
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.topSuggestion).toBeNull();
    expect(result.current.workPattern).toBeNull();

    await settleAsyncUpdates();

    expect(mockFrom).toHaveBeenCalledWith('jarvis_pending_actions');
    expect(result.current.workPattern).toEqual({
      mostActiveHours: [9, 14],
      preferredModules: ['emails', 'crm', 'tasks'],
      averageTasksPerDay: ACTIONS_ROWS.length / 30,
      commonActions: ['reply', 'summarize', 'prioritize'],
    });
  });

  it('génère des suggestions métier pertinentes après le délai initial', async () => {
    const { result } = renderHook(() => useJarvisProactive(), {
      wrapper: createWrapper(),
    });

    await settleAsyncUpdates();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await settleAsyncUpdates();

    expect(result.current.hasSuggestions).toBe(true);
    expect(result.current.suggestions).toHaveLength(5);
    expect(result.current.highPrioritySuggestions).toHaveLength(2);
    expect(result.current.highPrioritySuggestions.map((suggestion) => suggestion.id)).toEqual([
      'unread-emails-high',
      'overdue-tasks',
    ]);

    expect(result.current.suggestions).toEqual([
      expect.objectContaining({
        id: 'unread-emails-high',
        type: 'warning',
        priority: 'high',
        title: '11 emails non lus',
        description: "Vous avez beaucoup d'emails en attente. Voulez-vous que je vous aide à les trier ?",
        actionLabel: 'Trier mes emails',
        dismissable: true,
      }),
      expect.objectContaining({
        id: 'overdue-tasks',
        type: 'warning',
        priority: 'high',
        title: '2 tâches en retard',
        description: 'Dont: "Relancer client"',
        actionLabel: 'Voir les tâches',
        dismissable: true,
      }),
      expect.objectContaining({
        id: 'due-today',
        type: 'reminder',
        priority: 'medium',
        title: "3 tâches à faire aujourd'hui",
        description: 'Gardez le cap sur vos objectifs du jour !',
        dismissable: true,
      }),
      expect.objectContaining({
        id: 'morning-briefing',
        type: 'tip',
        priority: 'medium',
        title: 'Briefing du matin',
        description: 'Vous avez 7 tâches en cours. Souhaitez-vous commencer par les priorités ?',
        actionLabel: 'Voir mes priorités',
        dismissable: true,
      }),
      expect.objectContaining({
        id: 'support-backlog',
        type: 'insight',
        priority: 'medium',
        title: '6 tickets support ouverts',
        description: "Le backlog support est élevé. Besoin d'aide pour prioriser ?",
        actionLabel: 'Analyser le backlog',
        dismissable: true,
      }),
    ]);

    expect(result.current.topSuggestion).toEqual(
      expect.objectContaining({
        id: 'unread-emails-high',
        priority: 'high',
      }),
    );
    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(mockFrom).toHaveBeenCalledWith('taches');
    expect(mockFrom).toHaveBeenCalledWith('support_tickets');
  });

  it('permet de dismiss une suggestion et persiste le choix dans localStorage', async () => {
    const { result } = renderHook(() => useJarvisProactive(), {
      wrapper: createWrapper(),
    });

    await settleAsyncUpdates();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await settleAsyncUpdates();

    expect(result.current.suggestions.map((suggestion) => suggestion.id)).toContain('overdue-tasks');

    await act(async () => {
      result.current.dismissSuggestion('overdue-tasks');
    });

    expect(result.current.suggestions.map((suggestion) => suggestion.id)).toEqual([
      'unread-emails-high',
      'due-today',
      'morning-briefing',
      'support-backlog',
    ]);
    expect(result.current.highPrioritySuggestions).toEqual([
      expect.objectContaining({ id: 'unread-emails-high' }),
    ]);

    const storedDismissed = JSON.parse(localStorage.getItem('jarvis_dismissed_suggestions') || '[]') as Array<{
      id: string;
      dismissedAt: string;
    }>;

    expect(storedDismissed).toHaveLength(1);
    expect(storedDismissed[0]).toEqual({
      id: 'overdue-tasks',
      dismissedAt: expect.any(String),
    });
  });

  it('rafraîchit manuellement les suggestions avec les requêtes Supabase attendues', async () => {
    const { result } = renderHook(() => useJarvisProactive(), {
      wrapper: createWrapper(),
    });

    await settleAsyncUpdates();
    expect(result.current.workPattern).toEqual(
      expect.objectContaining({
        commonActions: ['reply', 'summarize', 'prioritize'],
      }),
    );

    mockFrom.mockClear();
    setSupabaseSuccessMocks();

    await act(async () => {
      await result.current.refreshSuggestions();
    });
    await settleAsyncUpdates();

    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(mockFrom).toHaveBeenCalledWith('taches');
    expect(mockFrom).toHaveBeenCalledWith('support_tickets');
    expect(result.current.suggestions.map((suggestion) => suggestion.id)).toEqual([
      'unread-emails-high',
      'overdue-tasks',
      'due-today',
      'morning-briefing',
      'support-backlog',
    ]);
  });

  it('ne lance pas les analyses automatiques lorsque le hook est désactivé', async () => {
    const { result } = renderHook(() => useJarvisProactive({ enabled: false }), {
      wrapper: createWrapper(),
    });

    await settleAsyncUpdates();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await settleAsyncUpdates();

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.workPattern).toBeNull();
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.hasSuggestions).toBe(false);
    expect(result.current.highPrioritySuggestions).toEqual([]);
  });

  it('gère une erreur Supabase rejetée sans planter et journalise via debug.error', async () => {
    setSupabaseRejectingMocks();

    const { result } = renderHook(() => useJarvisProactive(), {
      wrapper: createWrapper(),
    });

    await settleAsyncUpdates();

    expect(DEBUG_STATE.error).toHaveBeenCalledWith(
      '[JarvisProactive] Error analyzing patterns:',
      ERROR_PAYLOAD,
    );
    expect(result.current.workPattern).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await settleAsyncUpdates();

    expect(DEBUG_STATE.error).toHaveBeenCalledWith(
      '[JarvisProactive] Error generating suggestions:',
      ERROR_PAYLOAD,
    );
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.hasSuggestions).toBe(false);
    expect(result.current.topSuggestion).toBeNull();
    expect(result.current.isAnalyzing).toBe(false);
  });
});