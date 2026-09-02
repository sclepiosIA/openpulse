// @vitest-environment jsdom

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useIsSandboxProfile } from './useIsSandboxProfile';

const {
  PROFILE_TRUE,
  PROFILE_FALSE,
  PROFILE_NULL,
  tableState,
  mockFrom,
  mockSetSandboxFlag,
  builder,
} = vi.hoisted(() => {
  const PROFILE_TRUE = { is_sandbox: true };
  const PROFILE_FALSE = { is_sandbox: false };
  const PROFILE_NULL = null;

  const tableState = {
    profiles: {
      result: { data: PROFILE_FALSE as typeof PROFILE_TRUE | typeof PROFILE_FALSE | null, error: null as { message: string } | null },
      selectArgs: [] as string[],
      eqArgs: [] as Array<[string, string | undefined]>,
    },
  };

  const builder = {
    select: vi.fn((value: string) => {
      tableState.profiles.selectArgs.push(value);
      return builder;
    }),
    eq: vi.fn((column: string, value: string | undefined) => {
      tableState.profiles.eqArgs.push([column, value]);
      return builder;
    }),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => tableState.profiles.result),
    maybeSingle: vi.fn(async () => tableState.profiles.result),
    then: vi.fn((onFulfilled?: (value: typeof tableState.profiles.result) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(tableState.profiles.result).then(onFulfilled, onRejected),
    ),
    catch: vi.fn((onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(tableState.profiles.result).catch(onRejected),
    ),
  };

  const mockFrom = vi.fn((table: string) => {
    if (table === 'profiles') {
      return builder;
    }
    return builder;
  });

  const mockSetSandboxFlag = vi.fn();

  return {
    PROFILE_TRUE,
    PROFILE_FALSE,
    PROFILE_NULL,
    tableState,
    mockFrom,
    mockSetSandboxFlag,
    builder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/sandboxGuard', () => ({
  setSandboxFlag: mockSetSandboxFlag,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: React.PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useIsSandboxProfile', () => {
  beforeEach(() => {
    tableState.profiles.result = { data: PROFILE_FALSE, error: null };
    tableState.profiles.selectArgs = [];
    tableState.profiles.eqArgs = [];

    mockFrom.mockClear();
    mockSetSandboxFlag.mockClear();

    builder.select.mockClear();
    builder.eq.mockClear();
    builder.gte.mockClear();
    builder.lte.mockClear();
    builder.in.mockClear();
    builder.order.mockClear();
    builder.limit.mockClear();
    builder.insert.mockClear();
    builder.update.mockClear();
    builder.delete.mockClear();
    builder.single.mockClear();
    builder.maybeSingle.mockClear();
    builder.then.mockClear();
    builder.catch.mockClear();
  });

  it('retourne false immédiatement et désactive le flag quand userId est absent', async () => {
    const { result } = renderHook(() => useIsSandboxProfile(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(false);

    await waitFor(() => {
      expect(mockSetSandboxFlag).toHaveBeenCalledWith(false);
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(builder.select).not.toHaveBeenCalled();
    expect(builder.eq).not.toHaveBeenCalled();
    expect(builder.maybeSingle).not.toHaveBeenCalled();
  });

  it('garde false pendant le chargement puis passe à true quand le profil est sandbox', async () => {
    let resolveQuery: ((value: { data: typeof PROFILE_TRUE; error: null }) => void) | undefined;

    builder.maybeSingle.mockImplementationOnce(
      () =>
        new Promise<{ data: typeof PROFILE_TRUE; error: null }>((resolve) => {
          resolveQuery = resolve;
        }),
    );

    const { result } = renderHook(() => useIsSandboxProfile('user-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(false);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(builder.select).toHaveBeenCalledWith('is_sandbox');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mockSetSandboxFlag).not.toHaveBeenCalled();

    if (resolveQuery) {
      resolveQuery({ data: PROFILE_TRUE, error: null });
    }

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    expect(mockSetSandboxFlag).toHaveBeenCalledWith(true);
    expect(tableState.profiles.selectArgs).toEqual(['is_sandbox']);
    expect(tableState.profiles.eqArgs).toEqual([['user_id', 'user-1']]);
  });

  it('retourne false et pose le flag à false quand is_sandbox vaut false', async () => {
    tableState.profiles.result = { data: PROFILE_FALSE, error: null };

    const { result } = renderHook(() => useIsSandboxProfile('user-2'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(builder.maybeSingle).toHaveBeenCalledTimes(1);
    });

    expect(result.current).toBe(false);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(builder.select).toHaveBeenCalledWith('is_sandbox');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-2');
    expect(mockSetSandboxFlag).toHaveBeenCalledWith(false);
  });

  it('retourne false quand aucun profil n’est trouvé', async () => {
    tableState.profiles.result = { data: PROFILE_NULL, error: null };

    const { result } = renderHook(() => useIsSandboxProfile('user-3'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(builder.maybeSingle).toHaveBeenCalledTimes(1);
    });

    expect(result.current).toBe(false);
    expect(mockSetSandboxFlag).toHaveBeenCalledWith(false);
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-3');
  });

  it("ignore l'erreur retournée avec data null et conserve false", async () => {
    tableState.profiles.result = { data: PROFILE_NULL, error: { message: 'x' } };

    const { result } = renderHook(() => useIsSandboxProfile('user-4'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(builder.maybeSingle).toHaveBeenCalledTimes(1);
    });

    expect(result.current).toBe(false);
    expect(mockSetSandboxFlag).toHaveBeenCalledWith(false);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(builder.select).toHaveBeenCalledWith('is_sandbox');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-4');
  });

  it('réinitialise à false quand userId passe ensuite à undefined', async () => {
    tableState.profiles.result = { data: PROFILE_TRUE, error: null };

    const { result, rerender } = renderHook(
      ({ userId }: { userId: string | undefined }) => useIsSandboxProfile(userId),
      {
        initialProps: { userId: 'user-5' },
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    expect(mockSetSandboxFlag).toHaveBeenCalledWith(true);

    rerender({ userId: undefined });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });

    expect(mockSetSandboxFlag).toHaveBeenLastCalledWith(false);
  });
});