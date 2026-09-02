const {
  SUCCESS_RESULT,
  ERROR_RESULT,
  mockFrom,
  mockSelect,
  mockEq,
  mockGte,
  mockLte,
  mockIn,
  mockOrder,
  mockLimit,
  mockInsert,
  mockUpdate,
  mockDelete,
  setQueryResult,
} = vi.hoisted(() => {
  type QueryError = { message: string };
  type QueryResult = { data: null; error: QueryError | null };
  type ThenFn = PromiseLike<QueryResult>['then'];
  type CatchFn = <TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ) => Promise<QueryResult | TResult>;

  interface ChainBuilder {
    select: (columns?: string) => ChainBuilder;
    eq: (column: string, value: unknown) => ChainBuilder;
    gte: (column: string, value: unknown) => ChainBuilder;
    lte: (column: string, value: unknown) => ChainBuilder;
    in: (column: string, values: readonly unknown[]) => ChainBuilder;
    order: (column: string, options?: unknown) => ChainBuilder;
    limit: (count: number) => ChainBuilder;
    insert: (values?: unknown) => ChainBuilder;
    update: (values?: unknown) => ChainBuilder;
    delete: () => ChainBuilder;
    single: () => Promise<QueryResult>;
    maybeSingle: () => Promise<QueryResult>;
    then: ThenFn;
    catch: CatchFn;
  }

  const SUCCESS_RESULT: QueryResult = { data: null, error: null };
  const ERROR_RESULT: QueryResult = { data: null, error: { message: 'x' } };
  let currentResult: QueryResult = SUCCESS_RESULT;

  let builder: ChainBuilder;

  const chain = () => builder;
  const resolveCurrent = () => Promise.resolve(currentResult);

  const thenImpl: ThenFn = (onfulfilled, onrejected) =>
    Promise.resolve(currentResult).then(onfulfilled, onrejected);

  const catchImpl: CatchFn = (onrejected) => Promise.resolve(currentResult).catch(onrejected);

  builder = {
    select: vi.fn(chain),
    eq: vi.fn(chain),
    gte: vi.fn(chain),
    lte: vi.fn(chain),
    in: vi.fn(chain),
    order: vi.fn(chain),
    limit: vi.fn(chain),
    insert: vi.fn(chain),
    update: vi.fn(chain),
    delete: vi.fn(chain),
    single: vi.fn(resolveCurrent),
    maybeSingle: vi.fn(resolveCurrent),
    then: vi.fn(thenImpl) as unknown as ThenFn,
    catch: vi.fn(catchImpl) as unknown as CatchFn,
  };

  return {
    SUCCESS_RESULT,
    ERROR_RESULT,
    mockFrom: vi.fn(() => builder),
    mockSelect: builder.select,
    mockEq: builder.eq,
    mockGte: builder.gte,
    mockLte: builder.lte,
    mockIn: builder.in,
    mockOrder: builder.order,
    mockLimit: builder.limit,
    mockInsert: builder.insert,
    mockUpdate: builder.update,
    mockDelete: builder.delete,
    setQueryResult: (result: QueryResult) => {
      currentResult = result;
    },
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { deleteScheduledPost } from './scheduledPosts';

describe('deleteScheduledPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setQueryResult(SUCCESS_RESULT);
  });

  it('supprime le post planifié dans la table social_scheduled_posts avec le bon identifiant', async () => {
    await expect(deleteScheduledPost('post-1')).resolves.toBeUndefined();

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('social_scheduled_posts');
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockEq).toHaveBeenCalledTimes(1);
    expect(mockEq).toHaveBeenCalledWith('id', 'post-1');

    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockGte).not.toHaveBeenCalled();
    expect(mockLte).not.toHaveBeenCalled();
    expect(mockIn).not.toHaveBeenCalled();
    expect(mockOrder).not.toHaveBeenCalled();
    expect(mockLimit).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('propage l’erreur Supabase quand la suppression échoue', async () => {
    setQueryResult(ERROR_RESULT);

    await expect(deleteScheduledPost('post-error')).rejects.toMatchObject({ message: 'x' });

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('social_scheduled_posts');
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockEq).toHaveBeenCalledTimes(1);
    expect(mockEq).toHaveBeenCalledWith('id', 'post-error');
  });
});