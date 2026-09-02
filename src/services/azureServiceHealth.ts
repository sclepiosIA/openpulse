/**
 * Supervision légère des services Azure Gestion.
 *
 * Objectif : un cockpit lisible dans OpenPulse Monitor, sans secret côté front.
 * Les URLs viennent uniquement des variables Vite publiques déjà utilisées par
 * les clients métier ; si une URL manque, le service est indiqué « non
 * configuré » au lieu de lancer un appel réseau.
 */

export type AzureServiceId = 'drive' | 'mail' | 'pulse' | 'meetings'
export type AzureServiceHealthStatus = 'ok' | 'degraded' | 'down' | 'unconfigured'

export interface AzureServiceEnv {
  VITE_DRIVE_API_URL?: string
  VITE_EMAIL_AZURE_API_URL?: string
  VITE_PULSE_AZURE_API_URL?: string
  VITE_MEETINGS_API_BASE_URL?: string
  [key: string]: unknown
}

export interface AzureServiceTarget {
  id: AzureServiceId
  label: string
  description: string
  baseUrl: string | null
  healthPath: string
}

export interface AzureServiceHealthResult extends AzureServiceTarget {
  status: AzureServiceHealthStatus
  httpStatus: number | null
  version: string | null
  checkedAt: string
  dependencies: Record<string, string>
  message: string | null
}

export interface ProbeAzureServiceOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 5_000

function readEnv(): AzureServiceEnv {
  try {
    return (import.meta.env ?? {}) as AzureServiceEnv
  } catch {
    return {}
  }
}

export function normalizeAzureServiceUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, '')
}

export function resolveAzureServiceTargets(env: AzureServiceEnv = readEnv()): AzureServiceTarget[] {
  return [
    {
      id: 'drive',
      label: 'Drive API',
      description: 'Documents Azure Drive, uploads, permissions et sync desktop.',
      baseUrl: normalizeAzureServiceUrl(env.VITE_DRIVE_API_URL),
      healthPath: '/healthz',
    },
    {
      id: 'mail',
      label: 'Mail API',
      description: 'Smart Inbox Azure, comptes mail et supervision de sync.',
      baseUrl: normalizeAzureServiceUrl(env.VITE_EMAIL_AZURE_API_URL),
      healthPath: '/healthz',
    },
    {
      id: 'pulse',
      label: 'Pulse API',
      description: 'Conversations Pulse Azure et futur gateway temps réel.',
      baseUrl: normalizeAzureServiceUrl(env.VITE_PULSE_AZURE_API_URL),
      healthPath: '/healthz',
    },
    {
      id: 'meetings',
      label: 'Meetings API',
      description: 'Visio, upload audio et pipeline transcription Azure.',
      baseUrl: normalizeAzureServiceUrl(env.VITE_MEETINGS_API_BASE_URL),
      healthPath: '/healthz',
    },
  ]
}

function statusFromPayload(
  httpStatus: number,
  payload: Record<string, unknown> | null
): AzureServiceHealthStatus {
  if (httpStatus < 200 || httpStatus >= 300) return 'down'
  const rawStatus = typeof payload?.status === 'string' ? payload.status.toLowerCase() : 'ok'
  if (rawStatus === 'ok' || rawStatus === 'healthy') return 'ok'
  if (rawStatus === 'degraded' || rawStatus === 'warning') return 'degraded'
  return 'down'
}

function dependenciesFromPayload(payload: Record<string, unknown> | null): Record<string, string> {
  const deps = payload?.dependencies ?? payload?.services
  if (!deps || typeof deps !== 'object' || Array.isArray(deps)) return {}
  return Object.fromEntries(
    Object.entries(deps as Record<string, unknown>).map(([key, value]) => [key, String(value)])
  )
}

function messageFromError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return 'Timeout healthcheck'
  return error instanceof Error ? error.message : 'Erreur réseau inconnue'
}

export async function probeAzureServiceHealth(
  target: AzureServiceTarget,
  options: ProbeAzureServiceOptions = {}
): Promise<AzureServiceHealthResult> {
  const checkedAt = new Date().toISOString()
  if (!target.baseUrl) {
    return {
      ...target,
      status: 'unconfigured',
      httpStatus: null,
      version: null,
      checkedAt,
      dependencies: {},
      message: 'URL non configurée',
    }
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetchImpl(`${target.baseUrl}${target.healthPath}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    let payload: Record<string, unknown> | null = null
    try {
      payload = (await response.json()) as Record<string, unknown>
    } catch {
      payload = null
    }

    const status = statusFromPayload(response.status, payload)
    return {
      ...target,
      status,
      httpStatus: response.status,
      version: typeof payload?.version === 'string' ? payload.version : null,
      checkedAt,
      dependencies: dependenciesFromPayload(payload),
      message: status === 'down' ? `HTTP ${response.status}` : null,
    }
  } catch (error) {
    return {
      ...target,
      status: 'down',
      httpStatus: null,
      version: null,
      checkedAt,
      dependencies: {},
      message: messageFromError(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function probeAllAzureServices(
  env: AzureServiceEnv = readEnv(),
  options: ProbeAzureServiceOptions = {}
): Promise<AzureServiceHealthResult[]> {
  return Promise.all(
    resolveAzureServiceTargets(env).map((target) => probeAzureServiceHealth(target, options))
  )
}
