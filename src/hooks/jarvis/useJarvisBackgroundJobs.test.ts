// @vitest-environment jsdom

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisBackgroundJobs } from './useJarvisBackgroundJobs';

const {
  AUTH_STATE,
  ACTIVE_JOBS_ROWS,
  RECENT_JOBS_ROWS,
  CREATED_JOB_ROW,
  EMPTY_ROWS,
  invokeMock,
  toastMock,
  sanitizeSupabaseErrorMock,
  debugErrorMock,
  removeChannelMock,
  channelFactoryMock,
  mockFromExtended,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const ACTIVE_JOBS_ROWS = [
    {
      id: 'job-processing-1',
      user_id: 'u1',
      action_type: 'send_email',
      action_data: { recipient: 'a@test.local' },
      status: 'processing',
      progress: 65,
      result: null,
      error_message: null,
      retry_count: 0,
      max_retries: 3,
      started_at: '2024-01-01T10:00:00.000Z',
      completed_at: null,
      created_at: '2024-01-01T09:59:00.000Z',
    },
    {
      id: 'job-queued-1',
      user_id: 'u1',
      action_type: 'create_task',
      action_data: { title: 'Call client' },
      status: 'queued',
      progress: 0,
      result: null,
      error_message: null,
      retry_count: 0,
      max_retries: 3,
      started_at: null,
      completed_at: null,
      created_at: '2024-01-01T09:58:00.000Z',
    },
  ];

  const RECENT_JOBS_ROWS = [
    {
      id: 'job-completed-1',
      user_id: 'u1',
      action_type: 'close_ticket',
      action_data: { ticketId: 't-1' },
      status: 'completed',
      progress: 100,
      result: { closed: true },
      error_message: null,
      retry_count: 0,
      max_retries: 3,
      started_at: '2024-01-01T08:00:00.000Z',
      completed_at: '2024-01-01T08:05:00.000Z',
      created_at: '2024-01-01T07:59:00.000Z',
    },
    {
      id: 'job-failed-1',
      user_id: 'u1',
      action_type: 'update_status',
      action_data: { status: 'blocked' },
      status: 'failed',
      progress: 20,
      result: null,
      error_message: 'Remote rejected update',
      retry_count: 1,
      max_retries: 3,
      started_at: '2024-01-01T07:00:00.000Z',
      completed_at: '2024-01-01T07:01:00.000Z',
      created_at: '2024-01-01T06:59:00.000Z',
    },
  ];

  const CREATED_JOB_ROW = {
    id: 'job-created-1',
    user_id: 'u1',
    action_type: 'schedule_meeting',
    action_data: { when: 'tomorrow' },
    status: 'queued',
    progress: 0,
    result: null,
    error_message: null,
    retry_count: 0,
    max_retries: 3,
    started_at: null,
    completed_at: null,
    created_at: '2024-01-01T11:00:00.000Z',
  };

  const EMPTY_ROWS = [];

  const invokeMock = vi.fn();
  const toastMock = vi.fn();
  const sanitizeSupabaseErrorMock = vi.fn();
  const debugErrorMock = vi.fn();
  const removeChannelMock = vi.fn();
  const channelFactoryMock = vi.fn();
  const mockFromExtended = vi.fn();

  return {
    AUTH_STATE,
    ACTIVE_JOBS_ROWS,
    RECENT_JOBS_ROWS,
    CREATED_JOB_ROW,
    EMPTY_ROWS,
    invokeMock,
    toastMock,
    sanitizeSupabaseErrorMock,
    debugErrorMock,
    removeChannelMock,
    channelFactoryMock,
    mockFromExtended,
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
  },
}));

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: mockFromExtended,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
    channel: channelFactoryMock,
    removeChannel: removeChannelMock,
  },
}));

function createThenableResult(value: { data: unknown; error: unknown }) {
  return {
    then(onFulfilled: (result: { data: unknown; error: unknown }) => unknown) {
      return Promise.resolve(onFulfilled(value));
    },
    catch() {
      return Promise.resolve(value);
    },
  };
}

function makeBuilder(config: {
  selectResult?: { data: unknown; error: unknown };
  singleResult?: { data: unknown; error: unknown };
  maybeSingleResult?: { data: unknown; error: unknown };
  terminalResult?: { data: unknown; error: unknown };
}) {
  const terminal = config.terminalResult ?? config.selectResult ?? { data: null, error: null };

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => createThenableResult(config.selectResult ?? terminal)),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(config.singleResult ?? { data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve(config.maybeSingleResult ?? { data: null, error: null })),
    then(onFulfilled: (result: { data: unknown; error: unknown }) => unknown) {
      return Promise.resolve(onFulfilled(terminal));
    },
    catch() {
      return Promise.resolve(terminal);
    },
  };

  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  }

  return Wrapper;
}

