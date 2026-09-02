import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React, { type PropsWithChildren } from 'react';

const {
  CALLS_ROWS,
  CALLS_WITH_RECORDINGS,
  mockFrom,
  createSupabaseBuilder,
  storageFromMock,
  createSignedUrlMock,
  removeMock,
  invokeMock,
  getSessionMock,
  updateMock,
  supabaseMock,
  warnSpy,
} = vi.hoisted(() => {
  type SupabaseError = { message: string };
  type SupabaseResult<T> = Promise<{ data: T | null; error: SupabaseError | null }>;

  const CALLS_ROWS = [
    {
      id: 'c1',
      started_at: '2024-01-02T10:00:00Z',
      etablissement_id: 'e1',
      prospect_id: 'p1',
      contact_id: 'ct1',
      user_id: 'u1',
      recording_path: null,
    },
    {
      id: 'c2',
      started_at: '2024-01-01T09:00:00Z',
      etablissement_id: 'e1',
      prospect_id: 'p2',
      contact_id: 'ct2',
      user_id: 'u2',
      recording_path: null,
    },
  ];

  const CALLS_WITH_RECORDINGS = [
    { id: 'c10', recording_path: 'rec/c10.wav' },
    { id: 'c11', recording_path: null },
    { id: 'c12', recording_path: 'rec/c12.webm' },
  ];

  const createSupabaseBuilder = <TData,>(initial: { data: TData | null; error: SupabaseError | null }) => {
    const state = {
      result: initial,
      calls: [] as Array<{ method: string; args: unknown[] }>,
    };

    const builder: Record<string, unknown> = {};

    const chain =
      (method: string) =>
      (...args: unknown[]) => {
        state.calls.push({ method, args });
        return builder;
      };

    const methods = [
      'select',
      'eq',
      'gte',
      'lte',
      'in',
      'order',
      'limit',
      'insert',
      'upsert',
      'update',
      'delete',
      'not',
    ] as const;

    for (const m of methods) builder[m] = chain(m);

    builder.single = () => Promise.resolve(state.result);
    builder.maybeSingle = () => Promise.resolve(state.result);

    builder.then = (onFulfilled?: (v: { data: TData | null; error: SupabaseError | null }) => unknown, onRejected?: (e: unknown) => unknown) =>
      (Promise.resolve(state.result) as SupabaseResult<TData>).then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (e: unknown) => unknown) => (Promise.resolve(state.result) as SupabaseResult<TData>).catch(onRejected);

    Object.defineProperty(builder, '__state', { value: state });

    return builder as typeof builder & { __state: typeof state };
  };

  const updateMock = vi.fn(() => createSupabaseBuilder<{ id: string }[]>( { data: [{ id: 'ok' }], error: null } ));
  const mockFrom = vi.fn((table: string) => {
    if (table === 'calls') {
      // default; tests will override via mockFrom.mockImplementationOnce when needed
      return createSupabaseBuilder<typeof CALLS_ROWS>({ data: CALLS_ROWS, error: null });
    }
    return createSupabaseBuilder<unknown>({ data: null, error: null });
  });

  const createSignedUrlMock = vi.fn<Parameters<(...args: never[]) => never>, { data: { signedUrl: string } | null; error: SupabaseError | null }>(() =>
    Promise.resolve({ data: { signedUrl: 'https://example.test/signed' }, error: null })
  );

  const removeMock = vi.fn<Parameters<(...args: never[]) => never>, { data: unknown; error: SupabaseError | null }>(() =>
    Promise.resolve({ data: {}, error: null })
  );

  const storageFromMock = vi.fn((_bucket: string) => ({
    createSignedUrl: createSignedUrlMock,
    remove: removeMock,
  }));

  const invokeMock = vi.fn((fnName: string, args: { body: unknown }) => {
    if (fnName !== 'call-log') return Promise.resolve({ data: null, error: { message: 'unknown function' } });
    const body = args.body as { call_id?: string };
    return Promise.resolve({ data: { call_id: body.call_id }, error: null });
  });

  const getSessionMock = vi.fn(() =>
    Promise.resolve({
      data: { session: { access_token: 'access.token' } },
      error: null,
    })
  );

  const supabaseMock = {
    from: mockFrom,
    storage: { from: storageFromMock },
    functions: { invoke: invokeMock },
    auth: { getSession: getSessionMock },
  };

  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  return {
    CALLS_ROWS,
    CALLS_WITH_RECORDINGS,
    mockFrom,
    createSupabaseBuilder,
    storageFromMock,
    createSignedUrlMock,
    removeMock,
    invokeMock,
    getSessionMock,
    updateMock,
    supabaseMock,
    warnSpy,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });

  function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { Wrapper, queryClient };
};

