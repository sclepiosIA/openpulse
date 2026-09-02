const {
  QUERY_ROWS,
  mockFrom,
  mockSupabaseChannel,
  mockRemoveChannel,
  mockReportRealtimeError,
  mockDebugError,
  mockDebugWarn,
  mockStatusCallbacks,
  mockChannelNames,
  CHANNEL_ONE,
  CHANNEL_TWO,
  resetRealtimeMocks,
} = vi.hoisted(() => {
  type StatusCallback = (status: string) => void;

  const QUERY_ROWS = [{ id: '1', label: 'stable-row' }];
  const queryResult = { data: QUERY_ROWS, error: null };

  const queryBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  const configureQueryBuilder = () => {
    const chain = () => queryBuilder;
    queryBuilder.select.mockImplementation(chain);
    queryBuilder.eq.mockImplementation(chain);
    queryBuilder.gte.mockImplementation(chain);
    queryBuilder.lte.mockImplementation(chain);
    queryBuilder.in.mockImplementation(chain);
    queryBuilder.order.mockImplementation(chain);
    queryBuilder.limit.mockImplementation(chain);
    queryBuilder.insert.mockImplementation(chain);
    queryBuilder.update.mockImplementation(chain);
    queryBuilder.delete.mockImplementation(chain);
    queryBuilder.single.mockImplementation(() => Promise.resolve(queryResult));
    queryBuilder.maybeSingle.mockImplementation(() => Promise.resolve(queryResult));
    queryBuilder.then.mockImplementation(
      (
        resolve?: ((value: typeof queryResult) => unknown) | null,
        reject?: ((reason: unknown) => unknown) | null,
      ) => Promise.resolve(queryResult).then(resolve ?? undefined, reject ?? undefined),
    );
    queryBuilder.catch.mockImplementation((reject?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve(queryResult).catch(reject ?? undefined),
    );
  };

  const mockStatusCallbacks: StatusCallback[] = [];
  const mockChannelNames: string[] = [];

  const makeChannel = (label: string) => {
    const channel = {
      label,
      on: vi.fn(),
      subscribe: vi.fn(),
    };

    channel.on.mockImplementation(() => channel);
    channel.subscribe.mockImplementation((callback: StatusCallback) => {
      mockStatusCallbacks.push(callback);
      return channel;
    });

    return channel;
  };

  const CHANNEL_ONE = makeChannel('channel-one');
  const CHANNEL_TWO = makeChannel('channel-two');
  const stableChannels = [CHANNEL_ONE, CHANNEL_TWO];
  let channelIndex = 0;

  const defaultChannelImplementation = (name: string) => {
    mockChannelNames.push(name);
    const channel = stableChannels[channelIndex] ?? CHANNEL_TWO;
    channelIndex += 1;
    return channel;
  };

  const mockFrom = vi.fn(() => queryBuilder);
  const mockSupabaseChannel = vi.fn(defaultChannelImplementation);
  const mockRemoveChannel = vi.fn(() => undefined);
  const mockReportRealtimeError = vi.fn();
  const mockDebugError = vi.fn();
  const mockDebugWarn = vi.fn();

  configureQueryBuilder();

  const resetRealtimeMocks = () => {
    mockStatusCallbacks.splice(0, mockStatusCallbacks.length);
    mockChannelNames.splice(0, mockChannelNames.length);
    channelIndex = 0;

    mockFrom.mockReset();
    mockFrom.mockImplementation(() => queryBuilder);

    mockSupabaseChannel.mockReset();
    mockSupabaseChannel.mockImplementation(defaultChannelImplementation);

    mockRemoveChannel.mockReset();
    mockRemoveChannel.mockImplementation(() => undefined);

    mockReportRealtimeError.mockReset();
    mockDebugError.mockReset();
    mockDebugWarn.mockReset();

    queryBuilder.select.mockReset();
    queryBuilder.eq.mockReset();
    queryBuilder.gte.mockReset();
    queryBuilder.lte.mockReset();
    queryBuilder.in.mockReset();
    queryBuilder.order.mockReset();
    queryBuilder.limit.mockReset();
    queryBuilder.insert.mockReset();
    queryBuilder.update.mockReset();
    queryBuilder.delete.mockReset();
    queryBuilder.single.mockReset();
    queryBuilder.maybeSingle.mockReset();
    queryBuilder.then.mockReset();
    queryBuilder.catch.mockReset();
    configureQueryBuilder();

    CHANNEL_ONE.on.mockReset();
    CHANNEL_ONE.on.mockImplementation(() => CHANNEL_ONE);
    CHANNEL_ONE.subscribe.mockReset();
    CHANNEL_ONE.subscribe.mockImplementation((callback: StatusCallback) => {
      mockStatusCallbacks.push(callback);
      return CHANNEL_ONE;
    });

    CHANNEL_TWO.on.mockReset();
    CHANNEL_TWO.on.mockImplementation(() => CHANNEL_TWO);
    CHANNEL_TWO.subscribe.mockReset();
    CHANNEL_TWO.subscribe.mockImplementation((callback: StatusCallback) => {
      mockStatusCallbacks.push(callback);
      return CHANNEL_TWO;
    });
  };

  return {
    QUERY_ROWS,
    mockFrom,
    mockSupabaseChannel,
    mockRemoveChannel,
    mockReportRealtimeError,
    mockDebugError,
    mockDebugWarn,
    mockStatusCallbacks,
    mockChannelNames,
    CHANNEL_ONE,
    CHANNEL_TWO,
    resetRealtimeMocks,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: mockSupabaseChannel,
    removeChannel: mockRemoveChannel,
  },
}));

