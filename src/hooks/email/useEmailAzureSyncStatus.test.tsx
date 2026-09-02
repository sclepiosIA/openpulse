import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const mockIsAzureEnabled = vi.fn();
const mockGetBackend = vi.fn();
const mockFetchStatus = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/lib/emailBackend', () => ({
  isAzureEmailBackendEnabled: () => mockIsAzureEnabled(),
  getEmailBackend: () => mockGetBackend(),
}));

vi.mock('@/services/email/emailAzureApi', () => ({
  fetchEmailAzureSyncStatus: (...args: unknown[]) => mockFetchStatus(...args),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}));

import { useEmailAzureSyncStatus } from './useEmailAzureSyncStatus';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  mockIsAzureEnabled.mockReset();
  mockGetBackend.mockReset();
  mockFetchStatus.mockReset();
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok-1' } } });
});

describe('useEmailAzureSyncStatus', () => {
  it("mode supabase : query désactivée, AUCUN appel à l'API Azure", async () => {
    mockIsAzureEnabled.mockReturnValue(false);
    mockGetBackend.mockReturnValue('supabase');

    const { result } = renderHook(() => useEmailAzureSyncStatus(), {
      wrapper: createWrapper(),
    });

    expect(result.current.azureEnabled).toBe(false);
    expect(result.current.backend).toBe('supabase');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toBeNull();
    // Laisser un tick : la query désactivée ne doit jamais déclencher le fetch.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockFetchStatus).not.toHaveBeenCalled();
  });

  it('mode hybrid : interroge le service avec le token de session', async () => {
    mockIsAzureEnabled.mockReturnValue(true);
    mockGetBackend.mockReturnValue('hybrid');
    mockFetchStatus.mockResolvedValue({ state: 'unconfigured' });

    const { result } = renderHook(() => useEmailAzureSyncStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.result).toEqual({ state: 'unconfigured' });
    });
    expect(result.current.azureEnabled).toBe(true);
    expect(result.current.backend).toBe('hybrid');
    expect(mockFetchStatus).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'tok-1' }),
    );
  });

  it('mode azure : propage le résultat ok du service', async () => {
    mockIsAzureEnabled.mockReturnValue(true);
    mockGetBackend.mockReturnValue('azure');
    const okResult = {
      state: 'ok',
      data: {
        backend: 'azure',
        generated_at: '2026-07-07T12:00:00Z',
        accounts: [],
        queue: { ai_pending: 0, unclassified: 0 },
      },
    };
    mockFetchStatus.mockResolvedValue(okResult);

    const { result } = renderHook(() => useEmailAzureSyncStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.result).toEqual(okResult);
    });
  });

  it('session absente : appelle le service avec accessToken null (pas de crash)', async () => {
    mockIsAzureEnabled.mockReturnValue(true);
    mockGetBackend.mockReturnValue('hybrid');
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockFetchStatus.mockResolvedValue({ state: 'error', message: 'HTTP 401' });

    const { result } = renderHook(() => useEmailAzureSyncStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.result).toEqual({ state: 'error', message: 'HTTP 401' });
    });
    expect(mockFetchStatus).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: null }),
    );
  });
});
