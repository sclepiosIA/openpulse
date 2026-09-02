/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePulseUnreadCount, usePulseTotalUnread, pulseUnreadKeys } from './usePulseUnreadCount';

const {
  PROFILE,
  RPC_ROWS,
  EMPTY_RESULT,
  mockRpc,
  mockInvalidateQueries,
  mockUseCurrentProfile,
  mockWarn,
} = vi.hoisted(() => ({
  PROFILE: { id: 'profile-1' },
  RPC_ROWS: [
    { conversation_id: 'conv-1', unread_count: 2 },
    { conversation_id: 'conv-2', unread_count: 3 },
  ],
  EMPTY_RESULT: { total: 0, byConversation: {} as Record<string, number> },
  mockRpc: vi.fn(),
  mockInvalidateQueries: vi.fn(),
  mockUseCurrentProfile: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
    from: vi.fn(),
  },
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: mockUseCurrentProfile,
}));

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    frequent: {
      staleTime: 0,
    },
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    warn: mockWarn,
  },
}));

describe('usePulseUnreadCount', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    mockInvalidateQueries.mockImplementation((filters?: { queryKey?: readonly string[] }) =>
      Promise.resolve(filters),
    );
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(mockInvalidateQueries);

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    return { wrapper, queryClient };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCurrentProfile.mockReturnValue({
      data: PROFILE,
      isLoading: false,
    });
  });

  it('gère le chargement puis calcule le total et le détail par conversation', async () => {
    let resolveRpc: ((value: { data: typeof RPC_ROWS; error: null }) => void) | undefined;

    mockRpc.mockReturnValue(
      new Promise<{ data: typeof RPC_ROWS; error: null }>((resolve) => {
        resolveRpc = resolve;
      }),
    );

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePulseUnreadCount(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith('count_pulse_unread', { p_user_id: PROFILE.id });

    await act(async () => {
      if (resolveRpc) {
        resolveRpc({ data: RPC_ROWS, error: null });
      }
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      total: 5,
      byConversation: {
        'conv-1': 2,
        'conv-2': 3,
      },
    });
    expect(result.current.data?.total).toBe(5);
    expect(result.current.data?.byConversation['conv-1']).toBe(2);
    expect(result.current.data?.byConversation['conv-2']).toBe(3);
  });

  it('retourne 0 et un mapping vide quand la rpc renvoie une erreur Supabase', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'x', code: 'ERR' },
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePulseUnreadCount(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(EMPTY_RESULT);
    expect(mockWarn).toHaveBeenCalledWith('[Pulse] Unread count fetch failed:', 'x');
  });

  it('retourne 0 sans log spécifique pour le code PGRST116', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'not found', code: 'PGRST116' },
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePulseUnreadCount(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(EMPTY_RESULT);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('retourne 0 et journalise en cas d’exception réseau', async () => {
    const networkError = new Error('network down');
    mockRpc.mockRejectedValue(networkError);

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePulseUnreadCount(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(EMPTY_RESULT);
    expect(mockWarn).toHaveBeenCalledWith('[Pulse] Network error fetching unread:', networkError);
  });

  it('n’exécute pas la requête tant que le profil charge', async () => {
    mockUseCurrentProfile.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePulseUnreadCount(), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('invalidate invalide la clé total quand un profil existe', async () => {
    mockRpc.mockResolvedValue({
      data: RPC_ROWS,
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePulseUnreadCount(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await act(async () => {
      result.current.invalidate();
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: pulseUnreadKeys.total });
  });

  it('usePulseTotalUnread retourne le total agrégé', async () => {
    mockRpc.mockResolvedValue({
      data: RPC_ROWS,
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePulseTotalUnread(), { wrapper });

    expect(result.current).toBe(0);

    await waitFor(() => {
      expect(result.current).toBe(5);
    });
  });
});