describe('useJarvisBackgroundJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    const channel = {
      on: vi.fn(),
      subscribe: vi.fn(),
    };

    channel.on.mockImplementation(() => channel);
    channel.subscribe.mockReturnValue(channel);
    channelFactoryMock.mockReturnValue(channel);

    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
    sanitizeSupabaseErrorMock.mockReturnValue('Sanitized error');
  });

  it('charge les jobs actifs et récents avec les valeurs métier calculées', async () => {
    const activeBuilder = makeBuilder({
      selectResult: { data: ACTIVE_JOBS_ROWS, error: null },
    });
    const recentBuilder = makeBuilder({
      selectResult: { data: RECENT_JOBS_ROWS, error: null },
    });

    mockFromExtended.mockReturnValueOnce(activeBuilder).mockReturnValueOnce(recentBuilder);

    const { result } = renderHook(() => useJarvisBackgroundJobs(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.activeJobs).toEqual([]);
    expect(result.current.recentJobs).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFromExtended).toHaveBeenNthCalledWith(1, 'jarvis_background_jobs');
    expect(mockFromExtended).toHaveBeenNthCalledWith(2, 'jarvis_background_jobs');

    expect(result.current.activeJobs).toEqual(ACTIVE_JOBS_ROWS);
    expect(result.current.recentJobs).toEqual(RECENT_JOBS_ROWS);
    expect(result.current.hasActiveJobs).toBe(true);
    expect(result.current.activeCount).toBe(2);
    expect(result.current.processingJob).toEqual(ACTIVE_JOBS_ROWS[0]);

    expect(activeBuilder.select).toHaveBeenCalledWith('id, user_id, action_type, action_data, status, progress, result, error_message, retry_count, max_retries, started_at, completed_at, created_at');
    expect(activeBuilder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(activeBuilder.in).toHaveBeenCalledWith('status', ['queued', 'processing']);
    expect(activeBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });

    expect(recentBuilder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(recentBuilder.in).toHaveBeenCalledWith('status', ['completed', 'failed']);
    expect(recentBuilder.gte).toHaveBeenCalledWith('completed_at', expect.any(String));
    expect(recentBuilder.order).toHaveBeenCalledWith('completed_at', { ascending: false });
    expect(recentBuilder.limit).toHaveBeenCalledWith(10);

    expect(channelFactoryMock).toHaveBeenCalledWith('jarvis-jobs-u1');
    const channel = channelFactoryMock.mock.results[0]?.value as { on: ReturnType<typeof vi.fn> };
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'jarvis_background_jobs',
        filter: 'user_id=eq.u1',
      },
      expect.any(Function)
    );
  });

  it('crée un job puis déclenche le worker et affiche un toast de succès', async () => {
    const activeBuilder = makeBuilder({
      selectResult: { data: EMPTY_ROWS, error: null },
    });
    const recentBuilder = makeBuilder({
      selectResult: { data: EMPTY_ROWS, error: null },
    });
    const createBuilder = makeBuilder({
      singleResult: { data: CREATED_JOB_ROW, error: null },
    });

    mockFromExtended
      .mockReturnValueOnce(activeBuilder)
      .mockReturnValueOnce(recentBuilder)
      .mockReturnValueOnce(createBuilder);

    const { result } = renderHook(() => useJarvisBackgroundJobs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createJob({
        action_type: 'schedule_meeting',
        action_data: { when: 'tomorrow' },
      });
    });

    expect(createBuilder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      action_type: 'schedule_meeting',
      action_data: { when: 'tomorrow' },
      status: 'queued',
      progress: 0,
    });
    expect(createBuilder.select).toHaveBeenCalled();
    expect(createBuilder.single).toHaveBeenCalled();

    expect(invokeMock).toHaveBeenCalledWith('jarvis-background-worker', {
      body: { job_id: 'job-created-1', user_id: 'u1' },
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: '🚀 Job lancé',
      description: "L'action s'exécute en arrière-plan",
    });
  });

  it('annule un job actif avec les bons filtres et affiche un toast', async () => {
    const activeBuilder = makeBuilder({
      selectResult: { data: ACTIVE_JOBS_ROWS, error: null },
    });
    const recentBuilder = makeBuilder({
      selectResult: { data: RECENT_JOBS_ROWS, error: null },
    });
    const cancelBuilder = makeBuilder({
      terminalResult: { data: null, error: null },
    });

    mockFromExtended
      .mockReturnValueOnce(activeBuilder)
      .mockReturnValueOnce(recentBuilder)
      .mockReturnValueOnce(cancelBuilder);

    const { result } = renderHook(() => useJarvisBackgroundJobs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.cancelJob('job-processing-1');
    });

    expect(cancelBuilder.update).toHaveBeenCalledWith({ status: 'cancelled' });
    expect(cancelBuilder.eq).toHaveBeenNthCalledWith(1, 'id', 'job-processing-1');
    expect(cancelBuilder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'u1');
    expect(cancelBuilder.in).toHaveBeenCalledWith('status', ['queued', 'processing']);

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Job annulé',
    });
  });

  it('passe en erreur sur createJob si l’insertion retourne une erreur et sanitise le message', async () => {
    const activeBuilder = makeBuilder({
      selectResult: { data: EMPTY_ROWS, error: null },
    });
    const recentBuilder = makeBuilder({
      selectResult: { data: EMPTY_ROWS, error: null },
    });
    const createError = { message: 'insert failed' };
    const createBuilder = makeBuilder({
      singleResult: { data: null, error: createError },
    });

    mockFromExtended
      .mockReturnValueOnce(activeBuilder)
      .mockReturnValueOnce(recentBuilder)
      .mockReturnValueOnce(createBuilder);

    const { result } = renderHook(() => useJarvisBackgroundJobs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.createJob({
          action_type: 'send_email',
          action_data: { recipient: 'x@test.local' },
        });
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toEqual(createError);
    expect(sanitizeSupabaseErrorMock).toHaveBeenCalledWith(createError);
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Sanitized error',
      variant: 'destructive',
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('retourne des listes vides si la récupération des jobs échoue', async () => {
    const activeError = { message: 'x' };
    const recentError = { message: 'x' };

    const activeBuilder = makeBuilder({
      selectResult: { data: null, error: activeError },
    });
    const recentBuilder = makeBuilder({
      selectResult: { data: null, error: recentError },
    });

    mockFromExtended.mockReturnValueOnce(activeBuilder).mockReturnValueOnce(recentBuilder);

    const { result } = renderHook(() => useJarvisBackgroundJobs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activeJobs).toEqual([]);
    expect(result.current.recentJobs).toEqual([]);
    expect(result.current.hasActiveJobs).toBe(false);
    expect(result.current.activeCount).toBe(0);
    expect(result.current.processingJob).toBeUndefined();
    expect(debugErrorMock).toHaveBeenCalledWith('[useJarvisBackgroundJobs] Error:', activeError);
  });

  it('réagit aux mises à jour realtime: completion, échec et cleanup du channel', async () => {
    const activeBuilder = makeBuilder({
      selectResult: { data: ACTIVE_JOBS_ROWS, error: null },
    });
    const recentBuilder = makeBuilder({
      selectResult: { data: RECENT_JOBS_ROWS, error: null },
    });

    mockFromExtended.mockReturnValueOnce(activeBuilder).mockReturnValueOnce(recentBuilder);

    const { unmount } = renderHook(() => useJarvisBackgroundJobs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(channelFactoryMock).toHaveBeenCalled();
    });

    const channel = channelFactoryMock.mock.results[0]?.value as {
      on: ReturnType<typeof vi.fn>;
      subscribe: ReturnType<typeof vi.fn>;
    };
    const realtimeCallback = channel.on.mock.calls[0]?.[2] as (payload: { new: typeof RECENT_JOBS_ROWS[number] }) => void;

    act(() => {
      realtimeCallback({
        new: {
          ...RECENT_JOBS_ROWS[0],
          action_type: 'send_email',
          status: 'completed',
          error_message: null,
        },
      });
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: '✅ JARVIS - Terminé',
      description: 'Email envoyé avec succès',
    });

    act(() => {
      realtimeCallback({
        new: {
          ...RECENT_JOBS_ROWS[1],
          action_type: 'unknown_action',
          status: 'failed',
          error_message: 'Job crashed',
        },
      });
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: '❌ JARVIS - Échec',
      description: 'Job crashed',
      variant: 'destructive',
    });

    unmount();

    expect(removeChannelMock).toHaveBeenCalledTimes(1);
    expect(removeChannelMock).toHaveBeenCalledWith(channel);
  });
});