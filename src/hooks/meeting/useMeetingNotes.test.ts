import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMeetingNotes } from './useMeetingNotes';
import type { TranscriptionNextStep } from '@/types/transcription';

const { ROWS, AUTH, mockFrom, mockToast, mockGetSession } = vi.hoisted(() => {
  const ROWS = [
    {
      id: 's1',
      title: 'Réunion budget',
      status: 'completed',
      summary: 'Résumé budget 2025',
      decisions: [{ decision: 'Valider le budget' }],
      next_steps: [{ task: 'Envoyer le rapport', assignee: 'Alice', deadline: '2025-03-01' }],
      full_transcript: 'transcript',
      language: 'fr',
      created_at: '2025-01-02T10:00:00Z',
      created_by: 'u1',
      started_at: null,
      ended_at: null,
      etablissement_id: null,
      partenaire_id: null,
      groupe_id: null,
      room_code: null,
      calendar_event_id: null,
      conversation_id: null,
      external_meeting_url: null,
      updated_at: '2025-01-02T10:00:00Z',
    },
    {
      id: 's2',
      title: 'Point équipe',
      status: 'processing',
      summary: null,
      decisions: null,
      next_steps: null,
      full_transcript: null,
      language: 'fr',
      created_at: '2025-01-01T10:00:00Z',
      created_by: 'u1',
      started_at: null,
      ended_at: null,
      etablissement_id: null,
      partenaire_id: null,
      groupe_id: null,
      room_code: null,
      calendar_event_id: null,
      conversation_id: null,
      external_meeting_url: null,
      updated_at: '2025-01-01T10:00:00Z',
    },
  ];
  const AUTH = { user: { id: 'u1', email: 't@t.co' }, session: { user: { id: 'u1' } }, isLoading: false };
  const mockFrom = vi.fn();
  const mockToast = vi.fn();
  const mockGetSession = vi.fn(() => Promise.resolve({ data: { session: null } }));
  return { ROWS, AUTH, mockFrom, mockToast, mockGetSession };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: { getSession: mockGetSession },
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

type QueryResult = { data: unknown; error: unknown };

function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    'select',
    'eq',
    'is',
    'ilike',
    'order',
    'limit',
    'gte',
    'lte',
    'in',
    'insert',
    'update',
    'delete',
  ];
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (
    onFulfilled?: (v: QueryResult) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  builder.catch = (onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).catch(onRejected);
  return builder;
}

function asSpy(fn: unknown) {
  return fn as ReturnType<typeof vi.fn>;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  mockFrom.mockReset();
  mockToast.mockReset();
});

