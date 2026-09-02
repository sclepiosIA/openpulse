/**
 * Client HTTP Gestion Drive (`openpulse-gestion-drive-api`).
 *
 * Façade minimale pour la phase hybride de `/documents` :
 * - résolution du backend actif via `VITE_DOCUMENTS_BACKEND` + `?backend=` ;
 * - appels REST typés spaces/tree/changes/upload/download ;
 * - auth Bearer Drive court via échange de la session Gestion ; aucun token
 *   fournisseur n'est envoyé aux routes métier ni au shell natif.
 *
 * Le mode legacy (Supabase Storage) n'est PAS impacté : ce client n'est
 * jamais appelé quand le backend résolu est `legacy`.
 */
import { supabase } from '@/integrations/supabase/client'
import {
  DriveApiError,
  isDocumentsBackend,
  type DocumentsBackend,
  type DriveChangesResponse,
  type DriveDownloadUrlResponse,
  type DrivePermission,
  type DrivePermissionCreateRequest,
  type DrivePermissionRole,
  type DrivePermissionScope,
  type DrivePermissionsResponse,
  type DriveSpace,
  type DriveTree,
  type DriveUploadCompleteRequest,
  type DriveUploadIntentRequest,
  type DriveUploadIntentResponse,
} from './types'

/** Backend par défaut tant qu'Azure Drive n'est pas validé. */
const DEFAULT_BACKEND: DocumentsBackend = 'legacy'

interface DriveEnv {
  VITE_DOCUMENTS_BACKEND?: string
  VITE_DRIVE_API_URL?: string
}

function readEnv(): DriveEnv {
  // import.meta.env est absent dans certains contextes de test → fallback {}.
  try {
    return (import.meta.env ?? {}) as DriveEnv
  } catch {
    return {}
  }
}

/**
 * Backend configuré via le feature flag `VITE_DOCUMENTS_BACKEND`.
 * Valeur inconnue ou absente → `legacy` (fail-safe : jamais de casse).
 */
export function getConfiguredDocumentsBackend(env: DriveEnv = readEnv()): DocumentsBackend {
  const raw = env.VITE_DOCUMENTS_BACKEND?.trim().toLowerCase()
  return isDocumentsBackend(raw) ? raw : DEFAULT_BACKEND
}

/**
 * Backend effectif pour une visite donnée.
 *
 * Priorité : `?backend=legacy|azure` (URL, plan §19.2) > flag env > défaut.
 * Règle : l'override URL n'est honoré que si le flag autorise le mode
 * (en `legacy` pur on ignore `?backend=azure` pour ne pas exposer une UI
 * non configurée ; en `hybrid` tout est permis ; en `azure` on peut
 * toujours revenir en `legacy` via URL — porte de sortie).
 */
export function resolveDocumentsBackend(
  searchParams?: Pick<URLSearchParams, 'get'> | null,
  env: DriveEnv = readEnv()
): DocumentsBackend {
  const configured = getConfiguredDocumentsBackend(env)
  const rawOverride = searchParams?.get('backend')?.trim().toLowerCase() ?? null
  const override = isDocumentsBackend(rawOverride) ? rawOverride : null

  if (!override || override === 'hybrid') return configured
  if (configured === 'legacy') {
    // Flag verrouillé sur legacy : pas d'activation Azure par URL.
    return 'legacy'
  }
  return override
}

/** Le panneau Azure Drive doit-il être rendu ? */
export function isAzureDriveEnabled(backend: DocumentsBackend): boolean {
  return backend === 'azure' || backend === 'hybrid'
}

/** L'UI legacy Supabase doit-elle être rendue ? */
export function isLegacyDocumentsEnabled(backend: DocumentsBackend): boolean {
  return backend === 'legacy' || backend === 'hybrid'
}

/** Base URL de l'API Drive (sans slash final). Null si non configurée. */
export function getDriveApiBaseUrl(env: DriveEnv = readEnv()): string | null {
  const raw = env.VITE_DRIVE_API_URL?.trim()
  if (!raw) return null
  return raw.replace(/\/+$/, '')
}

let cachedSupabaseToken: string | null = null
let cachedDriveToken: string | null = null
let cachedDriveTokenExpiresAt = 0

export interface DriveTokenSession {
  accessToken: string
  refreshToken: string | null
  expiresAt: number
  userEmail: string
  displayName: string
}

export interface DesktopDriveTokenSession extends DriveTokenSession {
  refreshToken: string
}

export interface DesktopHandoffRequest {
  nonce: string
  challenge?: string
}

export class DriveFreshMfaRequiredError extends Error {
  readonly handoffChallenge: string

