// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useOAuthConnections,
  useInitGoogleOAuth,
  useDisconnectOAuth,
  useSaveNextcloudConfig,
  useCreateGoogleMeetLink,
  useCreateNextcloudTalkLink,
} from './useOAuthConnections';

const {
  stableUser,
  toastMock,
  sanitizeSupabaseErrorMock,
  debugErrorMock,
  invokeMock,
  mockFrom,
} = vi.hoisted(() => {
  const stableBuilder = {
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

  stableBuilder.select.mockReturnValue(stableBuilder);
  stableBuilder.eq.mockReturnValue(stableBuilder);
  stableBuilder.gte.mockReturnValue(stableBuilder);
  stableBuilder.lte.mockReturnValue(stableBuilder);
  stableBuilder.in.mockReturnValue(stableBuilder);
  stableBuilder.order.mockReturnValue(stableBuilder);
  stableBuilder.limit.mockReturnValue(stableBuilder);
  stableBuilder.insert.mockReturnValue(stableBuilder);
  stableBuilder.update.mockReturnValue(stableBuilder);
  stableBuilder.delete.mockReturnValue(stableBuilder);
  stableBuilder.single.mockResolvedValue({ data: null, error: null });
  stableBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
  stableBuilder.then.mockImplementation((onFulfilled: (value: { data: null; error: null }) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled),
  );
  stableBuilder.catch.mockImplementation(
    (onRejected: (reason: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected),
  );

  return {
    stableUser: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    toastMock: vi.fn(),
    sanitizeSupabaseErrorMock: vi.fn((error: Error) => `Sanitized: ${error.message}`),
    debugErrorMock: vi.fn(),
    invokeMock: vi.fn(),
    mockFrom: vi.fn(() => stableBuilder),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  toast: toastMock,
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
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
}));

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

describe('useOAuthConnections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne les statuts OAuth partagés attendus après le chargement', async () => {
    const { result } = renderHook(() => useOAuthConnections(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      google: {
        connected: true,
        email: 'Compte partagé',
        shared: true,
      },
      nextcloud: {
        connected: true,
        instanceUrl: 'Compte partagé',
        shared: true,
      },
      microsoft: {
        connected: false,
      },
      zoom: {
        connected: false,
      },
    });

    expect(result.current.data?.google.connected).toBe(true);
    expect(result.current.data?.google.email).toBe('Compte partagé');
    expect(result.current.data?.google.shared).toBe(true);
    expect(result.current.data?.nextcloud.connected).toBe(true);
    expect(result.current.data?.nextcloud.instanceUrl).toBe('Compte partagé');
    expect(result.current.data?.nextcloud.shared).toBe(true);
    expect(result.current.data?.microsoft.connected).toBe(false);
    expect(result.current.data?.zoom.connected).toBe(false);
  });
});

describe('mutations informatives dépréciées', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useInitGoogleOAuth affiche le toast attendu', async () => {
    const { result } = renderHook(() => useInitGoogleOAuth(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      const value = await result.current.mutateAsync();
      expect(value).toBeNull();
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Google Meet disponible',
      description: 'Google Meet est déjà configuré via le compte partagé.',
    });
  });

  it('useDisconnectOAuth affiche le toast attendu avec le provider fourni', async () => {
    const { result } = renderHook(() => useDisconnectOAuth(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      const value = await result.current.mutateAsync('zoom');
      expect(value).toBeNull();
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Action non disponible',
      description: 'Les services de visioconférence sont gérés par un compte partagé.',
    });
  });

  it('useSaveNextcloudConfig affiche le toast attendu', async () => {
    const { result } = renderHook(() => useSaveNextcloudConfig(), {
      wrapper: createWrapper(),
    });

    const config = {
      instanceUrl: 'https://cloud.local',
      username: 'alice',
      appPassword: 'pass123',
    };

    await act(async () => {
      const value = await result.current.mutateAsync(config);
      expect(value).toBeNull();
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Configuration Nextcloud',
      description: 'Nextcloud Talk est déjà configuré via le compte partagé.',
    });
  });
});

describe('useCreateGoogleMeetLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crée un lien Google Meet avec les paramètres attendus et retourne le lien', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        success: true,
        meetLink: 'meet-link',
      },
      error: null,
    });

    const { result } = renderHook(() => useCreateGoogleMeetLink(), {
      wrapper: createWrapper(),
    });

    const payload = {
      title: 'Réunion équipe',
      startTime: '2026-06-08T10:00:00Z',
      endTime: '2026-06-08T11:00:00Z',
    };

    await act(async () => {
      const meetLink = await result.current.mutateAsync(payload);
      expect(meetLink).toBe('meet-link');
    });

    expect(invokeMock).toHaveBeenCalledWith('create-google-meet-link', {
      body: payload,
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Lien Google Meet créé',
      description: "Le lien a été ajouté à l'événement",
    });
  });

  it('passe en erreur quand la function Supabase renvoie une erreur', async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'x' },
    });

    const { result } = renderHook(() => useCreateGoogleMeetLink(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          title: 'Réunion',
          startTime: '2026-06-08T10:00:00Z',
          endTime: '2026-06-08T11:00:00Z',
        }),
      ).rejects.toThrow('x');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(debugErrorMock).toHaveBeenCalledWith('Error creating Google Meet link:', { message: 'x' });
    expect(sanitizeSupabaseErrorMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Erreur Google Meet',
      description: 'Sanitized: x',
      variant: 'destructive',
    });
  });

  it('passe en erreur quand la réponse ne contient pas success=true', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        success: false,
        error: 'x',
      },
      error: null,
    });

    const { result } = renderHook(() => useCreateGoogleMeetLink(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          title: 'Réunion',
        }),
      ).rejects.toThrow('x');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Erreur Google Meet',
      description: 'Sanitized: x',
      variant: 'destructive',
    });
  });
});

describe('useCreateNextcloudTalkLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crée une salle Nextcloud Talk et retourne le lien', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        success: true,
        talkLink: 'talk-link',
      },
      error: null,
    });

    const { result } = renderHook(() => useCreateNextcloudTalkLink(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      const talkLink = await result.current.mutateAsync({
        title: 'Atelier',
      });
      expect(talkLink).toBe('talk-link');
    });

    expect(invokeMock).toHaveBeenCalledWith('create-nextcloud-talk-link', {
      body: { title: 'Atelier' },
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Salle Nextcloud Talk créée',
      description: "Le lien a été ajouté à l'événement",
    });
  });

  it('passe en erreur quand la function Supabase renvoie une erreur', async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'x' },
    });

    const { result } = renderHook(() => useCreateNextcloudTalkLink(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          title: 'Atelier',
        }),
      ).rejects.toThrow('x');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(debugErrorMock).toHaveBeenCalledWith('Error creating Nextcloud Talk link:', { message: 'x' });
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Erreur Nextcloud Talk',
      description: 'Sanitized: x',
      variant: 'destructive',
    });
  });

  it('passe en erreur quand la réponse ne contient pas success=true', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        success: false,
        error: 'x',
      },
      error: null,
    });

    const { result } = renderHook(() => useCreateNextcloudTalkLink(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          title: 'Atelier',
        }),
      ).rejects.toThrow('x');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Erreur Nextcloud Talk',
      description: 'Sanitized: x',
      variant: 'destructive',
    });
  });
});