describe('useMeetingNotes', () => {
  it('charge les sessions et normalise decisions/next_steps', async () => {
    const builder = makeBuilder({ data: ROWS, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useMeetingNotes(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.sessions[0].id).toBe('s1');
    expect(result.current.sessions[0].title).toBe('Réunion budget');
    expect(result.current.sessions[0].decisions).toEqual([{ decision: 'Valider le budget' }]);
    expect(result.current.sessions[1].title).toBe('Point équipe');
    expect(result.current.sessions[1].decisions).toEqual([]);
    expect(result.current.sessions[1].next_steps).toEqual([]);
    expect(result.current.uploadProgress).toEqual({ status: 'idle', message: '' });

    expect(mockFrom).toHaveBeenCalledWith('visio_transcription_sessions');
    expect(asSpy(builder.is)).toHaveBeenCalledWith('room_code', null);
    expect(asSpy(builder.order)).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(asSpy(builder.limit)).toHaveBeenCalledWith(100);
  });

  it('applique les filtres status, etablissementId et search', async () => {
    const builder = makeBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(
      () =>
        useMeetingNotes({
          status: 'completed',
          etablissementId: 'etab-1',
          search: 'budget',
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(asSpy(builder.eq)).toHaveBeenCalledWith('status', 'completed');
    expect(asSpy(builder.eq)).toHaveBeenCalledWith('etablissement_id', 'etab-1');
    expect(asSpy(builder.ilike)).toHaveBeenCalledWith('title', '%budget%');
    expect(result.current.sessions).toEqual([]);
  });

  it('passe en erreur quand supabase renvoie une erreur', async () => {
    const builder = makeBuilder({ data: null, error: { message: 'x' } });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useMeetingNotes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.sessions).toEqual([]);
  });

  it('getSession retourne une session normalisée ou null', async () => {
    const listBuilder = makeBuilder({ data: [], error: null });
    const singleBuilder = makeBuilder({ data: ROWS[1], error: null });
    mockFrom.mockReturnValue(listBuilder);

    const { result } = renderHook(() => useMeetingNotes(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockFrom.mockReturnValue(singleBuilder);
    let session: Awaited<ReturnType<typeof result.current.getSession>> = null;
    await act(async () => {
      session = await result.current.getSession('s2');
    });

    expect(asSpy(singleBuilder.eq)).toHaveBeenCalledWith('id', 's2');
    expect(session).not.toBeNull();
    expect(session?.id).toBe('s2');
    expect(session?.decisions).toEqual([]);
    expect(session?.next_steps).toEqual([]);

    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'not found' } }));
    let missing: Awaited<ReturnType<typeof result.current.getSession>> = null;
    await act(async () => {
      missing = await result.current.getSession('inconnu');
    });
    expect(missing).toBeNull();
  });

  it('createTaskFromStep récupère une catégorie par défaut et insère la tâche', async () => {
    const listBuilder = makeBuilder({ data: [], error: null });
    const catBuilder = makeBuilder({ data: { id: 'cat-1' }, error: null });
    const tacheBuilder = makeBuilder({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'categories_taches') return catBuilder;
      if (table === 'taches') return tacheBuilder;
      return listBuilder;
    });

    const { result } = renderHook(() => useMeetingNotes(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const step: TranscriptionNextStep = {
      task: 'Envoyer le rapport',
      assignee: 'Alice',
      deadline: '2025-03-01',
    } as TranscriptionNextStep;

    await act(async () => {
      await result.current.createTaskFromStep(step, 'etab-1');
    });

    expect(mockFrom).toHaveBeenCalledWith('categories_taches');
    expect(asSpy(tacheBuilder.insert)).toHaveBeenCalledWith({
      titre: 'Envoyer le rapport',
      description: "Tâche issue d'une note de réunion.\nAssigné à: Alice",
      etablissement_id: 'etab-1',
      categorie_id: 'cat-1',
      echeance: '2025-03-01',
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Tâche créée',
      description: 'Envoyer le rapport',
    });
  });

  it('createTaskFromStep affiche une erreur si aucune catégorie disponible', async () => {
    const listBuilder = makeBuilder({ data: [], error: null });
    const catBuilder = makeBuilder({ data: null, error: null });
    const tacheBuilder = makeBuilder({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'categories_taches') return catBuilder;
      if (table === 'taches') return tacheBuilder;
      return listBuilder;
    });

    const { result } = renderHook(() => useMeetingNotes(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const step: TranscriptionNextStep = { task: 'Tâche orpheline' } as TranscriptionNextStep;

    await act(async () => {
      await result.current.createTaskFromStep(step);
    });

    expect(asSpy(tacheBuilder.insert)).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Aucune catégorie de tâche disponible',
      variant: 'destructive',
    });
  });

  it('createEventFromStep insère un événement de 9h à 10h le jour de la deadline', async () => {
    const listBuilder = makeBuilder({ data: [], error: null });
    const eventBuilder = makeBuilder({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'calendar_events') return eventBuilder;
      return listBuilder;
    });

    const { result } = renderHook(() => useMeetingNotes(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const step: TranscriptionNextStep = {
      task: 'Préparer la présentation',
      assignee: 'Bob',
      deadline: '2025-03-01',
    } as TranscriptionNextStep;

    await act(async () => {
      await result.current.createEventFromStep(step, 'cal-1', 'etab-2');
    });

    expect(mockFrom).toHaveBeenCalledWith('calendar_events');
    const insertSpy = asSpy(eventBuilder.insert);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const payload = insertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.title).toBe('Préparer la présentation');
    expect(payload.description).toBe("Événement issu d'une note de réunion.\nAssigné à: Bob");
    expect(payload.calendar_id).toBe('cal-1');
    expect(payload.etablissement_id).toBe('etab-2');
    expect(payload.created_by).toBe('u1');

    const start = new Date(payload.start_time as string);
    const end = new Date(payload.end_time as string);
    expect(start.getHours()).toBe(9);
    expect(end.getHours()).toBe(10);
    expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000);

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Événement créé',
      description: 'Préparer la présentation',
    });
  });

  it('createEventFromStep ne fait rien sans deadline', async () => {
    const listBuilder = makeBuilder({ data: [], error: null });
    const eventBuilder = makeBuilder({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'calendar_events') return eventBuilder;
      return listBuilder;
    });

    const { result } = renderHook(() => useMeetingNotes(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const step: TranscriptionNextStep = { task: 'Sans date' } as TranscriptionNextStep;

    await act(async () => {
      await result.current.createEventFromStep(step, 'cal-1');
    });

    expect(asSpy(eventBuilder.insert)).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });
});