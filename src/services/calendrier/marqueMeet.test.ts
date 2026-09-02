import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { createMarqueMeetRoom } from './marqueMeet';

const {
  ROOM_OK,
  INVOKE_OK_RESPONSE,
  INVOKE_FAIL_RESPONSE,
  INVOKE_THROWN_ERROR,
  stableUser,
  mockInvoke,
  mockFrom,
} = vi.hoisted(() => {
  const ROOM_OK = {
    link: 'https://meet.local/room-1',
    roomId: 'room-1',
    name: 'Consultation',
  };

  return {
    ROOM_OK,
    INVOKE_OK_RESPONSE: {
      data: {
        success: true,
        room: ROOM_OK,
      },
      error: null,
    },
    INVOKE_FAIL_RESPONSE: {
      data: {
        success: false,
        error: 'création impossible',
      },
      error: null,
    },
    INVOKE_THROWN_ERROR: {
      data: null,
      error: { message: 'x' },
    },
    stableUser: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockInvoke: vi.fn(),
    mockFrom: vi.fn(),
  };
});

function createBuilder() {
  const builder = {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom.mockImplementation(() => createBuilder()),
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableUser,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableUser,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => stableUser,
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('marqueMeet', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockFrom.mockReset();
  });

  it('crée une salle et retourne les valeurs métier attendues', async () => {
    mockInvoke.mockResolvedValue(INVOKE_OK_RESPONSE);

    const room = await createMarqueMeetRoom('Consultation');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('webrtc-signaling', {
      body: { action: 'create-room', name: 'Consultation' },
    });
    expect(room).toEqual(ROOM_OK);
    expect(room.link).toBe('https://meet.local/room-1');
    expect(room.roomId).toBe('room-1');
    expect(room.name).toBe('Consultation');
  });

  it('propage une erreur supabase quand invoke retourne error', async () => {
    mockInvoke.mockResolvedValue(INVOKE_THROWN_ERROR);

    await expect(createMarqueMeetRoom('Urgence')).rejects.toMatchObject({
      message: 'x',
    });

    expect(mockInvoke).toHaveBeenCalledWith('webrtc-signaling', {
      body: { action: 'create-room', name: 'Urgence' },
    });
  });

  it('lève une erreur métier quand success vaut false', async () => {
    mockInvoke.mockResolvedValue(INVOKE_FAIL_RESPONSE);

    await expect(createMarqueMeetRoom('Bloc')).rejects.toThrow('création impossible');

    expect(mockInvoke).toHaveBeenCalledWith('webrtc-signaling', {
      body: { action: 'create-room', name: 'Bloc' },
    });
  });

  it('expose un cycle chargement puis succès via un hook de requête', async () => {
    mockInvoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(INVOKE_OK_RESPONSE), 0);
        }),
    );

    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        ({
          queryKey: ['marque-meet-room', 'Consultation'],
          queryFn: () => createMarqueMeetRoom('Consultation'),
        }),
      { wrapper },
    );

    expect(result.current.queryKey).toEqual(['marque-meet-room', 'Consultation']);

    const { result: queryResult } = renderHook(
      () => {
        const { useQuery } = requirelessTanstack();
        return useQuery({
          queryKey: ['marque-meet-room', 'Consultation'],
          queryFn: () => createMarqueMeetRoom('Consultation'),
        });
      },
      { wrapper },
    );

    expect(queryResult.current.isLoading || queryResult.current.isPending).toBe(true);

    await waitFor(() => {
      expect(queryResult.current.isSuccess).toBe(true);
    });

    expect(queryResult.current.data).toEqual(ROOM_OK);
    expect(queryResult.current.data?.link).toBe('https://meet.local/room-1');
  });

  it('expose un état isError via un hook de requête quand la création échoue', async () => {
    mockInvoke.mockResolvedValue(INVOKE_THROWN_ERROR);

    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        const { useQuery } = requirelessTanstack();
        return useQuery({
          queryKey: ['marque-meet-room', 'Erreur'],
          queryFn: () => createMarqueMeetRoom('Erreur'),
        });
      },
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toMatchObject({ message: 'x' });
  });
});

function requirelessTanstack() {
  return {
    useQuery: (options: {
      queryKey: readonly unknown[];
      queryFn: () => Promise<unknown>;
    }) => {
      const mod = (globalThis as unknown as { __tanstack?: typeof import('@tanstack/react-query') }).__tanstack;
      if (mod) return mod.useQuery(options);
      throw new Error('tanstack non initialisé');
    },
  };
}

import('@tanstack/react-query').then((mod) => {
  (globalThis as unknown as { __tanstack?: typeof import('@tanstack/react-query') }).__tanstack = mod;
});