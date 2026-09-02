const {
  EMAIL_DRAFT_ROWS,
  EMPTY_RESULT,
  ERROR_RESULT,
  SUCCESS_RESULT,
  mockFrom,
  supabaseState,
} = vi.hoisted(() => {
  const EMAIL_DRAFT_ROWS = [
    {
      id: 'draft-1',
      subject: 'Follow-up',
      body: 'Bonjour',
      updated_at: '2024-01-02T10:00:00.000Z',
      account: { email_address: 'sender@example.test' },
    },
    {
      id: 'draft-2',
      subject: 'Welcome',
      body: 'Salut',
      updated_at: '2024-01-01T09:00:00.000Z',
      account: { email_address: 'team@example.test' },
    },
  ];

  type EmailDraftRow = (typeof EMAIL_DRAFT_ROWS)[number];
  type SupabaseError = { message: string };
  type QueryResult = { data: EmailDraftRow[] | null; error: SupabaseError | null };
  type ChainMethod = (...parameters: unknown[]) => QueryBuilder;
  type QueryBuilder = {
    select: ChainMethod;
    eq: ChainMethod;
    gte: ChainMethod;
    lte: ChainMethod;
    in: ChainMethod;
    order: ChainMethod;
    limit: ChainMethod;
    insert: ChainMethod;
    update: ChainMethod;
    delete: ChainMethod;
    upsert: ChainMethod;
    neq: ChainMethod;
    is: ChainMethod;
    not: ChainMethod;
    or: ChainMethod;
    range: ChainMethod;
    single: () => Promise<QueryResult>;
    maybeSingle: () => Promise<QueryResult>;
    then: Promise<QueryResult>['then'];
    catch: Promise<QueryResult>['catch'];
  };

  const SUCCESS_RESULT: QueryResult = { data: EMAIL_DRAFT_ROWS, error: null };
  const EMPTY_RESULT: QueryResult = { data: null, error: null };
  const ERROR_RESULT: QueryResult = { data: null, error: { message: 'x' } };

  const supabaseState: {
    result: QueryResult;
    builders: QueryBuilder[];
  } = {
    result: SUCCESS_RESULT,
    builders: [],
  };

  const createBuilder = (): QueryBuilder => {
    let builder: QueryBuilder;

    const chain = (): ChainMethod => vi.fn((..._parameters: unknown[]) => builder);

    builder = {
      select: chain(),
      eq: chain(),
      gte: chain(),
      lte: chain(),
      in: chain(),
      order: chain(),
      limit: chain(),
      insert: chain(),
      update: chain(),
      delete: chain(),
      upsert: chain(),
      neq: chain(),
      is: chain(),
      not: chain(),
      or: chain(),
      range: chain(),
      single: vi.fn(() => Promise.resolve(supabaseState.result)),
      maybeSingle: vi.fn(() => Promise.resolve(supabaseState.result)),
      then: (onfulfilled, onrejected) =>
        Promise.resolve(supabaseState.result).then(onfulfilled, onrejected),
      catch: (onrejected) => Promise.resolve(supabaseState.result).catch(onrejected),
    };

    supabaseState.builders.push(builder);
    return builder;
  };

  const mockFrom = vi.fn((_table: string) => createBuilder());

  return {
    EMAIL_DRAFT_ROWS,
    EMPTY_RESULT,
    ERROR_RESULT,
    SUCCESS_RESULT,
    mockFrom,
    supabaseState,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { fetchAllEmailDrafts } from './emailDraftsQueries';

type EmailDraftForTest = {
  id: string;
  subject: string;
  body: string;
  updated_at: string;
  account: { email_address: string };
};

describe('fetchAllEmailDrafts', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    supabaseState.builders.length = 0;
    supabaseState.result = SUCCESS_RESULT;
  });

  it('fetches all email drafts ordered by latest update', async () => {
    const result = (await fetchAllEmailDrafts()) as EmailDraftForTest[];

    expect(result).toBe(EMAIL_DRAFT_ROWS);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'draft-1',
      subject: 'Follow-up',
      body: 'Bonjour',
      updated_at: '2024-01-02T10:00:00.000Z',
      account: { email_address: 'sender@example.test' },
    });
    expect(result[1]).toMatchObject({
      id: 'draft-2',
      subject: 'Welcome',
      account: { email_address: 'team@example.test' },
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('email_drafts');

    const builder = supabaseState.builders[0];
    expect(builder.select).toHaveBeenCalledTimes(1);
    expect(builder.select).toHaveBeenCalledWith('*, account:user_email_accounts(email_address)');
    expect(builder.order).toHaveBeenCalledTimes(1);
    expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false });
  });

  it('returns an empty array when Supabase data is null', async () => {
    supabaseState.result = EMPTY_RESULT;

    const result = await fetchAllEmailDrafts();

    expect(result).toEqual([]);
    expect(mockFrom).toHaveBeenCalledWith('email_drafts');

    const builder = supabaseState.builders[0];
    expect(builder.select).toHaveBeenCalledWith('*, account:user_email_accounts(email_address)');
    expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false });
  });

  it('throws the Supabase error when the query fails', async () => {
    supabaseState.result = ERROR_RESULT;

    await expect(fetchAllEmailDrafts()).rejects.toMatchObject({ message: 'x' });

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('email_drafts');

    const builder = supabaseState.builders[0];
    expect(builder.select).toHaveBeenCalledWith('*, account:user_email_accounts(email_address)');
    expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false });
  });
});