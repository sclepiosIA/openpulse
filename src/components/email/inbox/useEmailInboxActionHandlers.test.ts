// @vitest-environment jsdom

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEmailInboxActionHandlers } from './useEmailInboxActionHandlers';

const {
  AUTH_STATE,
  markAsProcessedMock,
  markAsReadMock,
  markAsSpamMock,
  updateTagsMock,
  archiveThreadMock,
  deleteThreadMock,
  supabaseBuilder,
  mockFrom,
} = vi.hoisted(() => {
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
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then(onfulfilled?: ((value: { data: null; error: null }) => unknown) | null, onrejected?: ((reason: unknown) => unknown) | null) {
      return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected);
    },
    catch(onrejected?: ((reason: unknown) => unknown) | null) {
      return Promise.resolve({ data: null, error: null }).catch(onrejected);
    },
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
  builder.upsert.mockReturnValue(builder);
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });

  return {
    AUTH_STATE: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    markAsProcessedMock: vi.fn(),
    markAsReadMock: vi.fn(),
    markAsSpamMock: vi.fn(),
    updateTagsMock: vi.fn(),
    archiveThreadMock: vi.fn(),
    deleteThreadMock: vi.fn(),
    supabaseBuilder: builder,
    mockFrom: vi.fn(() => builder),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/email/useEmailThreadActions', () => ({
  useEmailThreadActions: () => ({
    markAsProcessed: markAsProcessedMock,
    markAsRead: markAsReadMock,
    markAsSpam: markAsSpamMock,
    updateTags: updateTagsMock,
    archiveThread: archiveThreadMock,
    deleteThread: deleteThreadMock,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useEmailInboxActionHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(supabaseBuilder);
  });

  it('retourne immédiatement les handlers attendus après chargement', () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailInboxActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    expect(typeof result.current.optimisticUpdateThread).toBe('function');
    expect(typeof result.current.optimisticRemoveThread).toBe('function');
    expect(typeof result.current.actionHandlers.onMarkAsProcessed).toBe('function');
    expect(typeof result.current.actionHandlers.onMarkAsRead).toBe('function');
    expect(typeof result.current.actionHandlers.onMarkAsSpam).toBe('function');
    expect(typeof result.current.actionHandlers.onUpdateTags).toBe('function');
    expect(typeof result.current.actionHandlers.onArchive).toBe('function');
    expect(typeof result.current.actionHandlers.onDeleteThread).toBe('function');
  });

  it('optimisticUpdateThread met à jour uniquement le thread ciblé avec le patch métier', async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailInboxActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.optimisticUpdateThread('t1', { is_processed: true, unread_count: 0 });
    });

    expect(setThreads).toHaveBeenCalledTimes(1);

    const updater = setThreads.mock.calls[0][0] as (prev: Array<{ id: string; subject?: string; is_processed?: boolean; unread_count?: number }>) => Array<{ id: string; subject?: string; is_processed?: boolean; unread_count?: number }>;

    const prev = [
      { id: 't1', subject: 'Hello', is_processed: false, unread_count: 3 },
      { id: 't2', subject: 'World', is_processed: false, unread_count: 2 },
    ];

    const next = updater(prev);

    expect(next).toEqual([
      { id: 't1', subject: 'Hello', is_processed: true, unread_count: 0 },
      { id: 't2', subject: 'World', is_processed: false, unread_count: 2 },
    ]);
    expect(next[0]).not.toBe(prev[0]);
    expect(next[1]).toBe(prev[1]);
  });

  it('optimisticRemoveThread retire le thread et nettoie sa sélection', async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailInboxActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.optimisticRemoveThread('t2');
    });

    expect(setThreads).toHaveBeenCalledTimes(1);
    expect(setSelectedThreads).toHaveBeenCalledTimes(1);

    const threadsUpdater = setThreads.mock.calls[0][0] as (prev: Array<{ id: string; subject: string }>) => Array<{ id: string; subject: string }>;
    const selectedUpdater = setSelectedThreads.mock.calls[0][0] as (prev: Set<string>) => Set<string>;

    const prevThreads = [
      { id: 't1', subject: 'One' },
      { id: 't2', subject: 'Two' },
      { id: 't3', subject: 'Three' },
    ];
    const nextThreads = threadsUpdater(prevThreads);

    expect(nextThreads).toEqual([
      { id: 't1', subject: 'One' },
      { id: 't3', subject: 'Three' },
    ]);

    const prevSelected = new Set<string>(['t1', 't2']);
    const nextSelected = selectedUpdater(prevSelected);

    expect(Array.from(nextSelected)).toEqual(['t1']);
    expect(nextSelected).not.toBe(prevSelected);
    expect(prevSelected.has('t2')).toBe(true);
  });

  it('onMarkAsProcessed met is_processed à true et unread_count à 0 puis appelle la mutation', async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailInboxActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.actionHandlers.onMarkAsProcessed('t1', true);
    });

    expect(setThreads).toHaveBeenCalledTimes(1);

    const updater = setThreads.mock.calls[0][0] as (prev: Array<{ id: string; is_processed?: boolean; unread_count?: number }>) => Array<{ id: string; is_processed?: boolean; unread_count?: number }>;
    const next = updater([{ id: 't1', is_processed: false, unread_count: 4 }]);

    expect(next).toEqual([{ id: 't1', is_processed: true, unread_count: 0 }]);
    expect(markAsProcessedMock).toHaveBeenCalledTimes(1);
    expect(markAsProcessedMock).toHaveBeenCalledWith({ threadId: 't1', processed: true });
  });

  it('onMarkAsProcessed(false) ne force pas unread_count à 0', async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailInboxActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.actionHandlers.onMarkAsProcessed('t1', false);
    });

    const updater = setThreads.mock.calls[0][0] as (prev: Array<{ id: string; is_processed?: boolean; unread_count?: number }>) => Array<{ id: string; is_processed?: boolean; unread_count?: number }>;
    const next = updater([{ id: 't1', is_processed: true, unread_count: 7 }]);

    expect(next).toEqual([{ id: 't1', is_processed: false, unread_count: 7 }]);
    expect(markAsProcessedMock).toHaveBeenCalledWith({ threadId: 't1', processed: false });
  });

  it('onMarkAsRead met unread_count à 0 quand read=true puis appelle la mutation', async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailInboxActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.actionHandlers.onMarkAsRead('t1', true);
    });

    expect(setThreads).toHaveBeenCalledTimes(1);

    const updater = setThreads.mock.calls[0][0] as (prev: Array<{ id: string; unread_count?: number }>) => Array<{ id: string; unread_count?: number }>;
    const next = updater([{ id: 't1', unread_count: 5 }]);

    expect(next).toEqual([{ id: 't1', unread_count: 0 }]);
    expect(markAsReadMock).toHaveBeenCalledTimes(1);
    expect(markAsReadMock).toHaveBeenCalledWith({ threadId: 't1', read: true });
  });

  it('onMarkAsRead met unread_count à 1 quand read=false puis appelle la mutation', async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailInboxActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.actionHandlers.onMarkAsRead('t1', false);
    });

    const updater = setThreads.mock.calls[0][0] as (prev: Array<{ id: string; unread_count?: number }>) => Array<{ id: string; unread_count?: number }>;
    const next = updater([{ id: 't1', unread_count: 0 }]);

    expect(next).toEqual([{ id: 't1', unread_count: 1 }]);
    expect(markAsReadMock).toHaveBeenCalledWith({ threadId: 't1', read: false });
  });

  it('onUpdateTags remplace les tags localement puis appelle la mutation', async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailInboxActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.actionHandlers.onUpdateTags('t9', ['vip', 'client']);
    });

    expect(setThreads).toHaveBeenCalledTimes(1);

    const updater = setThreads.mock.calls[0][0] as (prev: Array<{ id: string; tags?: string[] }>) => Array<{ id: string; tags?: string[] }>;
    const next = updater([{ id: 't9', tags: ['old'] }]);

    expect(next).toEqual([{ id: 't9', tags: ['vip', 'client'] }]);
    expect(updateTagsMock).toHaveBeenCalledTimes(1);
    expect(updateTagsMock).toHaveBeenCalledWith({ threadId: 't9', tags: ['vip', 'client'] });
  });

  it('onMarkAsSpam retire le thread, enlève sa sélection et appelle la mutation spam', async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailInboxActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.actionHandlers.onMarkAsSpam('t2');
    });

    expect(setThreads).toHaveBeenCalledTimes(1);
    expect(setSelectedThreads).toHaveBeenCalledTimes(1);
    expect(markAsSpamMock).toHaveBeenCalledTimes(1);
    expect(markAsSpamMock).toHaveBeenCalledWith({ threadId: 't2', isSpam: true });

    const threadsUpdater = setThreads.mock.calls[0][0] as (prev: Array<{ id: string }>) => Array<{ id: string }>;
    const selectedUpdater = setSelectedThreads.mock.calls[0][0] as (prev: Set<string>) => Set<string>;

    expect(threadsUpdater([{ id: 't1' }, { id: 't2' }])).toEqual([{ id: 't1' }]);
    expect(Array.from(selectedUpdater(new Set<string>(['t2', 't3'])))).toEqual(['t3']);
  });

  it('onArchive retire le thread, nettoie la sélection et appelle archiveThread avec archived=true', async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailInboxActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.actionHandlers.onArchive('t5');
    });

    expect(setThreads).toHaveBeenCalledTimes(1);
    expect(setSelectedThreads).toHaveBeenCalledTimes(1);
    expect(archiveThreadMock).toHaveBeenCalledTimes(1);
    expect(archiveThreadMock).toHaveBeenCalledWith({ threadId: 't5', archived: true });
  });

  it('onDeleteThread retire le thread, nettoie la sélection et appelle deleteThread avec le bon payload', async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailInboxActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.actionHandlers.onDeleteThread('t7');
    });

    expect(setThreads).toHaveBeenCalledTimes(1);
    expect(setSelectedThreads).toHaveBeenCalledTimes(1);
    expect(deleteThreadMock).toHaveBeenCalledTimes(1);
    expect(deleteThreadMock).toHaveBeenCalledWith({ threadId: 't7' });
  });

  it('propage une erreur de mutation tout en ayant appliqué la mise à jour optimiste', () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();
    const error = new Error('x');

    markAsReadMock.mockImplementationOnce(() => {
      throw error;
    });

    const { result } = renderHook(
      () =>
        useEmailInboxActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    expect(() => {
      result.current.actionHandlers.onMarkAsRead('t1', false);
    }).toThrow('x');

    expect(setThreads).toHaveBeenCalledTimes(1);

    const updater = setThreads.mock.calls[0][0] as (prev: Array<{ id: string; unread_count?: number }>) => Array<{ id: string; unread_count?: number }>;
    const next = updater([{ id: 't1', unread_count: 0 }]);

    expect(next).toEqual([{ id: 't1', unread_count: 1 }]);
  });
});