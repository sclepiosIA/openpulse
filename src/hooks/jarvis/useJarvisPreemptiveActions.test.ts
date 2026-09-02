import React from 'react';
import type { PropsWithChildren } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { USER, ACTIONS, toastMock, debugErrorMock, sanitizeMock, invokeMock, mockFrom } = vi.hoisted(() => {
  const USER = { id: 'u1', email: 't@t.co' };

  const ACTIONS = [
    {
      id: 'a1',
      type: 'reminder',
      title: 'Payer une facture',
      description: 'Une facture arrive à échéance bientôt.',
      priority: 'critical' as const,
      suggestedAction: { type: 'open_invoice', data: { invoiceId: 'inv1' }, preview: 'Facture inv1' },
      context: { entityType: 'invoice', entityId: 'inv1', reason: 'Due soon' },
      createdAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-02T00:00:00.000Z',
    },
    {
      id: 'a2',
      type: 'cleanup',
      title: 'Nettoyer des doublons',
      description: 'Des doublons ont été détectés.',
      priority: 'high' as const,
      suggestedAction: { type: 'merge_duplicates', data: { count: 2 } },
      context: { reason: 'Duplicates detected' },
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'a3',
      type: 'reminder',
      title: 'Mettre à jour le profil',
      description: 'Votre profil est incomplet.',
      priority: 'low' as const,
      suggestedAction: { type: 'open_profile', data: {} },
      context: { reason: 'Missing fields' },
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const toastMock = vi.fn();
  const debugErrorMock = vi.fn();
  const sanitizeMock = vi.fn((e: unknown) => {
    if (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string') {
      return (e as { message: string }).message;
    }
    return 'Erreur';
  });

  const invokeMock = vi.fn<
    (fnName: string, opts?: { body?: unknown }) => Promise<{ data: unknown; error: null | { message: string } }>
  >();

  const mockFrom = vi.fn();

  return { USER, ACTIONS, toastMock, debugErrorMock, sanitizeMock, invokeMock, mockFrom };
});

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
    const builder: {
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
      upsert: ReturnType<typeof vi.fn>;
      single: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
      then: PromiseLike<unknown>['then'];
      catch: PromiseLike<unknown>['catch'];
    } = {
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
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
      catch: (onRejected?: ((reason: unknown) => unknown) | null) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    };
    return builder;
  };

  return {
    supabase: {
      from: mockFrom.mockImplementation(() => createBuilder()),
      functions: {
        invoke: invokeMock,
      },
    },
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: USER, session: { user: USER }, isLoading: false }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeMock,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const Wrapper = ({ children }: PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { Wrapper, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useJarvisPreemptiveActions', () => {
  it('charge puis expose les actions et les agrégats (priorité/type)', async () => {
    invokeMock.mockImplementation(async (_fnName, opts) => {
      const body = (opts?.body ?? {}) as { action?: string };
      if (body.action === 'get_pending') return { data: { actions: ACTIONS }, error: null };
      return { data: null, error: null };
    });

    const { Wrapper } = createWrapper();

    const { useJarvisPreemptiveActions } = await import('./useJarvisPreemptiveActions');
    const { result } = renderHook(() => useJarvisPreemptiveActions(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(invokeMock).toHaveBeenCalledWith('jarvis-preemptive-actions', { body: { action: 'get_pending' } });

    expect(result.current.totalCount).toBe(3);
    expect(result.current.hasActions).toBe(true);
    expect(result.current.hasCritical).toBe(true);

    expect(result.current.criticalActions.map(a => a.id)).toEqual(['a1']);
    expect(result.current.highPriorityActions.map(a => a.id)).toEqual(['a2']);
    expect(result.current.lowPriorityActions.map(a => a.id)).toEqual(['a3']);
    expect(result.current.mediumPriorityActions).toHaveLength(0);

    const reminders = result.current.getActionsByType('reminder').map(a => a.id).sort();
    expect(reminders).toEqual(['a1', 'a3']);
  });

  it('en cas derreur lors du fetch, retourne [] et logge debug.error', async () => {
    invokeMock.mockImplementation(async (_fnName, opts) => {
      const body = (opts?.body ?? {}) as { action?: string };
      if (body.action === 'get_pending') return { data: null, error: { message: 'x' } };
      return { data: null, error: null };
    });

    const { Wrapper } = createWrapper();

    const { useJarvisPreemptiveActions } = await import('./useJarvisPreemptiveActions');
    const { result } = renderHook(() => useJarvisPreemptiveActions(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.actions).toEqual([]);
    expect(result.current.hasActions).toBe(false);
    expect(result.current.totalCount).toBe(0);
    expect(debugErrorMock).toHaveBeenCalled();
  });

  it('executeAction appelle la fonction, invalide le cache et affiche un toast de succès', async () => {
    invokeMock.mockImplementation(async (_fnName, opts) => {
      const body = (opts?.body ?? {}) as { action?: string; actionId?: string };
      if (body.action === 'get_pending') return { data: { actions: ACTIONS }, error: null };
      if (body.action === 'execute') return { data: { ok: true, executed: body.actionId }, error: null };
      return { data: null, error: null };
    });

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { useJarvisPreemptiveActions } = await import('./useJarvisPreemptiveActions');
    const { result } = renderHook(() => useJarvisPreemptiveActions(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.executingId).toBe(null);
    expect(result.current.isExecuting).toBe(false);

    await act(async () => {
      await result.current.executeAction('a1');
    });

    expect(invokeMock).toHaveBeenCalledWith('jarvis-preemptive-actions', { body: { action: 'execute', actionId: 'a1' } });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['jarvis-preemptive-actions'] });

    expect(toastMock).toHaveBeenCalledWith({
      title: '✅ Action exécutée',
      description: 'Payer une facture',
    });

    expect(result.current.executingId).toBe(null);
  });

  it("executeAction en erreur affiche un toast destructive avec l'erreur sanitizée", async () => {
    invokeMock.mockImplementation(async (_fnName, opts) => {
      const body = (opts?.body ?? {}) as { action?: string; actionId?: string };
      if (body.action === 'get_pending') return { data: { actions: ACTIONS }, error: null };
      if (body.action === 'execute') return { data: null, error: { message: 'nope' } };
      return { data: null, error: null };
    });

    const { Wrapper } = createWrapper();

    const { useJarvisPreemptiveActions } = await import('./useJarvisPreemptiveActions');
    const { result } = renderHook(() => useJarvisPreemptiveActions(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.executeAction('a2')).rejects.toBeTruthy();
    });

    expect(invokeMock).toHaveBeenCalledWith('jarvis-preemptive-actions', { body: { action: 'execute', actionId: 'a2' } });
    expect(sanitizeMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'nope',
      variant: 'destructive',
    });
    expect(result.current.executingId).toBe(null);
  });

  it('dismissAction appelle la fonction et invalide les queries', async () => {
    invokeMock.mockImplementation(async (_fnName, opts) => {
      const body = (opts?.body ?? {}) as { action?: string; actionId?: string };
      if (body.action === 'get_pending') return { data: { actions: ACTIONS }, error: null };
      if (body.action === 'dismiss') return { data: { ok: true, dismissed: body.actionId }, error: null };
      return { data: null, error: null };
    });

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { useJarvisPreemptiveActions } = await import('./useJarvisPreemptiveActions');
    const { result } = renderHook(() => useJarvisPreemptiveActions(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.dismissAction('a3');
    });

    expect(invokeMock).toHaveBeenCalledWith('jarvis-preemptive-actions', { body: { action: 'dismiss', actionId: 'a3' } });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['jarvis-preemptive-actions'] });
  });

  it('scanForActions invoque scan puis refetch (appel get_pending supplémentaire)', async () => {
    invokeMock.mockImplementation(async (_fnName, opts) => {
      const body = (opts?.body ?? {}) as { action?: string };
      if (body.action === 'get_pending') return { data: { actions: ACTIONS }, error: null };
      if (body.action === 'scan') return { data: { ok: true }, error: null };
      return { data: null, error: null };
    });

    const { Wrapper } = createWrapper();

    const { useJarvisPreemptiveActions } = await import('./useJarvisPreemptiveActions');
    const { result } = renderHook(() => useJarvisPreemptiveActions(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const callsBefore = invokeMock.mock.calls.length;

    await act(async () => {
      await result.current.scanForActions();
    });

    expect(invokeMock).toHaveBeenCalledWith('jarvis-preemptive-actions', { body: { action: 'scan' } });

    await waitFor(() => {
      const callsAfter = invokeMock.mock.calls.length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
      const getPendingCalls = invokeMock.mock.calls.filter(
        c => c[0] === 'jarvis-preemptive-actions' && JSON.stringify(c[1]) === JSON.stringify({ body: { action: 'get_pending' } }),
      );
      expect(getPendingCalls.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('usePreemptiveActionNotifications', () => {
  it('notifie une seule fois les actions critiques', async () => {
    invokeMock.mockImplementation(async (_fnName, opts) => {
      const body = (opts?.body ?? {}) as { action?: string };
      if (body.action === 'get_pending') return { data: { actions: ACTIONS }, error: null };
      return { data: null, error: null };
    });

    const { Wrapper } = createWrapper();

    const { usePreemptiveActionNotifications } = await import('./useJarvisPreemptiveActions');
    const { result, rerender } = renderHook(() => usePreemptiveActionNotifications(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.hasCritical).toBe(true);
      expect(result.current.criticalCount).toBe(1);
    });

    await waitFor(() => {
      const criticalToastCalls = toastMock.mock.calls.filter(call => {
        const arg = call[0] as { title?: string };
        return typeof arg?.title === 'string' && arg.title.includes('Payer une facture');
      });
      expect(criticalToastCalls).toHaveLength(1);
    });

    rerender();

    await waitFor(() => {
      const criticalToastCalls = toastMock.mock.calls.filter(call => {
        const arg = call[0] as { title?: string };
        return typeof arg?.title === 'string' && arg.title.includes('Payer une facture');
      });
      expect(criticalToastCalls).toHaveLength(1);
    });
  });
});