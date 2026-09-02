/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEtablissementEmailSuggestions } from './useEtablissementEmailSuggestions';

const {
  SUGGESTIONS_ROWS,
  AUTH_STATE,
  toastSpy,
  sanitizeSupabaseErrorSpy,
  debugLogSpy,
  mockFrom,
  invokeSpy,
  queryState,
  fromCalls,
  invalidateQueriesSpy,
} = vi.hoisted(() => {
  const SUGGESTIONS_ROWS = [
    {
      id: 'sug-1',
      email_thread_id: 'thread-1',
      suggested_etablissement_id: 'eta-1',
      suggestion_type: 'link_existing' as const,
      match_confidence: 0.92,
      match_reason: 'domain match',
      extracted_data: {
        nom: 'Clinique Alpha',
        ville: 'Paris',
        type: 'Clinique',
        domain: 'alpha.test',
        email: 'contact@alpha.test',
      },
      status: 'pending' as const,
      reviewed_by: null,
      reviewed_at: null,
      created_at: '2024-01-10T10:00:00.000Z',
      email_thread: {
        id: 'thread-1',
        subject: 'Demande de partenariat',
        ai_summary: 'Résumé IA',
        last_message_date: '2024-01-10T09:00:00.000Z',
        participants: [{ name: 'Alice', email: 'alice@test.co' }],
        message_count: 3,
      },
      suggested_etablissement: {
        id: 'eta-1',
        nom: 'Clinique Alpha',
        ville: 'Paris',
      },
    },
    {
      id: 'sug-2',
      email_thread_id: 'thread-2',
      suggested_etablissement_id: null,
      suggestion_type: 'create_new' as const,
      match_confidence: 0.77,
      match_reason: 'name similarity',
      extracted_data: {
        nom: 'Cabinet Beta',
        ville: 'Lyon',
        type: 'Cabinet',
        email: 'beta@test.co',
      },
      status: 'pending' as const,
      reviewed_by: null,
      reviewed_at: null,
      created_at: '2024-01-09T10:00:00.000Z',
      email_thread: {
        id: 'thread-2',
        subject: 'Ouverture établissement',
        ai_summary: null,
        last_message_date: '2024-01-09T08:00:00.000Z',
        participants: [{ name: 'Bob', email: 'bob@test.co' }],
        message_count: 1,
      },
      suggested_etablissement: undefined,
    },
    {
      id: 'sug-3',
      email_thread_id: 'thread-3',
      suggested_etablissement_id: 'eta-2',
      suggestion_type: 'link_existing' as const,
      match_confidence: 0.55,
      match_reason: 'city hint',
      extracted_data: {
        nom_hint: 'Gamma',
        ville_hint: 'Marseille',
      },
      status: 'accepted' as const,
      reviewed_by: 'user-1',
      reviewed_at: '2024-01-08T10:00:00.000Z',
      created_at: '2024-01-08T09:00:00.000Z',
      email_thread: {
        id: 'thread-3',
        subject: 'Historique',
        ai_summary: null,
        last_message_date: '2024-01-08T08:00:00.000Z',
        participants: null,
        message_count: 2,
      },
      suggested_etablissement: {
        id: 'eta-2',
        nom: 'Centre Gamma',
        ville: 'Marseille',
      },
    },
  ];

  const AUTH_STATE = {
    user: { id: 'user-1', email: 'user@test.co' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  };

  const toastSpy = vi.fn();
  const sanitizeSupabaseErrorSpy = vi.fn((error: Error | { message?: string }) => error.message ?? 'Erreur');
  const debugLogSpy = vi.fn();
  const mockFrom = vi.fn();
  const invokeSpy = vi.fn();

  const queryState = {
    selectData: SUGGESTIONS_ROWS as unknown,
    selectError: null as { message: string } | null,
    updateError: null as { message: string } | null,
    threadUpdateError: null as { message: string } | null,
    invokeData: { created: true } as unknown,
    invokeError: null as { message: string } | null,
  };

  const fromCalls: Array<{ table: string; builder: Record<string, unknown> }> = [];
  const invalidateQueriesSpy = vi.fn();

  return {
    SUGGESTIONS_ROWS,
    AUTH_STATE,
    toastSpy,
    sanitizeSupabaseErrorSpy,
    debugLogSpy,
    mockFrom,
    invokeSpy,
    queryState,
    fromCalls,
    invalidateQueriesSpy,
  };
});

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorSpy,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    log: debugLogSpy,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: invokeSpy,
    },
  },
}));

