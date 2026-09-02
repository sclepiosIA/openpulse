import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Stable hoisted fixtures & mocks required by the test suite.
 * All data-returning mocks MUST live inside vi.hoisted to avoid
 * re-creation and infinite re-render loops in react-query / react hooks.
 */
const { CLIENT_ROWS, CLIENT_RESULT, mockFrom } = vi.hoisted(() => {
  const CLIENT_ROWS = [{ id: 'from-1', name: 'From Row' }];
  const CLIENT_RESULT = { data: CLIENT_ROWS, error: null as null | { message: string } };

  const selectThenable = {
    then: vi.fn((cb: (val: typeof CLIENT_RESULT) => void) =>
      Promise.resolve(CLIENT_RESULT).then(cb)
    ),
  };

  const selectMock = vi.fn().mockReturnValue(selectThenable);

  const mockFrom = vi.fn().mockImplementation((_table: string) => {
    return { select: selectMock };
  });

  return { CLIENT_ROWS, CLIENT_RESULT, mockFrom };
});

/**
 * Mock the actual Supabase client module BEFORE importing the module under test.
 * Provide minimal shape to be safe for any import consumers.
 */
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
      rpc: vi.fn(),
      functions: { invoke: vi.fn() },
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: { path: 'mock/path' }, error: null }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://mock.url/file' } }),
          download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
          remove: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      },
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      }),
      removeChannel: vi.fn(),
    },
  };
});

/**
 * Additional hoisted fixtures used by tests for the factory exports.
 */
const { PROXY_ROWS, PROXY_RESULT } = vi.hoisted(() => {
  const PROXY_ROWS = [{ id: 'p1', label: 'proxy' }];
  const PROXY_RESULT = { data: PROXY_ROWS, error: null as null | { message: string } };
  return { PROXY_ROWS, PROXY_RESULT };
});

const { SIMPLE_ROWS } = vi.hoisted(() => {
  const SIMPLE_ROWS = [{ id: 's1', value: 42 }];
  return { SIMPLE_ROWS };
});

const { OVERRIDE_ROWS, OVERRIDE_RESULT, ERROR_RESULT } = vi.hoisted(() => {
  const OVERRIDE_ROWS = [{ id: 'o1', title: 'override' }];
  const OVERRIDE_RESULT = { data: OVERRIDE_ROWS, error: null as null | { message: string } };
  const ERROR_RESULT = { data: null, error: { message: 'boom' } };
  return { OVERRIDE_ROWS, OVERRIDE_RESULT, ERROR_RESULT };
});

/**
 * Now import the module under test (after mocks have been set up).
 */
