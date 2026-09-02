import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisConversationPersistence } from './useJarvisConversationPersistence';

const h = vi.hoisted(() => {
  const ROWS = [
    {
      id: 'c1',
      user_id: 'u1',
      title: 'Conv 1',
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Salut Jarvis',
          timestamp: '2024-01-01T10:00:00.000Z',
        },
      ],
      created_at: '2024-01-01T09:00:00.000Z',
      updated_at: '2024-01-01T10:00:00.000Z',
      is_archived: false,
    },
  ];

  const AUTH = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const state = {
    result: { data: ROWS, error: null } as { data: unknown; error: { message: string } | null },
    singleResult: { data: { id: 'new-conv' }, error: null } as {
      data: unknown;
      error: { message: string } | null;
    },
  };

  const makeBuilder = () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      single: vi.fn(() => Promise.resolve(state.singleResult)),
      maybeSingle: vi.fn(() => Promise.resolve(state.singleResult)),
      then: (
        onFulfilled?: (v: unknown) => unknown,
        onRejected?: (e: unknown) => unknown
      ) => Promise.resolve(state.result).then(onFulfilled, onRejected),
      catch: (onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(state.result).catch(onRejected),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.gte.mockReturnValue(builder);
    builder.lte.mockReturnValue(builder);
    builder.in.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.limit.mockReturnValue(builder);
    builder.insert.mockReturnValue(builder);
    builder.update.mockReturnValue(builder);
    builder.delete.mockReturnValue(builder);
    return builder;
  };

  const builders: Array<ReturnType<typeof makeBuilder>> = [];

  const mockFrom = vi.fn(() => {
    const b = makeBuilder();
    builders.push(b);
    return b;
  });

  return { ROWS, AUTH, state, mockFrom, builders };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: h.mockFrom },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => h.AUTH,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useJarvisConversationPersistence', () => {
  beforeEach(() => {
    h.builders.length = 0;
    h.mockFrom.mockClear();
    h.state.result = { data: h.ROWS, error: null };
    h.state.singleResult = { data: { id: 'new-conv' }, error: null };
  });

  it('charge les conversations avec succès et désérialise les timestamps en Date', async () => {
    const { result } = renderHook(() => useJarvisConversationPersistence(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].id).toBe('c1');
    expect(result.current.conversations[0].title).toBe('Conv 1');
    expect(result.current.conversations[0].messages[0].content).toBe('Salut Jarvis');
    expect(result.current.conversations[0].messages[0].timestamp).toBeInstanceOf(Date);
    expect(
      (result.current.conversations[0].messages[0].timestamp as Date).toISOString()
    ).toBe('2024-01-01T10:00:00.000Z');
    expect(h.mockFrom).toHaveBeenCalledWith('jarvis_conversations');

    const queryBuilder = h.builders[0];
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(queryBuilder.eq).toHaveBeenCalledWith('is_archived', false);
    expect(queryBuilder.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(queryBuilder.limit).toHaveBeenCalledWith(50);
  });

  it('retourne une liste vide quand la requête échoue', async () => {
    h.state.result = { data: null, error: { message: 'x' } };

    const { result } = renderHook(() => useJarvisConversationPersistence(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.conversations).toEqual([]);
  });

  it('createConversation insère une nouvelle conversation et la sélectionne', async () => {
    const { result } = renderHook(() => useJarvisConversationPersistence(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdId: string | null = null;
    await act(async () => {
      createdId = await result.current.createConversation('Ma conversation');
    });

    expect(createdId).toBe('new-conv');

    const insertBuilder = h.builders.find((b) => b.insert.mock.calls.length > 0);
    expect(insertBuilder).toBeDefined();
    expect(insertBuilder?.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        title: 'Ma conversation',
        messages: [],
        is_archived: false,
        model_used: 'gpt-5',
        total_tokens: 0,
      })
    );

    await waitFor(() => expect(result.current.currentConversationId).toBe('new-conv'));
  });

  it('saveMessages sérialise les messages et génère un titre depuis le premier message', async () => {
    const { result } = renderHook(() => useJarvisConversationPersistence(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const messages = [
      {
        id: 'm1',
        role: 'user' as const,
        content: 'Bonjour Jarvis',
        timestamp: new Date('2024-01-02T10:00:00.000Z'),
      },
    ];

    await act(async () => {
      await result.current.saveMessages(messages, 'c1');
    });

    const updateBuilder = h.builders.find((b) => b.update.mock.calls.length > 0);
    expect(updateBuilder).toBeDefined();
    expect(updateBuilder?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Bonjour Jarvis',
        messages: [
          expect.objectContaining({
            id: 'm1',
            role: 'user',
            content: 'Bonjour Jarvis',
            timestamp: '2024-01-02T10:00:00.000Z',
          }),
        ],
      })
    );
    expect(updateBuilder?.eq).toHaveBeenCalledWith('id', 'c1');
  });

  it('saveMessages ne fait rien sans conversationId ni conversation courante', async () => {
    const { result } = renderHook(() => useJarvisConversationPersistence(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    h.builders.length = 0;

    await act(async () => {
      await result.current.saveMessages([
        {
          id: 'm1',
          role: 'user' as const,
          content: 'Hello',
          timestamp: new Date('2024-01-02T10:00:00.000Z'),
        },
      ]);
    });

    const updateBuilder = h.builders.find((b) => b.update.mock.calls.length > 0);
    expect(updateBuilder).toBeUndefined();
  });

  it('deleteConversation supprime la conversation par id', async () => {
    const { result } = renderHook(() => useJarvisConversationPersistence(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.deleteConversation('c1');
    });

    const deleteBuilder = h.builders.find((b) => b.delete.mock.calls.length > 0);
    expect(deleteBuilder).toBeDefined();
    expect(deleteBuilder?.eq).toHaveBeenCalledWith('id', 'c1');
  });

  it('archiveConversation passe is_archived à true', async () => {
    const { result } = renderHook(() => useJarvisConversationPersistence(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.archiveConversation('c1');
    });

    const archiveBuilder = h.builders.find(
      (b) =>
        b.update.mock.calls.length > 0 &&
        (b.update.mock.calls[0][0] as { is_archived?: boolean }).is_archived === true
    );
    expect(archiveBuilder).toBeDefined();
    expect(archiveBuilder?.update).toHaveBeenCalledWith({ is_archived: true });
    expect(archiveBuilder?.eq).toHaveBeenCalledWith('id', 'c1');
  });

  it('renameConversation met à jour le titre', async () => {
    const { result } = renderHook(() => useJarvisConversationPersistence(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.renameConversation('c1', 'Nouveau titre');
    });

    const renameBuilder = h.builders.find(
      (b) =>
        b.update.mock.calls.length > 0 &&
        (b.update.mock.calls[0][0] as { title?: string }).title === 'Nouveau titre'
    );
    expect(renameBuilder).toBeDefined();
    expect(renameBuilder?.update).toHaveBeenCalledWith({ title: 'Nouveau titre' });
    expect(renameBuilder?.eq).toHaveBeenCalledWith('id', 'c1');
  });

  it('loadConversation retourne les messages du cache et définit la conversation courante', async () => {
    const { result } = renderHook(() => useJarvisConversationPersistence(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.conversations).toHaveLength(1));

    let loaded: unknown = null;
    await act(async () => {
      loaded = await result.current.loadConversation('c1');
    });

    expect(loaded).toHaveLength(1);
    expect((loaded as Array<{ content: string }>)[0].content).toBe('Salut Jarvis');
    expect(result.current.currentConversationId).toBe('c1');
  });

  it('loadConversation va chercher en base si absente du cache', async () => {
    const { result } = renderHook(() => useJarvisConversationPersistence(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    h.state.singleResult = {
      data: {
        messages: [
          {
            id: 'm9',
            role: 'assistant',
            content: 'Depuis la base',
            timestamp: '2024-01-03T08:00:00.000Z',
          },
        ],
      },
      error: null,
    };

    let loaded: unknown = null;
    await act(async () => {
      loaded = await result.current.loadConversation('c-absente');
    });

    const fetched = loaded as Array<{ content: string; timestamp: Date }>;
    expect(fetched).toHaveLength(1);
    expect(fetched[0].content).toBe('Depuis la base');
    expect(fetched[0].timestamp).toBeInstanceOf(Date);
    expect(result.current.currentConversationId).toBe('c-absente');
  });

  it('loadConversation retourne null si la base renvoie une erreur', async () => {
    const { result } = renderHook(() => useJarvisConversationPersistence(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    h.state.singleResult = { data: null, error: { message: 'x' } };

    let loaded: unknown = 'sentinel';
    await act(async () => {
      loaded = await result.current.loadConversation('c-inconnue');
    });

    expect(loaded).toBeNull();
  });

  it('setCurrentConversation met à jour la conversation courante', async () => {
    const { result } = renderHook(() => useJarvisConversationPersistence(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setCurrentConversation('c1');
    });
    expect(result.current.currentConversationId).toBe('c1');

    act(() => {
      result.current.setCurrentConversation(null);
    });
    expect(result.current.currentConversationId).toBeNull();
  });
});