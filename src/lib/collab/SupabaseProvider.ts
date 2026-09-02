import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Custom Yjs provider that syncs document updates and awareness (cursors)
 * via Supabase Realtime Broadcast + Presence.
 */

export interface CollabUser {
  id: string;
  name: string;
  avatar?: string | null;
  color: string;
}

// Deterministic color palette for collaborators
const COLLAB_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

export class SupabaseProvider {
  doc: Y.Doc;
  awareness: Awareness;
  private channel: RealtimeChannel | null = null;
  private documentId: string;
  public readonly user: CollabUser;
  private connected = false;
  private synced = false;
  private updateHandler: (update: Uint8Array, origin: unknown) => void;
  private awarenessUpdateHandler: (changes: { added: number[]; updated: number[]; removed: number[] }) => void;
  private onSyncedCallbacks: Array<() => void> = [];
  private onConnectionChangeCallbacks: Array<(connected: boolean) => void> = [];
  private destroyed = false;

  constructor(documentId: string, doc: Y.Doc, user: CollabUser) {
    this.documentId = documentId;
    this.doc = doc;
    this.user = user;

    // Create awareness
    this.awareness = new Awareness(doc);
    this.awareness.setLocalStateField('user', {
      ...user,
      color: user.color || COLLAB_COLORS[Math.abs(hashCode(user.id)) % COLLAB_COLORS.length],
    });

    // Handler for local doc updates → broadcast to peers
    this.updateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin === this || !this.channel || this.destroyed) return;
      const encoded = uint8ArrayToBase64(update);
      this.channel.send({
        type: 'broadcast',
        event: 'yjs-update',
        payload: { update: encoded, sender: this.user.id },
      });
    };

    // Handler for awareness changes → broadcast cursor state
    this.awarenessUpdateHandler = () => {
      if (!this.channel || this.destroyed) return;
      const localState = this.awareness.getLocalState();
      if (localState) {
        this.channel.track({
          user_id: this.user.id,
          user_name: this.user.name,
          user_avatar: this.user.avatar,
          user_color: this.user.color,
          cursor: localState.cursor || null,
        });
      }
    };

    this.doc.on('update', this.updateHandler);
    this.awareness.on('update', this.awarenessUpdateHandler);
  }

  async connect() {
    if (this.destroyed) return;

    const channelName = `collab-doc-${this.documentId}`;

    this.channel = supabase
      .channel(channelName, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'yjs-update' }, ({ payload }) => {
        if (this.destroyed || payload.sender === this.user.id) return;
        const update = base64ToUint8Array(payload.update);
        Y.applyUpdate(this.doc, update, this);
      })
      .on('broadcast', { event: 'sync-request' }, ({ payload }) => {
        if (this.destroyed || payload.sender === this.user.id) return;
        // Send full state to the requesting peer
        const state = Y.encodeStateAsUpdate(this.doc);
        this.channel?.send({
          type: 'broadcast',
          event: 'sync-response',
          payload: {
            state: uint8ArrayToBase64(state),
            sender: this.user.id,
            target: payload.sender,
          },
        });
      })
      .on('broadcast', { event: 'sync-response' }, ({ payload }) => {
        if (this.destroyed || payload.target !== this.user.id) return;
        if (!this.synced) {
          const state = base64ToUint8Array(payload.state);
          Y.applyUpdate(this.doc, state, this);
          this.synced = true;
          this.onSyncedCallbacks.forEach(cb => cb());
        }
      })
      .on('presence', { event: 'sync' }, () => {
        // Presence synced — nothing extra needed
      })
      .on('presence', { event: 'join' }, () => {
        // New user joined — they'll request sync
      })
      .on('presence', { event: 'leave' }, () => {
        // User left
      });

    const status = await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        this.connected = true;
        this.onConnectionChangeCallbacks.forEach(cb => cb(true));

        // Track presence
        await this.channel?.track({
          user_id: this.user.id,
          user_name: this.user.name,
          user_avatar: this.user.avatar,
          user_color: this.user.color,
          cursor: null,
        });

        // Request sync from existing peers
        this.channel?.send({
          type: 'broadcast',
          event: 'sync-request',
          payload: { sender: this.user.id },
        });

        // If no sync-response within 2s, consider self as first user (already synced)
        setTimeout(() => {
          if (!this.synced && !this.destroyed) {
            this.synced = true;
            this.onSyncedCallbacks.forEach(cb => cb());
          }
        }, 2000);
      } else if (status === 'CHANNEL_ERROR') {
        this.connected = false;
        this.onConnectionChangeCallbacks.forEach(cb => cb(false));
      }
    });
  }

  onSynced(callback: () => void) {
    if (this.synced) {
      callback();
    } else {
      this.onSyncedCallbacks.push(callback);
    }
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.onConnectionChangeCallbacks.push(callback);
  }

  getConnectedUsers(): Array<{ user_id: string; user_name: string; user_avatar?: string; user_color: string }> {
    if (!this.channel) return [];
    const presenceState = this.channel.presenceState();
    const users: Array<{ user_id: string; user_name: string; user_avatar?: string; user_color: string }> = [];
    
    for (const key of Object.keys(presenceState)) {
      const presences = presenceState[key] as unknown as Array<{ user_id: string; user_name: string; user_avatar?: string; user_color?: string }>;
      for (const p of presences) {
        if (p.user_id !== this.user.id) {
          users.push({
            user_id: p.user_id,
            user_name: p.user_name,
            user_avatar: p.user_avatar,
            user_color: p.user_color || COLLAB_COLORS[0],
          });
        }
      }
    }
    return users;
  }

  get isSynced() {
    return this.synced;
  }

  get isConnected() {
    return this.connected;
  }

  destroy() {
    this.destroyed = true;
    this.doc.off('update', this.updateHandler);
    this.awareness.off('update', this.awarenessUpdateHandler);
    this.awareness.destroy();

    if (this.channel) {
      this.channel.untrack();
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.connected = false;
    this.onSyncedCallbacks = [];
    this.onConnectionChangeCallbacks = [];
  }
}

// Utilities
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}
