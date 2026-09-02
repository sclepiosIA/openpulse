import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { USER, TOAST_FN, INVOKE_MOCK, MOCK_FROM } = vi.hoisted(() => {
  const USER = { id: 'u1', email: 'u1@example.com' };
  const TOAST_FN = vi.fn();
  const INVOKE_MOCK = vi.fn(async () => {
    const q = (globalThis as unknown as { __INVOKE_QUEUE__?: Array<{ data: unknown; error: unknown }> }).__INVOKE_QUEUE__;
    if (Array.isArray(q) && q.length > 0) {
      return q.shift() as { data: unknown; error: unknown };
    }
    return {
      data: {
        success: true,
        tool_results: [{ result: { data: 'ok', error: null } }],
      },
      error: null,
    };
  });
  const MOCK_FROM = vi.fn(() => {
    const builder: {
      select: () => typeof builder;
      eq: () => typeof builder;
      gte: () => typeof builder;
      lte: () => typeof builder;
      in: () => typeof builder;
      order: () => typeof builder;
      limit: () => typeof builder;
      insert: () => typeof builder;
      update: () => typeof builder;
      delete: () => typeof builder;
      single: () => Promise<{ data: unknown; error: unknown }>;
      maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      then: (onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) => Promise<unknown>;
      catch: (onRejected: (r: unknown) => unknown) => Promise<unknown>;
    } = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      lte: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      then: (onFulfilled, onRejected) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
      catch: (onRejected) => Promise.resolve({ data: null, error: null }).catch(onRejected),
    };
    return builder;
  });
  return { USER, TOAST_FN, INVOKE_MOCK, MOCK_FROM };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: MOCK_FROM,
    functions: {
      invoke: INVOKE_MOCK,
    },
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({
    user: USER,
    isLoading: false,
    session: { user: USER },
  }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (err: unknown) => {
    if (err && typeof err === 'object' && 'message' in (err as Record<string, unknown>)) {
      const msg = (err as { message?: string }).message;
      return typeof msg === 'string' ? msg : 'error';
    }
    return 'error';
  },
}));

import { WORKFLOW_TEMPLATES, useJarvisWorkflows } from './useJarvisWorkflows';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return React.createElement(QueryClientProvider, { client }, children);
};

describe('useJarvisWorkflows', () => {
  beforeEach(() => {
    // Stable crypto.randomUUID
    if (!(globalThis as { crypto?: { randomUUID?: () => string } }).crypto) {
      Object.defineProperty(globalThis, 'crypto', {
        value: { randomUUID: () => 'uuid-1' },
        configurable: true,
      });
    } else if (typeof (globalThis as { crypto: { randomUUID?: () => string } }).crypto.randomUUID === 'function') {
      vi.spyOn((globalThis as { crypto: { randomUUID: () => string } }).crypto, 'randomUUID').mockReturnValue('uuid-1');
    } else {
      (globalThis as { crypto: { randomUUID: () => string } }).crypto.randomUUID = () => 'uuid-1';
    }

    (globalThis as unknown as { __INVOKE_QUEUE__?: Array<{ data: unknown; error: unknown }> }).__INVOKE_QUEUE__ = [];
    TOAST_FN.mockReset();
    INVOKE_MOCK.mockClear();
  });

  it('démarrage: isExecuting passe à true puis succès complet de l’Onboarding', async () => {
    (globalThis as unknown as { __INVOKE_QUEUE__: Array<{ data: unknown; error: unknown }> }).__INVOKE_QUEUE__ = [
      {
        data: { success: true, tool_results: [{ result: { data: { etab: 1 }, error: null } }] },
        error: null,
      },
      {
        data: { success: true, tool_results: [{ result: { data: { contact: 2 }, error: null } }] },
        error: null,
      },
      {
        data: { success: true, tool_results: [{ result: { data: { tasks: 3 }, error: null } }] },
        error: null,
      },
      {
        data: { success: true, tool_results: [{ result: { data: { email: 'sent' }, error: null } }] },
        error: null,
      },
    ];

    const { result } = renderHook(() => useJarvisWorkflows(), { wrapper });

    act(() => {
      result.current.startWorkflow(WORKFLOW_TEMPLATES[0]);
    });

    expect(result.current.isExecuting).toBe(true);

    await waitFor(() => expect(result.current.isExecuting).toBe(false));

    expect(result.current.activeWorkflow).not.toBeNull();
    const wf = result.current.activeWorkflow as NonNullable<typeof result.current.activeWorkflow>;
    expect(wf.name).toBe('Onboarding Établissement');
    expect(wf.status).toBe('completed');
    expect(wf.progress).toBe(100);
    expect(wf.steps.length).toBe(WORKFLOW_TEMPLATES[0].steps.length);
    expect(wf.steps.every(s => s.status === 'completed' || s.status === 'skipped')).toBe(true);

    // Toasts: started + finished
    expect(TOAST_FN).toHaveBeenCalled();
    const titles = TOAST_FN.mock.calls.map(args => (args[0] as { title?: string }).title);
    expect(titles.some(t => typeof t === 'string' && t.includes('Workflow démarré'))).toBe(true);
    expect(titles.some(t => typeof t === 'string' && t.includes('Workflow terminé'))).toBe(true);

    // Supabase invocations count and payload
    expect(INVOKE_MOCK).toHaveBeenCalledTimes(4);
    for (const call of INVOKE_MOCK.mock.calls) {
      expect(call[0]).toBe('jarvis-brain');
      const body = (call[1] as { body?: Record<string, unknown> }).body as Record<string, unknown>;
      expect(body.user_id).toBe(USER.id);
      expect(body.autonomous_mode).toBe(true);
      expect(typeof body.message).toBe('string');
      expect((body.message as string).includes('outil')).toBe(true);
    }
  });

  it('échec d’une étape → workflow en échec', async () => {
    (globalThis as unknown as { __INVOKE_QUEUE__: Array<{ data: unknown; error: unknown }> }).__INVOKE_QUEUE__ = [
      {
        data: { success: false, tool_results: [{ result: { data: null, error: 'boom' } }] },
        error: null,
      },
      {
        data: { success: true, tool_results: [{ result: { data: { contact: 2 }, error: null } }] },
        error: null,
      },
      {
        data: { success: true, tool_results: [{ result: { data: { tasks: 3 }, error: null } }] },
        error: null,
      },
      {
        data: { success: true, tool_results: [{ result: { data: { email: 'sent' }, error: null } }] },
        error: null,
      },
    ];

    const { result } = renderHook(() => useJarvisWorkflows(), { wrapper });

    act(() => {
      result.current.startWorkflow(WORKFLOW_TEMPLATES[0]);
    });

    expect(result.current.isExecuting).toBe(true);
    await waitFor(() => expect(result.current.isExecuting).toBe(false));

    const wf = result.current.activeWorkflow as NonNullable<typeof result.current.activeWorkflow>;
    expect(wf.status).toBe('failed');
    expect(wf.progress).toBe(100);
    expect(wf.steps.some(s => s.status === 'failed')).toBe(true);

    // Invoked all steps despite failure in first, due to dependency logic
    expect(INVOKE_MOCK).toHaveBeenCalledTimes(4);
    expect(TOAST_FN).toHaveBeenCalled();
    const lastToast = TOAST_FN.mock.calls[TOAST_FN.mock.calls.length - 1]?.[0] as { title?: string; variant?: string };
    expect(typeof lastToast.title).toBe('string');
    expect((lastToast.title as string).includes('Workflow terminé')).toBe(true);
    expect(lastToast.variant).toBe('destructive');
  });
});