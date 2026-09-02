// @vitest-environment jsdom

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSupportOpenCount } from './useSupportOpenCount';

const {
  COUNT_SUCCESS,
  toastInfo,
  debugError,
  invalidateQueries,
  removeChannel,
  mockFrom,
  mockChannel,
  selectMock,
  inMock,
  subscribeMock,
  channelOnMock,
  thenableSuccess,
  thenableError,
  stableChannel,
} = vi.hoisted(() => {
  const COUNT_SUCCESS = 4;

  const toastInfo = vi.fn();
  const debugError = vi.fn();
  const invalidateQueries = vi.fn();
  const removeChannel = vi.fn();

  const selectMock = vi.fn();
  const inMock = vi.fn();
  const subscribeMock = vi.fn();
  const channelOnMock = vi.fn();
  const mockChannel = vi.fn();
  const mockFrom = vi.fn();

  const thenableSuccess = {
    then: (resolve: (value: { count: number; error: null }) => unknown) =>
      Promise.resolve(resolve({ count: COUNT_SUCCESS, error: null })),
    catch: () => Promise.resolve(),
  };

  const thenableError = {
    then: (resolve: (value: { count: null; error: { message: string } }) => unknown) =>
      Promise.resolve(resolve({ count: null, error: { message: 'x' } })),
    catch: () => Promise.resolve(),
  };

  const builder = {
    select: selectMock,
    in: inMock,
  };

  selectMock.mockReturnValue(builder);
  inMock.mockReturnValue(thenableSuccess);

  const stableChannel = {
    on: channelOnMock,
    subscribe: subscribeMock,
  };

  channelOnMock.mockReturnValue(stableChannel);
  subscribeMock.mockReturnValue(stableChannel);
  mockChannel.mockReturnValue(stableChannel);
  mockFrom.mockReturnValue(builder);

  return {
    COUNT_SUCCESS,
    toastInfo,
    debugError,
    invalidateQueries,
    removeChannel,
    mockFrom,
    mockChannel,
    selectMock,
    inMock,
    subscribeMock,
    channelOnMock,
    thenableSuccess,
    thenableError,
    stableChannel,
  };
});

vi.mock('sonner', () => ({
  toast: {
    info: toastInfo,
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    standard: {},
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const spy = vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters) => {
    invalidateQueries(filters);
    return Promise.resolve();
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  return { Wrapper, queryClient, spy };
}

describe('useSupportOpenCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const builder = {
      select: selectMock,
      in: inMock,
    };

    selectMock.mockReturnValue(builder);
    inMock.mockReturnValue(thenableSuccess);
    mockFrom.mockReturnValue(builder);
    channelOnMock.mockReturnValue(stableChannel);
    subscribeMock.mockReturnValue(stableChannel);
    mockChannel.mockReturnValue(stableChannel);
  });

  it('charge puis retourne le nombre de tickets ouverts et configure la requête Supabase attendue', async () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useSupportOpenCount(), { wrapper: Wrapper });

    expect(result.current).toBe(0);

    await waitFor(() => {
      expect(result.current).toBe(COUNT_SUCCESS);
    });

    expect(mockFrom).toHaveBeenCalledWith('support_tickets');
    expect(selectMock).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(inMock).toHaveBeenCalledWith('statut', [
      'nouveau',
      'en_cours',
      'en_attente_client',
      'en_attente_interne',
    ]);

    expect(mockChannel).toHaveBeenCalledWith(expect.stringMatching(/^support-tickets-badge-/));
    expect(channelOnMock).toHaveBeenNthCalledWith(
      1,
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'support_tickets' },
      expect.any(Function),
    );
    expect(channelOnMock).toHaveBeenNthCalledWith(
      2,
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'support_tickets' },
      expect.any(Function),
    );
    expect(subscribeMock).toHaveBeenCalledTimes(1);
  });

  it('retourne 0 et log l’erreur quand la requête Supabase échoue', async () => {
    inMock.mockReturnValue(thenableError);

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useSupportOpenCount(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('support_tickets');
    });

    await waitFor(() => {
      expect(debugError).toHaveBeenCalledWith(
        '[useSupportOpenCount] Query error (silent fallback to 0):',
        { message: 'x' }
      );
    });

    expect(result.current).toBe(0);
  });

  it('invalide les bonnes queries et affiche une notification lors d’un INSERT realtime, puis nettoie le channel', async () => {
    const { Wrapper } = createWrapper();

    const { unmount } = renderHook(() => useSupportOpenCount(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalledTimes(1);
    });

    const insertHandler = channelOnMock.mock.calls[0][2] as (payload: { new: { sujet?: string; priorite?: string } }) => void;

    await act(async () => {
      insertHandler({ new: { sujet: 'Besoin d’aide', priorite: 'haute' } });
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['support-open-count'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['support-tickets'] });
    expect(toastInfo).toHaveBeenCalledWith('Nouveau ticket support', {
      description: 'Besoin d’aide',
    });

    unmount();

    expect(removeChannel).toHaveBeenCalledWith(stableChannel);
  });

  it('invalide uniquement le compteur lors d’un UPDATE realtime et utilise le message par défaut si le sujet est absent', async () => {
    const { Wrapper } = createWrapper();

    renderHook(() => useSupportOpenCount(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalledTimes(1);
    });

    const insertHandler = channelOnMock.mock.calls[0][2] as (payload: { new: { sujet?: string } | null }) => void;
    const updateHandler = channelOnMock.mock.calls[1][2] as () => void;

    await act(async () => {
      insertHandler({ new: {} });
      updateHandler();
    });

    expect(toastInfo).toHaveBeenCalledWith('Nouveau ticket support', {
      description: "Un nouveau ticket vient d'être créé",
    });

    const openCountInvalidations = invalidateQueries.mock.calls.filter(
      ([arg]) => JSON.stringify(arg) === JSON.stringify({ queryKey: ['support-open-count'] }),
    );
    const supportTicketsInvalidations = invalidateQueries.mock.calls.filter(
      ([arg]) => JSON.stringify(arg) === JSON.stringify({ queryKey: ['support-tickets'] }),
    );

    expect(openCountInvalidations).toHaveLength(2);
    expect(supportTicketsInvalidations).toHaveLength(1);
  });
});