/**
 * Pulse Azure Collaboration Hub — Lot 1 : types client API Azure.
 *
 * Miroir TypeScript du schéma PostgreSQL cible `pulse_*_azure`
 * (plan §6) et des payloads API (plan §12). Ces types sont distincts
 * de `src/types/pulse.ts` (Supabase) pour permettre la coexistence
 * supabase/azure/hybrid sans collision.
 */

// ---------------------------------------------------------------------------
// Enums / unions (alignés sur les CHECK constraints du schéma Azure)
// ---------------------------------------------------------------------------

export type AzureConversationType =
  | 'direct'
  | 'group'
  | 'project'
  | 'establishment'
  | 'incident'
  | 'dpo'

export type AzureConversationStatus = 'active' | 'archived'

export type AzureMemberRole = 'owner' | 'admin' | 'member' | 'readonly'

export type AzureMessageStatus = 'active' | 'edited' | 'deleted' | 'system'

export type AzureMessageBodyFormat = 'markdown' | 'plaintext'

export type AzureInsightType = 'summary' | 'action_items' | 'risk' | 'decision' | 'digest'

export type AzurePresenceStatus = 'online' | 'away' | 'busy' | 'focus' | 'offline'

// ---------------------------------------------------------------------------
// Entités (tables pulse_*_azure)
// ---------------------------------------------------------------------------

/** pulse_conversations_azure */
export interface AzurePulseConversation {
  id: string
  name: string
  description: string | null
  type: AzureConversationType
  project_key: string | null
  etablissement_id: string | null
  is_private: boolean
  status: AzureConversationStatus
  created_by: string | null
  created_at: string
  updated_at: string
  // Champs dérivés côté API (non stockés)
  unread_count?: number
  last_message?: AzurePulseMessage | null
  member_count?: number
}

/** pulse_members_azure */
export interface AzurePulseMember {
  conversation_id: string
  profile_id: string
  role: AzureMemberRole
  muted: boolean
  last_read_message_id: string | null
  joined_at: string
}

/** pulse_messages_azure */
export interface AzurePulseMessage {
  id: string
  conversation_id: string
  parent_message_id: string | null
  author_profile_id: string
  body: string
  body_format: AzureMessageBodyFormat
  status: AzureMessageStatus
  metadata: Record<string, unknown>
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

/** pulse_message_reads_azure */
export interface AzurePulseMessageRead {
  conversation_id: string
  profile_id: string
  last_read_message_id: string
  read_at: string
}

/** pulse_reactions_azure */
export interface AzurePulseReaction {
  message_id: string
  profile_id: string
  emoji: string
  created_at: string
}

/** pulse_presence_azure */
export interface AzurePulsePresence {
  profile_id: string
  status: AzurePresenceStatus
  custom_text: string | null
  conversation_id: string | null
  expires_at: string
  updated_at: string
}

/** pulse_ai_insights_azure */
export interface AzurePulseAiInsight {
  id: string
  conversation_id: string
  message_id: string | null
  insight_type: AzureInsightType
  payload: Record<string, unknown>
  model: string | null
  created_at: string
}

/** pulse_audit_logs_azure */
export interface AzurePulseAuditLog {
  id: string
  conversation_id: string | null
  actor_profile_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown>
  created_at: string
}

// ---------------------------------------------------------------------------
// Payloads API (plan §12)
// ---------------------------------------------------------------------------

export interface AzureCreateConversationInput {
  name: string
  description?: string
  type: AzureConversationType
  project_key?: string
  etablissement_id?: string
  is_private?: boolean
  member_profile_ids?: string[]
}

export interface AzureSendMessageInput {
  body: string
  body_format?: AzureMessageBodyFormat
  parent_message_id?: string
  metadata?: Record<string, unknown>
}

export interface AzureUpdateMessageInput {
  body: string
  metadata?: Record<string, unknown>
}

export interface AzureListMessagesParams {
  before?: string
  limit?: number
}

export interface AzureSearchParams {
  q: string
  conversation_id?: string
  limit?: number
}

export interface AzureSearchResult {
  message: AzurePulseMessage
  conversation: Pick<AzurePulseConversation, 'id' | 'name' | 'type'>
  score: number
  highlight?: string
}

export interface AzureSummarizeInput {
  conversation_id: string
  since?: string
  max_messages?: number
}

export interface AzureActionItemsInput {
  conversation_id: string
  message_id?: string
}

/** Réponse GET /healthz du service Pulse API Azure. */
export interface AzurePulseHealth {
  status: 'ok' | 'degraded' | 'down'
  version?: string
  timestamp?: string
  dependencies?: Record<string, 'ok' | 'degraded' | 'down'>
}

// ---------------------------------------------------------------------------
// Événements WebSocket (realtime gateway, plan §4 + milestone 2)
// ---------------------------------------------------------------------------

export type AzurePulseWsEventType =
  | 'message.created'
  | 'message.updated'
  | 'message.deleted'
  | 'reaction.added'
  | 'reaction.removed'
  | 'typing.start'
  | 'typing.stop'
  | 'presence.updated'
  | 'conversation.updated'
  | 'read.receipt'
  | 'pong'

export interface AzurePulseWsEvent<TPayload = unknown> {
  type: AzurePulseWsEventType
  conversation_id?: string
  payload: TPayload
  /** Horodatage serveur ISO 8601. */
  ts: string
}

export type AzurePulseWsClientMessage =
  | { type: 'subscribe'; conversation_id: string }
  | { type: 'unsubscribe'; conversation_id: string }
  | { type: 'typing.start'; conversation_id: string }
  | { type: 'typing.stop'; conversation_id: string }
  | { type: 'presence.set'; status: AzurePresenceStatus; custom_text?: string }
  | { type: 'ping' }
