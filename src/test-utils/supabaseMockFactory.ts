/**
 * Shared Supabase mock factory for unit tests.
 * Provides a consistent mock pattern across all test files.
 *
 * Usage:
 *   import { createSupabaseMock, mockSupabaseModule } from '@/test-utils/supabaseMockFactory';
 *   vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
 */

import { vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

interface MockQueryResult {
  data: unknown;
  error: null | { message: string };
  count?: number;
}

type MockQueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  like: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
};

function createChainableMock(defaultResult: MockQueryResult): MockQueryBuilder {
  const mock: any = {};

  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'is', 'gte', 'lte', 'like', 'ilike',
    'order', 'limit', 'range',
  ];

  for (const method of chainMethods) {
    mock[method] = vi.fn().mockReturnValue(mock);
  }

  mock.single = vi.fn().mockResolvedValue(defaultResult);
  mock.maybeSingle = vi.fn().mockResolvedValue(defaultResult);
  mock.then = vi.fn((cb: (val: MockQueryResult) => void) => Promise.resolve(defaultResult).then(cb));

  // Make the mock itself thenable (so `await supabase.from('x').select()` works)
  mock[Symbol.for('nodejs.util.promisify.custom')] = undefined;

  return mock as MockQueryBuilder;
}

/**
 * Creates a Proxy-based chainable mock that resolves any chained method call
 * to the given resolved value. Supports `.then()` so it works with `await`.
 * 
 * Usage:
 *   const mock = createChainableProxy({ data: [], error: null });
 *   // mock.select().eq().order() → resolves to { data: [], error: null }
 */
export function createChainableProxy(resolvedValue: any) {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (cb: any) => Promise.resolve(resolvedValue).then(cb);
      }
      return vi.fn((..._args: any[]) => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

/**
 * Creates a simple chainable mock query builder with explicit methods.
 * Less flexible than createChainableProxy but easier to spy on.
 * 
 * Usage:
 *   const builder = createSimpleQueryBuilder([{ id: '1' }]);
 *   // builder.select().eq().order() → resolves to { data: [...], error: null }
 */
export function createSimpleQueryBuilder(resolvedData: any = [], resolvedError: any = null) {
  const createChain = (): any => ({
    select: vi.fn(() => createChain()),
    eq: vi.fn(() => createChain()),
    neq: vi.fn(() => createChain()),
    in: vi.fn(() => createChain()),
    is: vi.fn(() => createChain()),
    or: vi.fn(() => createChain()),
    gte: vi.fn(() => createChain()),
    lte: vi.fn(() => createChain()),
    like: vi.fn(() => createChain()),
    ilike: vi.fn(() => createChain()),
    order: vi.fn(() => Promise.resolve({ data: resolvedData, error: resolvedError })),
    limit: vi.fn(() => createChain()),
    range: vi.fn(() => createChain()),
    single: vi.fn(() => Promise.resolve({ data: resolvedData, error: resolvedError })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: resolvedData, error: resolvedError })),
    then: vi.fn((cb: any) => Promise.resolve({ data: resolvedData, error: resolvedError }).then(cb)),
  });
  return createChain();
}

export function createSupabaseMock(overrides?: {
  fromResults?: Record<string, MockQueryResult>;
  rpcResults?: Record<string, MockQueryResult>;
  functionsResults?: Record<string, MockQueryResult>;
  authUser?: { id: string; email: string } | null;
}) {
  const defaultResult: MockQueryResult = { data: [], error: null };

  const fromMock = vi.fn((table: string) => {
    const result = overrides?.fromResults?.[table] || defaultResult;
    return createChainableMock(result);
  });

  const rpcMock = vi.fn((fn: string, params?: unknown) => {
    const result = overrides?.rpcResults?.[fn] || defaultResult;
    return Promise.resolve(result);
  });

  const functionsInvokeMock = vi.fn((fn: string, opts?: unknown) => {
    const result = overrides?.functionsResults?.[fn] || defaultResult;
    return Promise.resolve(result);
  });

  const authUser = overrides?.authUser ?? { id: 'test-user-id', email: 'test@test.com' };

  return {
    from: fromMock,
    rpc: rpcMock,
    functions: { invoke: functionsInvokeMock },
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: authUser ? { user: authUser, access_token: 'mock-token' } : null },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'mock/path' }, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://mock.url/file' } }),
        download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    }),
    removeChannel: vi.fn(),
  };
}

/**
 * Returns a module-shaped mock suitable for vi.mock().
 * Usage: vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
 */
export function mockSupabaseModule(overrides?: Parameters<typeof createSupabaseMock>[0]) {
  const mock = createSupabaseMock(overrides);
  return {
    supabase: mock,
    default: mock,
  };
}
