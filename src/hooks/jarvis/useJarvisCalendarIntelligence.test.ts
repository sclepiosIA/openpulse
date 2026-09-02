import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  USER,
  PATTERNS_RESPONSE,
  WEEKLY_RESPONSE,
  CONFLICTS,
  CONFLICTS_RESPONSE,
  SLOTS,
  SLOTS_RESPONSE,
  PREPARATION,
  PREPARATION_RESPONSE,
  CONTROL,
  mockInvoke,
  mockFrom,
  mockDebugError,
} = vi.hoisted(() => {
  const USER = { id: 'u1', email: 't@t.co' };

  const PATTERNS_RESPONSE = {
    patterns: {
      totalMeetings: 10,
      avgMeetingsPerWeek: 2,
      busiestDay: 'Tuesday',
      busiestHour: '10:00',
      quietestHour: '15:00',
    },
    insights: ['i1', 'i2'],
    recommendations: ['r1'],
  };

  const WEEKLY_RESPONSE = { summary: { meetings: 5, focusBlocks: 3 } };

  const CONFLICTS = [
    {
      type: 'overlap',
      severity: 'high',
      events: [
        { id: '1', title: 'A' },
        { id: '2', title: 'B' },
      ],
      message: 'Overlap',
    },
    {
      type: 'back_to_back',
      severity: 'low',
      events: [
        { id: '3', title: 'C' },
        { id: '4', title: 'D' },
      ],
      message: 'Back to back',
    },
  ];

  const CONFLICTS_RESPONSE = { conflicts: CONFLICTS };

  const SLOTS = [
    { start: new Date('2025-01-02T09:00:00.000Z'), end: new Date('2025-01-02T10:00:00.000Z'), score: 0.9, label: 'Morning' },
    { start: new Date('2025-01-03T14:00:00.000Z'), end: new Date('2025-01-03T15:00:00.000Z'), score: 0.8, label: 'Afternoon' },
  ];

  const SLOTS_RESPONSE = { slots: SLOTS };

  const PREPARATION = {
    event: { title: 'Demo', startTime: '2025-01-05T10:00:00.000Z', endTime: '2025-01-05T11:00:00.000Z', location: 'Room', description: 'Desc' },
    context: { attendees: 3 },
    suggestions: [{ type: 'agenda', title: 'Agenda', items: ['Intro'] }],
    documents: [],
  };

  const PREPARATION_RESPONSE = { preparation: PREPARATION };

  const CONTROL = {
    shouldErrorOnAnalyze: false,
    shouldErrorOnWeekly: false,
    shouldErrorOnConflicts: false,
    shouldErrorOnSuggest: false,
    shouldErrorOnPrepare: false,
    authenticated: true,
  };

  const mockInvoke = vi.fn(async (_fnName: string, args: unknown) => {
    const body = (args as { body?: Record<string, unknown> })?.body ?? {};
    const action = body.action as string | undefined;

    if (action === 'analyze_availability') {
      if (CONTROL.shouldErrorOnAnalyze) return { data: null, error: { message: 'failed analyze' } };
      return { data: PATTERNS_RESPONSE, error: null };
    }
    if (action === 'get_weekly_summary') {
      if (CONTROL.shouldErrorOnWeekly) return { data: null, error: { message: 'failed weekly' } };
      return { data: WEEKLY_RESPONSE, error: null };
    }
    if (action === 'detect_conflicts') {
      if (CONTROL.shouldErrorOnConflicts) return { data: null, error: { message: 'failed conflicts' } };
      return { data: CONFLICTS_RESPONSE, error: null };
    }
    if (action === 'suggest_best_slots') {
      if (CONTROL.shouldErrorOnSuggest) return { data: null, error: { message: 'failed slots', status: 400 } };
      return { data: SLOTS_RESPONSE, error: null };
    }
    if (action === 'prepare_meeting') {
      if (CONTROL.shouldErrorOnPrepare) return { data: null, error: { message: 'failed prepare' } };
      return { data: PREPARATION_RESPONSE, error: null };
    }
    return { data: null, error: null };
  });

  type ChainResult = { data: unknown; error: unknown };
  type ChainBuilder = {
    select: () => ChainBuilder;
    eq: () => ChainBuilder;
    gte: () => ChainBuilder;
    lte: () => ChainBuilder;
    in: () => ChainBuilder;
    order: () => ChainBuilder;
    limit: () => ChainBuilder;
    insert: () => ChainBuilder;
    update: () => ChainBuilder;
    delete: () => ChainBuilder;
    single: () => Promise<ChainResult>;
    maybeSingle: () => Promise<ChainResult>;
    then: (resolve: (value: ChainResult) => unknown) => Promise<unknown>;
    catch: (reject: (reason?: unknown) => unknown) => Promise<unknown>;
  };

  const makeBuilder = (): ChainBuilder => {
    const result: ChainResult = { data: null, error: null };
    const builder: ChainBuilder = {
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
      single: async () => result,
      maybeSingle: async () => result,
      then: (resolve) => Promise.resolve(result).then(resolve),
      catch: (reject) => Promise.resolve(result).catch(reject),
    };
    return builder;
  };

  const mockFrom = vi.fn((_table?: string) => makeBuilder());
  const mockDebugError = vi.fn();

  return {
    USER,
    PATTERNS_RESPONSE,
    WEEKLY_RESPONSE,
    CONFLICTS,
    CONFLICTS_RESPONSE,
    SLOTS,
    SLOTS_RESPONSE,
    PREPARATION,
    PREPARATION_RESPONSE,
    CONTROL,
    mockInvoke,
    mockFrom,
    mockDebugError,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
    from: mockFrom,
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => (CONTROL.authenticated ? { user: { id: USER.id, email: USER.email } } : { user: null }),
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: mockDebugError, log: vi.fn(), warn: vi.fn() },
}));

