import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { JarvisHealthState } from './useJarvisCircuitState';
import useJarvisCircuitState from './useJarvisCircuitState';

const { SAMPLE_SUCCESS_DATA, SAMPLE_ERROR_RESULT, SAMPLE_EXCEPTION_ERROR, mockInvoke, debugError, debugLog } = vi.hoisted(() => {
  const SAMPLE_SUCCESS_DATA: JarvisHealthState & Record<string, any> = {
    status: 'HEALTHY',
    lastChecked: null,
    isChecking: false,
    circuits: [], // will be constructed from checks in the hook
    recommendations: ['All systems operational'],
    responseTimeMs: 123,
    degradationMode: 'full',
    checks: {
      azureGpt52: {
        status: 'ok',
        latencyMs: 120,
        message: '',
      },
      azureGpt5: {
        status: 'degraded',
        latencyMs: 350,
        message: 'response slower than expected',
      },
      database: {
        status: 'down',
        latencyMs: null,
        message: 'connection refused',
      },
    },
  };

  const SAMPLE_ERROR_RESULT = {
    data: null,
    error: { message: 'health endpoint returned error' },
  };

  const SAMPLE_EXCEPTION_ERROR = new Error('network failure');

  const mockInvoke = vi.fn();

  const debugError = vi.fn();
  const debugLog = vi.fn();

  return {
    SAMPLE_SUCCESS_DATA,
    SAMPLE_ERROR_RESULT,
    SAMPLE_EXCEPTION_ERROR,
    mockInvoke,
    debugError,
    debugLog,
  };
});

// Mock supabase client used by the hook
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      functions: {
        invoke: mockInvoke,
      },
    },
  };
});

// Mock debug to capture error logs
vi.mock('@/lib/debug', () => {
  return {
    debug: {
      error: debugError,
      log: debugLog,
    },
  };
});

describe('useJarvisCircuitState hook', () => {
  const createClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  const wrapper = (client: QueryClient) => ({ children }: { children?: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('performs initial health check (loading -> success) and exposes derived helpers', async () => {
    // Arrange: make the supabase functions.invoke return a successful health payload
    mockInvoke.mockImplementationOnce(() => Promise.resolve({ data: SAMPLE_SUCCESS_DATA, error: null }));

    const client = createClient();

    // Act: render hook with autoCheck enabled but a very large interval to avoid repeated ticks
    const { result } = renderHook(() => useJarvisCircuitState({ checkIntervalMs: 1000000, autoCheck: true }), {
      wrapper: wrapper(client),
    });

    // Initially, the hook should mark isChecking true (loading)
    expect(result.current.isChecking).toBe(true);

    // Wait for the async check to complete
    await waitFor(() => expect(result.current.isChecking).toBe(false));

    // Assert: business values populated from SAMPLE_SUCCESS_DATA
    expect(result.current.status).toBe('HEALTHY');
    expect(typeof result.current.lastChecked).toBe('object'); // Date instance
    expect(result.current.responseTimeMs).toBe(123);
    // Circuits: should map three checks into circuit entries
    const names = result.current.circuits.map(c => c.name).sort();
    expect(names).toEqual(['azure-gpt5', 'azure-gpt52', 'database'].sort());
    // Specific mapping assertions
    const azure52 = result.current.circuits.find(c => c.name === 'azure-gpt52');
    const azure5 = result.current.circuits.find(c => c.name === 'azure-gpt5');
    const db = result.current.circuits.find(c => c.name === 'database');

    expect(azure52?.status).toBe('CLOSED');
    expect(azure52?.latencyMs).toBe(120);
    expect(azure5?.status).toBe('HALF-OPEN');
    expect(azure5?.lastError).toBe('response slower than expected');
    expect(db?.status).toBe('OPEN');
    expect(db?.lastError).toBe('connection refused');

    // Derived helpers
    expect(result.current.getContextBudget()).toBe(2500); // 'full' -> 2500
    expect(result.current.shouldEnableStreaming()).toBe(true);
    expect(result.current.isCircuitAvailable('azure-gpt52')).toBe(true);
    expect(result.current.isCircuitAvailable('non-existent')).toBe(true);

    // Trigger a manual forceCheck and ensure supabase was called with the correct function name and options
    mockInvoke.mockImplementationOnce(() => Promise.resolve({ data: SAMPLE_SUCCESS_DATA, error: null }));
    await act(async () => {
      await result.current.forceCheck();
    });
    expect(mockInvoke).toHaveBeenCalled();
    // The first arg should be the function identifier
    expect(mockInvoke.mock.calls[mockInvoke.mock.calls.length - 1][0]).toBe('jarvis-health-check');
    // And options should include method: 'GET'
    expect(mockInvoke.mock.calls[mockInvoke.mock.calls.length - 1][1]).toEqual(expect.objectContaining({ method: 'GET' }));
  });

  it('handles a health-check response containing an error object by setting status UNKNOWN and recommendations', async () => {
    // Arrange: return an error-like payload (data null, error provided)
    mockInvoke.mockImplementationOnce(() => Promise.resolve(SAMPLE_ERROR_RESULT));

    const client = createClient();

    const { result } = renderHook(() => useJarvisCircuitState({ checkIntervalMs: 1000000, autoCheck: true }), {
      wrapper: wrapper(client),
    });

    // Loading started
    expect(result.current.isChecking).toBe(true);

    // Wait for completion
    await waitFor(() => expect(result.current.isChecking).toBe(false));

    // Assert: on error result, hook marks status as UNKNOWN and sets recommendations
    expect(result.current.status).toBe('UNKNOWN');
    expect(result.current.recommendations).toContain('Health check failed - status unknown');
    // debug.error should have been called with an informative prefix
    expect(debugError).toHaveBeenCalled();
    const calledWith = debugError.mock.calls[0][0] as string;
    expect(calledWith).toContain('[JarvisCircuitState]');
  });

  it('handles exceptions during health check by setting status OFFLINE and logging', async () => {
    // Arrange: make the invoke throw/reject
    mockInvoke.mockImplementationOnce(() => Promise.reject(SAMPLE_EXCEPTION_ERROR));

    const client = createClient();

    const { result } = renderHook(() => useJarvisCircuitState({ checkIntervalMs: 1000000, autoCheck: true }), {
      wrapper: wrapper(client),
    });

    // Loading started
    expect(result.current.isChecking).toBe(true);

    // Wait for the rejection path to be handled
    await waitFor(() => expect(result.current.isChecking).toBe(false));

    // Assert: offline state and recommendation about inability to reach endpoint
    expect(result.current.status).toBe('OFFLINE');
    expect(result.current.recommendations).toContain('Unable to reach health endpoint');
    expect(debugError).toHaveBeenCalled();
    const debugArgs = debugError.mock.calls[0];
    expect(debugArgs[0]).toContain('[JarvisCircuitState]');
    // The thrown error object should have been forwarded to debug.error as second arg or inside message
    expect(debugError.mock.calls[0].some((arg: unknown) => (arg instanceof Error) || (String(arg).includes('network failure')))).toBe(true);
  });
});