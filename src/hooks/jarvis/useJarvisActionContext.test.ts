/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useJarvisActionContext } from './useJarvisActionContext';

const {
  AUTH_STATE,
  TOAST_FN,
  INVOKE_FN,
  DEBUG_ERROR,
  SANITIZE_FN,
  PENDING_ROWS,
  CONTEXT_ROW,
  JOB_ROW,
  state,
  mockFromExtended,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const TOAST_FN = vi.fn();
  const INVOKE_FN = vi.fn();
  const DEBUG_ERROR = vi.fn();
  const SANITIZE_FN = vi.fn((error: Error | { message?: string }) => error.message || 'sanitized');

  const PENDING_ROWS = [
    {
      id: 'ctx-1',
      user_id: 'u1',
      action_type: 'send_email',
      action_data: { to: 'a@b.c' },
      status: 'paused',
      original_message: 'Bonjour ceci est un message à envoyer rapidement',
      conversation_id: 'conv-1',
      last_interaction_at: '2024-01-02T10:00:00.000Z',
      created_at: '2024-01-01T10:00:00.000Z',
    },
    {
      id: 'ctx-2',
      user_id: 'u1',
      action_type: 'create_task',
      action_data: { title: 'Follow-up' },
      status: 'in_progress',
      original_message: 'Créer une tâche pour relancer le client',
      conversation_id: 'conv-2',
      last_interaction_at: '2024-01-01T09:00:00.000Z',
      created_at: '2024-01-01T08:00:00.000Z',
    },
  ];

  const CONTEXT_ROW = {
    id: 'ctx-1',
    user_id: 'u1',
    action_type: 'send_email',
    action_data: { to: 'a@b.c', subject: 'Hello' },
    status: 'paused',
    original_message: 'Bonjour ceci est un message à envoyer rapidement',
    conversation_id: 'conv-1',
    last_interaction_at: '2024-01-02T10:00:00.000Z',
    created_at: '2024-01-01T10:00:00.000Z',
  };

  const JOB_ROW = {
    id: 'job-1',
    user_id: 'u1',
    action_type: 'send_email',
    action_data: { to: 'a@b.c', subject: 'Hello' },
    status: 'queued',
    progress: 0,
  };

  const state = {
    pendingResult: { data: PENDING_ROWS, error: null as null | { message: string } },
    contextResult: { data: CONTEXT_ROW, error: null as null | { message: string } },
    jobInsertResult: { data: JOB_ROW, error: null as null | { message: string } },
    updateResult: { data: null, error: null as null | { message: string } },
  };

  const mockFromExtended = vi.fn((table: string) => {
    const chain = {
      table,
      _select: undefined as string | undefined,
      _insert: undefined as Record<string, unknown> | undefined,
      _update: undefined as Record<string, unknown> | undefined,
      _eqs: [] as Array<[string, unknown]>,
      _in: undefined as [string, unknown[]] | undefined,
      _order: undefined as [string, unknown] | undefined,
      _limit: undefined as number | undefined,

      select: vi.fn(function (fields?: string) {
        chain._select = fields;
        return chain;
      }),
      eq: vi.fn(function (field: string, value: unknown) {
        chain._eqs.push([field, value]);
        return chain;
      }),
      gte: vi.fn(function () {
        return chain;
      }),
      lte: vi.fn(function () {
        return chain;
      }),
      in: vi.fn(function (field: string, values: unknown[]) {
        chain._in = [field, values];
        return chain;
      }),
      order: vi.fn(function (field: string, opts?: unknown) {
        chain._order = [field, opts];
        return chain;
      }),
      limit: vi.fn(function (value: number) {
        chain._limit = value;
        return chain;
      }),
      insert: vi.fn(function (payload: Record<string, unknown>) {
        chain._insert = payload;
        return chain;
      }),
      update: vi.fn(function (payload: Record<string, unknown>) {
        chain._update = payload;
        return chain;
      }),
      delete: vi.fn(function () {
        return chain;
      }),
      single: vi.fn(async function () {
        if (table === 'jarvis_background_jobs') return state.jobInsertResult;
        return state.contextResult;
      }),
      maybeSingle: vi.fn(async function () {
        return state.contextResult;
      }),
      then: function (
        resolve: (value: { data: unknown; error: null | { message: string } }) => unknown,
        reject?: (reason: unknown) => unknown
      ) {
        let result: { data: unknown; error: null | { message: string } } = { data: null, error: null };
        if (table === 'jarvis_action_context' && chain._insert === undefined && chain._update === undefined) {
          result = state.pendingResult;
        } else if (chain._update !== undefined) {
          result = state.updateResult;
        }
        return Promise.resolve(result).then(resolve, reject);
      },
      catch: function (reject: (reason: unknown) => unknown) {
        return Promise.resolve({ data: null, error: null as null | { message: string } }).catch(reject);
      },
    };
    return chain;
  });

  const mockFrom = vi.fn(() => {
    const builder = {
      select: vi.fn(function () {
        return builder;
      }),
      eq: vi.fn(function () {
        return builder;
      }),
      gte: vi.fn(function () {
        return builder;
      }),
      lte: vi.fn(function () {
        return builder;
      }),
      in: vi.fn(function () {
        return builder;
      }),
      order: vi.fn(function () {
        return builder;
      }),
      limit: vi.fn(function () {
        return builder;
      }),
      insert: vi.fn(function () {
        return builder;
      }),
      update: vi.fn(function () {
        return builder;
      }),
      delete: vi.fn(function () {
        return builder;
      }),
      single: vi.fn(async function () {
        return { data: null, error: null };
      }),
      maybeSingle: vi.fn(async function () {
        return { data: null, error: null };
      }),
      then: function (resolve: (value: { data: null; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
      },
      catch: function (reject: (reason: unknown) => unknown) {
        return Promise.resolve({ data: null, error: null }).catch(reject);
      },
    };
    return builder;
  });

  return {
    AUTH_STATE,
    TOAST_FN,
    INVOKE_FN,
    DEBUG_ERROR,
    SANITIZE_FN,
    PENDING_ROWS,
    CONTEXT_ROW,
    JOB_ROW,
    state,
    mockFromExtended,
    mockFrom,
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: TOAST_FN }),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: DEBUG_ERROR,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: SANITIZE_FN,
}));

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: mockFromExtended,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: INVOKE_FN,
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useJarvisActionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AUTH_STATE.user = { id: 'u1', email: 't@t.co' };
    AUTH_STATE.session = { user: { id: 'u1' } };
    AUTH_STATE.isLoading = false;

    state.pendingResult = { data: PENDING_ROWS, error: null };
    state.contextResult = { data: CONTEXT_ROW, error: null };
    state.jobInsertResult = { data: JOB_ROW, error: null };
    state.updateResult = { data: null, error: null };

    INVOKE_FN.mockResolvedValue({ data: { ok: true }, error: null });
  });

  it('charge les contextes en attente puis expose les valeurs métier attendues', async () => {
    const { result } = renderHook(() => useJarvisActionContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.pendingContexts).toEqual([]);
    expect(result.current.hasPendingContexts).toBe(false);
    expect(result.current.pendingCount).toBe(0);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFromExtended).toHaveBeenCalledWith('jarvis_action_context');
    expect(result.current.pendingContexts).toEqual(PENDING_ROWS);
    expect(result.current.hasPendingContexts).toBe(true);
    expect(result.current.pendingCount).toBe(2);
    expect(result.current.getContextSummary(PENDING_ROWS[0])).toBe('📧 Email: Bonjour ceci est un message à envoyer rapidement');
    expect(
      result.current.getContextSummary({
        ...PENDING_ROWS[0],
        original_message: 'x'.repeat(60),
      })
    ).toBe('📧 Email: ' + 'x'.repeat(50) + '...');
  });

  it('retourne une liste vide et loggue en cas derreur de chargement', async () => {
    state.pendingResult = { data: null, error: { message: 'x' } };

    const { result } = renderHook(() => useJarvisActionContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.pendingContexts).toEqual([]);
    expect(result.current.hasPendingContexts).toBe(false);
    expect(result.current.pendingCount).toBe(0);
    expect(DEBUG_ERROR).toHaveBeenCalledWith('[useJarvisActionContext] Error:', { message: 'x' });
  });

  it('reprend une action, crée un job, déclenche le worker et affiche un toast de succès', async () => {
    const { result } = renderHook(() => useJarvisActionContext(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.resumeAction('ctx-1');
    });

    expect(mockFromExtended).toHaveBeenCalledWith('jarvis_action_context');
    expect(mockFromExtended).toHaveBeenCalledWith('jarvis_background_jobs');

    const bgCall = mockFromExtended.mock.results.find(
      (entry) => entry.type === 'return' && (entry.value as { table?: string }).table === 'jarvis_background_jobs'
    );
    const bgBuilder = bgCall?.value as {
      insert: ReturnType<typeof vi.fn>;
    };

    expect(bgBuilder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      action_type: 'send_email',
      action_data: { to: 'a@b.c', subject: 'Hello' },
      status: 'queued',
      progress: 0,
    });

    expect(INVOKE_FN).toHaveBeenCalledWith('jarvis-background-worker', {
      body: { job_id: 'job-1', user_id: 'u1' },
    });

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: '🔄 Action reprise',
      description: "L'exécution continue en arrière-plan",
    });
  });

  it('passe en erreur sur reprise si le contexte est introuvable et sanitize le message', async () => {
    state.contextResult = { data: null, error: { message: 'x' } };

    const { result } = renderHook(() => useJarvisActionContext(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.resumeAction('ctx-404')).rejects.toThrow('Action context not found');

    await waitFor(() => {
      expect(SANITIZE_FN).toHaveBeenCalledWith(expect.objectContaining({ message: 'Action context not found' }));
    });

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Action context not found',
      variant: 'destructive',
    });
    expect(INVOKE_FN).not.toHaveBeenCalled();
  });

  it('annule un contexte et affiche le toast associé', async () => {
    const { result } = renderHook(() => useJarvisActionContext(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.cancelContext('ctx-2');
    });

    const actionContextCalls = mockFromExtended.mock.results
      .filter((entry) => entry.type === 'return')
      .map((entry) => entry.value)
      .filter((value) => (value as { table?: string }).table === 'jarvis_action_context') as Array<{
        _update?: Record<string, unknown>;
        _eqs: Array<[string, unknown]>;
      }>;

    const updateCall = actionContextCalls.find((builder) => builder._update?.status === 'cancelled');

    expect(updateCall?._eqs).toContainEqual(['id', 'ctx-2']);
    expect(updateCall?._eqs).toContainEqual(['user_id', 'u1']);
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Action annulée',
    });
  });

  it('met en pause un contexte', async () => {
    const { result } = renderHook(() => useJarvisActionContext(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.pauseContext('ctx-1');
    });

    const actionContextCalls = mockFromExtended.mock.results
      .filter((entry) => entry.type === 'return')
      .map((entry) => entry.value)
      .filter((value) => (value as { table?: string }).table === 'jarvis_action_context') as Array<{
        _update?: Record<string, unknown>;
        _eqs: Array<[string, unknown]>;
      }>;

    const pauseCall = actionContextCalls.find((builder) => builder._update?.status === 'paused');

    expect(pauseCall?._eqs).toContainEqual(['id', 'ctx-1']);
    expect(pauseCall?._eqs).toContainEqual(['user_id', 'u1']);
    expect(typeof pauseCall?._update?.last_interaction_at).toBe('string');
  });
});