type BuilderState = {
  table: string;
  selectArg: unknown;
  updateArg: unknown;
  eqCalls: Array<[string, unknown]>;
  orderCalls: Array<[string, unknown]>;
  limitCalls: Array<[number]>;
};

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: <TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => Promise<TResult1 | TResult2>;
  catch: <TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ) => Promise<unknown | TResult>;
  __state: BuilderState;
};

function createBuilder(table: string): Builder {
  const state: BuilderState = {
    table,
    selectArg: undefined,
    updateArg: undefined,
    eqCalls: [],
    orderCalls: [],
    limitCalls: [],
  };

  const builder = {} as Builder;

  builder.select = vi.fn((arg?: unknown) => {
    state.selectArg = arg;
    return builder;
  });
  builder.eq = vi.fn((column: string, value: unknown) => {
    state.eqCalls.push([column, value]);
    return builder;
  });
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn((column: string, options?: unknown) => {
    state.orderCalls.push([column, options]);
    return builder;
  });
  builder.limit = vi.fn((value: number) => {
    state.limitCalls.push([value]);
    return builder;
  });
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn((payload: unknown) => {
    state.updateArg = payload;
    return builder;
  });
  builder.delete = vi.fn(() => builder);
  builder.single = vi.fn(async () => ({ data: null, error: null }));
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  builder.then = (onfulfilled, onrejected) => {
    const result =
      table === 'email_to_etablissement_suggestions' && state.selectArg !== undefined
        ? { data: queryState.selectData, error: queryState.selectError }
        : table === 'email_to_etablissement_suggestions' && state.updateArg !== undefined
          ? { data: null, error: queryState.updateError }
          : table === 'email_threads' && state.updateArg !== undefined
            ? { data: null, error: queryState.threadUpdateError }
            : { data: null, error: null };

    return Promise.resolve(result).then(onfulfilled ?? undefined, onrejected ?? undefined);
  };
  builder.catch = (onrejected) => Promise.resolve().catch(onrejected ?? undefined);
  builder.__state = state;

  fromCalls.push({ table, builder: builder as unknown as Record<string, unknown> });
  return builder;
}

function createQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(invalidateQueriesSpy);
  return queryClient;
}

function createWrapper() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