describe('useCalls.ts', () => {
  it('useCalls: isLoading puis succès avec filtres/limit correctement appliqués', async () => {
    const { useCalls } = await import('./useCalls');

    const builder = createSupabaseBuilder<typeof CALLS_ROWS>({ data: CALLS_ROWS, error: null });
    mockFrom.mockImplementationOnce((table: string) => {
      if (table !== 'calls') throw new Error('unexpected table');
      return builder;
    });

    const { Wrapper } = createWrapper();

    const opts = { etablissementId: 'e1', prospectId: 'p1', contactId: 'ct1', userId: 'u1', limit: 7 };
    const { result } = renderHook(() => useCalls(opts), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(CALLS_ROWS);

    const calls = (builder as unknown as { __state: { calls: Array<{ method: string; args: unknown[] }> } }).__state.calls;
    expect(calls.some((c) => c.method === 'select' && c.args[0] === '*')).toBe(true);
    expect(calls.some((c) => c.method === 'order' && c.args[0] === 'started_at' && typeof c.args[1] === 'object')).toBe(true);
    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'etablissement_id' && c.args[1] === 'e1')).toBe(true);
    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'prospect_id' && c.args[1] === 'p1')).toBe(true);
    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'contact_id' && c.args[1] === 'ct1')).toBe(true);
    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'u1')).toBe(true);
    expect(calls.some((c) => c.method === 'limit' && c.args[0] === 7)).toBe(true);
  });

  it('useCalls: passe en erreur si supabase renvoie error', async () => {
    const { useCalls } = await import('./useCalls');

    const builder = createSupabaseBuilder<unknown[]>({ data: null, error: { message: 'db down' } });
    mockFrom.mockImplementationOnce((table: string) => {
      if (table !== 'calls') throw new Error('unexpected table');
      return builder;
    });

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCalls({ limit: 3 }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as { message?: string } | null)?.message).toBe('db down');
  });

  it('getRecordingSignedUrl: retourne une URL signée en succès', async () => {
    const { getRecordingSignedUrl } = await import('./useCalls');

    createSignedUrlMock.mockImplementationOnce(() =>
      Promise.resolve({ data: { signedUrl: 'https://example.test/rec' }, error: null })
    );

    const url = await getRecordingSignedUrl('rec/c1.wav', 120);
    expect(url).toBe('https://example.test/rec');

    expect(storageFromMock).toHaveBeenCalledWith('call-recordings');
    expect(createSignedUrlMock).toHaveBeenCalledWith('rec/c1.wav', 120);
  });

  it('getRecordingSignedUrl: retourne null et log un warning si erreur', async () => {
    const { getRecordingSignedUrl } = await import('./useCalls');

    createSignedUrlMock.mockImplementationOnce(() =>
      Promise.resolve({ data: null, error: { message: 'nope' } })
    );

    const url = await getRecordingSignedUrl('rec/missing.wav');
    expect(url).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('logCallAction: invoque la function et retourne le payload', async () => {
    const { logCallAction } = await import('./useCalls');

    invokeMock.mockImplementationOnce((_name: string, args: { body: unknown }) =>
      Promise.resolve({ data: { call_id: (args.body as { call_id?: string }).call_id }, error: null })
    );

    const out = await logCallAction({ action: 'end', call_id: 'c1', reason: 'user_hangup' });
    expect(out).toEqual({ call_id: 'c1' });

    expect(invokeMock).toHaveBeenCalledWith('call-log', { body: { action: 'end', call_id: 'c1', reason: 'user_hangup' } });
  });

  it('logCallAction: throw si error', async () => {
    const { logCallAction } = await import('./useCalls');

    invokeMock.mockImplementationOnce(() => Promise.resolve({ data: null, error: { message: 'fn err' } }));

    await expect(logCallAction({ action: 'fail', call_id: 'c9' })).rejects.toMatchObject({ message: 'fn err' });
  });

  it('uploadCallRecording: poste le FormData avec Authorization et retourne le path', async () => {
    const { uploadCallRecording } = await import('./useCalls');

    getSessionMock.mockImplementationOnce(() =>
      Promise.resolve({
        data: { session: { access_token: 'access.token' } },
        error: null,
      })
    );

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return {
        ok: true,
        json: async () => ({ path: 'rec/c55.webm' }),
        text: async () => 'ok',
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const blob = new Blob(['x'], { type: 'audio/webm' });
    const path = await uploadCallRecording('c55', blob);

    expect(path).toBe('rec/c55.webm');
    expect(getSessionMock).toHaveBeenCalled();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string> | undefined)?.Authorization).toBe('Bearer access.token');
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it('uploadCallRecording: retourne null si pas de session', async () => {
    const { uploadCallRecording } = await import('./useCalls');

    getSessionMock.mockImplementationOnce(() =>
      Promise.resolve({
        data: { session: null },
        error: null,
      })
    );

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const blob = new Blob(['x'], { type: 'audio/wav' });
    const path = await uploadCallRecording('c66', blob);

    expect(path).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deleteOwnRecordings: supprime les fichiers, met à jour les calls et retourne le count', async () => {
    const { deleteOwnRecordings } = await import('./useCalls');

    const selectBuilder = createSupabaseBuilder<typeof CALLS_WITH_RECORDINGS>({ data: CALLS_WITH_RECORDINGS, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table !== 'calls') throw new Error('unexpected table');
      const builder = createSupabaseBuilder<unknown>({ data: null, error: null });
      (builder as unknown as { select: (s: unknown) => unknown }).select = (...args: unknown[]) => {
        (selectBuilder as unknown as { __state: { calls: Array<{ method: string; args: unknown[] }> } }).__state.calls.push({
          method: 'select',
          args,
        });
        return selectBuilder;
      };
      (builder as unknown as { update: (p: unknown) => unknown }).update = (..._args: unknown[]) => updateMock(..._args) as unknown;
      return builder;
    });

    const count = await deleteOwnRecordings();

    expect(count).toBe(2);

    expect(storageFromMock).toHaveBeenCalledWith('call-recordings');
    expect(removeMock).toHaveBeenCalledTimes(2);
    expect(removeMock).toHaveBeenNthCalledWith(1, ['rec/c10.wav']);
    expect(removeMock).toHaveBeenNthCalledWith(2, ['rec/c12.webm']);

    expect(updateMock).toHaveBeenCalledTimes(2);
    const firstUpdatePayload = updateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstUpdatePayload.recording_path).toBeNull();
    expect(typeof firstUpdatePayload.recording_purged_at).toBe('string');
  });
});