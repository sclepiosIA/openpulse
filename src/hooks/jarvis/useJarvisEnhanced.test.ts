import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisEnhanced } from './useJarvisEnhanced';

const {
  mockInvoke,
  PREDICTIONS_RESPONSE,
  WORKFLOWS_RESPONSE,
  LEARNING_RESPONSE,
  authStub,
  toastStub,
  sanitizeStub,
  debugStub,
} = vi.hoisted(() => {
  const mockInvoke = vi.fn();
  const PREDICTIONS_RESPONSE = {
    success: true,
    predictions: [
      {
        action: 'check-mail',
        probability: 0.7,
        reason: 'morning suggestion',
        executableCommand: 'open_mail',
        category: 'productivity',
      },
      {
        action: 'shutdown',
        probability: 0.4,
        reason: 'end_of_day cleanup',
        category: 'maintenance',
      },
      {
        action: 'remind',
        probability: 0.8,
        reason: 'morning reminder',
      },
    ],
    behavior_stats: {
      total_actions: 42,
      peak_hours: [9, 18],
      peak_days: [1, 2],
      most_common_actions: [{ action: 'check-mail', count: 10 }],
    },
  };

  const WORKFLOWS_RESPONSE = {
    success: true,
    workflows: [
      {
        id: 'morning-1-morning',
        name: 'Morning setup',
        description: 'desc',
        category: 'daily',
        triggerCommand: 'start',
        stepsCount: 3,
        estimatedDurationMs: 10000,
      },
      {
        id: 'weekly-summary-weekly',
        name: 'Weekly',
        description: 'desc',
        category: 'weekly',
        triggerCommand: 'summarize',
        stepsCount: 5,
        estimatedDurationMs: 50000,
      },
      {
        id: 'monthly-cleanup-monthly',
        name: 'Monthly cleanup',
        description: 'desc',
        category: 'monthly',
        triggerCommand: 'cleanup',
        stepsCount: 2,
        estimatedDurationMs: 20000,
      },
    ],
  };

  const LEARNING_RESPONSE = {
    success: true,
    metrics: {
      totalInteractions: 100,
      acceptanceRate: 0.75,
      topActions: [{ action: 'check-mail', count: 50 }],
      suggestions: ['do X'],
    },
    report: {
      period: 'last_month',
      acceptance_rate: 0.75,
      recommendations: ['improve Y'],
    },
  };

  const authStub = {
    user: { id: 'user-1', email: 'u@example.com' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  };

  const toastStub = vi.fn();
  const sanitizeStub = vi.fn(() => 'sanitized-error');
  const debugStub = { error: vi.fn() };

  return {
    mockInvoke,
    PREDICTIONS_RESPONSE,
    WORKFLOWS_RESPONSE,
    LEARNING_RESPONSE,
    authStub,
    toastStub,
    sanitizeStub,
    debugStub,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => authStub,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastStub }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeStub,
}));

vi.mock('@/lib/debug', () => ({
  debug: debugStub,
}));