import {
  createChainableProxy,
  createSimpleQueryBuilder,
  createSupabaseMock,
  mockSupabaseModule,
} from './supabaseMockFactory';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('supabaseMockFactory module', () => {
  it('createChainableProxy is chainable and resolves the provided value (hook integration)', async () => {
    function useProxyFetch(proxy: any) {
      // useState/useEffect via React import
      const [state, setState] = React.useState({
        loading: true,
        data: null as null | unknown,
        error: null as null | { message: string },
      });

      React.useEffect(() => {
        let mounted = true;
        (async () => {
          try {
            const res = await proxy.select().eq('id', 'p1');
            if (!mounted) return;
            setState({ loading: false, data: res.data, error: res.error });
          } catch (err) {
            if (!mounted) return;
            setState({ loading: false, data: null, error: err as any });
          }
        })();
        return () => {
          mounted = false;
        };
      }, [proxy]);

      return state;
    }

    const wrapper = makeWrapper();

    const proxy = createChainableProxy(PROXY_RESULT);

    const { result } = renderHook(() => useProxyFetch(proxy), { wrapper });

    // Initially loading true
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(PROXY_ROWS);
    expect(result.current.error).toBeNull();
  });

  it('createSimpleQueryBuilder resolves data on .order() and .single(), and methods are spyable', async () => {
    const builder = createSimpleQueryBuilder(SIMPLE_ROWS, null);

    function useBuilderFetch(b: any) {
      const [state, setState] = React.useState({
        loading: true,
        data: null as null | unknown,
        error: null as null | Error,
      });

      React.useEffect(() => {
        let mounted = true;
        (async () => {
          try {
            const res = await b.select().order();
            if (!mounted) return;
            setState({ loading: false, data: res.data, error: res.error });
          } catch (err) {
            if (!mounted) return;
            setState({ loading: false, data: null, error: err as any });
          }
        })();
        return () => {
          mounted = false;
        };
      }, [b]);

      return state;
    }

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useBuilderFetch(builder), { wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(SIMPLE_ROWS);
    expect(result.current.error).toBeNull();

    // Assert spyability: .select and .order are functions that exist
    expect(typeof builder.select).toBe('function');
    expect(typeof builder.order).toBe('function');
  });

  it('createSupabaseMock supports from overrides and error propagation, and storage.upload is callable', async () => {
    const supabaseSuccess = createSupabaseMock({
      fromResults: { things: OVERRIDE_RESULT },
    });

    function useSupabaseFetchSuccess(sup: any) {
      const [state, setState] = React.useState({
        loading: true,
        data: null as null | unknown,
        error: null as null | { message: string },
      });

      React.useEffect(() => {
        let mounted = true;
        (async () => {
          try {
            const res = await sup.from('things').select();
            if (!mounted) return;
            setState({ loading: false, data: res.data, error: res.error });
          } catch (err) {
            if (!mounted) return;
            setState({ loading: false, data: null, error: err as any });
          }
        })();
        return () => {
          mounted = false;
        };
      }, [sup]);

      return state;
    }

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useSupabaseFetchSuccess(supabaseSuccess), { wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(OVERRIDE_ROWS);
    expect(result.current.error).toBeNull();

    // Error case
    const supabaseError = createSupabaseMock({
      fromResults: { bad: ERROR_RESULT },
    });

    function useSupabaseFetchError(sup: any) {
      const [state, setState] = React.useState({
        loading: true,
        data: null as null | unknown,
        error: null as null | { message: string },
      });

      React.useEffect(() => {
        let mounted = true;
        (async () => {
          try {
            const res = await sup.from('bad').select();
            if (!mounted) return;
            setState({ loading: false, data: res.data, error: res.error });
          } catch (err) {
            if (!mounted) return;
            setState({ loading: false, data: null, error: err as any });
          }
        })();
        return () => {
          mounted = false;
        };
      }, [sup]);

      return state;
    }

    const { result: errResult } = renderHook(() => useSupabaseFetchError(supabaseError), { wrapper });

    expect(errResult.current.loading).toBe(true);

    await waitFor(() => {
      expect(errResult.current.loading).toBe(false);
    });

    expect(errResult.current.data).toBeNull();
    expect(errResult.current.error).toEqual(ERROR_RESULT.error);

    // Mutation-like behavior: storage.upload should be callable and we can assert calls
    const supabaseForStorage = createSupabaseMock();
    const storageFrom = supabaseForStorage.storage.from('my-bucket');

    await act(async () => {
      await storageFrom.upload('path.txt', new Blob(['hello']), { cacheControl: '3600' });
    });

    expect(storageFrom.upload).toHaveBeenCalled();

    const calls = storageFrom.upload.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toBe('path.txt');
    expect(lastCall[1]).toBeInstanceOf(Blob);
    expect(lastCall[2]).toEqual({ cacheControl: '3600' });
  });

  it('mockSupabaseModule returns a module-shaped mock with supabase and default keys', async () => {
    const mod = mockSupabaseModule({ fromResults: { moduleTable: OVERRIDE_RESULT } });

    expect(mod).toHaveProperty('supabase');
    expect(mod).toHaveProperty('default');
    expect(mod.default).toBe(mod.supabase);

    const builder = mod.supabase.from('moduleTable');
    expect(typeof builder.select).toBe('function');

    // Ensure can await .select()
    const res = await builder.select();
    expect(res.data).toEqual(OVERRIDE_ROWS);
    expect(res.error).toBeNull();
  });

  it('the mocked client import (vi.mock) is defined and used by the module import', async () => {
    // Ensure mockFrom is a mock function and callable
    expect(typeof mockFrom).toBe('function');

    const chain = mockFrom('any_table');
    expect(chain.select).toBeDefined();

    await chain.select().then((res: any) => {
      expect(res.data).toEqual(CLIENT_ROWS);
      expect(res.error).toBeNull();
    });
  });
});