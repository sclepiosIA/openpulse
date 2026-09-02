import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { SUCCESS_PAYLOAD, ERROR_PAYLOAD, mockInvoke } = vi.hoisted(() => {
  const results = [
    {
      email: 'alice@example.com',
      status: 'completed',
      profileId: 'p-123'
    }
  ];
  return {
    SUCCESS_PAYLOAD: { data: { success: true, results }, error: null },
    ERROR_PAYLOAD: { data: null, error: { message: 'setup failed' } },
    mockInvoke: vi.fn().mockResolvedValue({ data: { success: true, results }, error: null })
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke
    }
  }
}));

import { setupTeamMembers } from './setupTeamMembers';

describe('setupTeamMembers service', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  it('calls the Supabase edge function and returns typed data on success', async () => {
    mockInvoke.mockResolvedValueOnce(SUCCESS_PAYLOAD);

    const result = await setupTeamMembers();

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('setup-team-members', { body: {} });

    expect(result.success).toBe(true);
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toEqual({
      email: 'alice@example.com',
      status: 'completed',
      profileId: 'p-123'
    });
  });

  it('throws the Supabase error when the edge function returns an error payload', async () => {
    mockInvoke.mockResolvedValueOnce(ERROR_PAYLOAD);

    await expect(setupTeamMembers()).rejects.toEqual(ERROR_PAYLOAD.error);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('setup-team-members', { body: {} });
  });

  it('integration via a simple hook: shows loading then data on success', async () => {
    mockInvoke.mockResolvedValueOnce(SUCCESS_PAYLOAD);

    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 }
      }
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    function useCaller() {
      const [state, setState] = React.useState({
        isLoading: true,
        data: null as (Awaited<ReturnType<typeof setupTeamMembers>> | null),
        error: null as unknown
      });

      React.useEffect(() => {
        let mounted = true;
        (async () => {
          try {
            const r = await setupTeamMembers();
            if (mounted) {
              setState({ isLoading: false, data: r, error: null });
            }
          } catch (err) {
            if (mounted) {
              setState({ isLoading: false, data: null, error: err });
            }
          }
        })();
        return () => {
          mounted = false;
        };
      }, []);

      return state;
    }

    const { result } = renderHook(() => useCaller(), { wrapper });

    // initial loading state
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    // wait for async effect to finish
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.success).toBe(true);
    expect(result.current.data?.results[0]).toMatchObject({
      email: 'alice@example.com',
      status: 'completed',
      profileId: 'p-123'
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('setup-team-members', { body: {} });
  });

  it('integration via a simple hook: shows loading then error on edge-function error', async () => {
    mockInvoke.mockResolvedValueOnce(ERROR_PAYLOAD);

    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 }
      }
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    function useCaller() {
      const [state, setState] = React.useState({
        isLoading: true,
        data: null as (Awaited<ReturnType<typeof setupTeamMembers>> | null),
        error: null as unknown
      });

      React.useEffect(() => {
        let mounted = true;
        (async () => {
          try {
            const r = await setupTeamMembers();
            if (mounted) {
              setState({ isLoading: false, data: r, error: null });
            }
          } catch (err) {
            if (mounted) {
              setState({ isLoading: false, data: null, error: err });
            }
          }
        })();
        return () => {
          mounted = false;
        };
      }, []);

      return state;
    }

    const { result } = renderHook(() => useCaller(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual(ERROR_PAYLOAD.error);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('setup-team-members', { body: {} });
  });
});