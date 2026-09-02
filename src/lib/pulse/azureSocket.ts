/**
 * Pulse Azure Collaboration Hub — Lot 1 : stub WebSocket realtime gateway.
 *
 * Squelette de connexion vers `WS /api/pulse/ws` (plan §12, milestone 2).
 * Comportement lot 1 :
 * - jamais instancié par défaut dans /pulse (Supabase realtime inchangé) ;
 * - `connect()` no-op + statut 'disabled' si le backend Azure n'est pas actif ;
 * - reconnexion exponentielle simple, prête pour le gateway réel ;
 * - WebSocket injectable pour les tests (pas de réseau en jsdom).
 */

import { getPulseAzureConfig, type PulseAzureConfig } from '@/lib/pulse/azureBackend'
import type { AzurePulseWsClientMessage, AzurePulseWsEvent } from '@/types/pulse-azure'

export type PulseAzureSocketStatus =
  | 'disabled'
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed'
  | 'error'

export type PulseAzureSocketListener = (event: AzurePulseWsEvent) => void
export type PulseAzureStatusListener = (status: PulseAzureSocketStatus) => void

/** Sous-ensemble minimal de l'interface WebSocket utilisé par le stub. */
export interface WebSocketLike {
  readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  onopen: ((ev?: unknown) => void) | null
  onclose: ((ev?: unknown) => void) | null
  onerror: ((ev?: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
}

export type WebSocketFactory = (url: string) => WebSocketLike

export interface PulseAzureSocketOptions {
  config?: PulseAzureConfig
  webSocketFactory?: WebSocketFactory
  /** Délai initial de reconnexion en ms (défaut 1000, doublé à chaque échec, max 30s). */
  reconnectBaseDelayMs?: number
  maxReconnectAttempts?: number
}

const WS_OPEN = 1

export class PulseAzureSocket {
  private readonly configOverride?: PulseAzureConfig
  private readonly wsFactory: WebSocketFactory
  private readonly reconnectBaseDelayMs: number
  private readonly maxReconnectAttempts: number

  private ws: WebSocketLike | null = null
  private statusValue: PulseAzureSocketStatus = 'idle'
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private manuallyClosed = false
  private readonly eventListeners = new Set<PulseAzureSocketListener>()
  private readonly statusListeners = new Set<PulseAzureStatusListener>()
  private readonly subscribedConversations = new Set<string>()

  constructor(options: PulseAzureSocketOptions = {}) {
    this.configOverride = options.config
    this.wsFactory =
      options.webSocketFactory ?? ((url) => new WebSocket(url) as unknown as WebSocketLike)
    this.reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 1000
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 8
  }

  private get config(): PulseAzureConfig {
    return this.configOverride ?? getPulseAzureConfig()
  }

  get status(): PulseAzureSocketStatus {
    return this.statusValue
  }

  get isEnabled(): boolean {
    const cfg = this.config
    return cfg.azureEnabled && Boolean(cfg.wsUrl)
  }

  onEvent(listener: PulseAzureSocketListener): () => void {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  onStatusChange(listener: PulseAzureStatusListener): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  private setStatus(status: PulseAzureSocketStatus): void {
    if (this.statusValue === status) return
    this.statusValue = status
    for (const listener of this.statusListeners) listener(status)
  }

  /**
   * Ouvre la connexion si le backend Azure est actif. No-op sinon
   * (statut 'disabled') — garantit zéro impact en mode supabase.
   */
  connect(): void {
    if (!this.isEnabled) {
      this.setStatus('disabled')
      return
    }
    if (this.ws && this.ws.readyState === WS_OPEN) return

    this.manuallyClosed = false
    this.openSocket()
  }

  private openSocket(): void {
    const wsUrl = this.config.wsUrl
    if (!wsUrl) {
      this.setStatus('disabled')
      return
    }

    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting')

    let socket: WebSocketLike
    try {
      socket = this.wsFactory(wsUrl)
    } catch {
      this.setStatus('error')
      this.scheduleReconnect()
      return
    }
    this.ws = socket

    socket.onopen = () => {
      this.reconnectAttempts = 0
      this.setStatus('open')
      // Ré-abonner les conversations après reconnexion
      for (const conversationId of this.subscribedConversations) {
        this.sendRaw({ type: 'subscribe', conversation_id: conversationId })
      }
    }

    socket.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return
      try {
        const parsed = JSON.parse(ev.data) as AzurePulseWsEvent
        if (!parsed || typeof parsed.type !== 'string') return
        for (const listener of this.eventListeners) listener(parsed)
      } catch {
        // message non JSON — ignoré
      }
    }

    socket.onerror = () => {
      this.setStatus('error')
    }

    socket.onclose = () => {
      this.ws = null
      if (this.manuallyClosed) {
        this.setStatus('closed')
        return
      }
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.manuallyClosed) return
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('error')
      return
    }
    const delay = Math.min(this.reconnectBaseDelayMs * 2 ** this.reconnectAttempts, 30_000)
    this.reconnectAttempts += 1
    this.setStatus('reconnecting')
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay)
  }

  subscribe(conversationId: string): void {
    this.subscribedConversations.add(conversationId)
    this.sendRaw({ type: 'subscribe', conversation_id: conversationId })
  }

  unsubscribe(conversationId: string): void {
    this.subscribedConversations.delete(conversationId)
    this.sendRaw({ type: 'unsubscribe', conversation_id: conversationId })
  }

  send(message: AzurePulseWsClientMessage): boolean {
    return this.sendRaw(message)
  }

  private sendRaw(message: AzurePulseWsClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WS_OPEN) return false
    this.ws.send(JSON.stringify(message))
    return true
  }

  disconnect(): void {
    this.manuallyClosed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close(1000, 'client disconnect')
      this.ws = null
    }
    this.setStatus('closed')
  }
}

/** Instance par défaut, jamais connectée automatiquement. */
let defaultSocket: PulseAzureSocket | null = null

export function getPulseAzureSocket(): PulseAzureSocket {
  if (!defaultSocket) {
    defaultSocket = new PulseAzureSocket()
  }
  return defaultSocket
}

/** Réinitialise l'instance par défaut (usage tests uniquement). */
export function __resetPulseAzureSocketForTests(): void {
  if (defaultSocket) defaultSocket.disconnect()
  defaultSocket = null
}
