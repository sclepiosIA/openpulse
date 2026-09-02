import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

const {
  PROFILE,
  useCurrentProfileMock,
  debugErrorMock,
  mockFrom,
  builderState,
  lastBuilderRef,
} = vi.hoisted(() => {
  const PROFILE: { id: string } = { id: 'p1' };

  const useCurrentProfileMock = vi.fn(() => ({ data: PROFILE }));

  const debugErrorMock = vi.fn();

  type SupabaseResponse = { count: number | null; error: { message: string } | null };

  const builderState: { response: SupabaseResponse } = {
    response: { count: 3, error: null },
  };

  const lastBuilderRef: { current: null | Record<string, unknown> } = { current: null };

  const createBuilder = () => {
    const builder: Record<string, unknown> = {};

    const chain = () => builder;

    const thenableThen = (onFulfilled?: ((value: SupabaseResponse) => unknown) | null) =>
      Promise.resolve(builderState.response).then(onFulfilled ?? undefined);

    const thenableCatch = (onRejected?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve(builderState.response).catch(onRejected ?? undefined);

    Object.assign(builder, {
      select: vi.fn(chain),
      eq: vi.fn(chain),
      gte: vi.fn(chain),
      lte: vi.fn(chain),
      in: vi.fn(chain),
      order: vi.fn(chain),
      limit: vi.fn(chain),
      insert: vi.fn(chain),
      update: vi.fn(chain),
      delete: vi.fn(chain),
      single: vi.fn(() => Promise.resolve(builderState.response)),
      maybeSingle: vi.fn(() => Promise.resolve(builderState.response)),
      then: vi.fn(thenableThen),
      catch: vi.fn(thenableCatch),
    });

    lastBuilderRef.current = builder;
    return builder;
  };

  const mockFrom = vi.fn(() => createBuilder());

  return {
    PROFILE,
    useCurrentProfileMock,
    debugErrorMock,
    mockFrom,
    builderState,
    lastBuilderRef,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: useCurrentProfileMock,
}));

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    standard: { staleTime: 2 * 60 * 1000 },
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { useTodosUnreadCount } from './useTodosUnreadCount';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const Wrapper = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { Wrapper, queryClient };
}

describe('useTodosUnreadCount', () => {
  it('loading -> succès : retourne le count et construit la requête supabase', async () => {
    builderState.response = { count: 7, error: null };
    useCurrentProfileMock.mockImplementation(() => ({ data: PROFILE }));
    mockFrom.mockClear();

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTodosUnreadCount(), { wrapper: Wrapper });

    expect(result.current).toBe(0);

    await waitFor(() => {
      expect(result.current).toBe(7);
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('personal_todos');

    const builder = lastBuilderRef.current as {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
    } | null;

    expect(builder).not.toBeNull();
    expect(builder?.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(builder?.eq).toHaveBeenCalledWith('user_id', 'p1');
    expect(builder?.eq).toHaveBeenCalledWith('is_done', false);
  });

  it("si pas de profile.id, la query est désactivée et retourne 0 sans appeler supabase", async () => {
    useCurrentProfileMock.mockImplementation(() => ({ data: null }));
    mockFrom.mockClear();

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTodosUnreadCount(), { wrapper: Wrapper });

    expect(result.current).toBe(0);

    await waitFor(() => {
      expect(result.current).toBe(0);
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("en cas d'erreur supabase, log l'erreur et retourne 0", async () => {
    builderState.response = { count: null, error: { message: 'x' } };
    useCurrentProfileMock.mockImplementation(() => ({ data: PROFILE }));
    debugErrorMock.mockClear();
    mockFrom.mockClear();

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTodosUnreadCount(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current).toBe(0);
    });

    await waitFor(() => {
      expect(debugErrorMock).toHaveBeenCalledTimes(1);
    });

    const call = debugErrorMock.mock.calls[0];
    expect(call[0]).toBe('[useTodosUnreadCount] Error:');
    expect(call[1]).toEqual({ message: 'x' });
  });
});