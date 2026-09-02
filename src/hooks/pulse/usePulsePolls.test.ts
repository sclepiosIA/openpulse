/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  usePulsePoll,
  useCreatePulsePoll,
  useVotePoll,
  useUnvotePoll,
  useUpdatePollMessage,
  pulsePollKeys,
} from './usePulsePolls';

const {
  PROFILE,
  POLL_ROW,
  OPTIONS_ROWS,
  VOTES_ROWS,
  CREATED_POLL,
  CREATED_VOTE,
  UPDATED_POLL,
  toastSuccess,
  toastError,
  debugError,
  mockFrom,
} = vi.hoisted(() => ({
  PROFILE: { id: 'user-1', email: 'user@test.local' },
  POLL_ROW: {
    id: 'poll-1',
    conversation_id: 'conv-1',
    message_id: 'msg-1',
    created_by: 'user-2',
    question: 'Quel choix ?',
    is_multiple_choice: false,
    is_anonymous: true,
    ends_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  OPTIONS_ROWS: [
    {
      id: 'opt-1',
      poll_id: 'poll-1',
      text: 'Option A',
      position: 0,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'opt-2',
      poll_id: 'poll-1',
      text: 'Option B',
      position: 1,
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  VOTES_ROWS: [
    {
      id: 'vote-1',
      poll_id: 'poll-1',
      option_id: 'opt-1',
      user_id: 'user-1',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'vote-2',
      poll_id: 'poll-1',
      option_id: 'opt-1',
      user_id: 'user-2',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'vote-3',
      poll_id: 'poll-1',
      option_id: 'opt-2',
      user_id: 'user-3',
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  CREATED_POLL: {
    id: 'poll-new',
    conversation_id: 'conv-9',
    message_id: null,
    created_by: 'user-1',
    question: 'Nouvelle question',
    is_multiple_choice: true,
    is_anonymous: false,
    ends_at: null,
    created_at: '2026-01-02T00:00:00.000Z',
  },
  CREATED_VOTE: {
    id: 'vote-new',
    poll_id: 'poll-1',
    option_id: 'opt-2',
    user_id: 'user-1',
    created_at: '2026-01-02T00:00:00.000Z',
  },
  UPDATED_POLL: {
    id: 'poll-1',
    conversation_id: 'conv-1',
    message_id: 'msg-99',
    created_by: 'user-2',
    question: 'Quel choix ?',
    is_multiple_choice: false,
    is_anonymous: true,
    ends_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  debugError: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: PROFILE, isLoading: false, error: null }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

type QueueItem = {
  type: 'maybeSingle' | 'single' | 'then';
  value: { data: unknown; error: unknown };
};

function createBuilder(queue: QueueItem[]) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => {
      const item = queue.shift();
      if (!item || item.type !== 'maybeSingle') {
        throw new Error('Unexpected maybeSingle call');
      }
      return item.value;
    }),
    single: vi.fn(async () => {
      const item = queue.shift();
      if (!item || item.type !== 'single') {
        throw new Error('Unexpected single call');
      }
      return item.value;
    }),
    then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) => {
      const item = queue.shift();
      if (!item || item.type !== 'then') {
        return Promise.reject(new Error('Unexpected then call')).then(onFulfilled, onRejected);
      }
      return Promise.resolve(item.value).then(onFulfilled, onRejected);
    },
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
  };

  return builder;
}

function setupFromSequence(sequence: Record<string, QueueItem[]>) {
  mockFrom.mockImplementation((table: string) => {
    const queue = sequence[table];
    if (!queue) {
      throw new Error(`Unexpected table: ${table}`);
    }
    return createBuilder(queue);
  });
}

function createWrapper(client?: QueryClient) {
  const queryClient =
    client ||
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pulsePollKeys', () => {
  it('construit les clés attendues', () => {
    expect(pulsePollKeys.all).toEqual(['pulse-polls']);
    expect(pulsePollKeys.byId('poll-1')).toEqual(['pulse-polls', 'detail', 'poll-1']);
    expect(pulsePollKeys.byConversation('conv-1')).toEqual(['pulse-polls', 'conversation', 'conv-1']);
  });
});

describe('usePulsePoll', () => {
  it('charge puis retourne un sondage enrichi avec vote_count, my_votes et total_votes', async () => {
    setupFromSequence({
      pulse_polls: [{ type: 'maybeSingle', value: { data: POLL_ROW, error: null } }],
      pulse_poll_options: [{ type: 'then', value: { data: OPTIONS_ROWS, error: null } }],
      pulse_poll_votes: [{ type: 'then', value: { data: VOTES_ROWS, error: null } }],
    });

    const { result } = renderHook(() => usePulsePoll('poll-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'pulse_polls');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'pulse_poll_options');
    expect(mockFrom).toHaveBeenNthCalledWith(3, 'pulse_poll_votes');

    expect(result.current.data).toEqual({
      ...POLL_ROW,
      options: [
        { ...OPTIONS_ROWS[0], vote_count: 2 },
        { ...OPTIONS_ROWS[1], vote_count: 1 },
      ],
      votes: VOTES_ROWS,
      my_votes: ['opt-1'],
      total_votes: 3,
    });
  });

  it('passe en erreur si la récupération du sondage échoue', async () => {
    setupFromSequence({
      pulse_polls: [{ type: 'maybeSingle', value: { data: null, error: { message: 'x' } } }],
    });

    const { result } = renderHook(() => usePulsePoll('poll-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
  });
});

describe('useCreatePulsePoll', () => {
  it('crée un sondage, crée ses options, invalide la liste de conversation et affiche un succès', async () => {
    setupFromSequence({
      pulse_polls: [{ type: 'single', value: { data: CREATED_POLL, error: null } }],
      pulse_poll_options: [{ type: 'then', value: { data: null, error: null } }],
    });

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const invalidateQueriesSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useCreatePulsePoll(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        conversationId: 'conv-9',
        question: 'Nouvelle question',
        options: ['Oui', 'Non'],
        isMultipleChoice: true,
        isAnonymous: false,
        endsAt: null,
      });
    });

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'pulse_polls');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'pulse_poll_options');

    const firstBuilder = mockFrom.mock.results[0]?.value as ReturnType<typeof createBuilder>;
    const secondBuilder = mockFrom.mock.results[1]?.value as ReturnType<typeof createBuilder>;

    expect(firstBuilder.insert).toHaveBeenCalledWith({
      conversation_id: 'conv-9',
      created_by: 'user-1',
      question: 'Nouvelle question',
      is_multiple_choice: true,
      is_anonymous: false,
      ends_at: null,
    });

    expect(secondBuilder.insert).toHaveBeenCalledWith([
      { poll_id: 'poll-new', text: 'Oui', position: 0 },
      { poll_id: 'poll-new', text: 'Non', position: 1 },
    ]);

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: pulsePollKeys.byConversation('conv-9'),
    });
    expect(toastSuccess).toHaveBeenCalledWith('Sondage créé');
  });

  it('passe en erreur si la création du sondage échoue et notifie l’utilisateur', async () => {
    setupFromSequence({
      pulse_polls: [{ type: 'single', value: { data: null, error: { message: 'x' } } }],
    });

    const { result } = renderHook(() => useCreatePulsePoll(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          conversationId: 'conv-9',
          question: 'Nouvelle question',
          options: ['Oui', 'Non'],
        });
      } catch {}
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(debugError).toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la création du sondage');
  });
});

