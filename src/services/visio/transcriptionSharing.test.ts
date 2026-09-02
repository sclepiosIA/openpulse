const mocks = vi.hoisted(() => {
  type QueryResult = { data: unknown; error: unknown };
  type Fulfilled = (value: QueryResult) => unknown;
  type Rejected = (reason: unknown) => unknown;

  interface QueryBuilder {
    select: (...args: unknown[]) => QueryBuilder;
    eq: (...args: unknown[]) => QueryBuilder;
    gte: (...args: unknown[]) => QueryBuilder;
    lte: (...args: unknown[]) => QueryBuilder;
    in: (...args: unknown[]) => QueryBuilder;
    order: (...args: unknown[]) => QueryBuilder;
    limit: (...args: unknown[]) => QueryBuilder;
    insert: (...args: unknown[]) => QueryBuilder;
    update: (...args: unknown[]) => QueryBuilder;
    delete: (...args: unknown[]) => QueryBuilder;
    upsert: (...args: unknown[]) => QueryBuilder;
    match: (...args: unknown[]) => QueryBuilder;
    is: (...args: unknown[]) => QueryBuilder;
    filter: (...args: unknown[]) => QueryBuilder;
    neq: (...args: unknown[]) => QueryBuilder;
    range: (...args: unknown[]) => QueryBuilder;
    contains: (...args: unknown[]) => QueryBuilder;
    or: (...args: unknown[]) => QueryBuilder;
    single: (...args: unknown[]) => Promise<QueryResult>;
    maybeSingle: (...args: unknown[]) => Promise<QueryResult>;
    then: (onFulfilled: Fulfilled, onRejected?: Rejected) => Promise<unknown>;
    catch: (onRejected: Rejected) => Promise<unknown>;
  }

  const PARTICIPANT_ROWS = [
    {
      id: 'p1',
      display_name: 'Alice Martin',
      user_id: 'u1',
      profile: { email: 'alice@example.test' },
    },
    {
      id: 'p2',
      display_name: null,
      user_id: 'u2',
      profile: null,
    },
  ] as const;

  const STATUS_ROW = {
    status: 'completed',
    summary: 'Synthèse courte',
  } as const;

  const DB_ERROR = { message: 'x' } as const;

  const PARTICIPANTS_SUCCESS = { data: PARTICIPANT_ROWS, error: null };
  const PARTICIPANTS_EMPTY = { data: [], error: null };
  const QUERY_ERROR = { data: null, error: DB_ERROR };
  const STATUS_SUCCESS = { data: STATUS_ROW, error: null };
  const STATUS_NULL = { data: null, error: null };
  const STATUS_ERROR = { data: null, error: DB_ERROR };
  const INVOKE_SUCCESS = { data: null, error: null };
  const INVOKE_ERROR = { data: null, error: DB_ERROR };

  let queryResult: QueryResult = PARTICIPANTS_SUCCESS;
  let singleResult: QueryResult = STATUS_SUCCESS;
  let invokeResult: QueryResult = INVOKE_SUCCESS;

  let builder: QueryBuilder;

  builder = {
    select: vi.fn((..._args: unknown[]) => builder),
    eq: vi.fn((..._args: unknown[]) => builder),
    gte: vi.fn((..._args: unknown[]) => builder),
    lte: vi.fn((..._args: unknown[]) => builder),
    in: vi.fn((..._args: unknown[]) => builder),
    order: vi.fn((..._args: unknown[]) => builder),
    limit: vi.fn((..._args: unknown[]) => builder),
    insert: vi.fn((..._args: unknown[]) => builder),
    update: vi.fn((..._args: unknown[]) => builder),
    delete: vi.fn((..._args: unknown[]) => builder),
    upsert: vi.fn((..._args: unknown[]) => builder),
    match: vi.fn((..._args: unknown[]) => builder),
    is: vi.fn((..._args: unknown[]) => builder),
    filter: vi.fn((..._args: unknown[]) => builder),
    neq: vi.fn((..._args: unknown[]) => builder),
    range: vi.fn((..._args: unknown[]) => builder),
    contains: vi.fn((..._args: unknown[]) => builder),
    or: vi.fn((..._args: unknown[]) => builder),
    single: vi.fn((..._args: unknown[]) => Promise.resolve(singleResult)),
    maybeSingle: vi.fn((..._args: unknown[]) => Promise.resolve(singleResult)),
    then: vi.fn((onFulfilled: Fulfilled, onRejected?: Rejected) =>
      Promise.resolve(queryResult).then(onFulfilled, onRejected),
    ),
    catch: vi.fn((onRejected: Rejected) => Promise.resolve(queryResult).catch(onRejected)),
  };

  const mockFrom = vi.fn((_table: string) => builder);
  const mockInvoke = vi.fn((_name: string, _options: unknown) => Promise.resolve(invokeResult));

  return {
    PARTICIPANTS_SUCCESS,
    PARTICIPANTS_EMPTY,
    QUERY_ERROR,
    STATUS_SUCCESS,
    STATUS_NULL,
    STATUS_ERROR,
    INVOKE_SUCCESS,
    INVOKE_ERROR,
    builder,
    mockFrom,
    mockInvoke,
    setQueryResult: (result: QueryResult) => {
      queryResult = result;
    },
    setSingleResult: (result: QueryResult) => {
      singleResult = result;
    },
    setInvokeResult: (result: QueryResult) => {
      invokeResult = result;
    },
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.mockFrom,
    functions: {
      invoke: mocks.mockInvoke,
    },
  },
}));

