import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  AUTH_USER,
  TOAST_MOCK,
  SUBSCRIBE_SPY,
  LAST_SUBSCRIBE_ARGS,
  CAPTURED_HANDLERS_REF,
  UNSUBSCRIBE_MOCK,
} = vi.hoisted(() => {
  const TOAST_MOCK = vi.fn();
  type StatusType = 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'ERROR' | 'CONNECTING' | 'CLOSED' | string;
  interface Handlers {
    onPayload: (table: string, event: 'INSERT' | 'UPDATE' | 'DELETE', payload: unknown) => void;
    onStatus: (status: StatusType) => void;
  }
  const AUTH_USER = { id: 'u1', email: 'test@example.com' };
  const UNSUBSCRIBE_MOCK = vi.fn();
  const CAPTURED_HANDLERS_REF: { current: Handlers | null } = { current: null };
  const LAST_SUBSCRIBE_ARGS: {
    userId?: string;
    tables?: string[];
    handlers?: Handlers;
    isStreamingRef?: { current: boolean };
  } = {};
  const SUBSCRIBE_SPY = vi.fn(
    (
      userId: string,
      tables: string[],
      handlers: Handlers,
      isStreamingRef: { current: boolean }
    ) => {
      LAST_SUBSCRIBE_ARGS.userId = userId;
      LAST_SUBSCRIBE_ARGS.tables = tables;
      LAST_SUBSCRIBE_ARGS.handlers = handlers;
      LAST_SUBSCRIBE_ARGS.isStreamingRef = isStreamingRef;
      CAPTURED_HANDLERS_REF.current = handlers;
      return UNSUBSCRIBE_MOCK;
    }
  );
  return {
    AUTH_USER,
    TOAST_MOCK,
    SUBSCRIBE_SPY,
    LAST_SUBSCRIBE_ARGS,
    CAPTURED_HANDLERS_REF,
    UNSUBSCRIBE_MOCK,
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: AUTH_USER }),
}));
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: TOAST_MOCK }),
}));
vi.mock('@/lib/jarvisSmartTriggersChannel', () => ({
  subscribeSmartTriggers: SUBSCRIBE_SPY,
}));

import { useJarvisSmartTriggers } from './useJarvisSmartTriggers';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient, children });
  return Wrapper;
}