describe('useJarvisEnhanced', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    toastStub.mockReset();
    sanitizeStub.mockReset();
    debugStub.error.mockReset();

    mockInvoke.mockImplementation(async (fnName, opts) => {
      if (fnName === 'jarvis-predictive-engine') {
        return { data: PREDICTIONS_RESPONSE, error: null };
      }
      if (fnName === 'jarvis-workflow-engine') {
        const action = opts?.body?.action;
        if (action === 'list') {
          return { data: WORKFLOWS_RESPONSE, error: null };
        }
        if (action === 'execute') {
          return { data: { execution: { steps_executed: [1, 2, 3] } }, error: null };
        }
      }
      if (fnName === 'jarvis-learning-engine') {
        const action = opts?.body?.action;
        if (action === 'get_metrics') {
          return { data: LEARNING_RESPONSE, error: null };
        }
        if (action === 'record_feedback') {
          return { data: { ok: true }, error: null };
        }
      }
      return { data: null, error: null };
    });
  });

  it('loads predictions, workflows and learning metrics and provides contextual helpers', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useJarvisEnhanced(), { wrapper });

    await waitFor(() => {
      expect(result.current.isPredictionsLoading).toBe(false);
      expect(result.current.isWorkflowsLoading).toBe(false);
      expect(result.current.isLearningLoading).toBe(false);
    });

    expect(result.current.predictions.length).toBe(PREDICTIONS_RESPONSE.predictions.length);
    expect(result.current.behaviorStats?.total_actions).toBe(42);
    expect(result.current.workflows.length).toBe(WORKFLOWS_RESPONSE.workflows.length);
    expect(result.current.learningMetrics?.totalInteractions).toBe(100);
    expect(result.current.learningReport?.period).toBe('last_month');

    // Test contextual predictions in morning: set time to a morning hour so morning reasons are boosted
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-06-10T09:00:00Z')); // morning hour
      const contextual = result.current.getContextualPredictions();
      // Expect at least one morning-related prediction (check-mail or remind) to be included
      expect(contextual.some((p) => p.action === 'check-mail' || p.action === 'remind')).toBe(true);

      // Test suggested workflows for end of month -> should include monthly workflow
      vi.setSystemTime(new Date('2026-06-28T09:00:00Z')); // date >= 28 triggers end of month logic
      const suggested = result.current.getSuggestedWorkflows();
      expect(suggested.some((w) => w.id.includes('monthly'))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('executes a workflow successfully, calls toast and invalidates learning query', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useJarvisEnhanced(), { wrapper });

    // Wait initial queries to resolve
    await waitFor(() => expect(result.current.isWorkflowsLoading).toBe(false));

    // Execute workflow
    await act(async () => {
      await result.current.executeWorkflow({ workflowId: 'morning-1-morning', params: { foo: 'bar' } });
    });

    // toast called with success message including number of steps executed
    expect(toastStub).toHaveBeenCalled();
    const toastArg = toastStub.mock.calls[0][0];
    expect(toastArg.title).toBe('Workflow exécuté');
    expect(String(toastArg.description)).toContain('3 étapes complétées');

    // invalidateQueries called for learning with user id
    expect(invalidateSpy).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['jarvis-learning', authStub.user.id] });
  });

  it('handles workflow execution error: shows destructive toast with sanitized error', async () => {
    // Override mockInvoke for execute to return an error
    mockInvoke.mockImplementation(async (fnName, opts) => {
      if (fnName === 'jarvis-workflow-engine' && opts?.body?.action === 'execute') {
        return { data: null, error: { message: 'boom' } };
      }
      // fall back to defaults for other calls
      if (fnName === 'jarvis-predictive-engine') return { data: PREDICTIONS_RESPONSE, error: null };
      if (fnName === 'jarvis-workflow-engine' && opts?.body?.action === 'list') return { data: WORKFLOWS_RESPONSE, error: null };
      if (fnName === 'jarvis-learning-engine' && opts?.body?.action === 'get_metrics') return { data: LEARNING_RESPONSE, error: null };
      return { data: null, error: null };
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useJarvisEnhanced(), { wrapper });

    await waitFor(() => expect(result.current.isWorkflowsLoading).toBe(false));

    await act(async () => {
      await expect(result.current.executeWorkflow({ workflowId: 'morning-1-morning' })).rejects.toBeDefined();
    });

    // sanitizeSupabaseError should have been used and passed to toast
    expect(sanitizeStub).toHaveBeenCalled();
    expect(toastStub).toHaveBeenCalled();
    const toastArg = toastStub.mock.calls[0][0];
    expect(toastArg.variant).toBe('destructive');
    expect(String(toastArg.description)).toBe('sanitized-error');
  });

  it('records feedback and invalidates learning query', async () => {
    // Ensure record_feedback returns success
    mockInvoke.mockImplementation(async (fnName, opts) => {
      if (fnName === 'jarvis-learning-engine' && opts?.body?.action === 'record_feedback') {
        return { data: { ok: true }, error: null };
      }
      if (fnName === 'jarvis-predictive-engine') return { data: PREDICTIONS_RESPONSE, error: null };
      if (fnName === 'jarvis-workflow-engine' && opts?.body?.action === 'list') return { data: WORKFLOWS_RESPONSE, error: null };
      if (fnName === 'jarvis-learning-engine' && opts?.body?.action === 'get_metrics') return { data: LEARNING_RESPONSE, error: null };
      return { data: null, error: null };
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useJarvisEnhanced(), { wrapper });

    await waitFor(() => expect(result.current.isLearningLoading).toBe(false));

    await act(async () => {
      await result.current.recordFeedback({ actionType: 'check-mail', accepted: true, feedbackScore: 5 });
    });

    // Ensure the supabase function was called for record_feedback
    expect(mockInvoke).toHaveBeenCalled();
    const called = mockInvoke.mock.calls.find((c) => c[0] === 'jarvis-learning-engine' && c[1]?.body?.action === 'record_feedback');
    expect(called).toBeDefined();

    // Invalidate queries for learning should have been called
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['jarvis-learning', authStub.user.id] });
  });
});