import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisOfflineQueue, type QueuedMessage } from './useJarvisOfflineQueue';

const { mockInvoke, mockFrom, mockUseOfflineStatus, ONLINE, OFFLINE } = vi.hoisted(() => {
  const ONLINE = { isOnline: true, isOffline: false };
  const OFFLINE = { isOnline: false, isOffline: true };
  return {
    mockInvoke: vi.fn(),
    mockFrom: vi.fn(),
    mockUseOfflineStatus: vi.fn(() => ONLINE),
    ONLINE,
    OFFLINE,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const builder: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'gte', 'lte', 'in', 'order', 'limit', 'insert', 'update', 'delete', 'upsert'];
  for (const m of methods) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  builder.catch = () => builder;
  mockFrom.mockReturnValue(builder);
  return {
    supabase: {
      from: mockFrom,
      functions: { invoke: mockInvoke },
    },
  };
});

vi.mock('@/hooks/shared/useOfflineStatus', () => ({
  useOfflineStatus: mockUseOfflineStatus,
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ---- Fake in-memory IndexedDB ----
const storeData = new Map<string, QueuedMessage>();

interface FakeRequest {
  result: unknown;
  error: null;
  onsuccess: ((ev: { target: FakeRequest }) => void) | null;
  onerror: (() => void) | null;
}

function makeRequest(getResult: () => unknown): FakeRequest {
  const req: FakeRequest = { result: undefined, error: null, onsuccess: null, onerror: null };
  queueMicrotask(() => {
    req.result = getResult();
    if (req.onsuccess) req.onsuccess({ target: req });
  });
  return req;
}

const fakeStore = {
  put: (value: QueuedMessage) =>
    makeRequest(() => {
      storeData.set(value.id, value);
      return value.id;
    }),
  delete: (id: string) =>
    makeRequest(() => {
      storeData.delete(id);
      return undefined;
    }),
  getAll: () => makeRequest(() => Array.from(storeData.values())),
  clear: () =>
    makeRequest(() => {
      storeData.clear();
      return undefined;
    }),
  createIndex: vi.fn(),
};

const fakeDb = {
  objectStoreNames: { contains: () => true },
  transaction: () => ({ objectStore: () => fakeStore }),
};

const fakeIndexedDB = {
  open: () => makeRequest(() => fakeDb),
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function seedMessage(overrides: Partial<QueuedMessage>): QueuedMessage {
  return {
    id: 'seed-id',
    message: 'seed message',
    userId: 'user-1',
    priority: 'normal',
    createdAt: 1,
    retryCount: 0,
    status: 'pending',
    ...overrides,
  };
}

describe('useJarvisOfflineQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeData.clear();
    vi.stubGlobal('indexedDB', fakeIndexedDB);
    mockUseOfflineStatus.mockReturnValue(ONLINE);
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initialise avec une queue vide et aucun sync en cours', async () => {
    const { result } = renderHook(() => useJarvisOfflineQueue({ autoSync: false }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.queue).toEqual([]);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.failedCount).toBe(0);
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.lastSync).toBeNull();
  });

  it('charge la queue depuis IndexedDB triée par priorité (critical avant normal)', async () => {
    storeData.set('a', seedMessage({ id: 'a', priority: 'normal', createdAt: 1 }));
    storeData.set('b', seedMessage({ id: 'b', priority: 'critical', createdAt: 2 }));

    const { result } = renderHook(() => useJarvisOfflineQueue({ autoSync: false }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.queue).toHaveLength(2));
    expect(result.current.queue[0].id).toBe('b');
    expect(result.current.queue[1].id).toBe('a');
    expect(result.current.pendingCount).toBe(2);
  });

  it('enqueue ajoute un message avec les bonnes valeurs métier et persiste en DB', async () => {
    const { result } = renderHook(() => useJarvisOfflineQueue({ autoSync: false }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await Promise.resolve();
    });

    let id: string | null = null;
    await act(async () => {
      id = await result.current.enqueue('hello world', 'user-1', 'conv-1', 'critical');
    });

    expect(id).toBeTruthy();
    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].message).toBe('hello world');
    expect(result.current.queue[0].userId).toBe('user-1');
    expect(result.current.queue[0].conversationId).toBe('conv-1');
    expect(result.current.queue[0].priority).toBe('critical');
    expect(result.current.queue[0].status).toBe('pending');
    expect(result.current.queue[0].retryCount).toBe(0);
    expect(result.current.pendingCount).toBe(1);
    expect(storeData.size).toBe(1);
  });

  it('ignore les messages dupliqués dans la fenêtre de dédoublonnage', async () => {
    const { result } = renderHook(
      () => useJarvisOfflineQueue({ autoSync: false, dedupeTimeMs: 60000 }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await Promise.resolve();
    });

    let firstId: string | null = null;
    let secondId: string | null = null;
    await act(async () => {
      firstId = await result.current.enqueue('dup message', 'user-1');
      secondId = await result.current.enqueue('dup message', 'user-1');
    });

    expect(firstId).toBeTruthy();
    expect(secondId).toBeNull();
    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].message).toBe('dup message');
    expect(storeData.size).toBe(1);
  });

  it('sync traite les messages pending, appelle jarvis-brain et vide la queue', async () => {
    const { result } = renderHook(() => useJarvisOfflineQueue({ autoSync: false }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.enqueue('sync me', 'user-2', 'conv-2');
    });

    let outcome: { processed: number; failed: number } = { processed: -1, failed: -1 };
    await act(async () => {
      outcome = await result.current.sync();
    });

    expect(mockInvoke).toHaveBeenCalledWith('jarvis-brain', {
      body: {
        user_id: 'user-2',
        message: 'sync me',
        conversation_id: 'conv-2',
      },
    });
    expect(outcome).toEqual({ processed: 1, failed: 0 });
    expect(result.current.queue).toHaveLength(0);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.lastSync).toBeInstanceOf(Date);
    expect(result.current.isSyncing).toBe(false);
    expect(storeData.size).toBe(0);
  });

  it('marque le message en failed après échec quand maxRetries=1', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const { result } = renderHook(
      () => useJarvisOfflineQueue({ autoSync: false, maxRetries: 1 }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.enqueue('will fail', 'user-3');
    });

    let outcome: { processed: number; failed: number } = { processed: -1, failed: -1 };
    await act(async () => {
      outcome = await result.current.sync();
    });

    expect(outcome).toEqual({ processed: 0, failed: 1 });
    expect(result.current.failedCount).toBe(1);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.queue[0].status).toBe('failed');
    expect(result.current.queue[0].retryCount).toBe(1);
  });

  it('ne synchronise pas en mode hors-ligne', async () => {
    mockUseOfflineStatus.mockReturnValue(OFFLINE);

    const { result } = renderHook(() => useJarvisOfflineQueue({ autoSync: false }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.enqueue('offline message', 'user-4');
    });

    let outcome: { processed: number; failed: number } = { processed: -1, failed: -1 };
    await act(async () => {
      outcome = await result.current.sync();
    });

    expect(outcome).toEqual({ processed: 0, failed: 0 });
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.current.isOffline).toBe(true);
    expect(result.current.pendingCount).toBe(1);
  });

  it('clearQueue vide la queue et IndexedDB', async () => {
    const { result } = renderHook(() => useJarvisOfflineQueue({ autoSync: false }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.enqueue('to clear', 'user-5');
    });
    expect(result.current.queue).toHaveLength(1);

    await act(async () => {
      await result.current.clearQueue();
    });

    expect(result.current.queue).toEqual([]);
    expect(result.current.pendingCount).toBe(0);
    expect(storeData.size).toBe(0);
  });
});