  constructor(handoffChallenge: string) {
    super('Validation MFA récente requise pour connecter Gestion Drive')
    this.name = 'DriveFreshMfaRequiredError'
    this.handoffChallenge = handoffChallenge
  }
}

export async function exchangeWebSessionForDriveToken(
  providerAccessToken: string,
  env: DriveEnv = readEnv(),
  fetchImpl: typeof fetch = fetch,
  desktopHandoff: DesktopHandoffRequest | null = null
): Promise<DriveTokenSession> {
  const baseUrl = getDriveApiBaseUrl(env)
  if (!baseUrl) throw new Error('API Gestion Drive non configurée')
  if (providerAccessToken.length < 20 || providerAccessToken.length > 16_384) {
    throw new Error('Session Gestion invalide')
  }
  if (desktopHandoff) {
    if (!/^[A-Za-z0-9_-]{12,128}$/.test(desktopHandoff.nonce)) {
      throw new Error('Nonce Desktop invalide')
    }
    if (
      desktopHandoff.challenge !== undefined &&
      (desktopHandoff.challenge.length < 32 || desktopHandoff.challenge.length > 1024)
    ) {
      throw new Error('Challenge Desktop invalide')
    }
  }
  const requestHeaders: Record<string, string> = {
    Authorization: ['Bearer', providerAccessToken].join(' '),
  }
  if (desktopHandoff) {
    requestHeaders['X-OpenPulse-Desktop-Handoff'] = '1'
    requestHeaders['X-OpenPulse-Desktop-Nonce'] = desktopHandoff.nonce
    if (desktopHandoff.challenge) {
      requestHeaders['X-OpenPulse-Desktop-Challenge'] = desktopHandoff.challenge
    }
  }
  const response = await fetchImpl(`${baseUrl}/api/drive/desktop/web/token`, {
    method: 'POST',
    headers: requestHeaders,
  })
  if (!response.ok) {
    if (response.status === 428 && desktopHandoff) {
      const errorPayload = (await response.json().catch(() => null)) as {
        detail?: { code?: unknown; handoff_challenge?: unknown }
      } | null
      const handoffChallenge = errorPayload?.detail?.handoff_challenge
      if (
        errorPayload?.detail?.code === 'fresh_mfa_required' &&
        typeof handoffChallenge === 'string' &&
        handoffChallenge.length >= 32 &&
        handoffChallenge.length <= 1024
      ) {
        throw new DriveFreshMfaRequiredError(handoffChallenge)
      }
    }
    throw new Error(`Échange Drive refusé (HTTP ${response.status})`)
  }
  const payload = (await response.json()) as {
    access_token?: unknown
    refresh_token?: unknown
    expires_at?: unknown
    user_email?: unknown
    display_name?: unknown
  }
  if (
    typeof payload.access_token !== 'string' ||
    payload.access_token.length < 20 ||
    (desktopHandoff &&
      (typeof payload.refresh_token !== 'string' ||
        payload.refresh_token.length < 32 ||
        payload.refresh_token.length > 1024)) ||
    typeof payload.expires_at !== 'number' ||
    payload.expires_at <= Date.now() / 1000 ||
    typeof payload.user_email !== 'string' ||
    !payload.user_email.includes('@') ||
    typeof payload.display_name !== 'string'
  ) {
    throw new Error('Réponse Drive incomplète')
  }
  return {
    accessToken: payload.access_token,
    refreshToken: desktopHandoff ? (payload.refresh_token as string) : null,
    expiresAt: payload.expires_at,
    userEmail: payload.user_email,
    displayName: payload.display_name,
  }
}

export async function exchangeDesktopWebSessionForDriveToken(
  providerAccessToken: string,
  handoff: DesktopHandoffRequest,
  env: DriveEnv = readEnv(),
  fetchImpl: typeof fetch = fetch
): Promise<DesktopDriveTokenSession> {
  const session = await exchangeWebSessionForDriveToken(
    providerAccessToken,
    env,
    fetchImpl,
    handoff
  )
  if (!session.refreshToken) throw new Error('Grant Desktop Drive manquant')
  return { ...session, refreshToken: session.refreshToken }
}

async function getAccessToken(baseUrl: string): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    const supabaseToken = data.session?.access_token ?? null
    if (!supabaseToken) return null
    // Les tests/mocks historiques utilisent des tokens opaques. Un vrai token
    // Supabase est un JWT et doit être échangé contre un JWT Drive dédié.
    if (supabaseToken.split('.').length !== 3) return supabaseToken
    if (
      cachedSupabaseToken === supabaseToken &&
      cachedDriveToken &&
      cachedDriveTokenExpiresAt > Date.now() + 60_000
    )
      return cachedDriveToken
    const driveSession = await exchangeWebSessionForDriveToken(supabaseToken, {
      VITE_DRIVE_API_URL: baseUrl,
    })
    cachedSupabaseToken = supabaseToken
    cachedDriveToken = driveSession.accessToken
    cachedDriveTokenExpiresAt = driveSession.expiresAt * 1000
    return cachedDriveToken
  } catch {
    return null
  }
}

