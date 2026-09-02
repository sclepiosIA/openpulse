import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { toastErrorSpy } = vi.hoisted(() => ({
  toastErrorSpy: vi.fn(),
}));

vi.mock('@/lib/supabaseBrowser', async () => {
  const { mockSupabaseModule } = await vi.importActual<
    typeof import('@/test-utils/supabaseMockFactory')
  >('@/test-utils/supabaseMockFactory');

  return mockSupabaseModule({
    fromResults: {
      contacts: { data: null, error: { message: 'RLS: contacts forbidden' } },
    },
  });
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: toastErrorSpy,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message ?? String(e),
}));

import { useCsmContactsMutations } from '../csm/useCsmContactsMutations';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: { retry: false },
          queries: { retry: false },
        },
      }),
  );

  return React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useCsmContactsMutations (error paths)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals?.();
    vi.unstubAllEnvs?.();
  });

  it('shows sanitized error toast on add deny', async () => {
    const { result } = renderHook(() => useCsmContactsMutations(), { wrapper });

    await act(async () => {
      await result.current.handleAdd('etab-1');
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalled();
      expect(toastErrorSpy.mock.calls.at(-1)?.[0]).toMatch(/forbidden/);
    });
  });

  it('shows sanitized error toast on delete deny', async () => {
    const { result } = renderHook(() => useCsmContactsMutations(), { wrapper });

    await act(async () => {
      await result.current.handleDelete('c-1');
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalled();
      expect(toastErrorSpy.mock.calls.at(-1)?.[0]).toMatch(/forbidden/);
    });
  });
});