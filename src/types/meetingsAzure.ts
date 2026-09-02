/**
 * Types du domaine Meetings Azure (plan Gestion Visio/Transcription §7 & §10).
 *
 * Lot 1 : miroir client des tables `meeting_*_azure` / `transcription_*_azure`
 * (cf. supabase/migrations-azure/0001_meetings_azure.sql) et des payloads de
 * l'API Meetings (`/api/meetings/*`, `/api/transcriptions/*`).
 *
 * Ces types coexistent avec `@/types/transcription` (pipeline Supabase
 * existant) sans le remplacer — la convergence se fera via les adaptateurs
 * du service `azureMeetingsApi`.
 */

// ---------------------------------------------------------------------------
// Statuts (check constraints des tables Azure)
// ---------------------------------------------------------------------------

export type AzureMeetingRoomStatus = 'scheduled' | 'active' | 'ended' | 'cancelled'

export type AzureMeetingParticipantRole = 'host' | 'participant' | 'guest'

export type AzureRecordingMediaType = 'audio' | 'video' | 'screen' | 'mixed'

export type AzureRecordingStatus =
  | 'recording'
  | 'uploaded'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'deleted'

export type AzureTranscriptionSourceType = 'visio_recording' | 'manual_upload' | 'external'

export type AzureTranscriptionStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'validated'

export type AzureMeetingAiOutputType =
  | 'summary'
  | 'decisions'
  | 'actions'
  | 'risks'
  | 'minutes'
  | 'email_followup'
  | 'pulse_post'

// ---------------------------------------------------------------------------
// Entités (tables meeting_*_azure / transcription_*_azure)
// ---------------------------------------------------------------------------

export interface AzureMeetingRoom {
  id: string
  room_code: string
  title: string
  etablissement_id?: string | null
  project_key?: string | null
  created_by?: string | null
  status: AzureMeetingRoomStatus
  starts_at?: string | null
  ended_at?: string | null
  recording_enabled: boolean
  transcription_enabled: boolean
  created_at: string
  updated_at: string
}

export interface AzureMeetingParticipant {
  id: string
  room_id: string
  profile_id?: string | null
  display_name: string
  email?: string | null
  role: AzureMeetingParticipantRole
  joined_at?: string | null
  left_at?: string | null
}

export interface AzureMeetingRecording {
  id: string
  room_id: string
  blob_container: string
  blob_name: string
  media_type: AzureRecordingMediaType
  duration_seconds?: number | null
  size_bytes?: number | null
  sha256?: string | null
  status: AzureRecordingStatus
  created_at: string
}

export interface AzureTranscriptionSession {
  id: string
  room_id?: string | null
  source_type: AzureTranscriptionSourceType
  source_blob: string
  status: AzureTranscriptionStatus
  language: string
  model?: string | null
  diarization_enabled: boolean
  created_by?: string | null
  created_at: string
  completed_at?: string | null
}

export interface AzureTranscriptionSegment {
  id: string
  session_id: string
  speaker_label?: string | null
  speaker_profile_id?: string | null
  start_ms: number
  end_ms: number
  text: string
  confidence?: number | null
  created_at: string
}

export interface AzureMeetingAiOutput {
  id: string
  session_id: string
  output_type: AzureMeetingAiOutputType
  payload: Record<string, unknown>
  model?: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Payloads API Meetings (plan §10)
// ---------------------------------------------------------------------------

/** GET /api/meetings/health */
export interface AzureMeetingsHealth {
  status: 'ok' | 'degraded' | 'down'
  version?: string
  services?: Record<string, 'ok' | 'degraded' | 'down'>
  timestamp?: string
}

/** POST /api/transcriptions/upload-intent */
export interface AzureUploadIntentRequest {
  file_name: string
  content_type: string
  size_bytes: number
  title: string
  language?: string
  etablissement_id?: string
  room_id?: string
  source_type?: AzureTranscriptionSourceType
  diarization_enabled?: boolean
}

/**
 * Réponse upload-intent : URL SAS Blob pré-signée + session pré-créée
 * (status `queued` côté serveur une fois upload-complete confirmé).
 */
export interface AzureUploadIntentResponse {
  session_id: string
  upload_url: string
  blob_container: string
  blob_name: string
  expires_at: string
}

/** POST /api/transcriptions/upload-complete */
export interface AzureUploadCompleteRequest {
  session_id: string
  sha256?: string
  size_bytes?: number
}

export interface AzureUploadCompleteResponse {
  session_id: string
  status: AzureTranscriptionStatus
}

/** GET /api/transcriptions/sessions/:id — session + détails pipeline. */
export interface AzureTranscriptionSessionDetails extends AzureTranscriptionSession {
  segments?: AzureTranscriptionSegment[]
  ai_outputs?: AzureMeetingAiOutput[]
  recording?: AzureMeetingRecording | null
  room?: AzureMeetingRoom | null
}

/** Liste paginée générique de l'API Meetings. */
export interface AzureMeetingsPage<T> {
  items: T[]
  total: number
  page?: number
  page_size?: number
}
