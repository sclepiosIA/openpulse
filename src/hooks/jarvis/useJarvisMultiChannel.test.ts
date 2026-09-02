// @vitest-environment jsdom

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisMultiChannel } from './useJarvisMultiChannel';

const {
  AUTH_STATE,
  TOAST_FN,
  DEBUG_ERROR,
  SANITIZED_ERROR,
  CHANNELS_RESPONSE,
  HISTORY_RESPONSE,
  SEND_SUCCESS_RESPONSE,
  SEND_FAILURE_RESPONSE,
  INVOKE_ERROR,
  mockInvoke,
  mockFrom,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.dev' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  TOAST_FN: vi.fn(),
  DEBUG_ERROR: vi.fn(),
  SANITIZED_ERROR: 'Erreur nettoyee',
  CHANNELS_RESPONSE: {
    channels: [
      { id: 'email', name: 'Email', enabled: true, configured: true, icon: '' },
      { id: 'sms', name: 'SMS', enabled: true, configured: false, icon: '' },
      { id: 'slack', name: 'Slack', enabled: false, configured: true, icon: '' },
      { id: 'teams', name: 'Teams', enabled: true, configured: true, icon: '' },
    ],
  },
  HISTORY_RESPONSE: {
    history: [
      {
        id: 'h1',
        agent_id: 'prime',
        channel: 'email',
        recipient: 'alice@test.dev',
        message_preview: 'Bonjour Alice',
        status: 'sent',
        created_at: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'h2',
        agent_id: 'prime',
        channel: 'sms',
        recipient: '+330000000',
        message_preview: 'Code 1234',
        status: 'failed',
        error_message: 'provider down',
        created_at: '2024-01-02T00:00:00.000Z',
      },
    ],
  },
  SEND_SUCCESS_RESPONSE: {
    success: true,
    message_id: 'm1',
  },
  SEND_FAILURE_RESPONSE: {
    success: false,
    error: 'quota reached',
  },
  INVOKE_ERROR: new Error('backend exploded'),
  mockInvoke: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: TOAST_FN }),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: DEBUG_ERROR,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: vi.fn(() => SANITIZED_ERROR),
}));

