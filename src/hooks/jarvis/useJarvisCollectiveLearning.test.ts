import React, { type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';

const { USER, SUGGESTIONS, INSIGHTS, invokeMock, debugErrorMock, mockFrom } = vi.hoisted(() => {
  const USER = { id: 'u1', email: 't@t.co' };

  const SUGGESTIONS = [
    {
      id: 's1',
      type: 'productivity',
      title: 'Batch tasks',
      description: 'Group similar tasks to reduce context switching.',
      effectiveness: 0.92,
      adoptionRate: 0.48,
      sourceCount: 12,
      actionable: true,
      data: { cadence: 'daily' },
    },
    {
      id: 's2',
      type: 'focus',
      title: 'Pomodoro',
      description: 'Work in focused intervals.',
      effectiveness: 0.81,
      adoptionRate: 0.67,
      sourceCount: 20,
      actionable: true,
      data: { minutes: 25 },
    },
    {
      id: 's3',
      type: 'productivity',
      title: 'Template replies',
      description: 'Use templates for frequent responses.',
      effectiveness: 0.88,
      adoptionRate: 0.51,
      sourceCount: 9,
      actionable: true,
      data: { channel: 'email' },
    },
    {
      id: 's4',
      type: 'automation',
      title: 'Auto-tagging',
      description: 'Automatically tag items with rules.',
      effectiveness: 0.77,
      adoptionRate: 0.34,
      sourceCount: 7,
      actionable: false,
      data: { rules: 3 },
    },
    {
      id: 's5',
      type: 'focus',
      title: 'Block notifications',
      description: 'Disable non-critical alerts during deep work.',
      effectiveness: 0.95,
      adoptionRate: 0.29,
      sourceCount: 15,
      actionable: true,
      data: { durationMinutes: 90 },
    },
    {
      id: 's6',
      type: 'productivity',
      title: 'Daily review',
      description: 'Review priorities every morning.',
      effectiveness: 0.74,
      adoptionRate: 0.72,
      sourceCount: 30,
      actionable: true,
      data: { time: '08:30' },
    },
  ];

  const INSIGHTS = [
    {
      insight: 'Top performers schedule deep work blocks.',
      title: 'Deep work blocks',
      data: { averageBlocksPerWeek: 5 },
      recommendations: ['Reserve 2 hours daily', 'Protect blocks from meetings'],
    },
    {
      insight: 'They batch communications into two windows.',
      title: 'Communication batching',
      data: { windows: 2 },
      recommendations: ['Check inbox twice a day', 'Turn off push notifications'],
    },
  ];

  const invokeMock = vi.fn<
    (fnName: string, args: { body: Record<string, unknown> }) => Promise<{ data: unknown; error: { message: string } | null }>
  >();

  const debugErrorMock = vi.fn();

  const mockFrom = vi.fn();

  return { USER, SUGGESTIONS, INSIGHTS, invokeMock, debugErrorMock, mockFrom };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: USER, session: { user: USER }, isLoading: false }),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
    from: mockFrom,
  },
}));

import { useJarvisCollectiveLearning } from './useJarvisCollectiveLearning';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useJarvisCollectiveLearning', () => {
  it('charge puis retourne suggestions/insights, topSuggestions triées, getSuggestionsByType, hasSuggestions', async () => {
    invokeMock.mockImplementation(async (_fnName, args) => {
      const action = String(args.body.action);
      if (action === 'get_suggestions') return { data: { suggestions: SUGGESTIONS }, error: null };
      if (action === 'get_top_performer_insights') return { data: { insights: INSIGHTS }, error: null };
      return { data: null, error: null };
    });

    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => useJarvisCollectiveLearning(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(invokeMock).toHaveBeenCalledWith('jarvis-collective-learning', {
      body: { action: 'get_suggestions', userId: USER.id },
    });
    expect(invokeMock).toHaveBeenCalledWith('jarvis-collective-learning', {
      body: { action: 'get_top_performer_insights' },
    });

    expect(result.current.suggestions.map((s) => s.id)).toEqual(SUGGESTIONS.map((s) => s.id));
    expect(result.current.insights.map((i) => i.title)).toEqual(INSIGHTS.map((i) => i.title));
    expect(result.current.hasSuggestions).toBe(true);

    const focus = result.current.getSuggestionsByType('focus');
    expect(focus.map((s) => s.id).sort()).toEqual(['s2', 's5']);

    const top = result.current.topSuggestions;
    expect(top.length).toBe(5);
    expect(top[0].id).toBe('s5');
    for (let i = 0; i < top.length - 1; i += 1) {
      expect(top[i].effectiveness).toBeGreaterThanOrEqual(top[i + 1].effectiveness);
    }
  });

  it('en cas derreur supabase (error non-null), retourne des tableaux vides et loggue', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'x' } });

    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => useJarvisCollectiveLearning(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.insights).toEqual([]);
    expect(result.current.hasSuggestions).toBe(false);

    expect(debugErrorMock).toHaveBeenCalled();
  });

  it('recordAction appelle functions.invoke avec les bons paramètres', async () => {
    invokeMock.mockImplementation(async (_fnName, args) => {
      const action = String(args.body.action);
      if (action === 'get_suggestions') return { data: { suggestions: [] }, error: null };
      if (action === 'get_top_performer_insights') return { data: { insights: [] }, error: null };
      if (action === 'record_action') return { data: { ok: true }, error: null };
      return { data: null, error: null };
    });

    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => useJarvisCollectiveLearning(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.recordAction('apply_suggestion', { suggestionId: 's2', context: 'dashboard' }, true);
    });

    expect(invokeMock).toHaveBeenCalledWith('jarvis-collective-learning', {
      body: {
        action: 'record_action',
        userId: USER.id,
        actionType: 'apply_suggestion',
        actionData: { suggestionId: 's2', context: 'dashboard' },
        success: true,
      },
    });
  });
});