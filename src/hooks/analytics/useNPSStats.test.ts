import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { subMonths, format as formatDate } from 'date-fns';

const {
  mockFrom,
  setFormation,
  setSolution,
  setFormationError,
  setSolutionError,
  debugError
} = vi.hoisted(() => {
  let formationData: Array<{ note_globale: number | null; date_reponse: string }> = [];
  let solutionData: Array<{ nps_score: number | null; date_reponse: string }> = [];
  let formationErr: unknown = null;
  let solutionErr: unknown = null;

  const mockFrom = vi.fn((table: string) => {
    const builder: any = {
      select() { return builder; },
      gte() { return builder; },
      not() { return builder; },
      order() { return builder; },
      limit() { return builder; },
      insert() { return builder; },
      update() { return builder; },
      delete() { return builder; },
      single() { return builder; },
      maybeSingle() { return builder; },
      then(onFulfilled: (v: any) => any, onRejected?: (e: any) => any) {
        if (table === 'enquetes_satisfaction_formation') {
          if (formationErr instanceof Error) {
            return Promise.reject(formationErr).then(onFulfilled, onRejected);
          }
          return Promise.resolve({ data: formationData, error: formationErr }).then(onFulfilled, onRejected);
        }
        if (table === 'enquetes_satisfaction_solution') {
          if (solutionErr instanceof Error) {
            return Promise.reject(solutionErr).then(onFulfilled, onRejected);
          }
          return Promise.resolve({ data: solutionData, error: solutionErr }).then(onFulfilled, onRejected);
        }
        return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
      },
      catch() { return builder; }
    };
    return builder;
  });

  const debugError = vi.fn();

  return {
    mockFrom,
    setFormation: (v: Array<{ note_globale: number | null; date_reponse: string }>) => { formationData = v; },
    setSolution: (v: Array<{ nps_score: number | null; date_reponse: string }>) => { solutionData = v; },
    setFormationError: (e: unknown) => { formationErr = e; },
    setSolutionError: (e: unknown) => { solutionErr = e; },
    debugError
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom }
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: debugError }
}));

describe('useNPSStats', () => {
  const createWrapper = () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 }
      }
    });
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider as any, { client }, children);
  };

  beforeEach(() => {
    setFormation([]);
    setSolution([]);
    setFormationError(null);
    setSolutionError(null);
    mockFrom.mockClear();
    debugError.mockClear();
  });

  it('returns defaults when there is no data', async () => {
    const { useNPSStats } = await import('./useNPSStats');
    const { result } = renderHook(() => useNPSStats(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(result.current.data).toEqual({
      npsScore: 0,
      evolution: 0,
      totalRepondants: 0,
      promoteurs: 0,
      passifs: 0,
      detracteurs: 0,
      npsCalculated: 0,
      monthlyData: []
    });

    const calledTables = mockFrom.mock.calls.map(args => args[0]);
    expect(calledTables).toContain('enquetes_satisfaction_formation');
    expect(calledTables).toContain('enquetes_satisfaction_solution');

    expect(debugError).not.toHaveBeenCalled();
  });

  it('computes metrics correctly with mixed formation and solution data', async () => {
    const now = new Date();
    const currentMonthIso = new Date(now).toISOString();
    const prev = new Date(now);
    prev.setMonth(prev.getMonth() - 1);
    const previousMonthIso = prev.toISOString();

    // formation: one current-month (10), one previous-month (8)
    setFormation([
      { note_globale: 10, date_reponse: currentMonthIso },
      { note_globale: 8, date_reponse: previousMonthIso }
    ]);
    // solution: one current-month (6)
    setSolution([{ nps_score: 6, date_reponse: currentMonthIso }]);

    const { useNPSStats } = await import('./useNPSStats');
    const { result } = renderHook(() => useNPSStats(), { wrapper: createWrapper() });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    const out = result.current.data;
    expect(out?.npsScore).toBe(8); // (10+8+6)/3
    expect(out?.totalRepondants).toBe(3);
    expect(out?.promoteurs).toBe(1);
    expect(out?.passifs).toBe(1);
    expect(out?.detracteurs).toBe(1);
    expect(out?.npsCalculated).toBe(0);
    expect(out?.evolution).toBe(0);

    const expectedMonths: Array<{ mois: string; nps: number; repondants: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const month = subMonths(now, i);
      const keyIso = formatDate(month, 'yyyy-MM');
      const mois = formatDate(new Date(keyIso + '-01'), 'MMM yyyy');
      let nps = 0;
      let repondants = 0;
      const curMonthKey = formatDate(new Date(currentMonthIso), 'yyyy-MM');
      const prevMonthKey = formatDate(new Date(previousMonthIso), 'yyyy-MM');
      if (keyIso === curMonthKey) {
        nps = 8;
        repondants = 2;
      } else if (keyIso === prevMonthKey) {
        nps = 8;
        repondants = 1;
      }
      expectedMonths.push({ mois, nps, repondants });
    }

    expect(out?.monthlyData).toEqual(expectedMonths);
  });

  it('logs formation error and marks query as error when solution fetch rejects', async () => {
    const formationErr = { message: 'fetch formation failed' };
    const solutionReject = new Error('solution fetch rejected');

    setFormationError(formationErr);
    setSolutionError(solutionReject);

    const { useNPSStats } = await import('./useNPSStats');
    const { result } = renderHook(() => useNPSStats(), { wrapper: createWrapper() });

    await waitFor(() => { expect(result.current.isError).toBe(true); });

    expect(debugError).toHaveBeenCalled();
    const firstCall = debugError.mock.calls[0];
    expect(firstCall[0]).toBe('Error fetching formation NPS:');
    expect(firstCall[1]).toBe(formationErr);
  });

  it('logs solution error but still succeeds using formation data', async () => {
    const now = new Date();
    setFormation([{ note_globale: 9, date_reponse: now.toISOString() }]);
    setSolutionError({ message: 'solution-fail' });

    const { useNPSStats } = await import('./useNPSStats');
    const { result } = renderHook(() => useNPSStats(), { wrapper: createWrapper() });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(debugError).toHaveBeenCalledWith('Error fetching solution NPS:', { message: 'solution-fail' });
    expect(result.current.data?.totalRepondants).toBe(1);
    expect(result.current.data?.npsScore).toBe(9);
    expect(result.current.data?.promoteurs).toBe(1);
  });
});