describe('useJarvisSmartTriggers', () => {
  beforeEach(() => {
    TOAST_MOCK.mockClear();
    SUBSCRIBE_SPY.mockClear();
    UNSUBSCRIBE_MOCK.mockClear();
    CAPTURED_HANDLERS_REF.current = null;
    Object.keys(LAST_SUBSCRIBE_ARGS).forEach((k) => {
      // @ts-expect-error dynamic cleanup
      LAST_SUBSCRIBE_ARGS[k] = undefined;
    });
  });

  it('does not subscribe when disabled and initializes with no triggers', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisSmartTriggers({ enabled: false }), { wrapper });
    expect(SUBSCRIBE_SPY).not.toHaveBeenCalled();
    expect(result.current.isListening).toBe(false);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.hasUrgent).toBe(false);
  });

  it('subscribes when enabled, updates listening status, and unsubscribes on unmount', () => {
    const wrapper = createWrapper();
    const { result, unmount } = renderHook(
      () => useJarvisSmartTriggers({ enabled: true, isStreaming: true }),
      { wrapper }
    );

    expect(SUBSCRIBE_SPY).toHaveBeenCalledTimes(1);
    expect(LAST_SUBSCRIBE_ARGS.userId).toBe(AUTH_USER.id);
    const tables = LAST_SUBSCRIBE_ARGS.tables || [];
    const expectedTables = [
      'email_messages',
      'factures',
      'taches',
      'support_tickets',
      'etablissements',
      'tresorerie_operations_bancaires',
      'calendar_events',
    ];
    for (const t of expectedTables) {
      expect(tables).toContain(t);
    }
    expect(LAST_SUBSCRIBE_ARGS.isStreamingRef?.current).toBe(true);

    const handlers = CAPTURED_HANDLERS_REF.current;
    expect(handlers).toBeTruthy();

    act(() => {
      handlers?.onStatus('SUBSCRIBED');
    });
    expect(result.current.isListening).toBe(true);

    unmount();
    expect(UNSUBSCRIBE_MOCK).toHaveBeenCalledTimes(1);
  });

  it('processes an urgent email INSERT and shows destructive toast; avoids duplicates', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisSmartTriggers({ enabled: true }), { wrapper });

    const handlers = CAPTURED_HANDLERS_REF.current;
    expect(handlers).toBeTruthy();

    act(() => {
      handlers?.onPayload('email_messages', 'INSERT', {
        new: { id: 'em1', subject: 'URGENT: please respond ASAP' },
      });
    });

    expect(result.current.totalCount).toBe(1);
    expect(result.current.hasUrgent).toBe(true);
    expect(result.current.urgentTriggers.length).toBe(1);
    const trig = result.current.triggers[0];
    expect(trig.id).toBe('email_urgent_em1');
    expect(trig.type).toBe('urgent');
    expect(trig.source).toBe('email');
    expect(trig.entityType).toBe('email_message');
    expect(trig.entityId).toBe('em1');
    expect(trig.priority).toBe(1);

    expect(TOAST_MOCK).toHaveBeenCalledTimes(1);
    const toastArg = TOAST_MOCK.mock.calls[0][0];
    expect(toastArg.title).toBe('📧 Email urgent reçu');
    expect(toastArg.variant).toBe('destructive');

    act(() => {
      handlers?.onPayload('email_messages', 'INSERT', {
        new: { id: 'em1', subject: 'URGENT: please respond ASAP' },
      });
    });
    expect(result.current.totalCount).toBe(1);
    expect(result.current.urgentTriggers.length).toBe(1);
  });

  it('auto-dismisses a newly assigned task after its autoDismissSeconds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00.000Z'));
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisSmartTriggers({ enabled: true }), { wrapper });

    const handlers = CAPTURED_HANDLERS_REF.current;
    expect(handlers).toBeTruthy();

    act(() => {
      handlers?.onPayload('taches', 'INSERT', {
        new: { id: 't1', responsable_id: 'u1', titre: 'Important task' },
      });
    });

    expect(result.current.totalCount).toBe(1);
    expect(result.current.reminderTriggers.length).toBe(1);

    vi.advanceTimersByTime(60_000 + 50);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.totalCount).toBe(0);
    expect(result.current.reminderTriggers.length).toBe(0);
    vi.useRealTimers();
  });

  it('processes overdue facture UPDATE and shows default variant toast', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisSmartTriggers({ enabled: true }), { wrapper });

    const handlers = CAPTURED_HANDLERS_REF.current;
    expect(handlers).toBeTruthy();

    act(() => {
      handlers?.onPayload('factures', 'UPDATE', {
        old: { statut: 'Envoyée' },
        new: { id: 'f1', statut: 'En retard', montant_ttc: 1500, numero: 'F001' },
      });
    });

    expect(result.current.totalCount).toBe(1);
    expect(result.current.riskTriggers.length).toBe(1);
    const trig = result.current.riskTriggers[0];
    expect(trig.type).toBe('risk');
    expect(trig.priority).toBe(2);
    expect(trig.title).toBe('💰 Facture en retard');
    expect(trig.message).toContain('F001');

    expect(TOAST_MOCK).toHaveBeenCalledTimes(1);
    const toastArg = TOAST_MOCK.mock.calls[0][0];
    expect(toastArg.variant).toBe('default');
    expect(toastArg.title).toBe('💰 Facture en retard');
  });

  it('ignores task INSERT not assigned to current user', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisSmartTriggers({ enabled: true }), { wrapper });

    const handlers = CAPTURED_HANDLERS_REF.current;
    expect(handlers).toBeTruthy();

    act(() => {
      handlers?.onPayload('taches', 'INSERT', {
        new: { id: 't2', responsable_id: 'u2', titre: 'Other user task' },
      });
    });

    expect(result.current.totalCount).toBe(0);
    expect(TOAST_MOCK).not.toHaveBeenCalled();
  });

  it('creates a meeting reminder for imminent event and removes it after expiresAt via cleanup interval', async () => {
    vi.useFakeTimers();
    const base = new Date('2024-02-01T09:00:00.000Z');
    vi.setSystemTime(base);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisSmartTriggers({ enabled: true }), { wrapper });

    const handlers = CAPTURED_HANDLERS_REF.current;
    expect(handlers).toBeTruthy();

    act(() => {
      handlers?.onPayload('calendar_events', 'UPDATE', {
        new: {
          id: 'ce1',
          start_time: new Date(base.getTime() + 1000).toISOString(),
          created_by: 'u1',
          title: 'Weekly Sync',
        },
      });
    });

    expect(result.current.totalCount).toBe(1);
    expect(result.current.reminderTriggers.length).toBe(1);
    const trig = result.current.reminderTriggers[0];
    expect(trig.entityType).toBe('calendar_event');
    expect(trig.title).toBe('📅 Réunion imminente');
    expect(trig.expiresAt instanceof Date).toBe(true);

    vi.advanceTimersByTime(31_000);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.totalCount).toBe(0);
    expect(result.current.reminderTriggers.length).toBe(0);
    vi.useRealTimers();
  });

  it('passes isStreaming ref correctly to subscribe', () => {
    const wrapper = createWrapper();
    renderHook(() => useJarvisSmartTriggers({ enabled: true, isStreaming: true }), { wrapper });
    expect(SUBSCRIBE_SPY).toHaveBeenCalledTimes(1);
    expect(LAST_SUBSCRIBE_ARGS.isStreamingRef?.current).toBe(true);
  });
});