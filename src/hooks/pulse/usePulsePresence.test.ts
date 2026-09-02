import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { usePulsePresence } from './usePulsePresence';

const {
  PROFILE,
  ROWS,
  state,
  mockUpsert,
  mockFrom,
  mockChannel,
  mockRemoveChannel,
  channelObj,
} = vi.hoisted(() => {
  const PROFILE = { id: 'me-1', full_name: 'Moi' };

  const ROWS = [
    {
      id: 'p1',
      user_id: 'u2',
      conversation_id: 'conv-1',
      status: 'active',
      last_seen_at: new Date().toISOString(),
      typing_until: new Date(Date.now() + 600000).toISOString(),
    },
    {
      id: 'p2',
      user_id: 'u3',
      conversation_id: 'conv-1',
      status: 'away',
      last_seen_at: new Date().toISOString(),
      typing_until: null,
    },
  ];

  // File de résultats pour les SELECT (thenable). IMPORTANT : après le premier
  // chargement, les selects suivants renvoient { data: null } afin de casser la
  // boucle effet → setState → effet du hook (sinon `act` ne se stabilise jamais).
  const state: { selectResults: Array<{ data: unknown; error: unknown }> } = {
    selectResults: [],
  };

  const nextSelectResult = (): { data: unknown; error: unknown } => {
    const next = state.selectResults.shift();
    return next ?? { data: null, error: null };
  };

  const mockUpsert = vi.fn(() => Promise.resolve({ data: null, error: null }));

  const makeBuilder = () => {
    const builder: Record<string, unknown> = {};
    const chainMethods = [
      'select',
      'eq',
      'neq',
      'gte',
      'lte',
      'in',
      'order',
      'limit',
      'insert',
      'update',
      'delete',
    ];
    chainMethods.forEach((m) => {
      builder[m] = vi.fn(() => builder);
    });
    builder.upsert = mockUpsert;
    builder.single = vi.fn(() => Promise.resolve(nextSelectResult()));
    builder.maybeSingle = vi.fn(() => Promise.resolve(nextSelectResult()));
    builder.then = (
      onFulfilled?: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown
    ) => Promise.resolve(nextSelectResult()).then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(nextSelectResult()).catch(onRejected);
    return builder;
  };

  const mockFrom = vi.fn(() => makeBuilder());

  const channelObj: Record<string, unknown> = {};
  channelObj.on = vi.fn(() => channelObj);
  channelObj.subscribe = vi.fn(() => channelObj);
  channelObj.unsubscribe = vi.fn();

  const mockChannel = vi.fn(() => channelObj);
  const mockRemoveChannel = vi.fn();

  return {
    PROFILE,
    ROWS,
    state,
    mockUpsert,
    mockFrom,
    mockChannel,
    mockRemoveChannel,
    channelObj,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: PROFILE, isLoading: false }),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('usePulsePresence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Premier select → présences ; selects suivants → null (stoppe la boucle d'effet)
    state.selectResults = [{ data: ROWS, error: null }];
  });

  it('charge les présences initiales et identifie les utilisateurs en train de taper', async () => {
    const { result, unmount } = renderHook(() => usePulsePresence('conv-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.onlineUsers).toHaveLength(2);
    });

    const userIds = result.current.onlineUsers.map((p) => p.user_id);
    expect(userIds).toContain('u2');
    expect(userIds).toContain('u3');

    // u2 a un typing_until dans le futur, u3 non
    expect(result.current.typingUsers).toEqual(['u2']);

    // Le channel realtime est bien créé pour la conversation
    expect(mockChannel).toHaveBeenCalledWith(expect.stringMatching(/^pulse-presence-conv-1-[a-z0-9]+$/));
    expect(channelObj.subscribe).toHaveBeenCalled();

    unmount();
  });

  it('met à jour sa présence au montage (upsert status active)', async () => {
    const { unmount } = renderHook(() => usePulsePresence('conv-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });

    expect(mockFrom).toHaveBeenCalledWith('pulse_presence');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'me-1',
        conversation_id: 'conv-1',
        status: 'active',
        typing_until: null,
      }),
      { onConflict: 'user_id,conversation_id' }
    );

    unmount();
  });

  it('setTyping(true) envoie un upsert avec typing_until non nul', async () => {
    const { result, unmount } = renderHook(() => usePulsePresence('conv-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });
    mockUpsert.mockClear();

    await act(async () => {
      await result.current.setTyping(true);
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'me-1',
        conversation_id: 'conv-1',
        status: 'active',
        typing_until: expect.any(String),
      }),
      { onConflict: 'user_id,conversation_id' }
    );

    unmount();
  });

  it('setTyping(false) envoie un upsert avec typing_until null', async () => {
    const { result, unmount } = renderHook(() => usePulsePresence('conv-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });
    mockUpsert.mockClear();

    await act(async () => {
      await result.current.setTyping(false);
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'me-1',
        conversation_id: 'conv-1',
        typing_until: null,
      }),
      { onConflict: 'user_id,conversation_id' }
    );

    unmount();
  });

  it("updatePresence('offline') contourne le throttle après la mise à jour initiale", async () => {
    const { result, unmount } = renderHook(() => usePulsePresence('conv-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });
    mockUpsert.mockClear();

    await act(async () => {
      await result.current.updatePresence('offline');
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'offline', user_id: 'me-1' }),
      { onConflict: 'user_id,conversation_id' }
    );

    unmount();
  });

  it('ne fait rien sans conversationId (pas de upsert, pas de channel)', async () => {
    const { result, unmount } = renderHook(() => usePulsePresence(undefined), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.updatePresence('active');
      await result.current.setTyping(true);
    });

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockChannel).not.toHaveBeenCalled();
    expect(result.current.onlineUsers).toEqual([]);
    expect(result.current.typingUsers).toEqual([]);

    unmount();
  });

  it('reste stable en cas d’erreur de chargement initial (data null)', async () => {
    state.selectResults = [{ data: null, error: { message: 'x' } }];

    const { result, unmount } = renderHook(() => usePulsePresence('conv-1'), {
      wrapper: createWrapper(),
    });

    // L'upsert de présence au montage est tout de même tenté
    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });

    expect(result.current.onlineUsers).toEqual([]);
    expect(result.current.typingUsers).toEqual([]);

    unmount();
  });
});