vi.mock('./frontendErrorCapture', () => ({
  frontendErrorCapture: {
    reportRealtimeError: mockReportRealtimeError,
  },
}));

vi.mock('./debug', () => ({
  debug: {
    error: mockDebugError,
    warn: mockDebugWarn,
  },
}));

import { safeRealtimeChannel } from './realtimeMonitor';

describe('safeRealtimeChannel', () => {
  beforeEach(() => {
    resetRealtimeMocks();
  });

  it('crée un channel suffixé, applique le binding, subscribe et nettoie de façon idempotente', () => {
    const postgresCallback = vi.fn();

    const handle = safeRealtimeChannel('support-tickets-badge', (channel) =>
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_tickets' },
        postgresCallback,
      ),
    );

    expect(handle.channelName).toMatch(/^support-tickets-badge-[a-z0-9]+-[a-z0-9]+-[a-z0-9]{4}$/);
    expect(handle.channel).toBe(CHANNEL_ONE);
    expect(mockSupabaseChannel).toHaveBeenCalledTimes(1);
    expect(mockSupabaseChannel).toHaveBeenCalledWith(handle.channelName);
    expect(CHANNEL_ONE.on).toHaveBeenCalledTimes(1);
    expect(CHANNEL_ONE.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'support_tickets' },
      postgresCallback,
    );
    expect(CHANNEL_ONE.subscribe).toHaveBeenCalledTimes(1);
    expect(mockStatusCallbacks).toHaveLength(1);

    handle.dispose();
    handle.dispose();

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).toHaveBeenCalledWith(CHANNEL_ONE);
    expect(mockDebugError).not.toHaveBeenCalled();
    expect(mockReportRealtimeError).not.toHaveBeenCalled();
    expect(QUERY_ROWS).toEqual([{ id: '1', label: 'stable-row' }]);
  });

  it('génère des noms uniques et conserve le nom réellement transmis à supabase', () => {
    const first = safeRealtimeChannel('orders-feed', (channel) => channel);
    const second = safeRealtimeChannel('orders-feed', (channel) => channel);

    expect(first.channelName).toMatch(/^orders-feed-/);
    expect(second.channelName).toMatch(/^orders-feed-/);
    expect(first.channelName).not.toBe(second.channelName);
    expect(mockChannelNames).toEqual([first.channelName, second.channelName]);
    expect(first.channel).toBe(CHANNEL_ONE);
    expect(second.channel).toBe(CHANNEL_TWO);
  });

  it('logue CHANNEL_ERROR et TIMED_OUT sans reporter en base, puis ignore les statuts après dispose', () => {
    const onStatusError = vi.fn();

    const handle = safeRealtimeChannel('live-alerts', (channel) => channel, { onStatusError });
    const callback = mockStatusCallbacks[0];

    if (callback === undefined) {
      throw new Error('status callback missing');
    }

    callback('CHANNEL_ERROR');
    callback('TIMED_OUT');
    callback('CLOSED');

    expect(mockDebugWarn).toHaveBeenCalledTimes(2);
    expect(mockDebugWarn).toHaveBeenNthCalledWith(1, '[realtimeMonitor] status', handle.channelName, 'CHANNEL_ERROR');
    expect(mockDebugWarn).toHaveBeenNthCalledWith(2, '[realtimeMonitor] status', handle.channelName, 'TIMED_OUT');
    expect(onStatusError).toHaveBeenCalledTimes(2);
    expect(onStatusError).toHaveBeenNthCalledWith(1, 'CHANNEL_ERROR');
    expect(onStatusError).toHaveBeenNthCalledWith(2, 'TIMED_OUT');
    expect(mockReportRealtimeError).not.toHaveBeenCalled();

    handle.dispose();
    callback('CHANNEL_ERROR');

    expect(mockDebugWarn).toHaveBeenCalledTimes(2);
    expect(onStatusError).toHaveBeenCalledTimes(2);
  });

  it('capture une erreur de subscribe sans empêcher le retour du handle ni le cleanup', () => {
    const subscribeError = new Error('subscription failed');
    CHANNEL_ONE.subscribe.mockImplementationOnce(() => {
      throw subscribeError;
    });

    const handle = safeRealtimeChannel('failing-subscribe', (channel) => channel);

    expect(handle.channelName).toMatch(/^failing-subscribe-/);
    expect(handle.channel).toBe(CHANNEL_ONE);
    expect(mockDebugError).toHaveBeenCalledTimes(1);
    expect(mockDebugError).toHaveBeenCalledWith(
      '[realtimeMonitor] subscribe failed',
      handle.channelName,
      subscribeError,
    );
    expect(mockReportRealtimeError).toHaveBeenCalledTimes(1);
    expect(mockReportRealtimeError).toHaveBeenCalledWith('subscribe', handle.channelName, subscribeError);

    handle.dispose();

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).toHaveBeenCalledWith(CHANNEL_ONE);
  });

  it('capture une erreur de binding et retourne un handle sans channel', () => {
    const bindingError = new Error('binding failed');

    const handle = safeRealtimeChannel('broken-bind', () => {
      throw bindingError;
    });

    expect(handle.channelName).toMatch(/^broken-bind-/);
    expect(handle.channel).toBeNull();
    expect(mockSupabaseChannel).toHaveBeenCalledWith(handle.channelName);
    expect(CHANNEL_ONE.subscribe).not.toHaveBeenCalled();
    expect(mockDebugError).toHaveBeenCalledTimes(1);
    expect(mockDebugError).toHaveBeenCalledWith(
      '[realtimeMonitor] channel build failed',
      handle.channelName,
      bindingError,
    );
    expect(mockReportRealtimeError).toHaveBeenCalledTimes(1);
    expect(mockReportRealtimeError).toHaveBeenCalledWith('bind', handle.channelName, bindingError);

    handle.dispose();

    expect(mockRemoveChannel).not.toHaveBeenCalled();
  });

  it('capture une erreur de création de channel supabase et garde dispose sans effet', () => {
    const channelError = new Error('channel creation failed');
    mockSupabaseChannel.mockImplementationOnce((name: string) => {
      mockChannelNames.push(name);
      throw channelError;
    });

    const handle = safeRealtimeChannel('creation-error', (channel) => channel);

    expect(handle.channelName).toMatch(/^creation-error-/);
    expect(handle.channel).toBeNull();
    expect(mockChannelNames).toEqual([handle.channelName]);
    expect(mockDebugError).toHaveBeenCalledTimes(1);
    expect(mockDebugError).toHaveBeenCalledWith(
      '[realtimeMonitor] channel build failed',
      handle.channelName,
      channelError,
    );
    expect(mockReportRealtimeError).toHaveBeenCalledTimes(1);
    expect(mockReportRealtimeError).toHaveBeenCalledWith('bind', handle.channelName, channelError);

    handle.dispose();

    expect(mockRemoveChannel).not.toHaveBeenCalled();
  });

  it('capture une erreur de removeChannel et empêche une deuxième suppression', () => {
    const removeError = new Error('remove channel failed');
    const handle = safeRealtimeChannel('cleanup-error', (channel) => channel);

    mockRemoveChannel.mockImplementationOnce(() => {
      throw removeError;
    });

    handle.dispose();
    handle.dispose();

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).toHaveBeenCalledWith(CHANNEL_ONE);
    expect(mockDebugError).toHaveBeenCalledTimes(1);
    expect(mockDebugError).toHaveBeenCalledWith(
      '[realtimeMonitor] removeChannel failed',
      handle.channelName,
      removeError,
    );
    expect(mockReportRealtimeError).toHaveBeenCalledTimes(1);
    expect(mockReportRealtimeError).toHaveBeenCalledWith('remove', handle.channelName, removeError);
  });
});