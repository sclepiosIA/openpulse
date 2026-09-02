import { describe, it, expect, vi } from 'vitest';

const createClientMock = vi.fn(() => ({ from: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

describe('liveChatClient', () => {
  it('createLiveChatVisitorClient injects x-session-token header', async () => {
    const { createLiveChatVisitorClient } = await import('../liveChatClient');
    createClientMock.mockClear();
    const client = createLiveChatVisitorClient('tok-abc-123');
    expect(client).toBeDefined();
    expect(createClientMock).toHaveBeenCalled();
    const call = createClientMock.mock.calls[0] as any[];
    const opts = call[2];
    expect(opts.global.headers['x-session-token']).toBe('tok-abc-123');
    expect(opts.auth.persistSession).toBe(false);
    expect(opts.auth.autoRefreshToken).toBe(false);
  });

  it('creates different clients per token', async () => {
    const { createLiveChatVisitorClient } = await import('../liveChatClient');
    createClientMock.mockClear();
    createLiveChatVisitorClient('aa');
    createLiveChatVisitorClient('bb');
    const last = (createClientMock.mock.calls.at(-1) as any[])[2];
    expect(last.global.headers['x-session-token']).toBe('bb');
  });
});
