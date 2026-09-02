/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  usePulseMessages,
  usePulseThreadReplies,
  useSendPulseMessage,
  useUpdatePulseMessage,
  useDeletePulseMessage,
  pulseMessageKeys,
} from './usePulseMessages';

const hoisted = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'user-1', email: 'test@example.com' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  };

  const PROFILE = { id: 'profile-1' };
  const FALLBACK_PROFILE = { id: 'profile-fallback' };

  const MESSAGE_1 = {
    id: 'm1',
    conversation_id: 'conv-1',
    user_id: 'profile-1',
    content: 'Bonjour',
    parent_message_id: null,
    created_at: '2024-01-01T10:00:00.000Z',
    user: { id: 'profile-1', nom: 'Doe', prenom: 'Jane', email: 'jane@example.com', avatar_url: null },
    reactions: [],
    media: [],
    task_links: [],
  };

  const MESSAGE_2 = {
    id: 'm2',
    conversation_id: 'conv-1',
    user_id: 'profile-2',
    content: 'Salut',
    parent_message_id: null,
    created_at: '2024-01-01T11:00:00.000Z',
    user: { id: 'profile-2', nom: 'Smith', prenom: 'John', email: 'john@example.com', avatar_url: null },
    reactions: [],
    media: [],
    task_links: [],
  };

  const THREAD_REPLY = {
    id: 'r1',
    conversation_id: 'conv-1',
    user_id: 'profile-2',
    content: 'Réponse au thread',
    parent_message_id: 'm1',
    created_at: '2024-01-01T12:00:00.000Z',
    user: { id: 'profile-2', nom: 'Smith', prenom: 'John', email: 'john@example.com', avatar_url: null },
    reactions: [],
  };

  const EMPTY_ARRAY = [] as unknown[];
  const MESSAGES = [MESSAGE_1, MESSAGE_2];
  const THREAD_REPLIES = [THREAD_REPLY];
  const HIDDEN_ROWS = [{ message_id: 'm2' }];

  const toast = {
    success: vi.fn(),
    error: vi.fn(),
  };

  const debug = {
    log: vi.fn(),
    error: vi.fn(),
  };

  const safeStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };

  const mockUseAuth = vi.fn(() => AUTH_STATE);
  const mockUseCurrentProfile = vi.fn(() => ({ data: PROFILE }));

  const mockInvalidateQueries = vi.fn(() => Promise.resolve());
  const mockCancelQueries = vi.fn(() => Promise.resolve());
  const mockGetQueryData = vi.fn();
  const mockSetQueryData = vi.fn();

  const authGetSession = vi.fn(async () => ({ data: { session: AUTH_STATE.session } }));

  const mode = { current: 'messages' as 'messages' | 'thread' };

  const supabaseState = {
    pulseMessagesSelect: { data: MESSAGES, error: null, count: 2 },
    threadSelect: { data: THREAD_REPLIES, error: null, count: null },
    profilesMaybeSingle: { data: FALLBACK_PROFILE, error: null },
  };

  const extendedState = {
    hidesSelect: { data: EMPTY_ARRAY, error: null },
    pulseMessagesInsert: { data: MESSAGE_1, error: null },
    pulseMessagesUpdate: { data: { id: 'm1', conversation_id: 'conv-1', content: 'Modifié' }, error: null },
    pulseConversationUpdate: { data: null, error: null },
    messageHidesUpsert: { data: null, error: null },
  };

  const createThenableBuilder = (resolver: () => Promise<unknown>) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      is: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(() => resolver()),
      maybeSingle: vi.fn(() => resolver()),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        resolver().then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) => resolver().catch(onRejected),
    };
    return builder;
  };

  const mockFrom = vi.fn((table: string) => {
    if (table === 'pulse_messages') {
      return createThenableBuilder(async () =>
        mode.current === 'thread' ? supabaseState.threadSelect : supabaseState.pulseMessagesSelect
      );
    }

    if (table === 'profiles') {
      return createThenableBuilder(async () => supabaseState.profilesMaybeSingle);
    }

    return createThenableBuilder(async () => ({ data: null, error: null }));
  });

  const mockFromExtended = vi.fn((table: string) => {
    if (table === 'pulse_message_hides') {
      const builder = createThenableBuilder(async () => extendedState.hidesSelect);
      builder.upsert = vi.fn(() => createThenableBuilder(async () => extendedState.messageHidesUpsert));
      return builder;
    }

    if (table === 'pulse_messages') {
      const builder = createThenableBuilder(async () => extendedState.pulseMessagesUpdate);
      builder.insert = vi.fn(() => {
        const inserted = createThenableBuilder(async () => extendedState.pulseMessagesInsert);
        inserted.select = vi.fn(() => inserted);
        return inserted;
      });
      builder.update = vi.fn(() => builder);
      return builder;
    }

    if (table === 'pulse_conversations') {
      const builder = createThenableBuilder(async () => extendedState.pulseConversationUpdate);
      builder.update = vi.fn(() => builder);
      return builder;
    }

    return createThenableBuilder(async () => ({ data: null, error: null }));
  });

  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);

  const mockChannel = vi.fn(() => channel);
  const mockRemoveChannel = vi.fn();

  return {
    AUTH_STATE,
    PROFILE,
    FALLBACK_PROFILE,
    MESSAGES,
    THREAD_REPLIES,
    HIDDEN_ROWS,
    toast,
    debug,
    safeStorage,
    mockUseAuth,
    mockUseCurrentProfile,
    mockInvalidateQueries,
    mockCancelQueries,
    mockGetQueryData,
    mockSetQueryData,
    authGetSession,
    mockFrom,
    mockFromExtended,
    mockChannel,
    mockRemoveChannel,
    supabaseState,
    extendedState,
    mode,
  };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: hoisted.mockUseAuth,
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: hoisted.mockUseCurrentProfile,
}));

