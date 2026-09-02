/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCalendarPresence } from './useCalendarPresence';

const {
  PROFILE,
  EVENT_NOW,
  EMPTY_EVENTS,
  mockFrom,
  mockUseCurrentProfile,
  mockUseVisibilityAwareInterval,
  debugError,
} = vi.hoisted(() => ({
  PROFILE: { id: 'user-1' },
  EVENT_NOW: [
    {
      id: 'evt-1',
      title: 'Daily sync',
      start_time: '2024-01-01T10:00:00.000Z',
      end_time: '2024-01-01T11:00:00.000Z',
      calendar_id: 'cal-1',
      calendars: { owner_id: 'user-1' },
    },
  ] as Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    calendar_id: string;
    calendars: { owner_id: string };
  }>,
  EMPTY_EVENTS: [] as Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    calendar_id?: string;
    calendars?: { owner_id: string };
  }>,
  mockFrom: vi.fn(),
  mockUseCurrentProfile: vi.fn(),
  mockUseVisibilityAwareInterval: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: mockUseCurrentProfile,
}));

vi.mock('@/hooks/ui/useVisibilityAwareInterval', () => ({
  useVisibilityAwareInterval: mockUseVisibilityAwareInterval,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function createSupabaseBuilder(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (
      onFulfilled: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return builder;
}

describe('useCalendarPresence', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseCurrentProfile.mockReturnValue({
      data: PROFILE,
    });

    mockUseVisibilityAwareInterval.mockImplementation(
      (callback: () => Promise<void> | void, _delay: number, options?: { runImmediately?: boolean; enabled?: boolean }) => {
        if (options?.runImmediately && options.enabled) {
          void callback();
        }
      }
    );
  });

  it('déclenche le statut in_meeting avec les données réelles de l’événement en cours', async () => {
    const builder = createSupabaseBuilder({
      data: EVENT_NOW,
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const onStatusChange = vi.fn();

    renderHook(() => useCalendarPresence({ enabled: true, onStatusChange }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('calendar_events');
    });

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith('in_meeting', true, {
        id: 'evt-1',
        title: 'Daily sync',
        start_time: '2024-01-01T10:00:00.000Z',
        end_time: '2024-01-01T11:00:00.000Z',
      });
    });

    expect(builder.select).toHaveBeenCalledWith(`
          id,
          title,
          start_time,
          end_time,
          calendar_id,
          calendars!inner(owner_id)
        `);
    expect(builder.eq).toHaveBeenCalledWith('calendars.owner_id', 'user-1');
    expect(builder.eq).toHaveBeenCalledWith('status', 'confirmed');
    expect(builder.lte).toHaveBeenCalledTimes(1);
    expect(builder.gte).toHaveBeenCalledTimes(1);
    expect(builder.order).toHaveBeenCalledWith('start_time', { ascending: true });
    expect(builder.limit).toHaveBeenCalledWith(1);
  });

  it('retourne au statut active après une réunion précédente puis aucune réunion, et expose checkNow', async () => {
    const meetingBuilder = createSupabaseBuilder({
      data: EVENT_NOW,
      error: null,
    });
    const emptyBuilder = createSupabaseBuilder({
      data: EMPTY_EVENTS,
      error: null,
    });

    mockFrom.mockReturnValueOnce(meetingBuilder).mockReturnValueOnce(emptyBuilder);

    const onStatusChange = vi.fn();

    const { result } = renderHook(() => useCalendarPresence({ enabled: true, onStatusChange }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith('in_meeting', true, {
        id: 'evt-1',
        title: 'Daily sync',
        start_time: '2024-01-01T10:00:00.000Z',
        end_time: '2024-01-01T11:00:00.000Z',
      });
    });

    await act(async () => {
      await result.current.checkNow();
    });

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith('active', false, null);
    });

    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'calendar_events');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'calendar_events');
    expect(emptyBuilder.eq).toHaveBeenCalledWith('calendars.owner_id', 'user-1');
    expect(result.current.checkNow).toBeTypeOf('function');
  });

  it('ne déclenche pas onStatusChange si le même événement est détecté deux fois de suite', async () => {
    const builder = createSupabaseBuilder({
      data: EVENT_NOW,
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const onStatusChange = vi.fn();

    const { result } = renderHook(() => useCalendarPresence({ enabled: true, onStatusChange }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.checkNow();
    });

    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenLastCalledWith('in_meeting', true, {
      id: 'evt-1',
      title: 'Daily sync',
      start_time: '2024-01-01T10:00:00.000Z',
      end_time: '2024-01-01T11:00:00.000Z',
    });
  });

  it("ignore la réponse calendrier de l'ancien profil après un changement de session", async () => {
    let currentProfile: { id: string } | null = { id: 'user-1' };
    mockUseCurrentProfile.mockImplementation(() => ({ data: currentProfile }));
    mockUseVisibilityAwareInterval.mockImplementation(() => undefined);

    let resolveOldQuery!: (value: QueryResult) => void;
    const oldQuery = new Promise<QueryResult>((resolve) => {
      resolveOldQuery = resolve;
    });
    const oldBuilder = createSupabaseBuilder({ data: EVENT_NOW, error: null });
    oldBuilder.limit.mockImplementation(() => oldQuery);

    const newEvent = [{
      ...EVENT_NOW[0],
      id: 'evt-2',
      title: 'Réunion profil B',
      calendars: { owner_id: 'user-2' },
    }];
    const newBuilder = createSupabaseBuilder({ data: newEvent, error: null });
    mockFrom.mockReturnValueOnce(oldBuilder).mockReturnValueOnce(newBuilder);
    const onStatusChange = vi.fn();

    const { result, rerender } = renderHook(
      () => useCalendarPresence({ enabled: true, onStatusChange }),
      { wrapper: createWrapper() }
    );

    const oldCheck = result.current.checkNow();
    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));

    currentProfile = { id: 'user-2' };
    rerender();
    await act(async () => {
      resolveOldQuery({ data: EVENT_NOW, error: null });
      await oldCheck;
    });
    expect(onStatusChange).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.checkNow();
    });
    expect(newBuilder.eq).toHaveBeenCalledWith('calendars.owner_id', 'user-2');
    expect(onStatusChange).toHaveBeenCalledWith('in_meeting', true, {
      id: 'evt-2',
      title: 'Réunion profil B',
      start_time: '2024-01-01T10:00:00.000Z',
      end_time: '2024-01-01T11:00:00.000Z',
    });
  });

  it('gère une erreur Supabase sans appeler onStatusChange', async () => {
    const builder = createSupabaseBuilder({
      data: null,
      error: { message: 'x' },
    });
    mockFrom.mockReturnValue(builder);

    const onStatusChange = vi.fn();

    renderHook(() => useCalendarPresence({ enabled: true, onStatusChange }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(debugError).toHaveBeenCalledWith('Error checking calendar events:', { message: 'x' });
    });

    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it('n’interroge pas Supabase si disabled ou sans profil', () => {
    mockUseCurrentProfile.mockReturnValueOnce({ data: PROFILE });
    const onStatusChangeDisabled = vi.fn();

    renderHook(() => useCalendarPresence({ enabled: false, onStatusChange: onStatusChangeDisabled }), {
      wrapper: createWrapper(),
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(onStatusChangeDisabled).not.toHaveBeenCalled();

    mockUseCurrentProfile.mockReturnValueOnce({ data: null });
    const onStatusChangeNoProfile = vi.fn();

    renderHook(() => useCalendarPresence({ enabled: true, onStatusChange: onStatusChangeNoProfile }), {
      wrapper: createWrapper(),
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(onStatusChangeNoProfile).not.toHaveBeenCalled();
  });
});