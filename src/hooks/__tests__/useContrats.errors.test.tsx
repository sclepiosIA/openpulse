import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { toastErrorSpy, toastSuccessSpy } = vi.hoisted(() => ({
  toastErrorSpy: vi.fn(),
  toastSuccessSpy: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => {
  const createErrorQueryBuilder = () => {
    const response = Promise.resolve({
      data: null,
      error: { message: 'RLS: contrats forbidden' },
    });

    const builder: any = {};
    const chain = () => builder;

    [
      'select',
      'single',
      'maybeSingle',
      'insert',
      'update',
      'upsert',
      'delete',
      'eq',
      'neq',
      'match',
      'is',
      'in',
      'gte',
      'lte',
      'gt',
      'lt',
      'filter',
      'order',
      'limit',
      'range',
      'returns',
      'throwOnError',
    ].forEach((method) => {
      builder[method] = chain;
    });

    builder.then = response.then.bind(response);
    builder.catch = response.catch.bind(response);
    builder.finally = response.finally.bind(response);

    return builder;
  };

  const supabase = {
    from: () => createErrorQueryBuilder(),
  };

  return {
    supabase,
    default: supabase,
  };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('sonner', () => ({
  toast: { error: toastErrorSpy, success: toastSuccessSpy },
}));

import {
  useCreateContrat,
  useUpdateContrat,
  useDeleteContrat,
} from '../contracts/useContrats';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

const createWrapper = () => {
  const queryClient = createQueryClient();

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
};

const waitForToastError = async () => {
  await waitFor(() => expect(toastErrorSpy).toHaveBeenCalledTimes(1), { timeout: 5000 });
};

describe('useContrats (error paths)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals?.();
    vi.unstubAllEnvs?.();
  });

  it('useCreateContrat — toast.error sur RLS deny', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateContrat(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ titre: 'C1' } as any)).rejects.toBeTruthy();
    });

    await waitForToastError();
    expect(toastSuccessSpy).not.toHaveBeenCalled();
  });

  it('useUpdateContrat — toast.error sur RLS deny', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateContrat(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'c1', titre: 'C1' } as any)).rejects.toBeTruthy();
    });

    await waitForToastError();
    expect(toastSuccessSpy).not.toHaveBeenCalled();
  });

  it('useDeleteContrat — toast.error sur RLS deny', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteContrat(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('c1')).rejects.toBeTruthy();
    });

    await waitForToastError();
    expect(toastSuccessSpy).not.toHaveBeenCalled();
  });
});