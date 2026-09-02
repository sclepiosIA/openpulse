/**
 * Pulse Azure Collaboration Hub — Lot 1 : socle backend selector.
 *
 * Feature flag `VITE_PULSE_BACKEND` (plan §5) :
 * - `supabase` (défaut) : comportement actuel, aucun changement pour /pulse ;
 * - `azure`    : nouveau backend Azure (API + WebSocket gateway) ;
 * - `hybrid`   : conversations/messages restent Supabase, IA/recherche/notifs Azure.
 *
 * Ce module est volontairement pur (pas de side effects, env injectable)
 * pour être testable et importable partout sans risque.
 */

export type PulseBackendMode = 'supabase' | 'azure' | 'hybrid'

export const PULSE_BACKEND_MODES: readonly PulseBackendMode[] = [
  'supabase',
  'azure',
  'hybrid',
] as const

export const DEFAULT_PULSE_BACKEND: PulseBackendMode = 'supabase'

/** Env minimal lu par le sélecteur (sous-ensemble de import.meta.env). */
export interface PulseBackendEnv {
  VITE_PULSE_BACKEND?: string
  VITE_PULSE_AZURE_API_URL?: string
  VITE_PULSE_AZURE_WS_URL?: string
  [key: string]: unknown
}

export interface PulseAzureConfig {
  /** Mode résolu (invalide → 'supabase'). */
  mode: PulseBackendMode
  /** Base URL de l'API Pulse Azure (ex: https://openpulse-pulse-api.azurecontainerapps.io). */
  apiBaseUrl: string | null
  /** URL WebSocket du realtime gateway (dérivée de l'API si non fournie). */
  wsUrl: string | null
  /** true si le backend Azure participe (azure ou hybrid). */
  azureEnabled: boolean
  /** true si le realtime Supabase reste actif (supabase ou hybrid). */
  supabaseRealtimeActive: boolean
  /** true si le flag brut était invalide et a été replié sur 'supabase'. */
  fallbackApplied: boolean
  /** Valeur brute du flag, pour diagnostic. */
  rawMode: string | null
}

/** Parse tolérant du flag : trim + lowercase, fallback silencieux sur 'supabase'. */
export function parsePulseBackendMode(raw: unknown): PulseBackendMode {
  if (typeof raw !== 'string') return DEFAULT_PULSE_BACKEND
  const normalized = raw.trim().toLowerCase()
  return (PULSE_BACKEND_MODES as readonly string[]).includes(normalized)
    ? (normalized as PulseBackendMode)
    : DEFAULT_PULSE_BACKEND
}

/** Normalise une base URL (supprime le trailing slash, rejette les valeurs vides). */
export function normalizeBaseUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, '')
}

/**
 * Dérive l'URL WebSocket depuis la base API si `VITE_PULSE_AZURE_WS_URL`
 * n'est pas fournie : https → wss, http → ws, chemin plan §12 `/api/pulse/ws`.
 */
export function derivePulseWsUrl(apiBaseUrl: string | null): string | null {
  if (!apiBaseUrl) return null
  try {
    const url = new URL(apiBaseUrl)
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:'
    const basePath = url.pathname.replace(/\/+$/, '')
    url.pathname = `${basePath}/api/pulse/ws`
    return url.toString()
  } catch {
    return null
  }
}

/**
 * Résout la configuration Pulse Azure depuis l'env Vite.
 * Défaut sans variable = mode 'supabase' → zéro impact sur /pulse existant.
 */
export function resolvePulseAzureConfig(env?: PulseBackendEnv): PulseAzureConfig {
  const source: PulseBackendEnv =
    env ?? (import.meta as unknown as { env?: PulseBackendEnv }).env ?? {}

  const rawMode = typeof source.VITE_PULSE_BACKEND === 'string' ? source.VITE_PULSE_BACKEND : null
  const mode = parsePulseBackendMode(rawMode)
  const fallbackApplied = rawMode !== null && rawMode.trim().toLowerCase() !== mode

  const apiBaseUrl = normalizeBaseUrl(source.VITE_PULSE_AZURE_API_URL)
  const explicitWs = normalizeBaseUrl(source.VITE_PULSE_AZURE_WS_URL)
  const wsUrl = explicitWs ?? derivePulseWsUrl(apiBaseUrl)

  return {
    mode,
    apiBaseUrl,
    wsUrl,
    azureEnabled: mode === 'azure' || mode === 'hybrid',
    supabaseRealtimeActive: mode === 'supabase' || mode === 'hybrid',
    fallbackApplied,
    rawMode,
  }
}

/** Config module par défaut (évaluée paresseusement pour rester testable). */
let cachedConfig: PulseAzureConfig | null = null

export function getPulseAzureConfig(): PulseAzureConfig {
  if (!cachedConfig) {
    cachedConfig = resolvePulseAzureConfig()
  }
  return cachedConfig
}

/** Réinitialise le cache (usage tests uniquement). */
export function __resetPulseAzureConfigForTests(): void {
  cachedConfig = null
}
