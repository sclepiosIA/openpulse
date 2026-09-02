import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PulseAzureSocket, type WebSocketLike } from './azureSocket'
import { resolvePulseAzureConfig } from './azureBackend'

const WS_CONNECTING = 0
const WS_OPEN = 1
const WS_CLOSED = 3

class FakeWebSocket implements WebSocketLike {
  readyState = WS_CONNECTING
  sent: string[] = []
  closed: { code?: number; reason?: string } | null = null
  onopen: ((ev?: unknown) => void) | null = null
  onclose: ((ev?: unknown) => void) | null = null
  onerror: ((ev?: unknown) => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null

  send(data: string): void {
    this.sent.push(data)
  }

  close(code?: number, reason?: string): void {
    this.closed = { code, reason }
    this.readyState = WS_CLOSED
    this.onclose?.()
  }

  // Helpers de simulation serveur
  simulateOpen(): void {
    this.readyState = WS_OPEN
    this.onopen?.()
  }

  simulateMessage(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }

  simulateDrop(): void {
    this.readyState = WS_CLOSED
    this.onclose?.()
  }
}

function azureConfig() {
  return resolvePulseAzureConfig({
    VITE_PULSE_BACKEND: 'azure',
    VITE_PULSE_AZURE_API_URL: 'https://pulse-api.example.com',
  })
}

describe('PulseAzureSocket — garde de configuration', () => {
  it('mode supabase : connect() est un no-op, statut disabled', () => {
    const factory = vi.fn()
    const socket = new PulseAzureSocket({
      config: resolvePulseAzureConfig({}),
      webSocketFactory: factory,
    })

    expect(socket.isEnabled).toBe(false)
    socket.connect()

    expect(socket.status).toBe('disabled')
    expect(factory).not.toHaveBeenCalled()
  })
})

describe('PulseAzureSocket — cycle de vie', () => {
  let sockets: FakeWebSocket[]
  let factory: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    sockets = []
    factory = vi.fn((url: string) => {
      void url
      const fake = new FakeWebSocket()
      sockets.push(fake)
      return fake
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function makeSocket() {
    return new PulseAzureSocket({
      config: azureConfig(),
      webSocketFactory: factory,
      reconnectBaseDelayMs: 100,
      maxReconnectAttempts: 3,
    })
  }

  it('se connecte à l’URL WS dérivée et passe open', () => {
    const socket = makeSocket()
    socket.connect()

    expect(factory).toHaveBeenCalledWith('wss://pulse-api.example.com/api/pulse/ws')
    expect(socket.status).toBe('connecting')

    sockets[0].simulateOpen()
    expect(socket.status).toBe('open')
  })

  it('distribue les événements JSON aux listeners', () => {
    const socket = makeSocket()
    const events: unknown[] = []
    socket.onEvent((e) => events.push(e))
    socket.connect()
    sockets[0].simulateOpen()

    sockets[0].simulateMessage({
      type: 'message.created',
      conversation_id: 'c1',
      payload: { id: 'm1' },
      ts: '2026-07-07T12:00:00Z',
    })

    expect(events).toHaveLength(1)
    expect((events[0] as { type: string }).type).toBe('message.created')
  })

  it('ignore les messages non JSON sans crasher', () => {
    const socket = makeSocket()
    const events: unknown[] = []
    socket.onEvent((e) => events.push(e))
    socket.connect()
    sockets[0].simulateOpen()

    sockets[0].onmessage?.({ data: 'not-json{{{' })

    expect(events).toHaveLength(0)
    expect(socket.status).toBe('open')
  })

  it('reconnecte après une coupure et ré-abonne les conversations', () => {
    const socket = makeSocket()
    socket.connect()
    sockets[0].simulateOpen()
    socket.subscribe('c1')
    expect(sockets[0].sent).toContainEqual(
      JSON.stringify({ type: 'subscribe', conversation_id: 'c1' })
    )

    // Coupure réseau
    sockets[0].simulateDrop()
    expect(socket.status).toBe('reconnecting')

    // Avance le timer de reconnexion
    vi.advanceTimersByTime(150)
    expect(sockets).toHaveLength(2)

    sockets[1].simulateOpen()
    expect(socket.status).toBe('open')
    // Ré-abonnement automatique
    expect(sockets[1].sent).toContainEqual(
      JSON.stringify({ type: 'subscribe', conversation_id: 'c1' })
    )
  })

  it('abandonne après maxReconnectAttempts et passe en erreur', () => {
    const socket = makeSocket()
    socket.connect()

    for (let i = 0; i < 4; i += 1) {
      sockets[sockets.length - 1].simulateDrop()
      vi.advanceTimersByTime(100 * 2 ** i + 50)
    }

    expect(socket.status).toBe('error')
  })

  it('disconnect() ferme proprement sans reconnexion', () => {
    const socket = makeSocket()
    socket.connect()
    sockets[0].simulateOpen()

    socket.disconnect()

    expect(socket.status).toBe('closed')
    expect(sockets[0].closed?.code).toBe(1000)

    vi.advanceTimersByTime(5000)
    expect(sockets).toHaveLength(1) // pas de nouvelle tentative
  })

  it('send() retourne false quand la socket n’est pas ouverte', () => {
    const socket = makeSocket()
    expect(socket.send({ type: 'ping' })).toBe(false)

    socket.connect()
    sockets[0].simulateOpen()
    expect(socket.send({ type: 'ping' })).toBe(true)
  })
})