describe('useEtablissementEmailSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCalls.length = 0;
    queryState.selectData = SUGGESTIONS_ROWS;
    queryState.selectError = null;
    queryState.updateError = null;
    queryState.threadUpdateError = null;
    queryState.invokeData = { created: true };
    queryState.invokeError = null;

    mockFrom.mockImplementation((table: string) => createBuilder(table));
    invokeSpy.mockImplementation(async () => ({
      data: queryState.invokeData,
      error: queryState.invokeError,
    }));
  });

  it('charge puis retourne uniquement les suggestions pending avec leurs données métier', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useEtablissementEmailSuggestions(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.suggestions).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.suggestions).toHaveLength(2);
    expect(result.current.suggestions.map((s) => s.id)).toEqual(['sug-1', 'sug-2']);
    expect(result.current.suggestions[0]).toMatchObject({
      id: 'sug-1',
      suggestion_type: 'link_existing',
      match_confidence: 0.92,
      match_reason: 'domain match',
      extracted_data: {
        nom: 'Clinique Alpha',
        ville: 'Paris',
        domain: 'alpha.test',
      },
      email_thread: {
        id: 'thread-1',
        subject: 'Demande de partenariat',
        message_count: 3,
      },
      suggested_etablissement: {
        id: 'eta-1',
        nom: 'Clinique Alpha',
        ville: 'Paris',
      },
    });
    expect(result.current.suggestions[1]).toMatchObject({
      id: 'sug-2',
      suggestion_type: 'create_new',
      suggested_etablissement_id: null,
      extracted_data: {
        nom: 'Cabinet Beta',
        ville: 'Lyon',
      },
    });
    expect(result.current.suggestions.find((s) => s.id === 'sug-3')).toBeUndefined();

    const selectCall = fromCalls.find((call) => call.table === 'email_to_etablissement_suggestions');
    const builder = selectCall?.builder as unknown as Builder;

    expect(mockFrom).toHaveBeenCalledWith('email_to_etablissement_suggestions');
    expect(builder.select).toHaveBeenCalledTimes(1);
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(100);
    expect(builder.eq).not.toHaveBeenCalledWith('suggested_etablissement_id', 'eta-1');
  });

  it('filtre la requête par etablissementId quand fourni', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useEtablissementEmailSuggestions('eta-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const selectCall = fromCalls.find((call) => call.table === 'email_to_etablissement_suggestions');
    const builder = selectCall?.builder as unknown as Builder;

    expect(builder.eq).toHaveBeenCalledWith('suggested_etablissement_id', 'eta-1');
    expect(result.current.suggestions).toHaveLength(2);
    expect(result.current.suggestions.every((s) => s.status === 'pending')).toBe(true);
  });

  it('accepte une suggestion existante et relie le thread à l’établissement suggéré', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useEtablissementEmailSuggestions(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.acceptSuggestion({ suggestionId: 'sug-1' });
    });

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({
        title: 'Suggestion acceptée',
        description: 'La suggestion a été traitée avec succès.',
      });
    });

    const suggestionCalls = fromCalls.filter((call) => call.table === 'email_to_etablissement_suggestions');
    const updateBuilder = suggestionCalls[suggestionCalls.length - 1]?.builder as unknown as Builder;
    const threadUpdate = fromCalls.find((call) => call.table === 'email_threads')?.builder as unknown as Builder;

    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: 'accepted',
      reviewed_at: expect.any(String),
    });
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'sug-1');
    expect(threadUpdate.update).toHaveBeenCalledWith({ etablissement_id: 'eta-1' });
    expect(threadUpdate.eq).toHaveBeenCalledWith('id', 'thread-1');
    expect(invokeSpy).not.toHaveBeenCalled();
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['etablissement-email-suggestions'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['email-suggestions-pending'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['etablissements'] });
  });

  it('accepte une suggestion en création et appelle la fonction edge', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useEtablissementEmailSuggestions(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.acceptSuggestion({ suggestionId: 'sug-2', createNew: true });
    });

    await waitFor(() => {
      expect(invokeSpy).toHaveBeenCalledWith('auto-create-etablissement', {
        body: { suggestion_id: 'sug-2' },
      });
    });

    expect(debugLogSpy).toHaveBeenCalledWith('Establishment created:', { created: true });
    const threadCalls = fromCalls.filter((call) => call.table === 'email_threads');
    expect(threadCalls).toHaveLength(0);
  });

  it('rejette une suggestion et invalide les queries attendues', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useEtablissementEmailSuggestions(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.rejectSuggestion('sug-1');
    });

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({
        title: 'Suggestion refusée',
        description: 'La suggestion a été rejetée.',
      });
    });

    const suggestionCalls = fromCalls.filter((call) => call.table === 'email_to_etablissement_suggestions');
    const updateBuilder = suggestionCalls[suggestionCalls.length - 1]?.builder as unknown as Builder;

    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: 'rejected',
      reviewed_at: expect.any(String),
    });
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'sug-1');
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['etablissement-email-suggestions'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['email-suggestions-pending'] });
  });

  it('gère une erreur de chargement et ne retourne aucune suggestion', async () => {
    queryState.selectError = { message: 'load failed' };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useEtablissementEmailSuggestions(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isAccepting).toBe(false);
    expect(result.current.isRejecting).toBe(false);
  });

  it('gère une erreur de mutation acceptSuggestion avec toast destructif', async () => {
    queryState.updateError = { message: 'update failed' };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useEtablissementEmailSuggestions(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.acceptSuggestion({ suggestionId: 'sug-1' });
    });

    await waitFor(() => {
      expect(sanitizeSupabaseErrorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'update failed' }));
    });

    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'update failed',
      variant: 'destructive',
    });
  });

  it('gère une erreur de mutation rejectSuggestion avec toast destructif', async () => {
    queryState.updateError = { message: 'reject failed' };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useEtablissementEmailSuggestions(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.rejectSuggestion('sug-2');
    });

    await waitFor(() => {
      expect(sanitizeSupabaseErrorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'reject failed' }));
    });

    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'reject failed',
      variant: 'destructive',
    });
  });

  it('gère une erreur de fonction edge lors d’une création', async () => {
    queryState.invokeError = { message: 'function failed' };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useEtablissementEmailSuggestions(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.acceptSuggestion({ suggestionId: 'sug-2', createNew: true });
    });

    await waitFor(() => {
      expect(invokeSpy).toHaveBeenCalledWith('auto-create-etablissement', {
        body: { suggestion_id: 'sug-2' },
      });
      expect(sanitizeSupabaseErrorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'function failed' }));
    });

    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'function failed',
      variant: 'destructive',
    });
  });
});