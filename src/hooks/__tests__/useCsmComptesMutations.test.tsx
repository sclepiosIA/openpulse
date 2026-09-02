import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { supabaseFromSpy, toastErrorSpy, toastSuccessSpy, createRlsDenyBuilder } =
  vi.hoisted(() => {
    const createRlsDenyBuilder = () => {
      const response = {
        data: null,
        error: { message: 'RLS: not allowed' },
      };

      const builder: Record<string, any> = {};

      const chainableMethods = [
        'select',
        'update',
        'delete',
        'insert',
        'upsert',
        'eq',
        'neq',
        'match',
        'in',
        'is',
        'order',
        'limit',
        'range',
        'single',
        'maybeSingle',
        'returns',
        'throwOnError',
      ];

      chainableMethods.forEach((method) => {
        builder[method] = vi.fn(() => builder);
      });

      builder.then = (onFulfilled?: any, onRejected?: any) =>
        Promise.resolve(response).then(onFulfilled, onRejected);
      builder.catch = (onRejected?: any) => Promise.resolve(response).catch(onRejected);
      builder.finally = (onFinally?: any) => Promise.resolve(response).finally(onFinally);

      return builder;
    };

    return {
      supabaseFromSpy: vi.fn(),
      toastErrorSpy: vi.fn(),
      toastSuccessSpy: vi.fn(),
      createRlsDenyBuilder,
    };
  });

vi.mock('@/lib/supabaseBrowser', () => {
  supabaseFromSpy.mockImplementation(() => createRlsDenyBuilder());

  return {
    supabase: {
      from: supabaseFromSpy,
    },
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessSpy,
    error: toastErrorSpy,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message ?? String(e),
}));

import { useCsmComptesMutations } from '../csm/useCsmComptesMutations';

const createWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useCsmComptesMutations (error paths)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseFromSpy.mockImplementation(() => createRlsDenyBuilder());
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals?.();
    vi.unstubAllEnvs?.();
  });

  it('shows sanitized error toast on update RLS deny', async () => {
    const { result } = renderHook(() => useCsmComptesMutations(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handleUpdate('etab-1', 'nom', 'X');
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalled();
      expect(String(toastErrorSpy.mock.calls.at(-1)?.[0])).toMatch(/not allowed/);
    });

    expect(toastSuccessSpy).not.toHaveBeenCalled();
  }, 10000);

  it('shows sanitized error toast on delete RLS deny', async () => {
    const { result } = renderHook(() => useCsmComptesMutations(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handleDelete('etab-1', 'Compte X');
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalled();
      expect(String(toastErrorSpy.mock.calls.at(-1)?.[0])).toMatch(/not allowed/);
    });

    expect(toastSuccessSpy).not.toHaveBeenCalled();
  }, 10000);
});