/**
 * Client HTTP de l'API Meetings Azure (plan Gestion Visio/Transcription §10).
 *
 * Lot 1 — préparation non destructive :
 * - health check (panneau statut Azure dans /meeting-notes) ;
 * - upload-intent / upload-complete (pré-câblage pipeline transcription) ;
 * - lecture sessions/statut pipeline.
 *
 * Aucune de ces fonctions n'est appelée quand
 * VITE_TRANSCRIPTION_BACKEND=supabase (défaut) : le pipeline Edge Function
 * `meeting-notes-process` reste inchangé. Pas de secret côté client : l'auth
 * s'appuie sur le JWT Supabase existant transmis en Bearer (l'API Azure le
 * valide côté serveur), et l'upload Blob passe par une URL SAS pré-signée
 * renvoyée par upload-intent.
 */

import { supabase } from '@/integrations/supabase/client'
import { canReachAzureMeetingsApi, getMeetingsApiBaseUrl } from '@/config/meetingsBackend'
import type {
  AzureMeetingsHealth,
  AzureMeetingsPage,
  AzureTranscriptionSession,
  AzureTranscriptionSessionDetails,
  AzureUploadCompleteRequest,
  AzureUploadCompleteResponse,
  AzureUploadIntentRequest,
  AzureUploadIntentResponse,
} from '@/types/meetingsAzure'

export class AzureMeetingsApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AzureMeetingsApiError'
    this.status = status
  }
}

/** Erreur levée quand l'API Azure n'est pas activée/configurée. */
export class AzureMeetingsDisabledError extends Error {
  constructor() {
    super(
      "API Meetings Azure non configurée (VITE_MEETINGS_API_BASE_URL manquant ou backend 'supabase')."
    )
    this.name = 'AzureMeetingsDisabledError'
  }
}

const DEFAULT_TIMEOUT_MS = 10_000

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
  timeoutMs?: number
  /** Health check : pas de token requis. */
  skipAuth?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!canReachAzureMeetingsApi()) {
    throw new AzureMeetingsDisabledError()
  }

  const baseUrl = getMeetingsApiBaseUrl()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (!options.skipAuth) {
      const token = await getAuthToken()
      if (token) headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })

    if (!response.ok) {
      let message = `Erreur API Meetings (${response.status})`
      try {
        const payload = (await response.json()) as { error?: string; message?: string }
        message = payload.error || payload.message || message
      } catch {
        // corps non JSON — on garde le message générique
      }
      throw new AzureMeetingsApiError(message, response.status)
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------------
// Health / statut
// ---------------------------------------------------------------------------

/**
 * Sonde l'état de l'API Meetings Azure. Ne lève jamais : renvoie `down`
 * en cas d'erreur réseau/timeout pour alimenter le panneau statut sans
 * casser la page.
 */
export async function fetchAzureMeetingsHealth(): Promise<AzureMeetingsHealth> {
  try {
    return await request<AzureMeetingsHealth>('/api/meetings/health', {
      skipAuth: true,
      timeoutMs: 5_000,
    })
  } catch (error) {
    if (error instanceof AzureMeetingsDisabledError) throw error
    return { status: 'down', timestamp: new Date().toISOString() }
  }
}

// ---------------------------------------------------------------------------
// Transcriptions — upload intent / complete / statut (plan §10)
// ---------------------------------------------------------------------------

/**
 * Demande une URL SAS d'upload Blob + pré-création de la session
 * de transcription côté API Azure.
 */
export function requestTranscriptionUploadIntent(
  intent: AzureUploadIntentRequest
): Promise<AzureUploadIntentResponse> {
  return request<AzureUploadIntentResponse>('/api/transcriptions/upload-intent', {
    method: 'POST',
    body: intent,
  })
}

/**
 * Upload direct du fichier vers Azure Blob via l'URL SAS renvoyée par
 * upload-intent (PUT BlockBlob). Aucun secret : l'URL est pré-signée.
 */
export async function uploadFileToAzureBlob(
  uploadUrl: string,
  file: File | Blob,
  contentType?: string
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type':
        contentType || (file instanceof File ? file.type : '') || 'application/octet-stream',
    },
    body: file,
  })
  if (!response.ok) {
    throw new AzureMeetingsApiError(`Échec upload Blob Azure (${response.status})`, response.status)
  }
}

/** Confirme l'upload et déclenche l'enqueue du pipeline (status queued). */
export function completeTranscriptionUpload(
  payload: AzureUploadCompleteRequest
): Promise<AzureUploadCompleteResponse> {
  return request<AzureUploadCompleteResponse>('/api/transcriptions/upload-complete', {
    method: 'POST',
    body: payload,
  })
}

/** Liste les sessions de transcription Azure (statut pipeline). */
export function listAzureTranscriptionSessions(params?: {
  status?: string
  limit?: number
}): Promise<AzureMeetingsPage<AzureTranscriptionSession>> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.limit) query.set('limit', String(params.limit))
  const suffix = query.size > 0 ? `?${query.toString()}` : ''
  return request<AzureMeetingsPage<AzureTranscriptionSession>>(
    `/api/transcriptions/sessions${suffix}`
  )
}

/** Détail d'une session (segments, outputs IA, recording lié). */
export function getAzureTranscriptionSession(
  sessionId: string
): Promise<AzureTranscriptionSessionDetails> {
  return request<AzureTranscriptionSessionDetails>(
    `/api/transcriptions/sessions/${encodeURIComponent(sessionId)}`
  )
}
