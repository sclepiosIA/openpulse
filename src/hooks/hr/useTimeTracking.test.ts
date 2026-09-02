import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import {
  useCurrentSession,
  useClockIn,
  useClockOut,
  useMyTimeEntries,
  useTeamTimeEntries,
  useElapsedTimer,
  formatElapsed,
  formatDuration,
  groupByDay,
  totalMinutes,
  type TimeEntry,
} from './useTimeTracking';

const { mockFrom, setNextResponse, callLogs, USER } = vi.hoisted(() => {
  const USER = { id: 'user-1', email: 'test@example.com' } as const;

  let nextResponse: { data: unknown; error: unknown } = { data: null, error: null };

  const setNextResponse = (r: { data: unknown; error: unknown }) => {
    nextResponse = r;
  };

  const callLogs = {
    inserts: [] as unknown[],
    updates: [] as unknown[],
    eqs: [] as [string, unknown][],
    gtes: [] as [string, unknown][],
    ltes: [] as [string, unknown][],
    selects: 0,
    fromArgs: [] as unknown[],
  };

  const builder = {
    select(..._args: unknown[]) {
      callLogs.selects += 1;
      return builder;
    },
    insert(obj: unknown) {
      callLogs.inserts.push(obj);
      return builder;
    },
    update(obj: unknown) {
      callLogs.updates.push(obj);
      return builder;
    },
    eq(col: string, val: unknown) {
      callLogs.eqs.push([col, val]);
      return builder;
    },
    gte(col: string, val: unknown) {
      callLogs.gtes.push([col, val]);
      return builder;
    },
    lte(col: string, val: unknown) {
      callLogs.ltes.push([col, val]);
      return builder;
    },
    is(col: string, val: unknown) {
      callLogs.eqs.push([col, val]);
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    maybeSingle() {
      return {
        then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve(nextResponse).then((res) => onFulfilled(res)).catch((e) => (onRejected ? onRejected(e) : Promise.reject(e))),
        catch: (_fn?: unknown) => ({
          then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(nextResponse).then(onFulfilled),
        }),
      };
    },
    single() {
      return {
        then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve(nextResponse).then((res) => onFulfilled(res)).catch((e) => (onRejected ? onRejected(e) : Promise.reject(e))),
        catch: (_fn?: unknown) => ({
          then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(nextResponse).then(onFulfilled),
        }),
      };
    },
    then(onFulfilled: (v: unknown) => unknown) {
      return Promise.resolve(nextResponse).then(onFulfilled);
    },
    catch() {
      return builder;
    },
  } as any;

  const mockFrom = vi.fn((table: unknown) => {
    callLogs.fromArgs.push(table);
    return builder;
  });

  return { mockFrom, setNextResponse, callLogs, USER };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mockFrom } }));
vi.mock('@/hooks/shared/useAuth', () => ({ useAuth: () => ({ user: USER, isLoading: false }) }));

