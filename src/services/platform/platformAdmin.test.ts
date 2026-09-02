// @vitest-environment jsdom

import { callPlatformAdmin } from './platformAdmin';

const {
  SESSION_OK,
  SESSION_NONE,
  INVOKE_OK_DATA,
  INVOKE_ERROR,
  mockGetSession,
  mockInvoke,
  mockFetch,
} = vi.hoisted(() => ({
  SESSION_OK: { session: { access_token: 'tok' } },
  SESSION_NONE: { session: null },
  INVOKE_OK_DATA: { done: true, count: 2 },
  INVOKE_ERROR: { message: 'invoke failed' },
  mockGetSession: vi.fn(),
  mockInvoke: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  SUPABASE_URL: 'https://example.test',
  SUPABASE_ANON_KEY: 'anon-key',
}));

describe('callPlatformAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('fait un GET vers l’edge function avec le bearer token, apikey et query params', async () => {
    mockGetSession.mockResolvedValue({ data: SESSION_OK });
    mockFetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('{"users":3,"status":"ok"}'),
    });

    const result = await callPlatformAdmin<{ users: number; status: string }>({
      method: 'GET',
      action: 'list-users',
      params: { page: '2', q: 'john' },
    });

    expect(result).toEqual({ users: 3, status: 'ok' });
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [urlArg, initArg] = mockFetch.mock.calls[0] as [URL, RequestInit];
    expect(urlArg).toBeInstanceOf(URL);
    expect(urlArg.toString()).toBe('https://example.test/functions/v1/platform-admin?action=list-users&page=2&q=john');
    expect(urlArg.searchParams.get('action')).toBe('list-users');
    expect(urlArg.searchParams.get('page')).toBe('2');
    expect(urlArg.searchParams.get('q')).toBe('john');

    expect(initArg).toEqual({
      headers: {
        Authorization: 'Bearer tok',
        apikey: 'anon-key',
      },
    });
  });

  it('retourne null sur GET si la réponse est vide', async () => {
    mockGetSession.mockResolvedValue({ data: SESSION_OK });
    mockFetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(''),
    });

    const result = await callPlatformAdmin<null>({
      method: 'GET',
      action: 'empty',
    });

    expect(result).toBeNull();
  });

  it('lève une erreur explicite si la session est expirée avant un GET', async () => {
    mockGetSession.mockResolvedValue({ data: SESSION_NONE });

    await expect(
      callPlatformAdmin({
        method: 'GET',
        action: 'list-users',
      }),
    ).rejects.toThrow('Session expirée. Reconnectez-vous puis réessayez.');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('lève le message error du JSON si le GET échoue', async () => {
    mockGetSession.mockResolvedValue({ data: SESSION_OK });
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      text: vi.fn().mockResolvedValue('{"error":"forbidden area"}'),
    });

    await expect(
      callPlatformAdmin({
        method: 'GET',
        action: 'danger',
      }),
    ).rejects.toThrow('forbidden area');
  });

  it('lève statusText si le GET échoue sans champ error dans le JSON', async () => {
    mockGetSession.mockResolvedValue({ data: SESSION_OK });
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
      text: vi.fn().mockResolvedValue('{"detail":"nope"}'),
    });

    await expect(
      callPlatformAdmin({
        method: 'GET',
        action: 'danger',
      }),
    ).rejects.toThrow('Unauthorized');
  });

  it('fait un POST via supabase.functions.invoke avec le body fourni', async () => {
    mockInvoke.mockResolvedValue({ data: INVOKE_OK_DATA, error: null });

    const body = { action: 'ban-user', userId: 'u1', reason: 'spam' };

    const result = await callPlatformAdmin<typeof INVOKE_OK_DATA>({
      method: 'POST',
      body,
    });

    expect(result).toEqual(INVOKE_OK_DATA);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('platform-admin', {
      method: 'POST',
      body,
    });
  });

  it('propage l’erreur renvoyée par supabase.functions.invoke', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: INVOKE_ERROR });

    await expect(
      callPlatformAdmin({
        method: 'POST',
        body: { action: 'sync' },
      }),
    ).rejects.toEqual(INVOKE_ERROR);
  });
});