vi.mock('sonner', () => ({
  toast: hoisted.toast,
}));

vi.mock('@/lib/debug', () => ({
  debug: hoisted.debug,
}));

vi.mock('@/lib/safeStorage', () => ({
  safeStorage: hoisted.safeStorage,
}));

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: hoisted.mockFromExtended,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: hoisted.mockFrom,
    auth: {
      getSession: hoisted.authGetSession,
    },
    channel: hoisted.mockChannel,
    removeChannel: hoisted.mockRemoveChannel,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const spyInvalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const spyCancel = vi.spyOn(queryClient, 'cancelQueries');
  const spyGet = vi.spyOn(queryClient, 'getQueryData');
  const spySet = vi.spyOn(queryClient, 'setQueryData');

  spyInvalidate.mockImplementation(hoisted.mockInvalidateQueries);
  spyCancel.mockImplementation(hoisted.mockCancelQueries);
  spyGet.mockImplementation(hoisted.mockGetQueryData);
  spySet.mockImplementation(hoisted.mockSetQueryData);

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { wrapper, queryClient, spyInvalidate, spyCancel, spyGet, spySet };
}

describe('usePulseMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockUseAuth.mockReturnValue(hoisted.AUTH_STATE);
    hoisted.mockUseCurrentProfile.mockReturnValue({ data: hoisted.PROFILE });
    hoisted.supabaseState.pulseMessagesSelect = { data: hoisted.MESSAGES, error: null, count: 2 };
    hoisted.supabaseState.threadSelect = { data: hoisted.THREAD_REPLIES, error: null, count: null };
    hoisted.supabaseState.profilesMaybeSingle = { data: hoisted.FALLBACK_PROFILE, error: null };
    hoisted.extendedState.hidesSelect = { data: [], error: null };
    hoisted.extendedState.pulseMessagesInsert = { data: hoisted.MESSAGES[0], error: null };
    hoisted.extendedState.pulseMessagesUpdate = {
      data: { id: 'm1', conversation_id: 'conv-1', content: 'Modifié' },
      error: null,
    };
    hoisted.extendedState.pulseConversationUpdate = { data: null, error: null };
    hoisted.extendedState.messageHidesUpsert = { data: null, error: null };
    hoisted.mode.current = 'messages';
    vi.useRealTimers();
  });

  it('charge puis retourne les messages métier d’une conversation', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePulseMessages('conv-1'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const pages = result.current.data?.pages ?? [];
    expect(pages).toHaveLength(1);
    expect(pages[0]?.messages).toHaveLength(2);
    expect(pages[0]?.messages[0]?.content).toBe('Bonjour');
    expect(pages[0]?.messages[1]?.id).toBe('m2');
    expect(result.current.hasNextPage).toBe(false);
    expect(hoisted.mockFrom).toHaveBeenCalledWith('pulse_messages');
  });

  it('filtre les messages masqués pour le profil courant', async () => {
    hoisted.extendedState.hidesSelect = { data: hoisted.HIDDEN_ROWS, error: null };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePulseMessages('conv-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const messages = result.current.data?.pages[0]?.messages ?? [];
    expect(messages).toHaveLength(1);
    expect(messages[0]?.id).toBe('m1');
    expect(messages[0]?.content).toBe('Bonjour');
  });

  it('passe en erreur si la récupération des messages échoue', async () => {
    hoisted.supabaseState.pulseMessagesSelect = {
      data: null,
      error: { message: 'x' },
      count: 0,
    };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePulseMessages('conv-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('x');
  });

  it('charge les réponses d’un thread', async () => {
    hoisted.mode.current = 'thread';
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePulseThreadReplies('m1'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.parent_message_id).toBe('m1');
    expect(result.current.data?.[0]?.content).toBe('Réponse au thread');
  });

  it('passe en erreur si le thread échoue', async () => {
    hoisted.mode.current = 'thread';
    hoisted.supabaseState.threadSelect = { data: null, error: { message: 'x' }, count: null };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePulseThreadReplies('m1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('x');
  });

  it('envoie un message puis invalide la conversation', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSendPulseMessage(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        conversation_id: 'conv-1',
        content: 'Nouveau message',
        mentions: ['u2'],
        parent_message_id: null,
      });
    });

    expect(hoisted.mockFromExtended).toHaveBeenCalledWith('pulse_messages');
    expect(hoisted.mockFromExtended).toHaveBeenCalledWith('pulse_conversations');
    expect(hoisted.mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: pulseMessageKeys.byConversation('conv-1'),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('remonte une erreur d’envoi et appelle toast.error', async () => {
    hoisted.extendedState.pulseMessagesInsert = { data: null, error: { message: 'x' } };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSendPulseMessage(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          conversation_id: 'conv-1',
          content: 'Erreur',
          mentions: [],
          parent_message_id: null,
        })
      ).rejects.toEqual({ message: 'x' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(hoisted.toast.error).toHaveBeenCalledWith("Erreur lors de l'envoi du message");
    expect(hoisted.debug.error).toHaveBeenCalled();
  });

  it('modifie un message puis invalide la conversation et notifie le succès', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdatePulseMessage(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ messageId: 'm1', content: 'Modifié' });
    });

    expect(hoisted.mockFromExtended).toHaveBeenCalledWith('pulse_messages');
    expect(hoisted.mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: pulseMessageKeys.byConversation('conv-1'),
    });
    expect(hoisted.toast.success).toHaveBeenCalledWith('Message modifié');
  });

  it('passe en erreur sur modification échouée', async () => {
    hoisted.extendedState.pulseMessagesUpdate = { data: null, error: { message: 'x' } };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdatePulseMessage(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ messageId: 'm1', content: 'oops' })).rejects.toEqual({
        message: 'x',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(hoisted.toast.error).toHaveBeenCalledWith('Erreur lors de la modification');
  });

  it('masque un message avec mise à jour optimiste puis invalide après délai', async () => {
    vi.useFakeTimers();

    const oldData = {
      pages: [
        {
          messages: [hoisted.MESSAGES[0], hoisted.MESSAGES[1]],
        },
      ],
    };

    hoisted.mockGetQueryData.mockReturnValue(oldData);
    hoisted.mockSetQueryData.mockImplementation((key, updater) => {
      if (typeof updater === 'function') {
        return updater(oldData);
      }
      return { key, updater };
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeletePulseMessage(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ messageId: 'm2', conversationId: 'conv-1' });
    });

    expect(hoisted.mockFromExtended).toHaveBeenCalledWith('pulse_message_hides');
    expect(hoisted.mockCancelQueries).toHaveBeenCalledWith({
      queryKey: pulseMessageKeys.byConversation('conv-1'),
    });
    expect(hoisted.mockGetQueryData).toHaveBeenCalledWith(
      pulseMessageKeys.byConversation('conv-1')
    );
    expect(hoisted.mockSetQueryData).toHaveBeenCalled();
    expect(hoisted.toast.success).toHaveBeenCalledWith('Message supprimé');

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(hoisted.mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: pulseMessageKeys.byConversation('conv-1'),
    });
  });

  it('restaure le cache et passe en erreur si le masquage échoue', async () => {
    hoisted.extendedState.messageHidesUpsert = { data: null, error: { message: 'x' } };

    const previous = { pages: [{ messages: [hoisted.MESSAGES[0]] }] };
    hoisted.mockGetQueryData.mockReturnValue(previous);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeletePulseMessage(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ messageId: 'm1', conversationId: 'conv-1' })
      ).rejects.toEqual({ message: 'x' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(hoisted.mockSetQueryData).toHaveBeenCalledWith(
      pulseMessageKeys.byConversation('conv-1'),
      previous
    );
    expect(hoisted.toast.error).toHaveBeenCalledWith('Erreur lors de la suppression');
  });
});
