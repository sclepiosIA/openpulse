// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCalendarSuggestions } from './useCalendarSuggestions';

const {
  AUTH_STATE,
  TOAST_FN,
  SANITIZE_FN,
  SUGGESTIONS_ROWS,
  PROFILE_ROW,
  SUGGESTION_DETAIL_CAL,
  SUGGESTION_DETAIL_TASK,
  DEFAULT_CATEGORY,
  CREATED_EVENT,
  CREATED_TASK,
  NEW_CALENDAR,
  mockFrom,
  mockInvalidateQueries,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  TOAST_FN: vi.fn(),
  SANITIZE_FN: vi.fn((error: unknown) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }
    return 'Erreur';
  }),
  SUGGESTIONS_ROWS: [
    {
      id: 's1-old',
      email_thread_id: 'th1',
      calendar_uid: 'uid-1',
      event_summary: 'Réunion client',
      event_dtstart: '2099-01-10T10:00:00.000Z',
      event_dtend: '2099-01-10T11:00:00.000Z',
      event_location: 'Salle A',
      event_description: 'Ancienne version',
      event_organizer: 'Alice',
      event_meeting_link: 'https://meet.local/a',
      event_attendees: JSON.stringify([
        { email: 'john@example.com', name: 'John' },
        { email: 'jane@example.com' },
      ]),
      thread_summary: 'Résumé ancien',
      status: 'pending_etablissement',
      created_at: '2099-01-01T08:00:00.000Z',
      thread: {
        subject: 'Sujet A',
        participants: [{ email: 'john@example.com' }],
      },
    },
    {
      id: 's1-new',
      email_thread_id: 'th1',
      calendar_uid: 'uid-1',
      event_summary: 'Réunion client',
      event_dtstart: '2099-01-10T10:00:00.000Z',
      event_dtend: '2099-01-10T11:00:00.000Z',
      event_location: 'Salle B',
      event_description: 'Nouvelle version',
      event_organizer: 'Alice',
      event_meeting_link: 'https://meet.local/b',
      event_attendees: JSON.stringify([
        { email: 'john@example.com', name: 'John' },
        { email: 'jane@example.com' },
      ]),
      thread_summary: 'Résumé récent',
      status: 'pending_etablissement',
      created_at: '2099-01-02T08:00:00.000Z',
      thread: {
        subject: 'Sujet A',
        participants: [{ email: 'john@example.com' }],
      },
    },
    {
      id: 's2',
      email_thread_id: 'th2',
      calendar_uid: 'uid-2',
      event_summary: 'Point équipe',
      event_dtstart: '2099-02-15T09:30:00.000Z',
      event_dtend: '2099-02-15T10:00:00.000Z',
      event_location: 'Visio',
      event_description: 'Standup',
      event_organizer: 'Bob',
      event_meeting_link: 'https://meet.local/c',
      event_attendees: [{ email: 'team@example.com', name: 'Team' }],
      thread_summary: 'Résumé équipe',
      status: 'pending_etablissement',
      created_at: '2099-02-01T08:00:00.000Z',
      thread: {
        subject: 'Sujet B',
        participants: [{ email: 'team@example.com' }],
      },
    },
  ],
  PROFILE_ROW: { id: 'profile-1' },
  SUGGESTION_DETAIL_CAL: {
    id: 's-cal',
    email_thread_id: 'th-cal',
    calendar_uid: 'uid-cal',
    event_summary: 'Démo produit',
    event_dtstart: '2099-03-01T14:00:00.000Z',
    event_dtend: '2099-03-01T15:15:00.000Z',
    event_location: 'Bureau',
    event_description: 'Description de la démo',
    event_organizer: 'Claire',
    event_meeting_link: 'https://meet.local/demo',
    event_attendees: [
      { email: 'a@example.com', name: 'Anne' },
      { email: 'b@example.com' },
    ],
    thread_summary: 'Contexte commercial',
    thread: { id: 'th-cal', subject: 'Démo' },
  },
  SUGGESTION_DETAIL_TASK: {
    id: 's-task',
    email_thread_id: 'th-task',
    calendar_uid: 'uid-task',
    event_summary: 'Réunion de suivi',
    event_dtstart: '2099-04-02T08:00:00.000Z',
    event_dtend: '2099-04-02T09:30:00.000Z',
    event_location: 'Salle 12',
    event_description: 'Ordre du jour détaillé',
    event_organizer: 'Marc',
    event_meeting_link: 'https://meet.local/follow',
    thread: { id: 'thread-55' },
  },
  DEFAULT_CATEGORY: { id: 'cat-reunion' },
  CREATED_EVENT: { id: 'event-1' },
  CREATED_TASK: { id: 'task-1' },
  NEW_CALENDAR: { id: 'cal-1' },
  mockFrom: vi.fn(),
  mockInvalidateQueries: vi.fn(),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: SANITIZE_FN,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper(client?: QueryClient) {
  const queryClient = client ?? createQueryClient();
  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(
    mockInvalidateQueries as () => Promise<void>,
  );

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return {
    queryClient,
    wrapper,
  };
}

