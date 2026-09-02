// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInvoke, SUCCESS_DATA } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  SUCCESS_DATA: {
    ok: true,
    result: 'done',
    count: 2,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

import { invokeEdge } from './edgeFunctions';

describe('edgeFunctions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appelle supabase.functions.invoke avec le nom et un body fourni puis retourne les données', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: SUCCESS_DATA,
      error: null,
    });

    const body = { userId: 'u1', enabled: true };

    const result = await invokeEdge<typeof SUCCESS_DATA, typeof body>('send-report', body);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('send-report', {
      body,
    });
    expect(result).toEqual(SUCCESS_DATA);
    expect(result.ok).toBe(true);
    expect(result.result).toBe('done');
    expect(result.count).toBe(2);
  });

  it('utilise un objet vide quand aucun body n’est fourni', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: SUCCESS_DATA,
      error: null,
    });

    const result = await invokeEdge<typeof SUCCESS_DATA>('health-check');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('health-check', {
      body: {},
    });
    expect(result).toEqual(SUCCESS_DATA);
  });

  it('propage l’erreur renvoyée par supabase.functions.invoke', async () => {
    const error = { message: 'x' };
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error,
    });

    await expect(invokeEdge('failing-fn', { foo: 'bar' })).rejects.toEqual(error);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('failing-fn', {
      body: { foo: 'bar' },
    });
  });
});