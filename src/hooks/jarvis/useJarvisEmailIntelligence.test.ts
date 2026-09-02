import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisEmailIntelligence } from './useJarvisEmailIntelligence';

const {
  AUTH_STATE,
  PRIORITY_EMAILS,
  SENTIMENT_ALERTS,
  ANALYSIS_RESULT,
  SUGGESTION_RESULT,
  mockInvoke,
  mockFrom,
  debugError,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'test@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  PRIORITY_EMAILS: [
    {
      threadId: 'thread-1',
      subject: 'Client escalation',
      priorityScore: 94,
    },
    {
      threadId: 'thread-2',
      subject: 'Weekly update',
      priorityScore: 41,
    },
  ],
  SENTIMENT_ALERTS: [
    {
      threadId: 'thread-1',
      subject: 'Client escalation',
      sentiment: 'urgent',
      priorityScore: 94,
      actionRequired: true,
      alert: 'Immediate action required',
    },
    {
      threadId: 'thread-3',
      subject: 'Complaint follow-up',
      sentiment: 'negative',
      priorityScore: 78,
      actionRequired: true,
      alert: 'Negative tone detected',
    },
    {
      threadId: 'thread-4',
      subject: 'Thanks for the update',
      sentiment: 'positive',
      priorityScore: 12,
      actionRequired: false,
      alert: 'Positive feedback',
    },
  ],
  ANALYSIS_RESULT: {
    threadId: 'thread-1',
    priorityScore: 91,
    sentiment: 'urgent' as const,
    suggestedResponseTone: 'empathetic',
    keyTopics: ['delivery', 'refund'],
    actionRequired: true,
    estimatedResponseTime: 15,
  },
  SUGGESTION_RESULT: 'Bonjour, merci pour votre message. Nous traitons votre demande rapidement.',
  mockInvoke: vi.fn(),
  mockFrom: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
      functions: {
        invoke: mockInvoke,
      },
    },
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useJarvisEmailIntelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockInvoke.mockImplementation(async (fnName: string, payload?: { body?: Record<string, string> }) => {
      if (fnName !== 'jarvis-email-intelligence') {
        return { data: null, error: { message: 'unknown function' } };
      }

      const action = payload?.body?.action;

      if (action === 'get_priority_inbox') {
        return {
          data: { emails: PRIORITY_EMAILS },
          error: null,
        };
      }

      if (action === 'detect_sentiment_alerts') {
        return {
          data: { alerts: SENTIMENT_ALERTS },
          error: null,
        };
      }

      if (action === 'analyze_thread') {
        return {
          data: { analysis: ANALYSIS_RESULT },
          error: null,
        };
      }

      if (action === 'suggest_response') {
        return {
          data: { suggestion: SUGGESTION_RESULT },
          error: null,
        };
      }

      return { data: null, error: { message: 'unsupported action' } };
    });
  });

  it('charge les données et calcule les statistiques métier correctement', async () => {
    const { result } = renderHook(() => useJarvisEmailIntelligence(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.priorityInbox).toEqual([]);
    expect(result.current.sentimentAlerts).toEqual([]);
    expect(result.current.hasAlerts).toBe(false);
    expect(result.current.urgentCount).toBe(0);
    expect(result.current.negativeCount).toBe(0);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockInvoke).toHaveBeenCalledWith('jarvis-email-intelligence', {
      body: { action: 'get_priority_inbox', userId: 'u1' },
    });
    expect(mockInvoke).toHaveBeenCalledWith('jarvis-email-intelligence', {
      body: { action: 'detect_sentiment_alerts', userId: 'u1' },
    });

    expect(result.current.priorityInbox).toEqual(PRIORITY_EMAILS);
    expect(result.current.sentimentAlerts).toEqual(SENTIMENT_ALERTS);
    expect(result.current.priorityInbox[0]).toEqual({
      threadId: 'thread-1',
      subject: 'Client escalation',
      priorityScore: 94,
    });
    expect(result.current.sentimentAlerts[1]).toEqual({
      threadId: 'thread-3',
      subject: 'Complaint follow-up',
      sentiment: 'negative',
      priorityScore: 78,
      actionRequired: true,
      alert: 'Negative tone detected',
    });
    expect(result.current.hasAlerts).toBe(true);
    expect(result.current.urgentCount).toBe(1);
    expect(result.current.negativeCount).toBe(1);
    expect(typeof result.current.refetchInbox).toBe('function');
    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.isSuggestingResponse).toBe(false);
  });

  it('exécute les mutations analyzeThread et suggestResponse avec les bons paramètres', async () => {
    const { result } = renderHook(() => useJarvisEmailIntelligence(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let analysis:
      | {
          threadId: string;
          priorityScore: number;
          sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
          suggestedResponseTone: string;
          keyTopics: string[];
          actionRequired: boolean;
          estimatedResponseTime: number;
        }
      | undefined;

    await act(async () => {
      analysis = await result.current.analyzeThread('thread-1');
    });

    expect(mockInvoke).toHaveBeenCalledWith('jarvis-email-intelligence', {
      body: { action: 'analyze_thread', threadId: 'thread-1' },
    });
    expect(analysis).toEqual(ANALYSIS_RESULT);
    expect(analysis?.sentiment).toBe('urgent');
    expect(analysis?.keyTopics).toEqual(['delivery', 'refund']);
    expect(analysis?.actionRequired).toBe(true);
    expect(analysis?.estimatedResponseTime).toBe(15);

    let suggestion: string | undefined;

    await act(async () => {
      suggestion = await result.current.suggestResponse('thread-1');
    });

    expect(mockInvoke).toHaveBeenCalledWith('jarvis-email-intelligence', {
      body: { action: 'suggest_response', threadId: 'thread-1' },
    });
    expect(suggestion).toBe(SUGGESTION_RESULT);
  });

  it('gère les erreurs de query en retournant des tableaux vides et rejette les erreurs de mutation', async () => {
    mockInvoke.mockImplementation(async (_fnName: string, payload?: { body?: Record<string, string> }) => {
      const action = payload?.body?.action;

      if (action === 'get_priority_inbox') {
        return {
          data: null,
          error: { message: 'inbox failed' },
        };
      }

      if (action === 'detect_sentiment_alerts') {
        return {
          data: null,
          error: { message: 'alerts failed' },
        };
      }

      if (action === 'analyze_thread') {
        return {
          data: null,
          error: { message: 'analysis failed' },
        };
      }

      if (action === 'suggest_response') {
        return {
          data: null,
          error: { message: 'suggestion failed' },
        };
      }

      return { data: null, error: { message: 'unsupported action' } };
    });

    const { result } = renderHook(() => useJarvisEmailIntelligence(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.priorityInbox).toEqual([]);
    expect(result.current.sentimentAlerts).toEqual([]);
    expect(result.current.hasAlerts).toBe(false);
    expect(result.current.urgentCount).toBe(0);
    expect(result.current.negativeCount).toBe(0);
    expect(debugError).toHaveBeenCalledWith('Failed to fetch priority inbox:', { message: 'inbox failed' });
    expect(debugError).toHaveBeenCalledWith('Failed to fetch sentiment alerts:', { message: 'alerts failed' });

    await act(async () => {
      await expect(result.current.analyzeThread('thread-err')).rejects.toEqual({ message: 'analysis failed' });
    });

    await act(async () => {
      await expect(result.current.suggestResponse('thread-err')).rejects.toEqual({ message: 'suggestion failed' });
    });

    expect(mockInvoke).toHaveBeenCalledWith('jarvis-email-intelligence', {
      body: { action: 'analyze_thread', threadId: 'thread-err' },
    });
    expect(mockInvoke).toHaveBeenCalledWith('jarvis-email-intelligence', {
      body: { action: 'suggest_response', threadId: 'thread-err' },
    });
  });
});