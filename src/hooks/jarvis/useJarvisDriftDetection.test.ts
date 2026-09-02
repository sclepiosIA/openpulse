import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  USER,
  SUCCESS_INSERT_RESPONSE,
  ERROR_INSERT_RESPONSE,
  currentInsertResponse,
  mockFrom,
  builder,
  debugMock,
} = vi.hoisted(() => {
  const USER = { id: 'user_1', email: 'test@local' };

  const SUCCESS_INSERT_RESPONSE = { data: [{ id: 'ok' }], error: null };
  const ERROR_INSERT_RESPONSE = { data: null, error: { message: 'insert failed' } };

  const currentInsertResponse = { value: SUCCESS_INSERT_RESPONSE };

  // Builder functions will be vi.fn to allow assertions
  const insert = vi.fn((payload: unknown) => builderProxy);
  const select = vi.fn(() => builderProxy);
  const eq = vi.fn(() => builderProxy);
  const gte = vi.fn(() => builderProxy);
  const lte = vi.fn(() => builderProxy);
  const inFn = vi.fn(() => builderProxy);
  const order = vi.fn(() => builderProxy);
  const limit = vi.fn(() => builderProxy);
  const update = vi.fn(() => builderProxy);
  const deleteFn = vi.fn(() => builderProxy);
  const single = vi.fn(() => builderProxy);
  const maybeSingle = vi.fn(() => builderProxy);

  const then = vi.fn((onFulfilled: unknown, onRejected?: unknown) => {
    return Promise.resolve(currentInsertResponse.value).then(onFulfilled as any, onRejected as any);
  });
  const catchFn = vi.fn((onRejected: unknown) => {
    return Promise.resolve(currentInsertResponse.value).catch(onRejected as any);
  });

  const builderProxy: Record<string, unknown> = {
    insert,
    select,
    eq,
    gte,
    lte,
    in: inFn,
    order,
    limit,
    update,
    delete: deleteFn,
    single,
    maybeSingle,
    then,
    catch: catchFn,
  };

  const mockFrom = vi.fn(() => builderProxy);

  const debugMock = {
    log: vi.fn(),
    error: vi.fn(),
  };

  return {
    USER,
    SUCCESS_INSERT_RESPONSE,
    ERROR_INSERT_RESPONSE,
    currentInsertResponse,
    mockFrom,
    builder: builderProxy,
    debugMock,
  };
});

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

// Mock debug module
vi.mock('@/lib/debug', () => {
  return {
    debug: debugMock,
  };
});

// Mock useAuth hook to return a stable authenticated user
vi.mock('@/hooks/shared/useAuth', () => {
  return {
    useAuth: () => ({ user: USER, session: { user: USER }, isLoading: false }),
  };
});

import useJarvisDriftDetection from './useJarvisDriftDetection';

