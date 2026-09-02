/**
 * Sélecteur de backend Visio / Transcription (plan Gestion Meetings Azure).
 *
 * Lot 1 — socle non destructif :
 * - `supabase` (défaut) : comportement actuel inchangé (Edge Functions
 *   `webrtc-signaling` + `meeting-notes-process`).
 * - `azure`   : cible Meeting API Azure Container Apps (à venir).
 * - `hybrid`  : Supabase reste la source primaire, l'API Azure est sondée
 *   et préparée (upload-intent, statut pipeline) sans casser l'existant.
 *
 * Flags (build-time Vite) :
 *   VITE_VISIO_BACKEND=supabase|azure|hybrid
 *   VITE_TRANSCRIPTION_BACKEND=supabase|azure|hybrid
 *   VITE_MEETINGS_API_BASE_URL=https://... (API Meetings Azure)
 *
 * Lecture paresseuse (fonctions, pas constantes module) pour rester testable
 * via vi.stubEnv / injection d'env, et éviter de figer l'env au chargement.
 */

export type MeetingsBackend = 'supabase' | 'azure' | 'hybrid'

export const MEETINGS_BACKENDS: readonly MeetingsBackend[] = [
  'supabase',
  'azure',
  'hybrid',
] as const

export const DEFAULT_MEETINGS_BACKEND: MeetingsBackend = 'supabase'

type EnvSource = Record<string, string | undefined>

function readEnv(): EnvSource {
  // import.meta.env est toujours défini sous Vite/Vitest ; fallback objet vide
  // pour tout contexte d'exécution exotique (SSR outillage, scripts node).
  return (import.meta.env ?? {}) as EnvSource
}

export function parseMeetingsBackend(
  raw: string | undefined | null,
  fallback: MeetingsBackend = DEFAULT_MEETINGS_BACKEND
): MeetingsBackend {
  if (!raw) return fallback
  const normalized = raw.trim().toLowerCase()
  return (MEETINGS_BACKENDS as readonly string[]).includes(normalized)
    ? (normalized as MeetingsBackend)
    : fallback
}

/** Backend de signalisation/salles visio (`/visio/:roomCode`). */
export function getVisioBackend(env: EnvSource = readEnv()): MeetingsBackend {
  return parseMeetingsBackend(env.VITE_VISIO_BACKEND)
}

/** Backend du pipeline transcription (`/meeting-notes`). */
export function getTranscriptionBackend(env: EnvSource = readEnv()): MeetingsBackend {
  return parseMeetingsBackend(env.VITE_TRANSCRIPTION_BACKEND)
}

/**
 * Base URL de l'API Meetings Azure (sans slash final).
 * Chaîne vide si non configurée — les appels Azure sont alors désactivés.
 */
export function getMeetingsApiBaseUrl(env: EnvSource = readEnv()): string {
  const raw = env.VITE_MEETINGS_API_BASE_URL?.trim()
  if (!raw) return ''
  return raw.replace(/\/+$/, '')
}

/** True si au moins un des deux domaines sonde l'API Azure (azure|hybrid). */
export function isAzureMeetingsEnabled(env: EnvSource = readEnv()): boolean {
  const visio = getVisioBackend(env)
  const transcription = getTranscriptionBackend(env)
  return visio !== 'supabase' || transcription !== 'supabase'
}

/**
 * True si l'appel réseau vers l'API Azure est réellement possible :
 * flag activé ET base URL configurée.
 */
export function canReachAzureMeetingsApi(env: EnvSource = readEnv()): boolean {
  return isAzureMeetingsEnabled(env) && getMeetingsApiBaseUrl(env) !== ''
}