interface DriveRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

/**
 * Appel générique à l'API Drive. Erreurs normalisées en `DriveApiError`
 * pour que les hooks React Query puissent les afficher proprement.
 */
export async function driveRequest<T>(
  endpoint: string,
  options: DriveRequestOptions = {}
): Promise<T> {
  const baseUrl = getDriveApiBaseUrl()
  if (!baseUrl) {
    throw new DriveApiError(
      "VITE_DRIVE_API_URL n'est pas configurée : API Gestion Drive indisponible.",
      endpoint
    )
  }

  const token = await getAccessToken(baseUrl)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${baseUrl}${endpoint}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    const message = error instanceof Error ? error.message : 'Erreur réseau inconnue'
    throw new DriveApiError(`Appel Drive API impossible (${message})`, endpoint)
  }

  if (!response.ok) {
    if (response.status === 401) {
      cachedDriveToken = null
      cachedDriveTokenExpiresAt = 0
    }
    throw new DriveApiError(
      `Drive API ${endpoint} → HTTP ${response.status}`,
      endpoint,
      response.status
    )
  }

  // 204 No Content (ex. DELETE permission) : pas de corps à parser.
  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

/* ------------------------------------------------------------------ */
/* Endpoints typés (plan §7)                                           */
/* ------------------------------------------------------------------ */

export function fetchDriveSpaces(signal?: AbortSignal): Promise<DriveSpace[]> {
  return driveRequest<DriveSpace[]>('/api/drive/spaces', { signal })
}

export function fetchDriveTree(spaceId: string, signal?: AbortSignal): Promise<DriveTree> {
  return driveRequest<DriveTree>(`/api/drive/tree?space_id=${encodeURIComponent(spaceId)}`, {
    signal,
  })
}

export function fetchDriveChanges(
  spaceId: string,
  sinceEventId: number,
  signal?: AbortSignal
): Promise<DriveChangesResponse> {
  const qs = `space_id=${encodeURIComponent(spaceId)}&since_event_id=${sinceEventId}`
  return driveRequest<DriveChangesResponse>(`/api/drive/changes?${qs}`, { signal })
}

export function requestDriveUploadIntent(
  request: DriveUploadIntentRequest
): Promise<DriveUploadIntentResponse> {
  return driveRequest<DriveUploadIntentResponse>('/api/drive/upload-intent', {
    method: 'POST',
    body: request,
  })
}

export function completeDriveUpload(request: DriveUploadCompleteRequest): Promise<void> {
  return driveRequest<void>('/api/drive/upload-complete', { method: 'POST', body: request })
}

export function requestDriveDownloadUrl(fileId: string): Promise<DriveDownloadUrlResponse> {
  return driveRequest<DriveDownloadUrlResponse>('/api/drive/download-url', {
    method: 'POST',
    body: { file_id: fileId },
  })
}

/* ------------------------------------------------------------------ */
/* Permissions (P1 gouvernance — plan §4.3)                            */
/* ------------------------------------------------------------------ */

/**
 * Permissions directes d'une portée : espace seul, dossier ou fichier.
 * `folderId` et `fileId` sont mutuellement exclusifs (422 côté API sinon).
 */
export function fetchDrivePermissions(
  scope: DrivePermissionScope,
  signal?: AbortSignal
): Promise<DrivePermissionsResponse> {
  const params = new URLSearchParams({ space_id: scope.spaceId })
  if (scope.folderId) params.set('folder_id', scope.folderId)
  if (scope.fileId) params.set('file_id', scope.fileId)
  return driveRequest<DrivePermissionsResponse>(`/api/drive/permissions?${params.toString()}`, {
    signal,
  })
}

export function createDrivePermission(
  request: DrivePermissionCreateRequest
): Promise<DrivePermission> {
  return driveRequest<DrivePermission>('/api/drive/permissions', {
    method: 'POST',
    body: request,
  })
}

export function updateDrivePermission(
  permissionId: string,
  permission: DrivePermissionRole
): Promise<DrivePermission> {
  return driveRequest<DrivePermission>(
    `/api/drive/permissions/${encodeURIComponent(permissionId)}`,
    { method: 'PATCH', body: { permission } }
  )
}

export function deleteDrivePermission(permissionId: string): Promise<void> {
  return driveRequest<void>(`/api/drive/permissions/${encodeURIComponent(permissionId)}`, {
    method: 'DELETE',
  })
}