describe('useJarvisDriftDetection', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    // Reset builder response to success by default
    currentInsertResponse.value = SUCCESS_INSERT_RESPONSE;

    // Clear mocks
    mockFrom.mockClear();
    (builder.insert as any)?.mockClear?.();
    (builder.then as any)?.mockClear?.();
    (builder.select as any)?.mockClear?.();
    (builder.eq as any)?.mockClear?.();
    debugMock.log.mockClear();
    debugMock.error.mockClear();
  });

  it('tracks generated content and reports no drift when final content is identical', async () => {
    const { result } = renderHook(() => useJarvisDriftDetection(), { wrapper });

    act(() => {
      result.current.trackGeneratedContent('id-1', 'email', 'Hello World!', { source: 'test' });
    });

    expect(result.current.isTracking('id-1')).toBe(true);
    expect(result.current.getTrackingCount()).toBe(1);
    expect(debugMock.log).toHaveBeenCalledWith('[DriftDetection] Tracking content: id-1 (email)');

    let driftResult: unknown;
    await act(async () => {
      // identical final content
      driftResult = await result.current.recordFinalContent('id-1', 'Hello World!');
    });

    expect(driftResult).toBeDefined();
    const dr = driftResult as { driftPercentage: number; isSignificant: boolean; feedbackRecorded: boolean };
    expect(typeof dr.driftPercentage).toBe('number');
    expect(dr.driftPercentage).toBe(0);
    expect(dr.isSignificant).toBe(false);
    expect(dr.feedbackRecorded).toBe(false);

    expect(mockFrom).not.toHaveBeenCalled();

    expect(result.current.isTracking('id-1')).toBe(false);
    expect(result.current.getTrackingCount()).toBe(0);
  });

  it('calculates significant drift and records feedback when supabase insert succeeds', async () => {
    currentInsertResponse.value = SUCCESS_INSERT_RESPONSE;

    const { result } = renderHook(() => useJarvisDriftDetection(), { wrapper });

    act(() => {
      result.current.trackGeneratedContent('id-2', 'email', 'Short content to be replaced', { tag: 'x' });
    });

    expect(result.current.isTracking('id-2')).toBe(true);

    let driftResult: unknown;
    await act(async () => {
      driftResult = await result.current.recordFinalContent(
        'id-2',
        'Completely different final content that rewrites original text'
      );
    });

    const dr = driftResult as { driftPercentage: number; isSignificant: boolean; feedbackRecorded: boolean };
    expect(typeof dr.driftPercentage).toBe('number');
    expect(dr.isSignificant).toBe(true);
    expect(dr.feedbackRecorded).toBe(true);

    expect(mockFrom).toHaveBeenCalledWith('jarvis_learning_data');
    // insert should have been called at least once
    expect((builder.insert as any).mock.calls.length).toBeGreaterThanOrEqual(1);
    const insertArg = (builder.insert as any).mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.user_id).toBe(USER.id);
    expect(insertArg.action_type).toBe('email_correction');
    expect(typeof insertArg.feedback_score).toBe('number');
    expect((insertArg.metadata as Record<string, unknown>).drift_percentage).toBe(dr.driftPercentage);

    expect(debugMock.log).toHaveBeenCalled();
    expect(result.current.isTracking('id-2')).toBe(false);
  });

  it('handles supabase insert error gracefully and does not mark feedbackRecorded', async () => {
    currentInsertResponse.value = ERROR_INSERT_RESPONSE;

    const { result } = renderHook(() => useJarvisDriftDetection(), { wrapper });

    act(() => {
      result.current.trackGeneratedContent(
        'id-3',
        'response',
        'Generated answer that will be heavily modified',
        { flow: 'unit' }
      );
    });

    let driftResult: unknown;
    await act(async () => {
      driftResult = await result.current.recordFinalContent(
        'id-3',
        'A totally rewritten answer that differs a lot'
      );
    });

    const dr = driftResult as { driftPercentage: number; isSignificant: boolean; feedbackRecorded: boolean };
    expect(dr.isSignificant).toBe(true);
    expect(dr.feedbackRecorded).toBe(false);

    expect(mockFrom).toHaveBeenCalledWith('jarvis_learning_data');
    expect((builder.insert as any).mock.calls.length).toBeGreaterThanOrEqual(1);

    expect(debugMock.error).toHaveBeenCalled();
    const errorCalls = (debugMock.error.mock.calls as unknown[][]).flat();
    const hasFailureMessage = errorCalls.some((arg) =>
      typeof arg === 'string' && arg.includes('[DriftDetection] Failed to record feedback:')
    );
    expect(hasFailureMessage).toBe(true);

    expect(result.current.isTracking('id-3')).toBe(false);
  });

  it('allows cancelTracking to remove tracked item', () => {
    const { result } = renderHook(() => useJarvisDriftDetection(), { wrapper });

    act(() => {
      result.current.trackGeneratedContent('id-4', 'task', 'Task content', undefined);
    });

    expect(result.current.isTracking('id-4')).toBe(true);
    act(() => {
      result.current.cancelTracking('id-4');
    });
    expect(result.current.isTracking('id-4')).toBe(false);
    expect(debugMock.log).toHaveBeenCalledWith('[DriftDetection] Tracking cancelled: id-4');
  });
});