const {
  EMAIL_ROWS,
  THREAD_FLAGS_ROW,
  ACCOUNTS_RESPONSE,
  THREAD_FLAGS_RESPONSE,
  ERROR_RESPONSE,
  mockFrom,
  mockSelect,
  mockEq,
  mockOr,
  mockOrder,
  mockMaybeSingle,
  queryState,
  resetSupabaseMocks,
} = vi.hoisted(() => {
  type QueryResult = {
    data: unknown;
    error: { message: string } | null;
  };

  type Fulfilled = ((value: QueryResult) => unknown) | null | undefined;
  type Rejected = ((reason: unknown) => unknown) | null | undefined;

  type Builder = {
    select: (...args: unknown[]) => Builder;
    eq: (...args: unknown[]) => Builder;
    gte: (...args: unknown[]) => Builder;
    lte: (...args: unknown[]) => Builder;
    in: (...args: unknown[]) => Builder;
    order: (...args: unknown[]) => Builder;
    limit: (...args: unknown[]) => Builder;
    insert: (...args: unknown[]) => Builder;
    update: (...args: unknown[]) => Builder;
    delete: (...args: unknown[]) => Builder;
    or: (...args: unknown[]) => Builder;
    neq: (...args: unknown[]) => Builder;
    is: (...args: unknown[]) => Builder;
    not: (...args: unknown[]) => Builder;
    single: (...args: unknown[]) => Promise<QueryResult>;
    maybeSingle: (...args: unknown[]) => Promise<QueryResult>;
    then: (onfulfilled?: Fulfilled, onrejected?: Rejected) => Promise<unknown>;
    catch: (onrejected?: Rejected) => Promise<unknown>;
  };

  const EMAIL_ROWS = [
    {
      id: 'account-1',
      email_address: 'ops@example.test',
      display_name: 'Ops Mailbox',
      is_active: true,
      sync_enabled: true,
      is_shared: false,
      last_sync_at: '2024-01-02T03:04:05.000Z',
      imap_host: 'imap.example.test',
      imap_port: 993,
      smtp_host: 'smtp.example.test',
      smtp_port: 587,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-03T00:00:00.000Z',
    },
    {
      id: 'account-2',
      email_address: 'shared@example.test',
      display_name: 'Shared Mailbox',
      is_active: true,
      sync_enabled: false,
      is_shared: true,
      last_sync_at: null,
      imap_host: 'imap.shared.test',
      imap_port: 993,
      smtp_host: 'smtp.shared.test',
      smtp_port: 465,
      created_at: '2024-02-01T00:00:00.000Z',
      updated_at: '2024-02-03T00:00:00.000Z',
    },
  ];

  const THREAD_FLAGS_ROW = {
    is_archived: null,
    is_spam: true,
  };

  const ACCOUNTS_RESPONSE: QueryResult = { data: EMAIL_ROWS, error: null };
  const THREAD_FLAGS_RESPONSE: QueryResult = { data: THREAD_FLAGS_ROW, error: null };
  const ERROR_RESPONSE: QueryResult = { data: null, error: { message: 'x' } };

  const queryState: { response: QueryResult } = {
    response: ACCOUNTS_RESPONSE,
  };

  let builder: Builder;

  const mockSelect = vi.fn((..._args: unknown[]) => builder);
  const mockEq = vi.fn((..._args: unknown[]) => builder);
  const mockGte = vi.fn((..._args: unknown[]) => builder);
  const mockLte = vi.fn((..._args: unknown[]) => builder);
  const mockIn = vi.fn((..._args: unknown[]) => builder);
  const mockOrder = vi.fn((..._args: unknown[]) => builder);
  const mockLimit = vi.fn((..._args: unknown[]) => builder);
  const mockInsert = vi.fn((..._args: unknown[]) => builder);
  const mockUpdate = vi.fn((..._args: unknown[]) => builder);
  const mockDelete = vi.fn((..._args: unknown[]) => builder);
  const mockOr = vi.fn((..._args: unknown[]) => builder);
  const mockNeq = vi.fn((..._args: unknown[]) => builder);
  const mockIs = vi.fn((..._args: unknown[]) => builder);
  const mockNot = vi.fn((..._args: unknown[]) => builder);
  const mockSingle = vi.fn((..._args: unknown[]) => Promise.resolve(queryState.response));
  const mockMaybeSingle = vi.fn((..._args: unknown[]) => Promise.resolve(queryState.response));
  const mockThen = vi.fn((onfulfilled?: Fulfilled, onrejected?: Rejected) => {
    const fulfilled = onfulfilled === null ? undefined : onfulfilled;
    const rejected = onrejected === null ? undefined : onrejected;
    return Promise.resolve(queryState.response).then(fulfilled, rejected);
  });
  const mockCatch = vi.fn((onrejected?: Rejected) => {
    const rejected = onrejected === null ? undefined : onrejected;
    return Promise.resolve(queryState.response).catch(rejected);
  });

  builder = {
    select: mockSelect,
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    in: mockIn,
    order: mockOrder,
    limit: mockLimit,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    or: mockOr,
    neq: mockNeq,
    is: mockIs,
    not: mockNot,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    then: mockThen,
    catch: mockCatch,
  };

  const mockFrom = vi.fn((..._args: unknown[]) => builder);

  const resetSupabaseMocks = () => {
    queryState.response = ACCOUNTS_RESPONSE;
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockEq.mockClear();
    mockGte.mockClear();
    mockLte.mockClear();
    mockIn.mockClear();
    mockOrder.mockClear();
    mockLimit.mockClear();
    mockInsert.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
    mockOr.mockClear();
    mockNeq.mockClear();
    mockIs.mockClear();
    mockNot.mockClear();
    mockSingle.mockClear();
    mockMaybeSingle.mockClear();
    mockThen.mockClear();
    mockCatch.mockClear();
  };

  return {
    EMAIL_ROWS,
    THREAD_FLAGS_ROW,
    ACCOUNTS_RESPONSE,
    THREAD_FLAGS_RESPONSE,
    ERROR_RESPONSE,
    mockFrom,
    mockSelect,
    mockEq,
    mockOr,
    mockOrder,
    mockMaybeSingle,
    queryState,
    resetSupabaseMocks,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { fetchEmailAccountsForProfile, fetchEmailThreadFlags } from './emailAccountsClient';

describe('emailAccountsClient', () => {
  beforeEach(() => {
    resetSupabaseMocks();
  });

  describe('fetchEmailAccountsForProfile', () => {
    it('récupère les comptes actifs du profil et les comptes partagés avec les colonnes complètes', async () => {
      queryState.response = ACCOUNTS_RESPONSE;

      const result = await fetchEmailAccountsForProfile('profile-1');

      expect(result).toEqual(EMAIL_ROWS);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'account-1',
        email_address: 'ops@example.test',
        display_name: 'Ops Mailbox',
        is_active: true,
        sync_enabled: true,
        is_shared: false,
        imap_port: 993,
        smtp_port: 587,
      });
      expect(result[1]).toMatchObject({
        id: 'account-2',
        email_address: 'shared@example.test',
        display_name: 'Shared Mailbox',
        is_shared: true,
        sync_enabled: false,
        last_sync_at: null,
      });

      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('user_email_accounts_safe');
      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockSelect).toHaveBeenCalledWith(
        'id, email_address, display_name, is_active, sync_enabled, is_shared, last_sync_at, imap_host, imap_port, smtp_host, smtp_port, created_at, updated_at',
      );
      expect(mockEq).toHaveBeenCalledTimes(1);
      expect(mockEq).toHaveBeenCalledWith('is_active', true);
      expect(mockOr).toHaveBeenCalledTimes(1);
      expect(mockOr).toHaveBeenCalledWith('profile_id.eq.profile-1,is_shared.eq.true');
      expect(mockOrder).toHaveBeenCalledTimes(1);
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('utilise les colonnes personnalisées quand elles sont fournies', async () => {
      queryState.response = ACCOUNTS_RESPONSE;

      const result = await fetchEmailAccountsForProfile('profile-2', {
        columns: 'id, email_address, is_shared',
      });

      expect(result).toEqual(EMAIL_ROWS);
      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockSelect).toHaveBeenCalledWith('id, email_address, is_shared');
      expect(mockOr).toHaveBeenCalledWith('profile_id.eq.profile-2,is_shared.eq.true');
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('retourne un tableau vide quand Supabase renvoie data null avec une erreur', async () => {
      queryState.response = ERROR_RESPONSE;

      const result = await fetchEmailAccountsForProfile('profile-error');

      expect(result).toEqual([]);
      expect(mockFrom).toHaveBeenCalledWith('user_email_accounts_safe');
      expect(mockEq).toHaveBeenCalledWith('is_active', true);
      expect(mockOr).toHaveBeenCalledWith('profile_id.eq.profile-error,is_shared.eq.true');
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true });
    });
  });

  describe('fetchEmailThreadFlags', () => {
    it('récupère les flags du thread et applique false par défaut quand is_archived est absent', async () => {
      queryState.response = THREAD_FLAGS_RESPONSE;

      const result = await fetchEmailThreadFlags('thread-1');

      expect(result).toEqual({
        is_archived: false,
        is_spam: true,
      });
      expect(THREAD_FLAGS_ROW).toEqual({
        is_archived: null,
        is_spam: true,
      });
      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('email_threads');
      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockSelect).toHaveBeenCalledWith('is_archived, is_spam');
      expect(mockEq).toHaveBeenCalledTimes(1);
      expect(mockEq).toHaveBeenCalledWith('id', 'thread-1');
      expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    });

    it('retourne null quand Supabase renvoie data null avec une erreur', async () => {
      queryState.response = ERROR_RESPONSE;

      const result = await fetchEmailThreadFlags('thread-error');

      expect(result).toBeNull();
      expect(mockFrom).toHaveBeenCalledWith('email_threads');
      expect(mockSelect).toHaveBeenCalledWith('is_archived, is_spam');
      expect(mockEq).toHaveBeenCalledWith('id', 'thread-error');
      expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    });
  });
});