vi.mock('@/integrations/supabase/client', () => {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  mockFrom.mockReturnValue(builder);

  return {
    supabase: {
      from: mockFrom,
      functions: {
        invoke: mockInvoke,
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

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useJarvisMultiChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AUTH_STATE.user = { id: 'u1', email: 'user@test.dev' };
  });

  it('fetchChannels charge les canaux et calcule les icones et availableChannels', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: CHANNELS_RESPONSE,
      error: null,
    });

    const { result } = renderHook(() => useJarvisMultiChannel(), {
      wrapper: createWrapper(),
    });

    expect(result.current.channels).toEqual([]);
    expect(result.current.availableChannels).toEqual([]);
    expect(result.current.isChannelAvailable('email')).toBe(false);

    await act(async () => {
      await result.current.fetchChannels();
    });

    expect(mockInvoke).toHaveBeenCalledWith('jarvis-multi-channel', {
      body: {
        action: 'get_channels',
        user_id: 'u1',
      },
    });

    expect(result.current.channels).toEqual([
      { id: 'email', name: 'Email', enabled: true, configured: true, icon: '📧' },
      { id: 'sms', name: 'SMS', enabled: true, configured: false, icon: '📱' },
      { id: 'slack', name: 'Slack', enabled: false, configured: true, icon: '💬' },
      { id: 'teams', name: 'Teams', enabled: true, configured: true, icon: '🟦' },
    ]);

    expect(result.current.availableChannels).toEqual([
      { id: 'email', name: 'Email', enabled: true, configured: true, icon: '📧' },
      { id: 'teams', name: 'Teams', enabled: true, configured: true, icon: '🟦' },
    ]);

    expect(result.current.isChannelAvailable('email')).toBe(true);
    expect(result.current.isChannelAvailable('sms')).toBe(false);
    expect(result.current.isChannelAvailable('slack')).toBe(false);
    expect(result.current.isChannelAvailable('teams')).toBe(true);
    expect(result.current.isChannelAvailable('whatsapp')).toBe(false);
  });

  it('fetchHistory charge l historique des actions', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: HISTORY_RESPONSE,
      error: null,
    });

    const { result } = renderHook(() => useJarvisMultiChannel(), {
      wrapper: createWrapper(),
    });

    expect(result.current.history).toEqual([]);

    await act(async () => {
      await result.current.fetchHistory();
    });

    expect(mockInvoke).toHaveBeenCalledWith('jarvis-multi-channel', {
      body: {
        action: 'get_history',
        user_id: 'u1',
      },
    });

    expect(result.current.history).toEqual(HISTORY_RESPONSE.history);
    expect(result.current.history[0]).toMatchObject({
      id: 'h1',
      channel: 'email',
      recipient: 'alice@test.dev',
      status: 'sent',
    });
    expect(result.current.history[1]).toMatchObject({
      id: 'h2',
      channel: 'sms',
      status: 'failed',
      error_message: 'provider down',
    });
  });

  it('sendMessage envoie le message, affiche un toast de succes, rafraichit l historique et repasse isLoading a false', async () => {
    const message = {
      channel: 'email' as const,
      recipient: 'bob@test.dev',
      subject: 'Sujet',
      message: 'Bonjour Bob',
      metadata: { priority: 'high' },
    };

    let resolveSend: ((value: { data: typeof SEND_SUCCESS_RESPONSE; error: null }) => void) | undefined;

    mockInvoke
      .mockImplementationOnce(
        () =>
          new Promise<{ data: typeof SEND_SUCCESS_RESPONSE; error: null }>((resolve) => {
            resolveSend = resolve;
          })
      )
      .mockResolvedValueOnce({
        data: HISTORY_RESPONSE,
        error: null,
      });

    const { result } = renderHook(() => useJarvisMultiChannel(), {
      wrapper: createWrapper(),
    });

    let response:
      | { success: boolean; message_id?: string; error?: string }
      | undefined;

    const promise = result.current.sendMessage(message, 'prime');

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    await act(async () => {
      if (resolveSend) {
        resolveSend({
          data: SEND_SUCCESS_RESPONSE,
          error: null,
        });
      }
      response = await promise;
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'jarvis-multi-channel', {
      body: {
        action: 'send',
        user_id: 'u1',
        agent_id: 'prime',
        channel_message: message,
      },
    });

    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'jarvis-multi-channel', {
      body: {
        action: 'get_history',
        user_id: 'u1',
      },
    });

    expect(response).toEqual({
      success: true,
      message_id: 'm1',
    });

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: '✅ Message envoyé via Email',
      description: 'À bob@test.dev',
    });

    expect(result.current.history).toEqual(HISTORY_RESPONSE.history);
  });

  it('sendMessage retourne un echec metier et affiche un toast destructif sans rafraichir l historique', async () => {
    const message = {
      channel: 'sms' as const,
      recipient: '+331234',
      message: 'Ping',
    };

    mockInvoke.mockResolvedValueOnce({
      data: SEND_FAILURE_RESPONSE,
      error: null,
    });

    const { result } = renderHook(() => useJarvisMultiChannel(), {
      wrapper: createWrapper(),
    });

    let response:
      | { success: boolean; message_id?: string; error?: string }
      | undefined;

    await act(async () => {
      response = await result.current.sendMessage(message);
    });

    expect(response).toEqual({
      success: false,
      error: 'quota reached',
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('jarvis-multi-channel', {
      body: {
        action: 'send',
        user_id: 'u1',
        agent_id: 'prime',
        channel_message: message,
      },
    });

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Échec de l\'envoi',
      description: 'quota reached',
      variant: 'destructive',
    });

    expect(result.current.history).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('sendMessage gere une erreur backend, sanitise le message et retourne success false', async () => {
    const message = {
      channel: 'slack' as const,
      recipient: '#alerts',
      message: 'Attention',
    };

    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: INVOKE_ERROR,
    });

    const { result } = renderHook(() => useJarvisMultiChannel(), {
      wrapper: createWrapper(),
    });

    let response:
      | { success: boolean; message_id?: string; error?: string }
      | undefined;

    await act(async () => {
      response = await result.current.sendMessage(message, 'ops');
    });

    expect(response).toEqual({
      success: false,
      error: 'backend exploded',
    });

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: SANITIZED_ERROR,
      variant: 'destructive',
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('fetchChannels journalise une erreur quand la fonction renvoie { data:null, error }', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'x' },
    });

    const { result } = renderHook(() => useJarvisMultiChannel(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.fetchChannels();
    });

    expect(DEBUG_ERROR).toHaveBeenCalledWith(
      '[useJarvisMultiChannel] Error fetching channels:',
      { message: 'x' }
    );
    expect(result.current.channels).toEqual([]);
  });

  it('fetchHistory journalise une erreur quand la fonction renvoie { data:null, error }', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'x' },
    });

    const { result } = renderHook(() => useJarvisMultiChannel(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.fetchHistory();
    });

    expect(DEBUG_ERROR).toHaveBeenCalledWith(
      '[useJarvisMultiChannel] Error fetching history:',
      { message: 'x' }
    );
    expect(result.current.history).toEqual([]);
  });

  it('sendMessage refuse l envoi si non authentifie', async () => {
    AUTH_STATE.user = null;

    const { result } = renderHook(() => useJarvisMultiChannel(), {
      wrapper: createWrapper(),
    });

    const response = await result.current.sendMessage({
      channel: 'whatsapp',
      recipient: '+33999',
      message: 'Salut',
    });

    expect(response).toEqual({
      success: false,
      error: 'Not authenticated',
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(TOAST_FN).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});