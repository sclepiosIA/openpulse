// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import {
  listVersions,
  saveVersion,
  renameVersion,
  deleteVersion,
  clearVersionsLocalCache,
  diffLines,
  normalizeForDiff,
  summarizeDiff,
} from './versionHistory';

type BuilderResponse = {
  data?: unknown;
  error?: { message: string } | null;
};

const {
  SESSION_OK,
  REMOTE_LIST_ROWS,
  REMOTE_INSERT_ROW,
  mockGetSession,
  mockFrom,
  mockWarn,
} = vi.hoisted(() => ({
  SESSION_OK: { session: { user: { id: 'u1' } } },
  REMOTE_LIST_ROWS: [
    {
      id: 'r2',
      document_id: 'doc-1',
      user_id: 'u1',
      name: 'Remote New',
      kind: 'html' as const,
      content: '<p>new</p>',
      size: 10,
      auto: false,
      created_at: '2024-01-02T10:00:00.000Z',
    },
    {
      id: 'r1',
      document_id: 'doc-1',
      user_id: 'u1',
      name: 'Remote Old',
      kind: 'html' as const,
      content: '<p>old</p>',
      size: 10,
      auto: true,
      created_at: '2024-01-01T10:00:00.000Z',
    },
  ],
  REMOTE_INSERT_ROW: {
    id: 'r-new',
    document_id: 'doc-1',
    user_id: 'u1',
    name: 'Named Version',
    kind: 'html' as const,
    content: '<p>saved</p>',
    size: 12,
    auto: false,
    created_at: '2024-01-03T09:30:00.000Z',
  },
  mockGetSession: vi.fn(),
  mockFrom: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
    from: mockFrom,
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

function setupSupabaseBuilder(config?: {
  selectResponse?: BuilderResponse;
  insertResponse?: BuilderResponse;
  updateResponse?: BuilderResponse;
  deleteResponse?: BuilderResponse;
}) {
  const state = {
    mode: 'select' as 'select' | 'insert' | 'update' | 'delete',
  };

  const builder = {
    select: vi.fn(() => {
      state.mode = 'select';
      return builder;
    }),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => {
      state.mode = 'insert';
      return builder;
    }),
    update: vi.fn(() => {
      state.mode = 'update';
      return builder;
    }),
    delete: vi.fn(() => {
      state.mode = 'delete';
      return builder;
    }),
    single: vi.fn(() => Promise.resolve(config?.insertResponse ?? { data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve(config?.selectResponse ?? { data: null, error: null })),
    then: (
      onFulfilled?: ((value: BuilderResponse) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => {
      const response =
        state.mode === 'insert'
          ? (config?.insertResponse ?? { data: null, error: null })
          : state.mode === 'update'
            ? (config?.updateResponse ?? { data: null, error: null })
            : state.mode === 'delete'
              ? (config?.deleteResponse ?? { data: null, error: null })
              : (config?.selectResponse ?? { data: null, error: null });
      return Promise.resolve(response).then(onFulfilled ?? undefined, onRejected ?? undefined);
    },
    catch: (onRejected?: ((reason: unknown) => unknown) | null) => {
      const response =
        state.mode === 'insert'
          ? (config?.insertResponse ?? { data: null, error: null })
          : state.mode === 'update'
            ? (config?.updateResponse ?? { data: null, error: null })
            : state.mode === 'delete'
              ? (config?.deleteResponse ?? { data: null, error: null })
              : (config?.selectResponse ?? { data: null, error: null });
      return Promise.resolve(response).catch(onRejected ?? undefined);
    },
  };

  mockFrom.mockReturnValue(builder);
  return builder;
}

describe('versionHistory', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: SESSION_OK });
    vi.spyOn(console, 'warn').mockImplementation(mockWarn);
  });

  it('provides a QueryClientProvider wrapper compatible with renderHook', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => 123, { wrapper });
    expect(result.current).toBe(123);
  });

  describe('listVersions', () => {
    it('returns merged remote and local versions sorted by date and refreshes cache', async () => {
      setupSupabaseBuilder({
        selectResponse: { data: REMOTE_LIST_ROWS, error: null },
      });

      window.localStorage.setItem(
        'marque.docVersions.doc-1',
        JSON.stringify([
          {
            id: 'local-1',
            createdAt: new Date('2024-01-01T12:00:00.000Z').getTime(),
            name: 'Local Draft',
            kind: 'html',
            content: '<p>draft</p>',
            size: 12,
            auto: false,
            remote: false,
          },
          {
            id: 'r1',
            createdAt: new Date('2024-01-01T10:00:00.000Z').getTime(),
            name: 'Shadow Remote',
            kind: 'html',
            content: '<p>old</p>',
            size: 10,
            auto: true,
            remote: false,
          },
        ]),
      );

      const versions = await listVersions('doc-1');

      expect(mockFrom).toHaveBeenCalledWith('document_versions');
      expect(versions).toHaveLength(3);
      expect(versions.map((v) => v.id)).toEqual(['r2', 'local-1', 'r1']);
      expect(versions[0]).toMatchObject({
        id: 'r2',
        name: 'Remote New',
        remote: true,
        auto: false,
        kind: 'html',
      });
      expect(versions[1]).toMatchObject({
        id: 'local-1',
        name: 'Local Draft',
        remote: false,
      });
      expect(versions[2]).toMatchObject({
        id: 'r1',
        name: 'Remote Old',
        remote: true,
      });

      const cached = JSON.parse(window.localStorage.getItem('marque.docVersions.doc-1') ?? '[]') as Array<Record<string, unknown>>;
      expect(cached).toHaveLength(3);
      expect(cached[0]?.id).toBe('r2');
      expect(cached[1]?.id).toBe('local-1');
      expect(cached[2]?.id).toBe('r1');
    });

    it('falls back to localStorage when supabase returns an error', async () => {
      setupSupabaseBuilder({
        selectResponse: { data: null, error: { message: 'x' } },
      });

      window.localStorage.setItem(
        'marque.docVersions.doc-err',
        JSON.stringify([
          {
            id: 'loc-a',
            createdAt: 10,
            name: 'A',
            kind: 'json',
            content: '{"a":1}',
            size: 7,
            auto: true,
            remote: false,
          },
          {
            id: 'loc-b',
            createdAt: 20,
            name: 'B',
            kind: 'json',
            content: '{"b":2}',
            size: 7,
            auto: false,
            remote: false,
          },
        ]),
      );

      const versions = await listVersions('doc-err');

      expect(versions.map((v) => v.id)).toEqual(['loc-b', 'loc-a']);
      expect(versions[0]?.name).toBe('B');
      expect(versions[1]?.name).toBe('A');
      expect(versions.every((v) => v.remote === false)).toBe(true);
      expect(mockWarn).toHaveBeenCalled();
    });
  });

  describe('saveVersion', () => {
    it('saves remotely for authenticated user and updates local cache', async () => {
      const builder = setupSupabaseBuilder({
        insertResponse: { data: REMOTE_INSERT_ROW, error: null },
        selectResponse: { data: [{ id: 'r-new' }], error: null },
        deleteResponse: { data: null, error: null },
      });

      window.localStorage.setItem(
        'marque.docVersions.doc-1',
        JSON.stringify([
          {
            id: 'local-old',
            createdAt: 100,
            name: 'Old Local',
            kind: 'html',
            content: '<p>old local</p>',
            size: 16,
            auto: false,
            remote: false,
          },
        ]),
      );

      const result = await saveVersion('doc-1', '<p>saved</p>', 'html', { name: ' Named Version ' });

      expect(result).toMatchObject({
        id: 'r-new',
        name: 'Named Version',
        remote: true,
        kind: 'html',
        size: 12,
      });
      expect(mockGetSession).toHaveBeenCalled();

      expect(builder.insert).toHaveBeenCalledWith({
        document_id: 'doc-1',
        user_id: 'u1',
        name: 'Named Version',
        kind: 'html',
        content: '<p>saved</p>',
        size: 12,
        auto: false,
      });

      const cached = JSON.parse(window.localStorage.getItem('marque.docVersions.doc-1') ?? '[]') as Array<Record<string, unknown>>;
      expect(cached[0]?.id).toBe('r-new');
      expect(cached[1]?.id).toBe('local-old');
    });

    it('dedupes against latest local snapshot by returning existing version', async () => {
      setupSupabaseBuilder();

      window.localStorage.setItem(
        'marque.docVersions.doc-1',
        JSON.stringify([
          {
            id: 'local-same',
            createdAt: 200,
            name: 'Existing',
            kind: 'html',
            content: '<p>same</p>',
            size: 11,
            auto: false,
            remote: false,
          },
        ]),
      );

      const result = await saveVersion('doc-1', '<p>same</p>', 'html');

      expect(result).toMatchObject({ id: 'local-same', name: 'Existing', content: '<p>same</p>' });
      expect(mockGetSession).not.toHaveBeenCalled();
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('falls back to local save when remote insert errors', async () => {
      setupSupabaseBuilder({
        insertResponse: { data: null, error: { message: 'x' } },
      });

      const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('uuid-local-1');

      const result = await saveVersion('doc-2', '{"a":1}', 'json', { auto: true });

      expect(result).toMatchObject({
        id: 'uuid-local-1',
        kind: 'json',
        content: '{"a":1}',
        size: 7,
        auto: true,
        remote: false,
      });
      expect(result?.name.startsWith('Auto — ')).toBe(true);
      expect(mockWarn).toHaveBeenCalled();

      const cached = JSON.parse(window.localStorage.getItem('marque.docVersions.doc-2') ?? '[]') as Array<Record<string, unknown>>;
      expect(cached).toHaveLength(1);
      expect(cached[0]?.id).toBe('uuid-local-1');

      uuidSpy.mockRestore();
    });
  });

  describe('renameVersion', () => {
    it('renames locally and remotely with trimmed name', async () => {
      const builder = setupSupabaseBuilder({
        updateResponse: { data: null, error: null },
      });

      window.localStorage.setItem(
        'marque.docVersions.doc-1',
        JSON.stringify([
          {
            id: 'v1',
            createdAt: 1,
            name: 'Before',
            kind: 'html',
            content: 'x',
            size: 1,
            auto: false,
            remote: false,
          },
        ]),
      );

      const ok = await renameVersion('doc-1', 'v1', '  After  ');

      expect(ok).toBe(true);
      expect(builder.update).toHaveBeenCalledWith({ name: 'After' });

      const cached = JSON.parse(window.localStorage.getItem('marque.docVersions.doc-1') ?? '[]') as Array<Record<string, unknown>>;
      expect(cached[0]?.name).toBe('After');
    });

    it('returns false on remote error when version is not found locally', async () => {
      setupSupabaseBuilder({
        updateResponse: { data: null, error: { message: 'x' } },
      });

      const ok = await renameVersion('doc-missing', 'missing-id', 'Renamed');

      expect(ok).toBe(false);
    });
  });

  describe('deleteVersion', () => {
    it('deletes locally and remotely', async () => {
      const builder = setupSupabaseBuilder({
        deleteResponse: { data: null, error: null },
      });

      window.localStorage.setItem(
        'marque.docVersions.doc-1',
        JSON.stringify([
          {
            id: 'keep',
            createdAt: 2,
            name: 'Keep',
            kind: 'html',
            content: 'b',
            size: 1,
            auto: false,
            remote: false,
          },
          {
            id: 'gone',
            createdAt: 1,
            name: 'Gone',
            kind: 'html',
            content: 'a',
            size: 1,
            auto: false,
            remote: false,
          },
        ]),
      );

      const ok = await deleteVersion('doc-1', 'gone');

      expect(ok).toBe(true);
      expect(builder.delete).toHaveBeenCalled();

      const cached = JSON.parse(window.localStorage.getItem('marque.docVersions.doc-1') ?? '[]') as Array<Record<string, unknown>>;
      expect(cached).toHaveLength(1);
      expect(cached[0]?.id).toBe('keep');
    });

    it('returns false when remote deletion errors and no local version matched', async () => {
      setupSupabaseBuilder({
        deleteResponse: { data: null, error: { message: 'x' } },
      });

      const ok = await deleteVersion('doc-404', 'nope');

      expect(ok).toBe(false);
    });
  });

  describe('local cache helpers', () => {
    it('clears the document local cache key', () => {
      window.localStorage.setItem('marque.docVersions.doc-clear', JSON.stringify([{ id: '1' }]));

      clearVersionsLocalCache('doc-clear');

      expect(window.localStorage.getItem('marque.docVersions.doc-clear')).toBeNull();
    });
  });

  describe('diff utilities', () => {
    it('computes line-based diff and summarizes added and removed lines', () => {
      const ops = diffLines('a\nb\nc', 'a\nx\nc\nd');

      expect(ops).toEqual([
        { type: 'equal', line: 'a' },
        { type: 'del', line: 'b' },
        { type: 'add', line: 'x' },
        { type: 'equal', line: 'c' },
        { type: 'add', line: 'd' },
      ]);
      expect(summarizeDiff(ops)).toEqual({ added: 2, removed: 1 });
    });

    it('normalizes json content with pretty printing', () => {
      const normalized = normalizeForDiff('{"b":2,"a":{"c":1}}', 'json');

      expect(normalized).toBe('{\n  "b": 2,\n  "a": {\n    "c": 1\n  }\n}');
    });

    it('returns invalid json unchanged', () => {
      const normalized = normalizeForDiff('{"broken"', 'json');

      expect(normalized).toBe('{"broken"');
    });

    it('normalizes html by splitting adjacent tags and trimming extra spaces', () => {
      const normalized = normalizeForDiff('  <div><span>a</span></div>  ', 'html');

      expect(normalized).toBe('<div>\n<span>a</span>\n</div>');
    });
  });
});