// @vitest-environment jsdom

import React, { PropsWithChildren } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisFeedback } from './useJarvisFeedback';

const {
  AUTH_STATE,
  PROFILE_ROW,
  mockFrom,
  debugError,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'test@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const PROFILE_ROW = { id: 'profile-1' };

  return {
    AUTH_STATE,
    PROFILE_ROW,
    mockFrom: vi.fn(),
    debugError: vi.fn(),
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

type SupabaseResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

function createThenableBuilder(config?: {
  selectResult?: SupabaseResult<unknown>;
  insertResult?: SupabaseResult<unknown>;
}) {
  const state = {
    selectResult: config?.selectResult ?? { data: null, error: null },
    insertResult: config?.insertResult ?? { data: null, error: null },
    mode: 'select' as 'select' | 'insert',
  };

  const builder = {
    select: vi.fn(() => {
      state.mode = 'select';
      return builder;
    }),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    update: vi.fn(() => {
      state.mode = 'insert';
      return builder;
    },),
    delete: vi.fn(() => {
      state.mode = 'insert';
      return builder;
    }),
    insert: vi.fn(() => {
      state.mode = 'insert';
      return builder;
    }),
    single: vi.fn(async () => state.selectResult),
    maybeSingle: vi.fn(async () => state.selectResult),
    then: (onFulfilled: (value: SupabaseResult<unknown>) => unknown, onRejected?: (reason: unknown) => unknown) => {
      const value = state.mode === 'select' ? state.selectResult : state.insertResult;
      return Promise.resolve(value).then(onFulfilled, onRejected);
    },
    catch: (onRejected: (reason: unknown) => unknown) => {
      const value = state.mode === 'select' ? state.selectResult : state.insertResult;
      return Promise.resolve(value).catch(onRejected);
    },
  };

  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useJarvisFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/assistant/room');
    AUTH_STATE.user = { id: 'u1', email: 'test@example.com' };
    AUTH_STATE.session = { user: { id: 'u1' } };
    AUTH_STATE.isLoading = false;
  });

  it('expose les fonctions du hook après chargement', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useJarvisFeedback(), { wrapper });

    await waitFor(() => {
      expect(typeof result.current.submitMessageFeedback).toBe('function');
      expect(typeof result.current.submitSuggestionFeedback).toBe('function');
    });
  });

  it('soumet un feedback message avec les valeurs métier attendues', async () => {
    const wrapper = createWrapper();
    const feedbackBuilder = createThenableBuilder({
      insertResult: { data: null, error: null },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_feedbacks') return feedbackBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const { result } = renderHook(() => useJarvisFeedback(), { wrapper });

    await act(async () => {
      await result.current.submitMessageFeedback('msg-42', 'positive');
    });

    expect(mockFrom).toHaveBeenCalledWith('user_feedbacks');
    expect(feedbackBuilder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      type: 'suggestion',
      title: 'Jarvis positive feedback',
      description: 'Message ID: msg-42 | Feedback: positive',
      current_route: '/assistant/room',
    });
    expect(debugError).not.toHaveBeenCalled();
  });

  it('transforme report en type bug pour le feedback message', async () => {
    const wrapper = createWrapper();
    const feedbackBuilder = createThenableBuilder({
      insertResult: { data: null, error: null },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_feedbacks') return feedbackBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const { result } = renderHook(() => useJarvisFeedback(), { wrapper });

    await act(async () => {
      await result.current.submitMessageFeedback('msg-77', 'report');
    });

    expect(feedbackBuilder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      type: 'bug',
      title: 'Jarvis report feedback',
      description: 'Message ID: msg-77 | Feedback: report',
      current_route: '/assistant/room',
    });
  });

  it('récupère le profil puis insère le feedback de suggestion avec le contexte réel', async () => {
    const wrapper = createWrapper();

    const profilesBuilder = createThenableBuilder({
      selectResult: { data: PROFILE_ROW, error: null },
    });
    const suggestionInsertBuilder = createThenableBuilder({
      insertResult: { data: null, error: null },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesBuilder;
      if (table === 'jarvis_suggestion_feedback') return suggestionInsertBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const { result } = renderHook(() => useJarvisFeedback(), { wrapper });

    await act(async () => {
      await result.current.submitSuggestionFeedback(
        'hydration',
        'sug-1',
        'accepted',
        { source: 'home', score: 3 }
      );
    });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(profilesBuilder.select).toHaveBeenCalledWith('id');
    expect(profilesBuilder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(profilesBuilder.maybeSingle).toHaveBeenCalled();

    expect(mockFrom).toHaveBeenCalledWith('jarvis_suggestion_feedback');
    expect(suggestionInsertBuilder.insert).toHaveBeenCalledWith([
      {
        user_id: 'profile-1',
        suggestion_type: 'hydration',
        suggestion_id: 'sug-1',
        suggestion_context: { source: 'home', score: 3 },
        action: 'accepted',
      },
    ]);
    expect(debugError).not.toHaveBeenCalled();
  });

  it('n’insère pas de feedback suggestion si le profil est absent', async () => {
    const wrapper = createWrapper();

    const profilesBuilder = createThenableBuilder({
      selectResult: { data: null, error: null },
    });
    const suggestionInsertBuilder = createThenableBuilder({
      insertResult: { data: null, error: null },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesBuilder;
      if (table === 'jarvis_suggestion_feedback') return suggestionInsertBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const { result } = renderHook(() => useJarvisFeedback(), { wrapper });

    await act(async () => {
      await result.current.submitSuggestionFeedback('sleep', 'sug-2', 'dismissed');
    });

    expect(profilesBuilder.maybeSingle).toHaveBeenCalled();
    expect(suggestionInsertBuilder.insert).not.toHaveBeenCalled();
    expect(debugError).not.toHaveBeenCalled();
  });

  it('gère une erreur sur le feedback message en loggant debug.error', async () => {
    const wrapper = createWrapper();
    const expectedError = new Error('insert failed');

    const failingBuilder = createThenableBuilder();
    failingBuilder.insert.mockImplementation(() => {
      throw expectedError;
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_feedbacks') return failingBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const { result } = renderHook(() => useJarvisFeedback(), { wrapper });

    await act(async () => {
      await result.current.submitMessageFeedback('msg-500', 'negative');
    });

    expect(failingBuilder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      type: 'suggestion',
      title: 'Jarvis negative feedback',
      description: 'Message ID: msg-500 | Feedback: negative',
      current_route: '/assistant/room',
    });
    expect(debugError).toHaveBeenCalledWith(
      '[JarvisFeedback] Error saving feedback:',
      expectedError
    );
  });

  it('gère une erreur sur le feedback suggestion en loggant debug.error', async () => {
    const wrapper = createWrapper();
    const expectedError = new Error('profile query failed');

    const profilesBuilder = createThenableBuilder();
    profilesBuilder.maybeSingle.mockRejectedValue(expectedError);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesBuilder;
      if (table === 'jarvis_suggestion_feedback') {
        return createThenableBuilder({ insertResult: { data: null, error: null } });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const { result } = renderHook(() => useJarvisFeedback(), { wrapper });

    await act(async () => {
      await result.current.submitSuggestionFeedback('nutrition', 'sug-9', 'rejected', {
        origin: 'panel',
      });
    });

    expect(profilesBuilder.select).toHaveBeenCalledWith('id');
    expect(profilesBuilder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(debugError).toHaveBeenCalledWith(
      '[JarvisFeedback] Suggestion feedback error:',
      expectedError
    );
  });

  it('ne fait aucun appel Supabase sans utilisateur authentifié', async () => {
    const wrapper = createWrapper();
    AUTH_STATE.user = null;
    AUTH_STATE.session = null;

    const { result } = renderHook(() => useJarvisFeedback(), { wrapper });

    await act(async () => {
      await result.current.submitMessageFeedback('msg-no-user', 'positive');
      await result.current.submitSuggestionFeedback('focus', 'sug-no-user', 'executed', {
        origin: 'widget',
      });
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(debugError).not.toHaveBeenCalled();
  });
});