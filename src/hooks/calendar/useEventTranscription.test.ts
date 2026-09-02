/* @vitest-environment jsdom */

import React, { type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useEventTranscription } from './useEventTranscription';

const {
  AUTH_STATE,
  DB_ROW,
  NULL_RESULT,
  SUPABASE_ERROR,
  mockFrom,
  mockIsOccurrenceId,
  mockParseOccurrenceId,
  mockDebugError,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  DB_ROW: {
    id: 'ts1',
    room_code: 'ROOM42',
    external_meeting_url: 'https://app.test/visio/ROOM42',
    title: '',
    started_at: null,
    ended_at: null,
    created_by: '',
    etablissement_id: null,
    partenaire_id: null,
    groupe_id: null,
    status: 'ended',
    summary: null,
    decisions: null,
    next_steps: null,
    full_transcript: null,
    language: '',
    calendar_event_id: 'event-parent',
    created_at: '',
    updated_at: '',
  },
  NULL_RESULT: { data: null, error: null },
  SUPABASE_ERROR: { data: null, error: { message: 'x' } },
  mockFrom: vi.fn(),
  mockIsOccurrenceId: vi.fn(),
  mockParseOccurrenceId: vi.fn(),
  mockDebugError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/recurrenceUtils', () => ({
  isOccurrenceId: mockIsOccurrenceId,
  parseOccurrenceId: mockParseOccurrenceId,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
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
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled?: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
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

  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient, children });
  };
}

describe('useEventTranscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOccurrenceId.mockReturnValue(false);
    mockParseOccurrenceId.mockReturnValue(null);
  });

  it('retourne isLoading puis mappe correctement une transcription trouvée par calendar_event_id', async () => {
    const builder = createQueryBuilder({ data: DB_ROW, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useEventTranscription('event-123', null), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.transcription).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith('visio_transcription_sessions');

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(builder.select).toHaveBeenCalledWith(
      'id, room_code, external_meeting_url, title, started_at, ended_at, created_by, etablissement_id, partenaire_id, groupe_id, status, summary, decisions, next_steps, full_transcript, language, calendar_event_id, created_at, updated_at'
    );
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(1);
    expect(builder.eq).toHaveBeenCalledWith('calendar_event_id', 'event-123');
    expect(builder.maybeSingle).toHaveBeenCalledTimes(1);

    expect(result.current.error).toBeNull();
    expect(result.current.transcription).toEqual({
      id: 'ts1',
      room_code: 'ROOM42',
      external_meeting_url: 'https://app.test/visio/ROOM42',
      title: 'Session de transcription',
      started_at: expect.any(String),
      ended_at: undefined,
      created_by: '',
      etablissement_id: undefined,
      partenaire_id: undefined,
      groupe_id: undefined,
      status: 'ended',
      summary: undefined,
      decisions: [],
      next_steps: [],
      full_transcript: undefined,
      language: 'fr-FR',
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });
  });

  it('utilise le parentId pour un occurrenceId récurrent', async () => {
    const builder = createQueryBuilder({ data: DB_ROW, error: null });
    mockFrom.mockReturnValue(builder);
    mockIsOccurrenceId.mockReturnValue(true);
    mockParseOccurrenceId.mockReturnValue({ parentId: 'event-parent' });

    const { result } = renderHook(() => useEventTranscription('occ-1', null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockIsOccurrenceId).toHaveBeenCalledWith('occ-1');
    expect(mockParseOccurrenceId).toHaveBeenCalledWith('occ-1');
    expect(builder.eq).toHaveBeenCalledWith('calendar_event_id', 'event-parent');
    expect(result.current.transcription?.id).toBe('ts1');
  });

  it('recherche par room_code extrait de l’URL de visio', async () => {
    const builder = createQueryBuilder({ data: DB_ROW, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(
      () => useEventTranscription(null, 'https://domain.test/path/visio/abc123'),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(builder.eq).toHaveBeenCalledWith('room_code', 'ABC123');
    expect(result.current.transcription?.room_code).toBe('ROOM42');
  });

  it('recherche par external_meeting_url si aucun room_code n’est trouvable', async () => {
    const builder = createQueryBuilder({ data: DB_ROW, error: null });
    mockFrom.mockReturnValue(builder);

    const url = 'https://meet.test/session?id=12';
    const { result } = renderHook(() => useEventTranscription(null, url), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(builder.eq).toHaveBeenCalledWith('external_meeting_url', url);
    expect(result.current.transcription?.external_meeting_url).toBe('https://app.test/visio/ROOM42');
  });

  it('retourne null sans requête si aucun identifiant n’est fourni', () => {
    const { result } = renderHook(() => useEventTranscription(null, null), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.transcription).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('retourne null quand maybeSingle ne trouve aucune session', async () => {
    const builder = createQueryBuilder(NULL_RESULT);
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useEventTranscription('event-404', null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(builder.eq).toHaveBeenCalledWith('calendar_event_id', 'event-404');
    expect(result.current.transcription).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('remonte une erreur quand Supabase échoue et log via debug.error', async () => {
    const builder = createQueryBuilder(SUPABASE_ERROR);
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useEventTranscription('event-error', null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).not.toBeNull();
    });

    expect(builder.eq).toHaveBeenCalledWith('calendar_event_id', 'event-error');
    expect(mockDebugError).toHaveBeenCalledWith('[useEventTranscription] Error:', { message: 'x' });
    expect(result.current.transcription).toBeNull();
    expect(result.current.error?.message).toBe('x');
  });
})