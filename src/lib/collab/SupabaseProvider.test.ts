// @vitest-environment jsdom

import * as Y from 'yjs';
import { SupabaseProvider } from './SupabaseProvider';

const {
  mockChannel,
  mockSupabase,
  subscribeStatus,
  presenceStateValue,
  capturedHandlers,
  sendMock,
  trackMock,
  untrackMock,
  removeChannelMock,
  channelMockFn,
} = vi.hoisted(() => {
  const captured: Record<string, ((payload: unknown) => void) | undefined> = {};
  let subscribeStatusValue: 'SUBSCRIBED' | 'CHANNEL_ERROR' = 'SUBSCRIBED';
  let presenceStateCurrent: Record<string, Array<{ user_id: string; user_name: string; user_avatar?: string; user_color?: string }>> = {};

  const send = vi.fn().mockResolvedValue({ error: null });
  const track = vi.fn().mockResolvedValue({ error: null });
  const untrack = vi.fn().mockResolvedValue({ error: null });

  const channel = {
    on: vi.fn((type: string, filter: { event: string }, handler: (payload: unknown) => void) => {
      captured[`${type}:${filter.event}`] = handler;
      return channel;
    }),
    subscribe: vi.fn(async (callback: (status: 'SUBSCRIBED' | 'CHANNEL_ERROR') => void) => {
      callback(subscribeStatusValue);
      return 'ok';
    }),
    send,
    track,
    untrack,
    presenceState: vi.fn(() => presenceStateCurrent),
  };

  const channelFn = vi.fn(() => channel);
  const removeChannel = vi.fn();

  const supabase = {
    channel: channelFn,
    removeChannel,
  };

  return {
    mockChannel: channel,
    mockSupabase: supabase,
    subscribeStatus: {
      get: () => subscribeStatusValue,
      set: (value: 'SUBSCRIBED' | 'CHANNEL_ERROR') => {
        subscribeStatusValue = value;
      },
    },
    presenceStateValue: {
      get: () => presenceStateCurrent,
      set: (value: Record<string, Array<{ user_id: string; user_name: string; user_avatar?: string; user_color?: string }>>) => {
        presenceStateCurrent = value;
      },
    },
    capturedHandlers: captured,
    sendMock: send,
    trackMock: track,
    untrackMock: untrack,
    removeChannelMock: removeChannel,
    channelMockFn: channelFn,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('SupabaseProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    subscribeStatus.set('SUBSCRIBED');
    presenceStateValue.set({});
    Object.keys(capturedHandlers).forEach((key) => {
      delete capturedHandlers[key];
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connecte le canal, suit la présence, demande la synchro et devient synced après timeout', async () => {
    const doc = new Y.Doc();
    const provider = new SupabaseProvider('doc-1', doc, {
      id: 'u1',
      name: 'Alice',
      avatar: 'a.png',
      color: '#123456',
    });

    const connectionChanges: boolean[] = [];
    const syncedSpy = vi.fn();

    provider.onConnectionChange((connected) => {
      connectionChanges.push(connected);
    });
    provider.onSynced(syncedSpy);

    expect(provider.isConnected).toBe(false);
    expect(provider.isSynced).toBe(false);

    await provider.connect();

    expect(channelMockFn).toHaveBeenCalledWith('collab-doc-doc-1', {
      config: { broadcast: { self: false } },
    });
    expect(provider.isConnected).toBe(true);
    expect(connectionChanges).toEqual([true]);
    expect(trackMock).toHaveBeenCalledWith({
      user_id: 'u1',
      user_name: 'Alice',
      user_avatar: 'a.png',
      user_color: '#123456',
      cursor: null,
    });
    expect(sendMock).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'sync-request',
      payload: { sender: 'u1' },
    });
    expect(provider.isSynced).toBe(false);

    await vi.advanceTimersByTimeAsync(2000);

    expect(provider.isSynced).toBe(true);
    expect(syncedSpy).toHaveBeenCalledTimes(1);
  });

  it('diffuse les mises à jour Yjs locales et les changements de présence', async () => {
    const doc = new Y.Doc();
    const provider = new SupabaseProvider('doc-2', doc, {
      id: 'u1',
      name: 'Alice',
      avatar: null,
      color: '#abcdef',
    });

    await provider.connect();
    sendMock.mockClear();
    trackMock.mockClear();

    const text = doc.getText('content');
    text.insert(0, 'Hello');

    expect(sendMock).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'yjs-update',
      payload: expect.objectContaining({
        sender: 'u1',
        update: expect.any(String),
      }),
    });

    provider.awareness.setLocalStateField('cursor', { x: 10, y: 20 });

    expect(trackMock).toHaveBeenCalledWith({
      user_id: 'u1',
      user_name: 'Alice',
      user_avatar: null,
      user_color: '#abcdef',
      cursor: { x: 10, y: 20 },
    });
  });

  it('applique une mise à jour distante et traite sync-response ciblée', async () => {
    const doc = new Y.Doc();
    const provider = new SupabaseProvider('doc-3', doc, {
      id: 'u1',
      name: 'Alice',
      avatar: null,
      color: '#111111',
    });

    await provider.connect();

    const remoteDoc = new Y.Doc();
    remoteDoc.getText('content').insert(0, 'Remote');
    const remoteUpdate = Y.encodeStateAsUpdate(remoteDoc);
    const remoteBase64 = btoa(String.fromCharCode(...Array.from(remoteUpdate)));

    const updateHandler = capturedHandlers['broadcast:yjs-update'];
    expect(updateHandler).toBeTypeOf('function');

    updateHandler?.({
      payload: {
        update: remoteBase64,
        sender: 'u2',
      },
    });

    expect(doc.getText('content').toString()).toBe('Remote');

    const syncedSpy = vi.fn();
    provider.onSynced(syncedSpy);

    const syncDoc = new Y.Doc();
    syncDoc.getText('content').insert(0, ' + Synced');
    const syncUpdate = Y.encodeStateAsUpdate(syncDoc);
    const syncBase64 = btoa(String.fromCharCode(...Array.from(syncUpdate)));

    const syncResponseHandler = capturedHandlers['broadcast:sync-response'];
    expect(syncResponseHandler).toBeTypeOf('function');

    syncResponseHandler?.({
      payload: {
        state: syncBase64,
        sender: 'u2',
        target: 'u1',
      },
    });

    expect(provider.isSynced).toBe(true);
    expect(doc.getText('content').toString()).toContain('Remote');
    expect(doc.getText('content').toString()).toContain(' + Synced');
    expect(syncedSpy).toHaveBeenCalledTimes(1);
  });

  it('répond à sync-request d’un pair et retourne les utilisateurs connectés hors utilisateur courant', async () => {
    presenceStateValue.set({
      self: [
        {
          user_id: 'u1',
          user_name: 'Alice',
          user_avatar: 'self.png',
          user_color: '#111111',
        },
      ],
      other1: [
        {
          user_id: 'u2',
          user_name: 'Bob',
          user_avatar: 'bob.png',
          user_color: '#222222',
        },
      ],
      other2: [
        {
          user_id: 'u3',
          user_name: 'Cara',
        },
      ],
    });

    const doc = new Y.Doc();
    doc.getText('content').insert(0, 'Seed');

    const provider = new SupabaseProvider('doc-4', doc, {
      id: 'u1',
      name: 'Alice',
      avatar: 'self.png',
      color: '#111111',
    });

    await provider.connect();
    sendMock.mockClear();

    const syncRequestHandler = capturedHandlers['broadcast:sync-request'];
    expect(syncRequestHandler).toBeTypeOf('function');

    syncRequestHandler?.({
      payload: {
        sender: 'u2',
      },
    });

    expect(sendMock).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'sync-response',
      payload: expect.objectContaining({
        sender: 'u1',
        target: 'u2',
        state: expect.any(String),
      }),
    });

    expect(provider.getConnectedUsers()).toEqual([
      {
        user_id: 'u2',
        user_name: 'Bob',
        user_avatar: 'bob.png',
        user_color: '#222222',
      },
      {
        user_id: 'u3',
        user_name: 'Cara',
        user_avatar: undefined,
        user_color: '#3b82f6',
      },
    ]);
  });

  it('gère l’erreur de canal et nettoie correctement à la destruction', async () => {
    subscribeStatus.set('CHANNEL_ERROR');

    const doc = new Y.Doc();
    const provider = new SupabaseProvider('doc-5', doc, {
      id: 'u1',
      name: 'Alice',
      avatar: null,
      color: '#333333',
    });

    const connectionSpy = vi.fn();
    provider.onConnectionChange(connectionSpy);

    await provider.connect();

    expect(provider.isConnected).toBe(false);
    expect(connectionSpy).toHaveBeenCalledWith(false);

    provider.destroy();

    expect(untrackMock).toHaveBeenCalledTimes(1);
    expect(removeChannelMock).toHaveBeenCalledWith(mockChannel);
    expect(provider.isConnected).toBe(false);

    sendMock.mockClear();
    trackMock.mockClear();

    doc.getText('content').insert(0, 'AfterDestroy');
    provider.awareness.setLocalStateField('cursor', { x: 1, y: 2 });

    expect(sendMock).not.toHaveBeenCalled();
    expect(trackMock).not.toHaveBeenCalled();
    expect(provider.getConnectedUsers()).toEqual([]);
  });
});