type StepResult = { data?: unknown; error?: { message: string } | null };

function createBuilder(steps: Record<string, StepResult>) {
  let currentTable = '';
  const insertCalls: Array<{ table: string; values: unknown }> = [];
  const updateCalls: Array<{ table: string; values: unknown }> = [];
  const eqCalls: Array<{ table: string; args: [string, unknown] }> = [];

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push({ table: currentTable, args: [column, value] });
      return builder;
    }),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn((values: unknown) => {
      insertCalls.push({ table: currentTable, values });
      return builder;
    }),
    update: vi.fn((values: unknown) => {
      updateCalls.push({ table: currentTable, values });
      return builder;
    }),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => steps[`${currentTable}.single`] ?? { data: null, error: null }),
    maybeSingle: vi.fn(async () => steps[`${currentTable}.maybeSingle`] ?? { data: null, error: null }),
    then: (
      onFulfilled: (value: StepResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => {
      const step = Promise.resolve(steps[`${currentTable}.then`] ?? { data: null, error: null });
      return step.then(onFulfilled, onRejected);
    },
    catch: (onRejected: (reason: unknown) => unknown) => {
      const step = Promise.resolve(steps[`${currentTable}.then`] ?? { data: null, error: null });
      return step.catch(onRejected);
    },
  };

  mockFrom.mockImplementation((table: string) => {
    currentTable = table;
    return builder;
  });

  return { builder, insertCalls, updateCalls, eqCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
  AUTH_STATE.user = { id: 'u1', email: 't@t.co' };
});

