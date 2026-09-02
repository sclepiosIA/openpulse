const {
  PRESENCE_ROW,
  ERROR_RESULT,
  EMPTY_RESULT,
  NOW_ISO,
  mockFrom,
  builder,
  state,
} = vi.hoisted(() => {
  const PRESENCE_ROW = {
    status: 'available',
    custom_status: 'Focus',
    custom_status_emoji: '🎯',
    auto_status: true,
    calendar_event_id: 'evt1',
  };

  const ERROR_RESULT = {
    data: null,
    error: { message: 'x' },
  };

  const EMPTY_RESULT = {
    data: null,
    error: null,
  };

  const NOW_ISO = '2024-01-02T03:04:05.000Z';

  const state = {
    maybeSingleResult: {
      data: PRESENCE_ROW,
      error: null,
    } as unknown,
    singleResult: EMPTY_RESULT as unknown,
    thenResult: EMPTY_RESULT as unknown,
  };

  let builder: Record<string, ReturnType<typeof vi.fn>>;

  builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(state.singleResult)),
    maybeSingle: vi.fn(() => Promise.resolve(state.maybeSingleResult)),
    then: vi.fn(
      (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(state.thenResult).then(onFulfilled, onRejected),
    ),
    catch: vi.fn((onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(state.thenResult).catch(onRejected),
    ),
  };

  const mockFrom = vi.fn(() => builder);

  return {
    PRESENCE_ROW,
    ERROR_RESULT,
    EMPTY_RESULT,
    NOW_ISO,
    mockFrom,
    builder,
    state,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { fetchLatestPresence, upsertGlobalPresence, upsertPresence } from './presenceService';

describe('presenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
    state.maybeSingleResult = {
      data: PRESENCE_ROW,
      error: null,
    };
    state.singleResult = EMPTY_RESULT;
    state.thenResult = EMPTY_RESULT;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetchLatestPresence lit la dernière présence du user', async () => {
    const result = await fetchLatestPresence('u1');

    expect(result).toEqual({
      status: 'available',
      custom_status: 'Focus',
      custom_status_emoji: '🎯',
      auto_status: true,
      calendar_event_id: 'evt1',
    });
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('pulse_presence');
    expect(builder.select).toHaveBeenCalledWith(
      'status, custom_status, custom_status_emoji, auto_status, calendar_event_id',
    );
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.order).toHaveBeenCalledWith('last_seen_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(1);
    expect(builder.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('fetchLatestPresence retourne null quand Supabase renvoie une erreur sans donnée', async () => {
    state.maybeSingleResult = ERROR_RESULT;

    const result = await fetchLatestPresence('u2');

    expect(result).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith('pulse_presence');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u2');
    expect(builder.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('upsertPresence écrit la présence globale sans conversation avec les valeurs fournies', async () => {
    await upsertPresence({
      userId: 'u1',
      status: 'busy',
      customStatus: 'Meeting',
      autoStatus: true,
      statusExpiresAt: '2024-01-02T04:00:00.000Z',
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('pulse_presence');
    expect(builder.upsert).toHaveBeenCalledWith(
      {
        user_id: 'u1',
        conversation_id: null,
        status: 'busy',
        custom_status: 'Meeting',
        status_expires_at: '2024-01-02T04:00:00.000Z',
        auto_status: true,
        last_seen_at: NOW_ISO,
      },
      { onConflict: 'user_id,conversation_id' },
    );
    expect(builder.then).toHaveBeenCalledTimes(1);
  });

  it('upsertPresence applique les valeurs par défaut null et false', async () => {
    await upsertPresence({
      userId: 'u3',
      status: 'away',
    });

    expect(builder.upsert).toHaveBeenCalledWith(
      {
        user_id: 'u3',
        conversation_id: null,
        status: 'away',
        custom_status: null,
        status_expires_at: null,
        auto_status: false,
        last_seen_at: NOW_ISO,
      },
      { onConflict: 'user_id,conversation_id' },
    );
  });

  it('upsertGlobalPresence écrit une présence sans conversation_id', async () => {
    await upsertGlobalPresence({
      userId: 'u4',
      status: 'offline',
      customStatus: null,
      autoStatus: false,
      statusExpiresAt: null,
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('pulse_presence');
    expect(builder.upsert).toHaveBeenCalledWith(
      {
        user_id: 'u4',
        conversation_id: null,
        status: 'offline',
        custom_status: null,
        status_expires_at: null,
        auto_status: false,
        last_seen_at: NOW_ISO,
      },
      { onConflict: 'user_id,conversation_id', ignoreDuplicates: false },
    );
    expect(builder.then).toHaveBeenCalledTimes(1);
  });
});