describe('useTimeTracking module', () => {
  beforeEach(() => {
    // reset logs and default response
    callLogs.inserts.length = 0;
    callLogs.updates.length = 0;
    callLogs.eqs.length = 0;
    callLogs.gtes.length = 0;
    callLogs.ltes.length = 0;
    callLogs.selects = 0;
    callLogs.fromArgs.length = 0;
    // default response null
    setNextResponse({ data: null, error: null });
  });

  it('loads current session successfully and reflects isLoading → success with returned TimeEntry', async () => {
    const sample: TimeEntry = {
      id: 't1',
      user_id: USER.id,
      clock_in: new Date().toISOString(),
      clock_out: null,
      duration_minutes: null,
      note: 'working',
      auto_closed: false,
      created_at: new Date().toISOString(),
    };
    setNextResponse({ data: sample, error: null });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
    const wrapper = ({ children }: { children?: React.ReactNode }) => React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useCurrentSession(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data).toMatchObject({ id: 't1', user_id: USER.id, note: 'working' });
    expect(callLogs.fromArgs[0]).toBe('time_entries');
    expect(callLogs.selects).toBeGreaterThanOrEqual(1);
  });

  it('reports error state when supabase returns an error for current session', async () => {
    setNextResponse({ data: null, error: { message: 'fetch-failed' } });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
    const wrapper = ({ children }: { children?: React.ReactNode }) => React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useCurrentSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as any).message).toBe('fetch-failed');
  });

  it('performs clock in mutation and invalidates queries on success', async () => {
    const created: TimeEntry = {
      id: 'created-1',
      user_id: USER.id,
      clock_in: new Date().toISOString(),
      clock_out: null,
      duration_minutes: null,
      note: 'note-x',
      auto_closed: false,
      created_at: new Date().toISOString(),
    };
    setNextResponse({ data: created, error: null });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
    const spyInvalidate = vi.spyOn(qc, 'invalidateQueries');
    const wrapper = ({ children }: { children?: React.ReactNode }) => React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useClockIn(), { wrapper });

    await act(async () => {
      const res = await result.current.mutateAsync('note-x');
      expect(res).toMatchObject({ id: 'created-1', note: 'note-x' });
    });

    // Supabase was called for the time_entries table
    expect(callLogs.fromArgs[0]).toBe('time_entries');

    // Insert recorded the expected payload
    expect(callLogs.inserts.length).toBeGreaterThanOrEqual(1);
    const inserted = callLogs.inserts[0] as any;
    expect(inserted).toMatchObject({ user_id: USER.id, note: 'note-x' });

    // onSuccess invalidated the two keys
    expect(spyInvalidate).toHaveBeenCalled();
    expect(spyInvalidate.mock.calls.some((c) => JSON.stringify(c[0]?.queryKey) === JSON.stringify(['time-entry-current']))).toBe(true);
    expect(spyInvalidate.mock.calls.some((c) => JSON.stringify(c[0]?.queryKey) === JSON.stringify(['time-entries']))).toBe(true);
  });

  it('performs clock out mutation and records update conditions', async () => {
    const updated: TimeEntry = {
      id: 'sess-1',
      user_id: USER.id,
      clock_in: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      clock_out: new Date().toISOString(),
      duration_minutes: 10,
      note: null,
      auto_closed: false,
      created_at: new Date().toISOString(),
    };
    setNextResponse({ data: updated, error: null });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
    const spyInvalidate = vi.spyOn(qc, 'invalidateQueries');
    const wrapper = ({ children }: { children?: React.ReactNode }) => React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useClockOut(), { wrapper });

    await act(async () => {
      const res = await result.current.mutateAsync('sess-1');
      expect(res).toMatchObject({ id: 'sess-1', duration_minutes: 10 });
    });

    expect(callLogs.fromArgs[0]).toBe('time_entries');

    // eq should have been called for id and user_id
    const eqs = callLogs.eqs;
    expect(eqs.some(([k, v]) => k === 'id' && v === 'sess-1')).toBe(true);
    expect(eqs.some(([k, v]) => k === 'user_id' && v === USER.id)).toBe(true);

    expect(spyInvalidate).toHaveBeenCalled();
    expect(spyInvalidate.mock.calls.some((c) => JSON.stringify(c[0]?.queryKey) === JSON.stringify(['time-entry-current']))).toBe(true);
  });

  it('fetches my time entries for a given range', async () => {
    const entries: TimeEntry[] = [
      {
        id: 'e1',
        user_id: USER.id,
        clock_in: new Date().toISOString(),
        clock_out: new Date().toISOString(),
        duration_minutes: 60,
        note: null,
        auto_closed: false,
        created_at: new Date().toISOString(),
      },
    ];
    setNextResponse({ data: entries, error: null });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
    const wrapper = ({ children }: { children?: React.ReactNode }) => React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useMyTimeEntries('today'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(Array.isArray(result.current.data)).toBe(true);
    expect((result.current.data as TimeEntry[])[0]).toMatchObject({ id: 'e1', user_id: USER.id });
    expect(callLogs.fromArgs[0]).toBe('time_entries');
    expect(callLogs.gtes.length).toBeGreaterThanOrEqual(1);
    expect(callLogs.ltes.length).toBeGreaterThanOrEqual(1);
  });

  it('fetches team time entries ignoring user', async () => {
    const teamEntries: TimeEntry[] = [
      {
        id: 't-a',
        user_id: 'other',
        clock_in: new Date().toISOString(),
        clock_out: new Date().toISOString(),
        duration_minutes: 30,
        note: null,
        auto_closed: false,
        created_at: new Date().toISOString(),
      },
    ];
    setNextResponse({ data: teamEntries, error: null });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
    const wrapper = ({ children }: { children?: React.ReactNode }) => React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useTeamTimeEntries('week'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect((result.current.data as TimeEntry[])[0]).toMatchObject({ id: 't-a', user_id: 'other' });
    expect(callLogs.fromArgs[0]).toBe('time_entries');
    expect(callLogs.gtes.length).toBeGreaterThanOrEqual(1);
  });

  it('elapsed timer ticks based on clockIn and stops when null', async () => {
    vi.useFakeTimers();
    const base = new Date('2025-01-01T12:00:00.000Z');
    vi.setSystemTime(base);

    const clockIn = new Date(base.getTime() - 5000).toISOString();

    const { result, rerender, unmount } = renderHook(({ ci }) => useElapsedTimer(ci), {
      initialProps: { ci: clockIn },
    });

    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBeGreaterThanOrEqual(5);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBeGreaterThanOrEqual(7);

    rerender({ ci: null });
    expect(result.current).toBe(0);

    unmount();
    vi.useRealTimers();
  });

  it('formatElapsed and formatDuration produce expected strings', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
    expect(formatElapsed(3661)).toBe('01:01:01');
    expect(formatDuration(45)).toBe('45min');
    expect(formatDuration(90)).toBe('1h30');
  });

  it('groupByDay groups entries by date and totalMinutes sums correctly including current session elapsed', () => {
    const now = new Date('2025-02-02T08:00:00.000Z').toISOString();
    const entries: TimeEntry[] = [
      { id: 'a', user_id: 'u', clock_in: '2025-02-02T07:00:00.000Z', clock_out: '2025-02-02T07:30:00.000Z', duration_minutes: 30, note: null, auto_closed: false, created_at: now },
      { id: 'b', user_id: 'u', clock_in: '2025-02-02T07:45:00.000Z', clock_out: null, duration_minutes: null, note: null, auto_closed: false, created_at: now },
    ];

    const groups = groupByDay(entries);
    expect(Object.keys(groups).length).toBe(1);
    expect(groups['2025-02-02'].length).toBe(2);

    const total = totalMinutes(entries, 120);
    expect(Math.round(total)).toBe(32);
  });
});