describe('useVotePoll', () => {
  it('enregistre un vote et invalide le détail du sondage', async () => {
    setupFromSequence({
      pulse_poll_votes: [{ type: 'single', value: { data: CREATED_VOTE, error: null } }],
    });

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const invalidateQueriesSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useVotePoll(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        pollId: 'poll-1',
        optionId: 'opt-2',
      });
    });

    const builder = mockFrom.mock.results[0]?.value as ReturnType<typeof createBuilder>;
    expect(builder.insert).toHaveBeenCalledWith({
      poll_id: 'poll-1',
      option_id: 'opt-2',
      user_id: 'user-1',
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: pulsePollKeys.byId('poll-1'),
    });
  });

  it('passe en erreur avec message duplicate et affiche le toast dédié', async () => {
    setupFromSequence({
      pulse_poll_votes: [{ type: 'single', value: { data: null, error: { message: 'duplicate vote' } } }],
    });

    const { result } = renderHook(() => useVotePoll(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          pollId: 'poll-1',
          optionId: 'opt-2',
        });
      } catch {}
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(debugError).toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('Vous avez déjà voté pour cette option');
  });
});

describe('useUnvotePoll', () => {
  it('supprime un vote avec les filtres attendus et invalide le détail du sondage', async () => {
    setupFromSequence({
      pulse_poll_votes: [{ type: 'then', value: { data: null, error: null } }],
    });

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const invalidateQueriesSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useUnvotePoll(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        pollId: 'poll-1',
        optionId: 'opt-2',
      });
    });

    const builder = mockFrom.mock.results[0]?.value as ReturnType<typeof createBuilder>;
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'poll_id', 'poll-1');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'option_id', 'opt-2');
    expect(builder.eq).toHaveBeenNthCalledWith(3, 'user_id', 'user-1');
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: pulsePollKeys.byId('poll-1'),
    });
  });

  it('passe en erreur si la suppression échoue et affiche un toast', async () => {
    setupFromSequence({
      pulse_poll_votes: [{ type: 'then', value: { data: null, error: { message: 'x' } } }],
    });

    const { result } = renderHook(() => useUnvotePoll(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          pollId: 'poll-1',
          optionId: 'opt-2',
        });
      } catch {}
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(debugError).toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('Erreur lors du retrait du vote');
  });
});

describe('useUpdatePollMessage', () => {
  it('met à jour message_id et invalide le détail du sondage', async () => {
    setupFromSequence({
      pulse_polls: [{ type: 'single', value: { data: UPDATED_POLL, error: null } }],
    });

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const invalidateQueriesSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useUpdatePollMessage(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        pollId: 'poll-1',
        messageId: 'msg-99',
      });
    });

    const builder = mockFrom.mock.results[0]?.value as ReturnType<typeof createBuilder>;
    expect(builder.update).toHaveBeenCalledWith({ message_id: 'msg-99' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'poll-1');
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: pulsePollKeys.byId('poll-1'),
    });
  });

  it('passe en erreur si la mise à jour échoue', async () => {
    setupFromSequence({
      pulse_polls: [{ type: 'single', value: { data: null, error: { message: 'x' } } }],
    });

    const { result } = renderHook(() => useUpdatePollMessage(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          pollId: 'poll-1',
          messageId: 'msg-99',
        });
      } catch {}
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});