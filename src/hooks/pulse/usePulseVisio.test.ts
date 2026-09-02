/* @vitest-environment jsdom */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePulseVisio } from './usePulseVisio';

const {
  stableToast,
  useToastMock,
  sanitizeSupabaseErrorMock,
  debugErrorMock,
  invokeMock,
  mockFrom,
} = vi.hoisted(() => ({
  stableToast: vi.fn(),
  useToastMock: vi.fn(),
  sanitizeSupabaseErrorMock: vi.fn(),
  debugErrorMock: vi.fn(),
  invokeMock: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: useToastMock,
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
  },
}));

vi.mock('@/integrations/supabase/client', () => {
  const resolved = Promise.resolve({ data: null, error: null });
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
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
  };

  mockFrom.mockReturnValue(builder);

  return {
    supabase: {
      from: mockFrom,
      functions: {
        invoke: invokeMock,
      },
    },
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('usePulseVisio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastMock.mockReturnValue({ toast: stableToast });
    sanitizeSupabaseErrorMock.mockReturnValue('Erreur formatée');
  });

  it('gère la création OpenPulse Meet avec état de chargement et retourne le roomCode', async () => {
    let resolveInvoke: ((value: {
      data: {
        success: true;
        room: { link: string; roomCode: string };
      };
      error: null;
    }) => void) | null = null;

    invokeMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInvoke = resolve;
        }),
    );

    const { result } = renderHook(() => usePulseVisio(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isCreating).toBe(false);

    let promise: Promise<{
      link: string;
      provider: 'marque_meet';
      roomCode?: string;
      eventId?: string;
    } | null> | null = null;

    act(() => {
      promise = result.current.createVisioLink('marque_meet', 'Consultation cardio', 'conv-1');
    });

    await waitFor(() => {
      expect(result.current.isCreating).toBe(true);
    });

    expect(invokeMock).toHaveBeenCalledWith('webrtc-signaling', {
      body: {
        action: 'create-room',
        name: 'Consultation cardio',
        conversationId: 'conv-1',
      },
    });

    await act(async () => {
      if (resolveInvoke) {
        resolveInvoke({
          data: {
            success: true,
            room: {
              link: 'https://visio.local/room-a',
              roomCode: 'ROOM-A',
            },
          },
          error: null,
        });
      }
    });

    let response: {
      link: string;
      provider: 'marque_meet';
      roomCode?: string;
      eventId?: string;
    } | null = null;

    await act(async () => {
      response = await promise;
    });

    await waitFor(() => {
      expect(result.current.isCreating).toBe(false);
    });

    expect(response).toEqual({
      link: 'https://visio.local/room-a',
      provider: 'marque_meet',
      roomCode: 'ROOM-A',
    });
    expect(stableToast).toHaveBeenCalledWith({
      title: 'Visio créée',
      description: 'Salle OpenPulse Meet créée avec succès',
    });
  });

  it('gère la création Google Meet et retourne le eventId', async () => {
    invokeMock.mockResolvedValue({
      data: {
        meetLink: 'https://meet.local/abc',
        eventId: 'evt-42',
      },
      error: null,
    });

    const { result } = renderHook(() => usePulseVisio(), {
      wrapper: createWrapper(),
    });

    let response: {
      link: string;
      provider: 'google_meet';
      roomCode?: string;
      eventId?: string;
    } | null = null;

    await act(async () => {
      response = await result.current.createVisioLink('google_meet', 'Staff médical');
    });

    expect(invokeMock).toHaveBeenCalledWith('create-google-meet-link', {
      body: { title: 'Staff médical' },
    });
    expect(response).toEqual({
      link: 'https://meet.local/abc',
      provider: 'google_meet',
      eventId: 'evt-42',
    });
    expect(stableToast).toHaveBeenCalledWith({
      title: 'Visio créée',
      description: 'Lien Google Meet généré',
    });
    expect(result.current.isCreating).toBe(false);
  });

  it('gère la création Nextcloud Talk', async () => {
    invokeMock.mockResolvedValue({
      data: {
        talkLink: 'https://talk.local/room-b',
        eventId: 'evt-talk',
      },
      error: null,
    });

    const { result } = renderHook(() => usePulseVisio(), {
      wrapper: createWrapper(),
    });

    let response: {
      link: string;
      provider: 'nextcloud_talk';
      roomCode?: string;
      eventId?: string;
    } | null = null;

    await act(async () => {
      response = await result.current.createVisioLink('nextcloud_talk', 'Réunion équipe');
    });

    expect(invokeMock).toHaveBeenCalledWith('create-nextcloud-talk-link', {
      body: { title: 'Réunion équipe' },
    });
    expect(response).toEqual({
      link: 'https://talk.local/room-b',
      provider: 'nextcloud_talk',
      eventId: 'evt-talk',
    });
    expect(stableToast).toHaveBeenCalledWith({
      title: 'Visio créée',
      description: 'Lien Nextcloud Talk généré',
    });
    expect(result.current.isCreating).toBe(false);
  });

  it('retourne null et affiche une erreur si Supabase renvoie une erreur', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: 'x' },
    });

    const { result } = renderHook(() => usePulseVisio(), {
      wrapper: createWrapper(),
    });

    let response: {
      link: string;
      provider: 'google_meet';
      roomCode?: string;
      eventId?: string;
    } | null = null;

    await act(async () => {
      response = await result.current.createVisioLink('google_meet', 'Point rapide');
    });

    expect(response).toBeNull();
    expect(debugErrorMock).toHaveBeenCalledWith('Visio creation error:', { message: 'x' });
    expect(sanitizeSupabaseErrorMock).toHaveBeenCalledWith({ message: 'x' });
    expect(stableToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur formatée',
      variant: 'destructive',
    });
    expect(result.current.isCreating).toBe(false);
  });

  it('retourne null si aucun lien externe n’est renvoyé', async () => {
    invokeMock.mockResolvedValue({
      data: { eventId: 'evt-empty' },
      error: null,
    });

    const { result } = renderHook(() => usePulseVisio(), {
      wrapper: createWrapper(),
    });

    let response: {
      link: string;
      provider: 'nextcloud_talk';
      roomCode?: string;
      eventId?: string;
    } | null = null;

    await act(async () => {
      response = await result.current.createVisioLink('nextcloud_talk', 'Réunion sans lien');
    });

    expect(response).toBeNull();
    expect(debugErrorMock).toHaveBeenCalledWith('Visio creation error:', expect.any(Error));
    expect(sanitizeSupabaseErrorMock).toHaveBeenCalledWith(expect.any(Error));
    expect(stableToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur formatée',
      variant: 'destructive',
    });
    expect(result.current.isCreating).toBe(false);
  });
});