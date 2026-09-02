/**
 * Pulse Azure Collaboration Hub — Lot 1 : client API Azure (stub).
 *
 * Couvre les endpoints du plan §12. Tant que `VITE_PULSE_BACKEND` ne vaut
 * pas `azure`/`hybrid` ou que l'URL API n'est pas configurée, chaque appel
 * rejette avec `PulseAzureNotConfiguredError` — aucun réseau n'est touché.
 * Le fetch est injectable pour les tests.
 */

import { getPulseAzureConfig, type PulseAzureConfig } from '@/lib/pulse/azureBackend'
import type {
  AzureActionItemsInput,
  AzureCreateConversationInput,
  AzureListMessagesParams,
  AzurePulseAiInsight,
  AzurePulseConversation,
  AzurePulseHealth,
  AzurePulseMessage,
  AzurePulsePresence,
  AzurePulseReaction,
  AzureSearchParams,
  AzureSearchResult,
  AzureSendMessageInput,
  AzureSummarizeInput,
  AzureUpdateMessageInput,
} from '@/types/pulse-azure'

export class PulseAzureNotConfiguredError extends Error {
  constructor(detail?: string) {
    super(
      `Pulse Azure backend non configuré${detail ? ` : ${detail}` : ''}. ` +
        'Définir VITE_PULSE_BACKEND=azure|hybrid et VITE_PULSE_AZURE_API_URL.'
    )
    this.name = 'PulseAzureNotConfiguredError'
  }
}

export class PulseAzureApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Pulse Azure API error (HTTP ${status})`)
    this.name = 'PulseAzureApiError'
    this.status = status
    this.body = body
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface PulseAzureClientOptions {
  config?: PulseAzureConfig
  fetchFn?: FetchLike
  /** Fournit le bearer token (ex: session Supabase ou Entra ID). */
  getAccessToken?: () => Promise<string | null>
}

export class PulseAzureApiClient {
  private readonly configOverride?: PulseAzureConfig
  private readonly fetchFn: FetchLike
  private readonly getAccessToken?: () => Promise<string | null>

  constructor(options: PulseAzureClientOptions = {}) {
    this.configOverride = options.config
    this.fetchFn = options.fetchFn ?? ((input, init) => globalThis.fetch(input, init))
    this.getAccessToken = options.getAccessToken
  }

  private get config(): PulseAzureConfig {
    return this.configOverride ?? getPulseAzureConfig()
  }

  /** true si le client peut réellement appeler l'API Azure. */
  get isEnabled(): boolean {
    const cfg = this.config
    return cfg.azureEnabled && Boolean(cfg.apiBaseUrl)
  }

  private assertEnabled(): string {
    const cfg = this.config
    if (!cfg.azureEnabled) {
      throw new PulseAzureNotConfiguredError(`mode actuel "${cfg.mode}"`)
    }
    if (!cfg.apiBaseUrl) {
      throw new PulseAzureNotConfiguredError('VITE_PULSE_AZURE_API_URL manquante')
    }
    return cfg.apiBaseUrl
  }

  private async request<T>(
    method: string,
    path: string,
    options: { body?: unknown; query?: Record<string, string | number | undefined> } = {}
  ): Promise<T> {
    const baseUrl = this.assertEnabled()

    let url = `${baseUrl}${path}`
    if (options.query) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) params.set(key, String(value))
      }
      const qs = params.toString()
      if (qs) url += `?${qs}`
    }

    const headers: Record<string, string> = { Accept: 'application/json' }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    const token = this.getAccessToken ? await this.getAccessToken() : null
    if (token) headers.Authorization = `Bearer ${token}`

    const response = await this.fetchFn(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      let body: unknown = null
      try {
        body = await response.json()
      } catch {
        // corps non JSON — ignoré
      }
      throw new PulseAzureApiError(response.status, body)
    }

    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  // --- Santé -------------------------------------------------------------

  health(): Promise<AzurePulseHealth> {
    return this.request<AzurePulseHealth>('GET', '/healthz')
  }

  // --- Conversations -------------------------------------------------------

  listConversations(): Promise<AzurePulseConversation[]> {
    return this.request('GET', '/api/pulse/conversations')
  }

  createConversation(input: AzureCreateConversationInput): Promise<AzurePulseConversation> {
    return this.request('POST', '/api/pulse/conversations', { body: input })
  }

  markConversationRead(conversationId: string): Promise<void> {
    return this.request('POST', `/api/pulse/conversations/${conversationId}/read`)
  }

  // --- Messages ------------------------------------------------------------

  listMessages(
    conversationId: string,
    params: AzureListMessagesParams = {}
  ): Promise<AzurePulseMessage[]> {
    return this.request('GET', `/api/pulse/conversations/${conversationId}/messages`, {
      query: { before: params.before, limit: params.limit },
    })
  }

  sendMessage(conversationId: string, input: AzureSendMessageInput): Promise<AzurePulseMessage> {
    return this.request('POST', `/api/pulse/conversations/${conversationId}/messages`, {
      body: input,
    })
  }

  updateMessage(messageId: string, input: AzureUpdateMessageInput): Promise<AzurePulseMessage> {
    return this.request('PATCH', `/api/pulse/messages/${messageId}`, { body: input })
  }

  deleteMessage(messageId: string): Promise<void> {
    return this.request('DELETE', `/api/pulse/messages/${messageId}`)
  }

  addReaction(messageId: string, emoji: string): Promise<AzurePulseReaction> {
    return this.request('POST', `/api/pulse/messages/${messageId}/reactions`, {
      body: { emoji },
    })
  }

  // --- Recherche / IA / Présence -------------------------------------------

  search(params: AzureSearchParams): Promise<AzureSearchResult[]> {
    return this.request('GET', '/api/pulse/search', {
      query: { q: params.q, conversation_id: params.conversation_id, limit: params.limit },
    })
  }

  summarize(input: AzureSummarizeInput): Promise<AzurePulseAiInsight> {
    return this.request('POST', '/api/pulse/ai/summarize', { body: input })
  }

  extractActionItems(input: AzureActionItemsInput): Promise<AzurePulseAiInsight> {
    return this.request('POST', '/api/pulse/ai/action-items', { body: input })
  }

  listPresence(): Promise<AzurePulsePresence[]> {
    return this.request('GET', '/api/pulse/presence')
  }
}

/** Instance par défaut, paresseuse et sans effet tant que non appelée. */
let defaultClient: PulseAzureApiClient | null = null

export function getPulseAzureApiClient(): PulseAzureApiClient {
  if (!defaultClient) {
    defaultClient = new PulseAzureApiClient()
  }
  return defaultClient
}

/** Réinitialise l'instance par défaut (usage tests uniquement). */
export function __resetPulseAzureApiClientForTests(): void {
  defaultClient = null
}
