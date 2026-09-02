const {
  ROWS,
  EMPTY_ROWS,
  SUPABASE_ERROR,
  mockFrom,
  builder,
  state,
  resetSupabaseMock,
} = vi.hoisted(() => {
  type QueryError = { message: string };
  type QueryResult = { data: unknown; error: QueryError | null };
  type FulfilledHandler = ((value: QueryResult) => unknown) | null | undefined;
  type RejectedHandler = ((reason: unknown) => unknown) | null | undefined;

  const ROWS = [
    {
      id: 'tr_1',
      token: 'tok-a',
      subject: 'Rapport mensuel',
      expires_at: '2030-01-02T03:04:05.000Z',
      file_count: 2,
      total_size_bytes: 2048,
      download_count: 1,
      purged_at: null,
      created_at: '2025-01-03T10:00:00.000Z',
    },
    {
      id: 'tr_2',
      token: 'tok-b',
      subject: null,
      expires_at: null,
      file_count: 0,
      total_size_bytes: 0,
      download_count: 3,
      purged_at: '2025-01-04T10:00:00.000Z',
      created_at: '2025-01-02T10:00:00.000Z',
    },
  ];

  const EMPTY_ROWS: typeof ROWS = [];
  const SUPABASE_ERROR = { message: 'x' };

  const state: { result: QueryResult } = {
    result: { data: ROWS, error: null },
  };

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
    then: vi.fn(),
    catch: vi.fn(),
  };

  builder.select.mockImplementation(() => builder);
  builder.eq.mockImplementation(() => builder);
  builder.gte.mockImplementation(() => builder);
  builder.lte.mockImplementation(() => builder);
  builder.in.mockImplementation(() => builder);
  builder.order.mockImplementation(() => builder);
  builder.limit.mockImplementation(() => builder);
  builder.insert.mockImplementation(() => builder);
  builder.update.mockImplementation(() => builder);
  builder.delete.mockImplementation(() => builder);
  builder.upsert.mockImplementation(() => builder);
  builder.single.mockImplementation(() => Promise.resolve(state.result));
  builder.maybeSingle.mockImplementation(() => Promise.resolve(state.result));
  builder.then.mockImplementation((onFulfilled?: FulfilledHandler, onRejected?: RejectedHandler) =>
    Promise.resolve(state.result).then(onFulfilled, onRejected)
  );
  builder.catch.mockImplementation((onRejected?: RejectedHandler) =>
    Promise.resolve(state.result).catch(onRejected)
  );

  const mockFrom = vi.fn(() => builder);

  const resetSupabaseMock = () => {
    state.result = { data: ROWS, error: null };
    mockFrom.mockClear();
    builder.select.mockClear();
    builder.eq.mockClear();
    builder.gte.mockClear();
    builder.lte.mockClear();
    builder.in.mockClear();
    builder.order.mockClear();
    builder.limit.mockClear();
    builder.insert.mockClear();
    builder.update.mockClear();
    builder.delete.mockClear();
    builder.upsert.mockClear();
    builder.single.mockClear();
    builder.maybeSingle.mockClear();
    builder.then.mockClear();
    builder.catch.mockClear();
  };

  return {
    ROWS,
    EMPTY_ROWS,
    SUPABASE_ERROR,
    mockFrom,
    builder,
    state,
    resetSupabaseMock,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { deleteEmailTransfer, fetchMyEmailTransfers } from './emailTransfers';

const EXPECTED_COLS =
  'id,token,subject,expires_at,file_count,total_size_bytes,download_count,purged_at,created_at';

describe('emailTransfers', () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  describe('fetchMyEmailTransfers', () => {
    it('récupère les transferts email avec la limite par défaut et les colonnes attendues', async () => {
      const result = await fetchMyEmailTransfers();

      expect(result).toEqual(ROWS);
      expect(result).toHaveLength(2);
      expect(result.at(0)).toMatchObject({
        id: 'tr_1',
        token: 'tok-a',
        subject: 'Rapport mensuel',
        expires_at: '2030-01-02T03:04:05.000Z',
        file_count: 2,
        total_size_bytes: 2048,
        download_count: 1,
        purged_at: null,
        created_at: '2025-01-03T10:00:00.000Z',
      });
      expect(result.at(1)).toMatchObject({
        id: 'tr_2',
        token: 'tok-b',
        subject: null,
        expires_at: null,
        file_count: 0,
        total_size_bytes: 0,
        download_count: 3,
        purged_at: '2025-01-04T10:00:00.000Z',
        created_at: '2025-01-02T10:00:00.000Z',
      });

      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('email_transfers');
      expect(builder.select).toHaveBeenCalledTimes(1);
      expect(builder.select).toHaveBeenCalledWith(EXPECTED_COLS);
      expect(builder.order).toHaveBeenCalledTimes(1);
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(builder.limit).toHaveBeenCalledTimes(1);
      expect(builder.limit).toHaveBeenCalledWith(50);
      expect(builder.then).toHaveBeenCalledTimes(1);
    });

    it('utilise la limite fournie en option', async () => {
      const result = await fetchMyEmailTransfers({ limit: 1 });

      expect(result).toEqual(ROWS);
      expect(builder.limit).toHaveBeenCalledTimes(1);
      expect(builder.limit).toHaveBeenCalledWith(1);
    });

    it('retourne un tableau vide quand Supabase renvoie data null sans erreur', async () => {
      state.result = { data: null, error: null };

      const result = await fetchMyEmailTransfers();

      expect(result).toEqual(EMPTY_ROWS);
      expect(mockFrom).toHaveBeenCalledWith('email_transfers');
      expect(builder.select).toHaveBeenCalledWith(EXPECTED_COLS);
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(builder.limit).toHaveBeenCalledWith(50);
    });

    it('rejette avec l erreur Supabase quand la requête échoue', async () => {
      state.result = { data: null, error: SUPABASE_ERROR };

      await expect(fetchMyEmailTransfers()).rejects.toEqual(SUPABASE_ERROR);

      expect(mockFrom).toHaveBeenCalledWith('email_transfers');
      expect(builder.select).toHaveBeenCalledWith(EXPECTED_COLS);
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(builder.limit).toHaveBeenCalledWith(50);
    });
  });

  describe('deleteEmailTransfer', () => {
    it('supprime le transfert email correspondant à l id fourni', async () => {
      const result = await deleteEmailTransfer('tr_1');

      expect(result).toBeUndefined();
      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('email_transfers');
      expect(builder.delete).toHaveBeenCalledTimes(1);
      expect(builder.eq).toHaveBeenCalledTimes(1);
      expect(builder.eq).toHaveBeenCalledWith('id', 'tr_1');
      expect(builder.then).toHaveBeenCalledTimes(1);
    });

    it('rejette avec l erreur Supabase quand la suppression échoue', async () => {
      state.result = { data: null, error: SUPABASE_ERROR };

      await expect(deleteEmailTransfer('tr_2')).rejects.toEqual(SUPABASE_ERROR);

      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('email_transfers');
      expect(builder.delete).toHaveBeenCalledTimes(1);
      expect(builder.eq).toHaveBeenCalledTimes(1);
      expect(builder.eq).toHaveBeenCalledWith('id', 'tr_2');
    });
  });
});