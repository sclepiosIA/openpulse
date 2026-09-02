import { describe, it, expect, vi, beforeEach } from 'vitest';

const channelInstances: any[] = [];
const removeChannel = vi.fn();
const channelFactory = vi.fn((_name: string) => {
  const inst: any = {
    on: vi.fn(() => inst),
    subscribe: vi.fn((cb: (s: string) => void) => {
      inst._statusCb = cb;
      // Simulate async subscribed
      setTimeout(() => cb('SUBSCRIBED'), 0);
      return inst;
    }),
  };
  channelInstances.push(inst);
  return inst;
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: (n: string) => channelFactory(n),
    removeChannel: (c: any) => removeChannel(c),
  },
}));

vi.mock('@/lib/debug', () => ({ debug: { warn: vi.fn(), log: vi.fn() } }));

describe('jarvisSmartTriggersChannel', () => {
  beforeEach(() => {
    channelInstances.length = 0;
    channelFactory.mockClear();
    removeChannel.mockClear();
    vi.resetModules();
  });

  it('shares a single channel across subscribers and tears down on last unsub', async () => {
    const { subscribeSmartTriggers } = await import('../jarvisSmartTriggersChannel');
    const isStreaming = { current: false };
    const sub1 = { onPayload: vi.fn(), onStatus: vi.fn() };
    const sub2 = { onPayload: vi.fn(), onStatus: vi.fn() };
    const unsub1 = subscribeSmartTriggers('user-1', ['t1', 't2'], sub1, isStreaming);
    const unsub2 = subscribeSmartTriggers('user-1', ['t1', 't2'], sub2, isStreaming);
    // Single channel created
    expect(channelFactory).toHaveBeenCalledTimes(1);
    // Two table listeners registered
    expect(channelInstances[0].on).toHaveBeenCalledTimes(2);
    unsub1();
    expect(removeChannel).not.toHaveBeenCalled();
    unsub2();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe is idempotent', async () => {
    const { subscribeSmartTriggers } = await import('../jarvisSmartTriggersChannel');
    const unsub = subscribeSmartTriggers('u', ['x'], { onPayload: vi.fn() }, { current: false });
    unsub();
    unsub(); // no throw
  });
});