describe('useCalendarSuggestions', () => {
  it('charge puis retourne les suggestions dédupliquées avec attendees parsés', async () => {
    createBuilder({
      'calendar_invitation_suggestions.then': {
        data: SUGGESTIONS_ROWS,
        error: null,
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCalendarSuggestions(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.suggestions).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('calendar_invitation_suggestions');
    expect(result.current.suggestions).toHaveLength(2);
    expect(result.current.suggestions.map((s) => s.id)).toEqual(['s1-new', 's2']);
    expect(result.current.suggestions[0].event_location).toBe('Salle B');
    expect(result.current.suggestions[0].thread?.subject).toBe('Sujet A');
    expect(result.current.suggestions[0].event_attendees).toEqual([
      { email: 'john@example.com', name: 'John' },
      { email: 'jane@example.com' },
    ]);
    expect(result.current.suggestions[1].event_attendees).toEqual([
      { email: 'team@example.com', name: 'Team' },
    ]);
  });

  it('retourne des suggestions vides quand la requête échoue', async () => {
    createBuilder({
      'calendar_invitation_suggestions.then': {
        data: null,
        error: { message: 'x' },
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCalendarSuggestions(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.suggestions).toEqual([]);
  });

  it('acceptToCalendar crée un calendrier si absent, crée l’événement, ajoute les participants et met à jour la suggestion', async () => {
    const { insertCalls, updateCalls, eqCalls } = createBuilder({
      'calendar_invitation_suggestions.then': {
        data: SUGGESTIONS_ROWS,
        error: null,
      },
      'profiles.maybeSingle': {
        data: PROFILE_ROW,
        error: null,
      },
      'calendar_invitation_suggestions.maybeSingle': {
        data: SUGGESTION_DETAIL_CAL,
        error: null,
      },
      'calendars.maybeSingle': {
        data: null,
        error: null,
      },
      'calendars.single': {
        data: NEW_CALENDAR,
        error: null,
      },
      'calendar_events.single': {
        data: CREATED_EVENT,
        error: null,
      },
      'event_attendees.then': {
        data: null,
        error: null,
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCalendarSuggestions(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.acceptToCalendar({ suggestionId: 's-cal' });
    });

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Succès',
          description: 'Événement ajouté à votre calendrier',
        }),
      );
    });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockFrom).toHaveBeenCalledWith('calendar_invitation_suggestions');
    expect(mockFrom).toHaveBeenCalledWith('calendars');
    expect(mockFrom).toHaveBeenCalledWith('calendar_events');
    expect(mockFrom).toHaveBeenCalledWith('event_attendees');

    expect(insertCalls).toContainEqual({
      table: 'calendars',
      values: {
        name: 'Mon calendrier',
        owner_id: 'u1',
        is_default: true,
        color: '#3b82f6',
        type: 'personal',
      },
    });

    expect(insertCalls).toContainEqual({
      table: 'calendar_events',
      values: {
        calendar_id: 'cal-1',
        title: 'Démo produit',
        start_time: '2099-03-01T14:00:00.000Z',
        end_time: '2099-03-01T15:15:00.000Z',
        location: 'Bureau',
        video_conference_url: 'https://meet.local/demo',
        description:
          '📝 Contexte des échanges:\nContexte commercial\n\n👥 Participants:\n• Anne (a@example.com)\n• b@example.com\n\n👤 Organisateur: Claire\n\n📄 Description originale:\nDescription de la démo',
        status: 'confirmed',
        visibility: 'private',
        created_by: 'u1',
      },
    });

    expect(insertCalls).toContainEqual({
      table: 'event_attendees',
      values: [
        {
          event_id: 'event-1',
          email: 'a@example.com',
          name: 'Anne',
          status: 'pending',
          role: 'attendee',
        },
        {
          event_id: 'event-1',
          email: 'b@example.com',
          name: null,
          status: 'pending',
          role: 'attendee',
        },
      ],
    });

    expect(updateCalls).toContainEqual({
      table: 'calendar_invitation_suggestions',
      values: expect.objectContaining({
        status: 'accepted',
        created_calendar_event_id: 'event-1',
        processed_by: 'profile-1',
      }),
    });

    expect(eqCalls).toContainEqual({
      table: 'calendar_invitation_suggestions',
      args: ['id', 's-cal'],
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendar-suggestions'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendar-events'] });
  });

  it('acceptSuggestion crée une tâche métier puis met à jour la suggestion et le thread', async () => {
    const { insertCalls, updateCalls, eqCalls } = createBuilder({
      'calendar_invitation_suggestions.then': {
        data: SUGGESTIONS_ROWS,
        error: null,
      },
      'profiles.maybeSingle': {
        data: PROFILE_ROW,
        error: null,
      },
      'calendar_invitation_suggestions.maybeSingle': {
        data: SUGGESTION_DETAIL_TASK,
        error: null,
      },
      'categories_taches.maybeSingle': {
        data: DEFAULT_CATEGORY,
        error: null,
      },
      'taches.single': {
        data: CREATED_TASK,
        error: null,
      },
      'calendar_invitation_suggestions.then': {
        data: null,
        error: null,
      },
      'email_threads.then': {
        data: null,
        error: null,
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCalendarSuggestions(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.acceptSuggestion({
        suggestionId: 's-task',
        etablissementId: 'eta-9',
      });
    });

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Succès',
          description: 'Invitation acceptée et tâche créée',
        }),
      );
    });

    expect(mockFrom).toHaveBeenCalledWith('categories_taches');
    expect(mockFrom).toHaveBeenCalledWith('taches');
    expect(mockFrom).toHaveBeenCalledWith('email_threads');

    expect(insertCalls).toContainEqual({
      table: 'taches',
      values: {
        titre: 'Réunion de suivi',
        description:
          '📹 Lien visio: https://meet.local/followOrdre du jour détaillé\n📍 Lieu: Salle 12\n👤 Organisateur: Marc\n⏱️ Durée: 90 minutes\n\n🔗 UID: uid-task',
        etablissement_id: 'eta-9',
        categorie_id: 'cat-reunion',
        priorite: 'medium',
        echeance: '2099-04-02',
        statut: 'A faire',
        archive: false,
      },
    });

    expect(updateCalls).toContainEqual({
      table: 'calendar_invitation_suggestions',
      values: expect.objectContaining({
        status: 'accepted',
        suggested_etablissement_id: 'eta-9',
        created_task_id: 'task-1',
        processed_by: 'profile-1',
      }),
    });

    expect(updateCalls).toContainEqual({
      table: 'email_threads',
      values: { etablissement_id: 'eta-9' },
    });

    expect(eqCalls).toContainEqual({
      table: 'email_threads',
      args: ['id', 'thread-55'],
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendar-suggestions'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['taches'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-threads'] });
  });

  it('rejectSuggestion met à jour le statut à rejected', async () => {
    const { updateCalls, eqCalls } = createBuilder({
      'calendar_invitation_suggestions.then': {
        data: SUGGESTIONS_ROWS,
        error: null,
      },
      'profiles.maybeSingle': {
        data: PROFILE_ROW,
        error: null,
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCalendarSuggestions(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.rejectSuggestion('s2');
    });

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Succès',
          description: 'Invitation rejetée',
        }),
      );
    });

    expect(updateCalls).toContainEqual({
      table: 'calendar_invitation_suggestions',
      values: expect.objectContaining({
        status: 'rejected',
        processed_by: 'profile-1',
      }),
    });
    expect(eqCalls).toContainEqual({
      table: 'calendar_invitation_suggestions',
      args: ['id', 's2'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendar-suggestions'] });
  });

  it('déclenche le toast d’erreur lors d’un échec de mutation', async () => {
    createBuilder({
      'calendar_invitation_suggestions.then': {
        data: SUGGESTIONS_ROWS,
        error: null,
      },
      'profiles.maybeSingle': {
        data: PROFILE_ROW,
        error: null,
      },
      'calendar_invitation_suggestions.maybeSingle': {
        data: null,
        error: { message: 'x' },
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCalendarSuggestions(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.acceptSuggestion({
        suggestionId: 'missing',
        etablissementId: 'eta-1',
      });
    });

    await waitFor(() => {
      expect(SANITIZE_FN).toHaveBeenCalled();
      expect(TOAST_FN).toHaveBeenCalledWith({
        title: 'Erreur',
        description: 'x',
        variant: 'destructive',
      });
    });
  });
});