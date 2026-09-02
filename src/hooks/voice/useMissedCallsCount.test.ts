import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  AUTH_VALUE,
  NO_AUTH_VALUE,
  SUCCESS_RESPONSE,
  ERROR_RESPONSE,
  mockState,
  mockBuilder,
  mockFrom,
  mockChannel,
  mockRemoveChannel,
  channelInstance,
  mockToastInfo,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
  mockUseAuth,
  mockQueryPresets,
  FIXED_NOW_MS,
  EXPECTED_SINCE,
} = vi.hoisted(() => {
  type QueryResponse = {
    data: null;
    count: number | null;
    error: null | { message: string };
  };

  type RealtimePayload = {
    new: { status?: string; from_name?: string; from_number?: string } | null;
  };

  type RealtimeConfig = {
    event: string;
    schema: string;
    table: string;
    filter: string;
  };

  type RealtimeRegistration = {
    config: RealtimeConfig;
    callback: (payload: RealtimePayload) => void;
  };

  type Fulfilled<TResult> = ((value: QueryResponse) => TResult | PromiseLike<TResult>) | null | undefined;
  type Rejected<TResult> = ((reason: unknown) => TResult | PromiseLike<TResult>) | null | undefined;

  const AUTH_USER = { id: 'u1', email: 't@t.co' };
  const AUTH_VALUE = {
    user: AUTH_USER,
    session: { user: AUTH_USER },
    isLoading: false,
  };
  const NO_AUTH_VALUE = {
    user: null,
    session: null,
    isLoading: false,
  };

  const SUCCESS_RESPONSE: QueryResponse = { data: null, count: 3, error: null };
  const ERROR_RESPONSE: QueryResponse = { data: null, count: null, error: { message: 'x' } };

  const FIXED_NOW_MS = new Date('2024-01-15T12:00:00.000Z').getTime();
  const EXPECTED_SINCE = '2024-01-08T12:00:00.000Z';

  const mockState: {
    response: QueryResponse | Promise<QueryResponse>;
    authValue: typeof AUTH_VALUE | typeof NO_AUTH_VALUE;
    registrations: RealtimeRegistration[];
    channelName: string;
  } = {
    response: SUCCESS_RESPONSE,
    authValue: AUTH_VALUE,
    registrations: [],
    channelName: '',
  };

  const mockBuilder = {} as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: ReturnType<typeof vi.fn>;
    catch: ReturnType<typeof vi.fn>;
  };

  mockBuilder.select = vi.fn(() => mockBuilder);
  mockBuilder.eq = vi.fn(() => mockBuilder);
  mockBuilder.gte = vi.fn(() => mockBuilder);
  mockBuilder.lte = vi.fn(() => mockBuilder);
  mockBuilder.in = vi.fn(() => mockBuilder);
  mockBuilder.order = vi.fn(() => mockBuilder);
  mockBuilder.limit = vi.fn(() => mockBuilder);
  mockBuilder.insert = vi.fn(() => mockBuilder);
  mockBuilder.update = vi.fn(() => mockBuilder);
  mockBuilder.delete = vi.fn(() => mockBuilder);
  mockBuilder.single = vi.fn(() => Promise.resolve(mockState.response));
  mockBuilder.maybeSingle = vi.fn(() => Promise.resolve(mockState.response));
  mockBuilder.then = vi.fn((onfulfilled?: Fulfilled<unknown>, onrejected?: Rejected<unknown>) =>
    Promise.resolve(mockState.response).then(onfulfilled, onrejected),
  );
  mockBuilder.catch = vi.fn((onrejected?: Rejected<unknown>) => Promise.resolve(mockState.response).catch(onrejected));

  const channelInstance = {} as {
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };

  channelInstance.on = vi.fn(
    (_eventType: string, config: RealtimeConfig, callback: (payload: RealtimePayload) => void) => {
      mockState.registrations.push({ config, callback });
      return channelInstance;
    },
  );
  channelInstance.subscribe = vi.fn(() => channelInstance);

  const mockFrom = vi.fn((_table: string) => mockBuilder);
  const mockChannel = vi.fn((name: string) => {
    mockState.channelName = name;
    return channelInstance;
  });
  const mockRemoveChannel = vi.fn((_channel: typeof channelInstance) => undefined);

  const mockToastInfo = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockDebugError = vi.fn();
  const mockUseAuth = vi.fn(() => mockState.authValue);

  const mockQueryPresets = {
    standard: {
      staleTime: 0,
    },
  };

  return {
    AUTH_VALUE,
    NO_AUTH_VALUE,
    SUCCESS_RESPONSE,
    ERROR_RESPONSE,
    mockState,
    mockBuilder,
    mockFrom,
    mockChannel,
    mockRemoveChannel,
    channelInstance,
    mockToastInfo,
    mockToastSuccess,
    mockToastError,
    mockDebugError,
    mockUseAuth,
    mockQueryPresets,
    FIXED_NOW_MS,
    EXPECTED_SINCE,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: mockQueryPresets,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    info: mockToastInfo,
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

import { useMissedCallsCount } from './useMissedCallsCount';

let dateNowMock: { mockRestore: () => void } | undefined;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function renderUseMissedCallsCount(queryClient = createQueryClient()) {
  return {
    queryClient,
    ...renderHook(() => useMissedCallsCount(), {
      wrapper: createWrapper(queryClient),
    }),
  };
}

function findRealtimeRegistration(event: 'INSERT' | 'UPDATE') {
  const registration = mockState.registrations.find((item) => item.config.event === event);

  if (registration === undefined) {
    throw new Error(`Realtime registration not found for ${event}`);
  }

  return registration;
}

beforeEach(() => {
  dateNowMock = vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
  vi.clearAllMocks();

  mockState.response = SUCCESS_RESPONSE;
  mockState.authValue = AUTH_VALUE;
  mockState.registrations.length = 0;
  mockState.channelName = '';
});

afterEach(() => {
  cleanup();
  dateNowMock?.mockRestore();
  dateNowMock = undefined;
});

describe('useMissedCallsCount', () => {
  it('retourne 0 pendant le chargement puis le nombre réel d’appels manqués', async () => {
    let resolveQuery: (value: typeof SUCCESS_RESPONSE) => void = () => undefined;
    const pendingQuery = new Promise<typeof SUCCESS_RESPONSE>((resolve) => {
      resolveQuery = resolve;
    });
    mockState.response = pendingQuery;

    const { result } = renderUseMissedCallsCount();

    expect(result.current).toBe(0);

    await waitFor(() => {
      expect(mockBuilder.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    });

    expect(result.current).toBe(0);

    resolveQuery(SUCCESS_RESPONSE);

    await waitFor(() => {
      expect(result.current).toBe(3);
    });
  });

  it('charge le compteur des appels entrants manqués des 7 derniers jours pour l’utilisateur courant', async () => {
    const { result } = renderUseMissedCallsCount();

    await waitFor(() => {
      expect(result.current).toBe(3);
    });

    expect(mockFrom).toHaveBeenCalledWith('calls');
    expect(mockBuilder.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(mockBuilder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(mockBuilder.eq).toHaveBeenCalledWith('status', 'missed');
    expect(mockBuilder.gte).toHaveBeenCalledWith('started_at', EXPECTED_SINCE);
    expect(mockChannel).toHaveBeenCalledWith(
      expect.stringMatching(/^missed-calls-badge-u1-[a-z0-9]+-\d+-[a-z0-9]+$/),
    );
    expect(channelInstance.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'calls', filter: 'user_id=eq.u1' },
      expect.any(Function),
    );
    expect(channelInstance.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'calls', filter: 'user_id=eq.u1' },
      expect.any(Function),
    );
    expect(channelInstance.subscribe).toHaveBeenCalledTimes(1);
  });

  it('retourne 0 et loggue l’erreur Supabase quand le comptage échoue', async () => {
    mockState.response = ERROR_RESPONSE;

    const { result } = renderUseMissedCallsCount();

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalledWith('[useMissedCallsCount]', { message: 'x' });
    });

    expect(result.current).toBe(0);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('invalide le cache et affiche un toast quand un INSERT realtime correspond à un appel manqué', async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result, unmount } = renderUseMissedCallsCount(queryClient);

    await waitFor(() => {
      expect(result.current).toBe(3);
    });

    await waitFor(() => {
      expect(mockState.registrations).toHaveLength(2);
    });

    const insertRegistration = findRealtimeRegistration('INSERT');

    await act(async () => {
      insertRegistration.callback({
        new: { status: 'missed', from_name: 'Alice' },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['missed-calls-count', 'u1'] });
    expect(mockToastInfo).toHaveBeenCalledWith('Appel manqué', {
      description: 'Alice',
    });

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledWith(channelInstance);
  });

  it('ignore le toast sur INSERT realtime non manqué mais invalide le cache sur UPDATE', async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderUseMissedCallsCount(queryClient);

    await waitFor(() => {
      expect(result.current).toBe(3);
    });

    await waitFor(() => {
      expect(mockState.registrations).toHaveLength(2);
    });

    const insertRegistration = findRealtimeRegistration('INSERT');
    const updateRegistration = findRealtimeRegistration('UPDATE');

    await act(async () => {
      insertRegistration.callback({
        new: { status: 'answered', from_name: 'Bob' },
      });
      updateRegistration.callback({
        new: { status: 'missed', from_number: '010203' },
      });
    });

    expect(mockToastInfo).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['missed-calls-count', 'u1'] });
  });

  it('ne lance aucune requête ni abonnement realtime sans utilisateur authentifié', async () => {
    mockState.authValue = NO_AUTH_VALUE;

    const { result } = renderUseMissedCallsCount();

    expect(result.current).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockChannel).not.toHaveBeenCalled();
    expect(channelInstance.subscribe).not.toHaveBeenCalled();
  });
});