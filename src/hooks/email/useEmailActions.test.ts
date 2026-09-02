import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  RESPONSES,
  LAST_UPDATED,
  mockFrom,
  toastSuccess,
  toastInfo,
  handleError,
  debugLog,
  debugError,
} = vi.hoisted(() => {
  const RESPONSES: Record<string, unknown> = {};
  const LAST_UPDATED: Record<string, unknown> = {};

  function builderFactory(table: string) {
    const builder: {
      lastOp: string;
      selectOpts?: unknown;
      update(payload?: unknown): typeof builder;
      delete(): typeof builder;
      insert(): typeof builder;
      select(cols?: unknown, opts?: unknown): typeof builder;
      maybeSingle(): typeof builder;
      eq(col?: unknown, val?: unknown): typeof builder;
      in(col?: unknown, vals?: unknown): typeof builder;
      then(resolve?: (value: unknown) => unknown, reject?: (reason?: unknown) => unknown): Promise<unknown>;
      catch(reject?: (reason?: unknown) => unknown): Promise<unknown>;
    } = {
      lastOp: 'default',
      update(payload?: unknown) {
        LAST_UPDATED[table] = payload;
        this.lastOp = 'update';
        return this;
      },
      delete() {
        this.lastOp = 'delete';
        return this;
      },
      insert() {
        this.lastOp = 'insert';
        return this;
      },
      select(_cols?: unknown, opts?: unknown) {
        this.lastOp = 'select';
        this.selectOpts = opts;
        return this;
      },
      maybeSingle() {
        this.lastOp = 'select:maybeSingle';
        return this;
      },
      eq(_col?: unknown, _val?: unknown) {
        return this;
      },
      in(_col?: unknown, _vals?: unknown) {
        this.lastOp = 'in';
        return this;
      },
      then(resolve?: (value: unknown) => unknown, reject?: (reason?: unknown) => unknown) {
        const keyExact = `${table}:${this.lastOp}`;
        const keyBase = `${table}:${this.lastOp.split(':')[0]}`;
        const res = RESPONSES[keyExact] ?? RESPONSES[keyBase] ?? RESPONSES[table] ?? { data: null, error: null };
        return Promise.resolve(res).then(resolve as (value: unknown) => unknown, reject);
      },
      catch(reject?: (reason?: unknown) => unknown) {
        const key = `${table}:${this.lastOp}`;
        const res = RESPONSES[key] ?? RESPONSES[table] ?? { data: null, error: null };
        return Promise.resolve(res).catch(reject);
      },
    };
    return builder;
  }

  const mockFrom = vi.fn((table: string) => builderFactory(table));

  const toastSuccess = vi.fn();
  const toastInfo = vi.fn();

  const handleError = vi.fn();
  const debugLog = vi.fn();
  const debugError = vi.fn();

  return { RESPONSES, LAST_UPDATED, mockFrom, toastSuccess, toastInfo, handleError, debugLog, debugError };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mockFrom } }));

vi.mock('sonner', () => ({ toast: { success: toastSuccess, info: toastInfo } }));

vi.mock('../shared/useErrorHandler', () => ({ useErrorHandler: () => ({ handleError }) }));

vi.mock('@/lib/debug', () => ({ debug: { log: debugLog, error: debugError } }));

const { useEmailActions } = await import('./useEmailActions');

