/* @vitest-environment jsdom */
import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCreateCalendarEvent, usePulseTaskCreate } from './useCalendarEventActions';

const {
  EXISTING_CALENDAR,
  NEW_CALENDAR,
  CREATED_EVENT,
  CATEGORY_ROW,
  CREATED_TASK,
  AUTH_STATE,
  mockFrom,
  debugError,
  toastError,
} = vi.hoisted(() => ({
  EXISTING_CALENDAR: { id: 'cal-existing' },
  NEW_CALENDAR: { id: 'cal-new' },
  CREATED_EVENT: { id: 'evt-1', title: 'Réunion équipe' },
  CATEGORY_ROW: { id: 'cat-1' },
  CREATED_TASK: { id: 'task-1', titre: 'Préparer démo' },
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  debugError: vi.fn(),
  toastError: vi.fn(),
}));

type QueryError = { message: string } | null;
type QueryResult<T> = { data: T | null; error: QueryError };

type TableConfig = {
  selectResult?: QueryResult<unknown>;
  insertResult?: QueryResult<unknown>;
  updateResult?: QueryResult<unknown>;
  deleteResult?: QueryResult<unknown>;
};

type BuilderState = {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete' | null;
  payload: unknown;
};

function createBuilder(config: Record<string, TableConfig>) {
  const state: BuilderState = {
    table: '',
    op: null,
    payload: undefined,
  };

  const resolveResult = () => {
    const tableConfig = config[state.table] ?? {};
    if (state.op === 'insert') {
      return Promise.resolve(tableConfig.insertResult ?? { data: null, error: null });
    }
    if (state.op === 'update') {
      return Promise.resolve(tableConfig.updateResult ?? { data: null, error: null });
    }
    if (state.op === 'delete') {
      return Promise.resolve(tableConfig.deleteResult ?? { data: null, error: null });
    }
    return Promise.resolve(tableConfig.selectResult ?? { data: null, error: null });
  };

  const builder = {
    select: vi.fn(() => {
      if (!state.op) state.op = 'select';
      return builder;
    }),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn((payload: unknown) => {
      state.op = 'insert';
      state.payload = payload;
      return builder;
    }),
    update: vi.fn((payload: unknown) => {
      state.op = 'update';
      state.payload = payload;
      return builder;
    }),
    delete: vi.fn(() => {
      state.op = 'delete';
      return builder;
    }),
    single: vi.fn(() => resolveResult()),
    maybeSingle: vi.fn(() => resolveResult()),
    then: (
      onFulfilled?: (value: QueryResult<unknown>) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => resolveResult().then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => resolveResult().catch(onRejected),
  };

  return { builder, state };
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: toastError,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
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

  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { wrapper, queryClient, invalidateSpy };
}

describe('useCreateCalendarEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getOrCreateDefaultCalendar retourne le calendrier existant', async () => {
    const calendarsBuilder = createBuilder({
      calendars: {
        selectResult: { data: EXISTING_CALENDAR, error: null },
      },
    });

    mockFrom.mockImplementation((table: string) => {
      calendarsBuilder.state.table = table;
      calendarsBuilder.state.op = null;
      calendarsBuilder.state.payload = undefined;
      return calendarsBuilder.builder;
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });

    const calendarId = await result.current.getOrCreateDefaultCalendar('u1');

    expect(calendarId).toBe('cal-existing');
    expect(mockFrom).toHaveBeenCalledWith('calendars');
    expect(calendarsBuilder.builder.eq).toHaveBeenNthCalledWith(1, 'owner_id', 'u1');
    expect(calendarsBuilder.builder.eq).toHaveBeenNthCalledWith(2, 'is_default', true);
    expect(calendarsBuilder.builder.insert).not.toHaveBeenCalled();
  });

  it('getOrCreateDefaultCalendar crée un calendrier par défaut si absent', async () => {
    const calendarsBuilder = createBuilder({
      calendars: {
        selectResult: { data: null, error: null },
        insertResult: { data: NEW_CALENDAR, error: null },
      },
    });

    mockFrom.mockImplementation((table: string) => {
      calendarsBuilder.state.table = table;
      calendarsBuilder.state.op = null;
      calendarsBuilder.state.payload = undefined;
      return calendarsBuilder.builder;
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });

    const calendarId = await result.current.getOrCreateDefaultCalendar('u1');

    expect(calendarId).toBe('cal-new');
    expect(calendarsBuilder.builder.insert).toHaveBeenCalledWith({
      name: 'Mon calendrier',
      owner_id: 'u1',
      is_default: true,
      color: '#3b82f6',
      type: 'personal',
    });
  });

  it('createEvent insère les bonnes données métier', async () => {
    const eventBuilder = createBuilder({
      calendar_events: {
        insertResult: { data: CREATED_EVENT, error: null },
      },
    });

    mockFrom.mockImplementation((table: string) => {
      eventBuilder.state.table = table;
      eventBuilder.state.op = null;
      eventBuilder.state.payload = undefined;
      return eventBuilder.builder;
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });

    const payload = {
      calendarId: 'cal-1',
      title: 'Réunion équipe',
      startTime: '2025-01-10T09:00:00.000Z',
      endTime: '2025-01-10T10:00:00.000Z',
      videoConferenceUrl: 'https://meet.local/room',
      description: 'Point hebdo',
      location: 'Salle A',
      status: 'tentative',
      visibility: 'public',
      createdBy: 'u1',
      color: '#ff00aa',
    };

    const data = await result.current.createEvent(payload);

    expect(data).toEqual(CREATED_EVENT);
    expect(mockFrom).toHaveBeenCalledWith('calendar_events');
    expect(eventBuilder.builder.insert).toHaveBeenCalledWith({
      calendar_id: 'cal-1',
      title: 'Réunion équipe',
      start_time: '2025-01-10T09:00:00.000Z',
      end_time: '2025-01-10T10:00:00.000Z',
      video_conference_url: 'https://meet.local/room',
      description: 'Point hebdo',
      location: 'Salle A',
      status: 'tentative',
      visibility: 'public',
      created_by: 'u1',
      color: '#ff00aa',
    });
  });

  it('createEvent remonte une erreur supabase', async () => {
    const eventBuilder = createBuilder({
      calendar_events: {
        insertResult: { data: null, error: { message: 'event failed' } },
      },
    });

    mockFrom.mockImplementation((table: string) => {
      eventBuilder.state.table = table;
      eventBuilder.state.op = null;
      eventBuilder.state.payload = undefined;
      return eventBuilder.builder;
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });

    await expect(
      result.current.createEvent({
        calendarId: 'cal-1',
        title: 'Réunion équipe',
        startTime: '2025-01-10T09:00:00.000Z',
        endTime: '2025-01-10T10:00:00.000Z',
        createdBy: 'u1',
      }),
    ).rejects.toEqual({ message: 'event failed' });
  });

  it('addAttendees n’appelle pas supabase si la liste est vide', async () => {
    const genericBuilder = createBuilder({});

    mockFrom.mockImplementation((table: string) => {
      genericBuilder.state.table = table;
      genericBuilder.state.op = null;
      genericBuilder.state.payload = undefined;
      return genericBuilder.builder;
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });

    await result.current.addAttendees([]);

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('addAttendees insère les participants et loggue en cas d’erreur sans throw', async () => {
    const attendeesBuilder = createBuilder({
      event_attendees: {
        insertResult: { data: null, error: { message: 'attendees failed' } },
      },
    });

    mockFrom.mockImplementation((table: string) => {
      attendeesBuilder.state.table = table;
      attendeesBuilder.state.op = null;
      attendeesBuilder.state.payload = undefined;
      return attendeesBuilder.builder;
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });

    const attendees = [
      {
        event_id: 'evt-1',
        email: 'guest@test.local',
        display_name: 'Guest',
        role: 'required',
        status: 'pending',
        user_id: null,
      },
    ];

    await expect(result.current.addAttendees(attendees)).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith('event_attendees');
    expect(attendeesBuilder.builder.insert).toHaveBeenCalledWith(attendees);
    expect(debugError).toHaveBeenCalledWith('Error adding attendees:', { message: 'attendees failed' });
  });

  it('addReminder insère un rappel avec les bonnes valeurs', async () => {
    const reminderBuilder = createBuilder({
      event_reminders: {
        insertResult: { data: null, error: null },
      },
    });

    mockFrom.mockImplementation((table: string) => {
      reminderBuilder.state.table = table;
      reminderBuilder.state.op = null;
      reminderBuilder.state.payload = undefined;
      return reminderBuilder.builder;
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });

    await result.current.addReminder({
      event_id: 'evt-1',
      user_id: 'u1',
      minutes_before: 30,
    });

    expect(mockFrom).toHaveBeenCalledWith('event_reminders');
    expect(reminderBuilder.builder.insert).toHaveBeenCalledWith({
      event_id: 'evt-1',
      user_id: 'u1',
      minutes_before: 30,
    });
  });

  it('addReminder remonte une erreur supabase', async () => {
    const reminderBuilder = createBuilder({
      event_reminders: {
        insertResult: { data: null, error: { message: 'reminder failed' } },
      },
    });

    mockFrom.mockImplementation((table: string) => {
      reminderBuilder.state.table = table;
      reminderBuilder.state.op = null;
      reminderBuilder.state.payload = undefined;
      return reminderBuilder.builder;
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });

    await expect(
      result.current.addReminder({
        event_id: 'evt-1',
        user_id: 'u1',
        minutes_before: 30,
      }),
    ).rejects.toEqual({ message: 'reminder failed' });

    expect(reminderBuilder.builder.insert).toHaveBeenCalledWith({
      event_id: 'evt-1',
      user_id: 'u1',
      minutes_before: 30,
    });
  });

  it('invalidateCalendar invalide la clé calendar-events', () => {
    const genericBuilder = createBuilder({});

    mockFrom.mockImplementation((table: string) => {
      genericBuilder.state.table = table;
      genericBuilder.state.op = null;
      genericBuilder.state.payload = undefined;
      return genericBuilder.builder;
    });

    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });

    result.current.invalidateCalendar();

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['calendar-events'] });
  });
});