import { useJarvisCalendarIntelligence } from './useJarvisCalendarIntelligence';

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe('useJarvisCalendarIntelligence', () => {
  beforeEach(() => {
    CONTROL.shouldErrorOnAnalyze = false;
    CONTROL.shouldErrorOnWeekly = false;
    CONTROL.shouldErrorOnConflicts = false;
    CONTROL.shouldErrorOnSuggest = false;
    CONTROL.shouldErrorOnPrepare = false;
    CONTROL.authenticated = true;
    vi.clearAllMocks();
  });

  it('charge puis renvoie les données de patterns, weeklySummary et conflicts (succès) et calcule les stats', async () => {
    const { result } = renderHook(() => useJarvisCalendarIntelligence(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.patterns).toEqual(PATTERNS_RESPONSE.patterns);
    expect(result.current.insights).toEqual(PATTERNS_RESPONSE.insights);
    expect(result.current.recommendations).toEqual(PATTERNS_RESPONSE.recommendations);
    expect(result.current.weeklySummary).toEqual(WEEKLY_RESPONSE.summary);
    expect(result.current.conflicts).toEqual(CONFLICTS);
    expect(result.current.hasConflicts).toBe(true);
    expect(result.current.highSeverityConflictsCount).toBe(1);

    const calls = mockInvoke.mock.calls;
    const actions = calls.map((c) => (c[1] as { body?: { action?: string } } | undefined)?.body?.action);
    expect(actions).toContain('analyze_availability');
    expect(actions).toContain('get_weekly_summary');
    expect(actions).toContain('detect_conflicts');

    const conflictCall = calls.find((c) => (c[1] as { body?: { action?: string } } | undefined)?.body?.action === 'detect_conflicts');
    expect(conflictCall?.[0]).toBe('jarvis-calendar-intelligence');
    expect((conflictCall?.[1] as { body?: { userId?: string } } | undefined)?.body?.userId).toBe(USER.id);
    const dateRange = (conflictCall?.[1] as { body?: { dateRange?: { start?: string; end?: string } } } | undefined)?.body?.dateRange;
    expect(typeof dateRange?.start).toBe('string');
    expect(typeof dateRange?.end).toBe('string');
  });

  it('mutation suggestSlots (succès) renvoie des créneaux et appelle Supabase avec les bons paramètres', async () => {
    const { result } = renderHook(() => useJarvisCalendarIntelligence(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const payload = {
      duration: 45,
      preferredTime: 'morning' as const,
      dateRange: {
        start: '2025-01-01T00:00:00.000Z',
        end: '2025-01-07T00:00:00.000Z',
      },
    };

    await act(async () => {
      const slots = await result.current.suggestSlots(payload);
      expect(slots).toEqual(SLOTS);
    });

    const suggestCall = mockInvoke.mock.calls.find((c) => (c[1] as { body?: { action?: string } } | undefined)?.body?.action === 'suggest_best_slots');
    expect(suggestCall?.[0]).toBe('jarvis-calendar-intelligence');
    const body = (suggestCall?.[1] as {
      body?: { userId?: string; duration?: number; preferredTime?: string; dateRange?: { start?: string; end?: string } };
    } | undefined)?.body;
    expect(body?.userId).toBe(USER.id);
    expect(body?.duration).toBe(45);
    expect(body?.preferredTime).toBe('morning');
    expect(body?.dateRange).toEqual(payload.dateRange);
  });

  it('mutation prepareMeeting (succès) renvoie la préparation et appelle Supabase avec eventId', async () => {
    const { result } = renderHook(() => useJarvisCalendarIntelligence(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const prep = await result.current.prepareMeeting('evt1');
      expect(prep).toEqual(PREPARATION);
    });

    const prepareCall = mockInvoke.mock.calls.find((c) => (c[1] as { body?: { action?: string } } | undefined)?.body?.action === 'prepare_meeting');
    expect(prepareCall?.[0]).toBe('jarvis-calendar-intelligence');
    expect((prepareCall?.[1] as { body?: { eventId?: string } } | undefined)?.body?.eventId).toBe('evt1');
  });

  it('mutation suggestSlots (erreur) rejette et expose une erreur', async () => {
    CONTROL.shouldErrorOnSuggest = true;

    const { result } = renderHook(() => useJarvisCalendarIntelligence(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(
        result.current.suggestSlots({
          duration: 30,
          preferredTime: 'afternoon',
          dateRange: { start: '2025-02-01T00:00:00.000Z', end: '2025-02-03T00:00:00.000Z' },
        })
      ).rejects.toMatchObject({ message: 'failed slots' });
    });

    const suggestCall = mockInvoke.mock.calls.find((c) => (c[1] as { body?: { action?: string } } | undefined)?.body?.action === 'suggest_best_slots');
    const body = (suggestCall?.[1] as {
      body?: { userId?: string; duration?: number; preferredTime?: string; dateRange?: { start?: string; end?: string } };
    } | undefined)?.body;
    expect(body?.userId).toBe(USER.id);
    expect(body?.duration).toBe(30);
    expect(body?.preferredTime).toBe('afternoon');
  });

  it('erreur côté patterns: retourne valeurs par défaut et logue via debug.error', async () => {
    CONTROL.shouldErrorOnAnalyze = true;

    const { result } = renderHook(() => useJarvisCalendarIntelligence(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.patterns).toBeUndefined();
    expect(mockDebugError).toHaveBeenCalled();
    const errorMsgs = mockDebugError.mock.calls.map((c) => String(c[0]));
    expect(errorMsgs.some((m) => m.includes('Failed to fetch calendar patterns'))).toBe(true);
  });

  it('si non authentifié: aucune invocation Supabase, pas de chargement, valeurs neutres', async () => {
    CONTROL.authenticated = false;

    const { result } = renderHook(() => useJarvisCalendarIntelligence(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.current.patterns).toBeUndefined();
    expect(result.current.weeklySummary).toBeUndefined();
    expect(result.current.conflicts).toEqual([]);
    expect(result.current.hasConflicts).toBe(false);
    expect(result.current.highSeverityConflictsCount).toBe(0);
  });
});