describe('useEmailActions', () => {
  let qc: QueryClient;
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactElement;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(RESPONSES).forEach((k) => {
      // @ts-expect-error dynamic clear
      delete RESPONSES[k];
    });
    Object.keys(LAST_UPDATED).forEach((k) => {
      // @ts-expect-error dynamic clear
      delete LAST_UPDATED[k];
    });

    qc = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    qc.invalidateQueries = vi.fn();

    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
  });

  it('archiveThread - success: updates, toasts and invalidates cache', async () => {
    RESPONSES['email_threads:update'] = { data: null, error: null };

    const { result } = renderHook(() => useEmailActions(), { wrapper });

    await act(async () => {
      await result.current.archiveThread('thread-123');
    });

    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(toastSuccess).toHaveBeenCalledWith('Email archivé');
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-threads'] });
    expect(debugLog).toHaveBeenCalledWith('📦 Archiving thread:', 'thread-123');
  });

  it('archiveThread - error: calls handleError with the original error and message', async () => {
    const errorObj = { message: 'boom' };
    RESPONSES['email_threads:update'] = { data: null, error: errorObj };

    const { result } = renderHook(() => useEmailActions(), { wrapper });

    await act(async () => {
      await result.current.archiveThread('thread-err');
    });

    expect(handleError).toHaveBeenCalledWith(errorObj, "Erreur lors de l'archivage de l'email");
  });

  it('deleteThread permanent - uses delete and shows permanent message', async () => {
    RESPONSES['email_threads:delete'] = { data: null, error: null };

    const { result } = renderHook(() => useEmailActions(), { wrapper });

    await act(async () => {
      await result.current.deleteThread('t-delete', true);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(toastSuccess).toHaveBeenCalledWith('Email supprimé définitivement');
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-threads'] });
    expect(debugLog).toHaveBeenCalledWith('🗑️ Deleting thread:', 't-delete', 'permanent:', true);
  });

  it('addTag - when tag already present shows info and does not call update', async () => {
    RESPONSES['email_threads:select:maybeSingle'] = { data: { tags: ['existing'] }, error: null };

    const { result } = renderHook(() => useEmailActions(), { wrapper });

    const beforeCalls = mockFrom.mock.calls.length;

    await act(async () => {
      await result.current.addTag('thread-xyz', 'existing');
    });

    const afterCalls = mockFrom.mock.calls.length;
    expect(afterCalls - beforeCalls).toBe(1);
    expect(toastInfo).toHaveBeenCalledWith('Tag déjà présent');
  });

  it('markAsUnread - updates thread unread_count based on messages length and invalidates caches', async () => {
    RESPONSES['email_messages:select'] = { data: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }], error: null };
    RESPONSES['email_threads:update'] = { data: null, error: null };
    RESPONSES['email_messages:update'] = { data: null, error: null };

    const { result } = renderHook(() => useEmailActions(), { wrapper });

    await act(async () => {
      await result.current.markAsUnread('thread-abc');
    });

    expect((LAST_UPDATED['email_threads'] as unknown as { unread_count?: number }).unread_count).toBe(3);
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-threads'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-unread-count'] });
  });

  it('markAsRead - when messages update errors, debug.error is called and caches invalidated', async () => {
    RESPONSES['email_threads:update'] = { data: null, error: null };
    const msgErr = { message: 'msgs failed' };
    RESPONSES['email_messages:update'] = { data: null, error: msgErr };

    const { result } = renderHook(() => useEmailActions(), { wrapper });

    await act(async () => {
      await result.current.markAsRead('thread-999');
    });

    expect(debugError).toHaveBeenCalledWith('Failed to mark messages as read:', msgErr);
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-threads'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-unread-count'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-counts'] });
  });

  it('updateCategory and updatePriority - both succeed, toast and invalidate', async () => {
    RESPONSES['email_threads:update'] = { data: null, error: null };

    const { result } = renderHook(() => useEmailActions(), { wrapper });

    await act(async () => {
      await result.current.updateCategory('thread-cat', 'promos');
      await result.current.updatePriority('thread-prio', 'high');
    });

    expect(toastSuccess).toHaveBeenCalledWith('Catégorie mise à jour');
    expect(toastSuccess).toHaveBeenCalledWith('Priorité mise à jour');
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-threads'] });
  });

  it('removeTag - removes tag and updates tags array accordingly', async () => {
    RESPONSES['email_threads:select:maybeSingle'] = { data: { tags: ['a', 'b', 'c'] }, error: null };
    RESPONSES['email_threads:update'] = { data: null, error: null };

    const { result } = renderHook(() => useEmailActions(), { wrapper });

    await act(async () => {
      await result.current.removeTag('thread-tags', 'b');
    });

    const updated = LAST_UPDATED['email_threads'] as unknown as { tags?: string[] };
    expect(updated).toHaveProperty('tags');
    expect(Array.isArray(updated.tags)).toBe(true);
    expect(updated.tags).toEqual(['a', 'c']);
    expect(toastSuccess).toHaveBeenCalledWith('Tag supprimé');
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-threads'] });
  });
});