import {
  fetchTranscriptionParticipants,
  fetchTranscriptionSessionStatus,
  sendTranscriptionEmail,
} from './transcriptionSharing';

describe('transcriptionSharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setQueryResult(mocks.PARTICIPANTS_SUCCESS);
    mocks.setSingleResult(mocks.STATUS_SUCCESS);
    mocks.setInvokeResult(mocks.INVOKE_SUCCESS);
  });

  describe('fetchTranscriptionParticipants', () => {
    it('charge et mappe les participants avec nom affiché et email', async () => {
      const result = await fetchTranscriptionParticipants('s1');

      expect(mocks.mockFrom).toHaveBeenCalledWith('visio_transcription_participants');
      expect(mocks.builder.select).toHaveBeenCalledWith(
        'id, display_name, user_id, profile:profiles(email)',
      );
      expect(mocks.builder.eq).toHaveBeenCalledWith('session_id', 's1');
      expect(result).toEqual([
        {
          id: 'p1',
          displayName: 'Alice Martin',
          email: 'alice@example.test',
        },
        {
          id: 'p2',
          displayName: 'Participant',
          email: undefined,
        },
      ]);
    });

    it('retourne une liste vide quand Supabase ne renvoie aucun participant', async () => {
      mocks.setQueryResult(mocks.PARTICIPANTS_EMPTY);

      const result = await fetchTranscriptionParticipants('s2');

      expect(mocks.mockFrom).toHaveBeenCalledWith('visio_transcription_participants');
      expect(mocks.builder.eq).toHaveBeenCalledWith('session_id', 's2');
      expect(result).toEqual([]);
    });

    it('propage les erreurs Supabase', async () => {
      mocks.setQueryResult(mocks.QUERY_ERROR);

      await expect(fetchTranscriptionParticipants('s3')).rejects.toMatchObject({ message: 'x' });

      expect(mocks.mockFrom).toHaveBeenCalledWith('visio_transcription_participants');
      expect(mocks.builder.eq).toHaveBeenCalledWith('session_id', 's3');
    });
  });

  describe('fetchTranscriptionSessionStatus', () => {
    it('charge le statut et le résumé de la session', async () => {
      const result = await fetchTranscriptionSessionStatus('s1');

      expect(mocks.mockFrom).toHaveBeenCalledWith('visio_transcription_sessions');
      expect(mocks.builder.select).toHaveBeenCalledWith('status, summary');
      expect(mocks.builder.eq).toHaveBeenCalledWith('id', 's1');
      expect(mocks.builder.maybeSingle).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        status: 'completed',
        summary: 'Synthèse courte',
      });
    });

    it('retourne null quand aucune session de transcription ne correspond', async () => {
      mocks.setSingleResult(mocks.STATUS_NULL);

      const result = await fetchTranscriptionSessionStatus('s2');

      expect(mocks.mockFrom).toHaveBeenCalledWith('visio_transcription_sessions');
      expect(mocks.builder.eq).toHaveBeenCalledWith('id', 's2');
      expect(result).toBeNull();
    });

    it('propage les erreurs Supabase pour le statut de session', async () => {
      mocks.setSingleResult(mocks.STATUS_ERROR);

      await expect(fetchTranscriptionSessionStatus('s3')).rejects.toMatchObject({ message: 'x' });

      expect(mocks.mockFrom).toHaveBeenCalledWith('visio_transcription_sessions');
      expect(mocks.builder.maybeSingle).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendTranscriptionEmail', () => {
    it('appelle la fonction edge avec le sessionId et les emails', async () => {
      await sendTranscriptionEmail('s1', ['alice@example.test', 'bob@example.test']);

      expect(mocks.mockInvoke).toHaveBeenCalledWith('send-transcription-email', {
        body: {
          sessionId: 's1',
          emails: ['alice@example.test', 'bob@example.test'],
        },
      });
    });

    it('propage les erreurs de la fonction edge', async () => {
      mocks.setInvokeResult(mocks.INVOKE_ERROR);

      await expect(sendTranscriptionEmail('s2', ['alice@example.test'])).rejects.toMatchObject({
        message: 'x',
      });

      expect(mocks.mockInvoke).toHaveBeenCalledWith('send-transcription-email', {
        body: {
          sessionId: 's2',
          emails: ['alice@example.test'],
        },
      });
    });
  });
});