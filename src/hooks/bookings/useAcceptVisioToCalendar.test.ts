/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAcceptVisioToCalendar } from './useAcceptVisioToCalendar';

const {
  AUTH_STATE,
  TOAST_FN,
  SANITIZE_FN,
  DEBUG_WARN,
  MESSAGE_ROW,
  CALENDAR_ROW,
  NEW_CALENDAR_ROW,
  EVENT_ROW,
  SUMMARY_DATA,
  builderState,
  mockFrom,
  mockInvoke,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'user-1', email: 'user@test.local' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  };

  const TOAST_FN = vi.fn();
  const SANITIZE_FN = vi.fn((error: unknown) => {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String((error as { message: string }).message);
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Erreur';
  });
  const DEBUG_WARN = vi.fn();

  const MESSAGE_ROW = { thread_id: 'thread-1' };
  const CALENDAR_ROW = { id: 'cal-1' };
  const NEW_CALENDAR_ROW = { id: 'cal-new-1' };
  const EVENT_ROW = { id: 'event-1' };
  const SUMMARY_DATA = { summary: 'Résumé IA du fil', cleanTitle: 'Titre nettoyé' };

  const builderState = {
    currentTable: '',
    mode: 'success',
    lastInsertArgs: [] as Array<{ table: string; payload: unknown }>,
    lastEqArgs: [] as Array<unknown[]>,
    invokeError: null as { message: string } | null,
    invokeData: SUMMARY_DATA as { summary: string; cleanTitle: string } | null,
  };

  const createBuilder = (table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((...args: unknown[]) => {
        builderState.lastEqArgs.push(args);
        return builder;
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      insert: vi.fn((payload: unknown) => {
        builderState.lastInsertArgs.push({ table, payload });
        return builder;
      }),
      single: vi.fn(async () => {
        if (table === 'email_messages') {
          return { data: MESSAGE_ROW, error: null };
        }
        if (table === 'calendars') {
          if (builderState.mode === 'create-calendar') {
            return { data: NEW_CALENDAR_ROW, error: null };
          }
          return { data: null, error: null };
        }
        if (table === 'calendar_events') {
          if (builderState.mode === 'event-error') {
            return { data: null, error: { message: 'x' } };
          }
          return { data: EVENT_ROW, error: null };
        }
        return { data: null, error: null };
      }),
      maybeSingle: vi.fn(async () => {
        if (table === 'calendars') {
          if (builderState.mode === 'create-calendar') {
            return { data: null, error: null };
          }
          return { data: CALENDAR_ROW, error: null };
        }
        return { data: null, error: null };
      }),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    };
    return builder;
  };

  const mockFrom = vi.fn((table: string) => {
    builderState.currentTable = table;
    return createBuilder(table);
  });

  const mockInvoke = vi.fn(async () => ({
    data: builderState.invokeData,
    error: builderState.invokeError,
  }));

  return {
    AUTH_STATE,
    TOAST_FN,
    SANITIZE_FN,
    DEBUG_WARN,
    MESSAGE_ROW,
    CALENDAR_ROW,
    NEW_CALENDAR_ROW,
    EVENT_ROW,
    SUMMARY_DATA,
    builderState,
    mockFrom,
    mockInvoke,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: SANITIZE_FN,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    warn: DEBUG_WARN,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { Wrapper, invalidateSpy };
}

describe('useAcceptVisioToCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AUTH_STATE.user = { id: 'user-1', email: 'user@test.local' };
    builderState.mode = 'success';
    builderState.lastInsertArgs = [];
    builderState.lastEqArgs = [];
    builderState.invokeError = null;
    builderState.invokeData = SUMMARY_DATA;
  });

  it('expose un état initial inactif', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAcceptVisioToCalendar(), { wrapper: Wrapper });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(typeof result.current.mutateAsync).toBe('function');
  });

  it('crée un événement avec résumé IA, titre nettoyé, participants, invalide le cache et affiche un toast de succès', async () => {
    const { Wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useAcceptVisioToCalendar(), { wrapper: Wrapper });

    const startTime = new Date('2024-05-01T10:00:00.000Z');
    const endTime = new Date('2024-05-01T11:00:00.000Z');

    let mutationResult: { eventId: string; summary: string | null } | undefined;

    await act(async () => {
      mutationResult = await result.current.mutateAsync({
        messageId: 'msg-1',
        subject: 'Sujet brut',
        visioLink: 'https://meet.local/room-1',
        visioProvider: 'Meet',
        startTime,
        endTime,
        attendees: [
          { email: 'alice@test.local', name: 'Alice' },
          { email: 'bob@test.local' },
        ],
        fromAddress: 'orga@test.local',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_messages');
    expect(mockFrom).toHaveBeenCalledWith('calendars');
    expect(mockFrom).toHaveBeenCalledWith('calendar_events');
    expect(mockFrom).toHaveBeenCalledWith('event_attendees');

    expect(mockInvoke).toHaveBeenCalledWith('generate-thread-summary', {
      body: { threadId: 'thread-1' },
    });

    expect(mutationResult).toEqual({
      eventId: 'event-1',
      summary: 'Résumé IA du fil',
    });

    const eventInsert = builderState.lastInsertArgs.find((entry) => entry.table === 'calendar_events');
    expect(eventInsert).toEqual({
      table: 'calendar_events',
      payload: {
        calendar_id: 'cal-1',
        title: 'Titre nettoyé',
        start_time: '2024-05-01T10:00:00.000Z',
        end_time: '2024-05-01T11:00:00.000Z',
        video_conference_url: 'https://meet.local/room-1',
        description:
          '📝 Contexte:\nRésumé IA du fil\n\n👥 Participants:\n• Alice\n• bob@test.local\n\n👤 Organisateur: orga@test.local',
        status: 'confirmed',
        visibility: 'private',
        created_by: 'user-1',
      },
    });

    const attendeeInsert = builderState.lastInsertArgs.find((entry) => entry.table === 'event_attendees');
    expect(attendeeInsert).toEqual({
      table: 'event_attendees',
      payload: [
        {
          event_id: 'event-1',
          email: 'alice@test.local',
          display_name: 'Alice',
          status: 'pending',
          role: 'attendee',
        },
        {
          event_id: 'event-1',
          email: 'bob@test.local',
          display_name: null,
          status: 'pending',
          role: 'attendee',
        },
      ],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['calendar-events'] });
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: '✓ Événement accepté',
      description: 'La visio a été ajoutée à votre calendrier avec le résumé IA',
    });
  });

  it('crée un calendrier par défaut si aucun calendrier n’existe', async () => {
    builderState.mode = 'create-calendar';

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAcceptVisioToCalendar(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        messageId: 'msg-1',
        subject: 'Planification',
        visioLink: 'https://visio.local/r1',
        visioProvider: 'Zoom',
        startTime: new Date('2024-06-01T09:00:00.000Z'),
        endTime: new Date('2024-06-01T10:00:00.000Z'),
        attendees: [],
      });
    });

    const calendarInsert = builderState.lastInsertArgs.find((entry) => entry.table === 'calendars');
    expect(calendarInsert).toEqual({
      table: 'calendars',
      payload: {
        name: 'Mon calendrier',
        owner_id: 'user-1',
        is_default: true,
        color: '#3b82f6',
        type: 'personal',
      },
    });

    const eventInsert = builderState.lastInsertArgs.find((entry) => entry.table === 'calendar_events');
    expect(eventInsert).toEqual({
      table: 'calendar_events',
      payload: {
        calendar_id: 'cal-new-1',
        title: 'Titre nettoyé',
        start_time: '2024-06-01T09:00:00.000Z',
        end_time: '2024-06-01T10:00:00.000Z',
        video_conference_url: 'https://visio.local/r1',
        description: '📝 Contexte:\nRésumé IA du fil',
        status: 'confirmed',
        visibility: 'private',
        created_by: 'user-1',
      },
    });
  });

  it('passe en erreur et affiche une erreur sanitizée quand la création de l’événement échoue', async () => {
    builderState.mode = 'event-error';

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAcceptVisioToCalendar(), { wrapper: Wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          messageId: 'msg-1',
          subject: 'Sujet',
          visioLink: 'https://meet.local/err',
          visioProvider: 'Meet',
          startTime: new Date('2024-05-01T10:00:00.000Z'),
          endTime: new Date('2024-05-01T11:00:00.000Z'),
          attendees: [],
        }),
      ).rejects.toEqual({ message: 'x' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(SANITIZE_FN).toHaveBeenCalledWith({ message: 'x' });
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'x',
      variant: 'destructive',
    });
  });
});