describe('usePulseTaskCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expose un état initial puis réussit avec catégorie fournie', async () => {
    const tasksBuilder = createBuilder({
      taches: {
        insertResult: { data: CREATED_TASK, error: null },
      },
    });

    mockFrom.mockImplementation((table: string) => {
      tasksBuilder.state.table = table;
      tasksBuilder.state.op = null;
      tasksBuilder.state.payload = undefined;
      return tasksBuilder.builder;
    });

    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => usePulseTaskCreate(), { wrapper });

    expect(result.current.isIdle).toBe(true);
    expect(result.current.isPending).toBe(false);

    await act(async () => {
      await result.current.mutateAsync({
        titre: 'Préparer démo',
        description: 'Assembler la présentation',
        priorite: 'Haute',
        echeance: '2025-01-15',
        responsable_id: 'u1',
        categorie_id: 'cat-provided',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('taches');
    expect(mockFrom).not.toHaveBeenCalledWith('categories_taches');
    expect(tasksBuilder.builder.insert).toHaveBeenCalledWith([
      {
        titre: 'Préparer démo',
        description: 'Assembler la présentation',
        statut: 'A faire',
        priorite: 'Haute',
        echeance: '2025-01-15',
        responsable_id: 'u1',
        categorie_id: 'cat-provided',
      },
    ]);
    expect(result.current.data).toEqual(CREATED_TASK);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tasks'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['taches'] });
  });

  it('cherche une catégorie par défaut si categorie_id absent', async () => {
    const categoriesBuilder = createBuilder({
      categories_taches: {
        selectResult: { data: CATEGORY_ROW, error: null },
      },
    });
    const tasksBuilder = createBuilder({
      taches: {
        insertResult: { data: CREATED_TASK, error: null },
      },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'categories_taches') {
        categoriesBuilder.state.table = table;
        categoriesBuilder.state.op = null;
        categoriesBuilder.state.payload = undefined;
        return categoriesBuilder.builder;
      }
      tasksBuilder.state.table = table;
      tasksBuilder.state.op = null;
      tasksBuilder.state.payload = undefined;
      return tasksBuilder.builder;
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePulseTaskCreate(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        titre: 'Préparer démo',
        description: 'Assembler la présentation',
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('categories_taches');
    expect(categoriesBuilder.builder.limit).toHaveBeenCalledWith(1);
    expect(tasksBuilder.builder.insert).toHaveBeenCalledWith([
      {
        titre: 'Préparer démo',
        description: 'Assembler la présentation',
        statut: 'A faire',
        priorite: 'Normale',
        echeance: null,
        responsable_id: undefined,
        categorie_id: 'cat-1',
      },
    ]);
  });

  it('passe en erreur si aucune catégorie n’est disponible', async () => {
    const categoriesBuilder = createBuilder({
      categories_taches: {
        selectResult: { data: null, error: null },
      },
    });

    mockFrom.mockImplementation((table: string) => {
      categoriesBuilder.state.table = table;
      categoriesBuilder.state.op = null;
      categoriesBuilder.state.payload = undefined;
      return categoriesBuilder.builder;
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePulseTaskCreate(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          titre: 'Préparer démo',
          description: 'Assembler la présentation',
        }),
      ).rejects.toThrow('Aucune catégorie de tâche disponible');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(debugError).toHaveBeenCalledWith('Error creating task:', expect.any(Error));
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la création de la tâche');
  });

  it('passe en erreur si l’insertion de tâche échoue', async () => {
    const tasksBuilder = createBuilder({
      taches: {
        insertResult: { data: null, error: { message: 'insert failed' } },
      },
    });

    mockFrom.mockImplementation((table: string) => {
      tasksBuilder.state.table = table;
      tasksBuilder.state.op = null;
      tasksBuilder.state.payload = undefined;
      return tasksBuilder.builder;
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePulseTaskCreate(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          titre: 'Préparer démo',
          description: 'Assembler la présentation',
          categorie_id: 'cat-provided',
        }),
      ).rejects.toEqual({ message: 'insert failed' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(tasksBuilder.builder.insert).toHaveBeenCalledWith([
      {
        titre: 'Préparer démo',
        description: 'Assembler la présentation',
        statut: 'A faire',
        priorite: 'Normale',
        echeance: null,
        responsable_id: undefined,
        categorie_id: 'cat-provided',
      },
    ]);
    expect(debugError).toHaveBeenCalledWith('Error creating task:', { message: 'insert failed' });
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la création de la tâche');
  });
});