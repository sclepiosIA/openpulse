// Auto-update Gestion Desktop avec état visible et confirmation persistée
// après le redémarrage de l'application.

export type UpdateCheckResult =
  | { status: 'unavailable' }
  | { status: 'up-to-date' }
  | { status: 'available'; version: string }
  | { status: 'installed'; version: string }
  | { status: 'error'; message: string }

export type UpdateUiState =
  | { stage: 'checking'; message: string }
  | { stage: 'available'; version: string; message: string }
  | { stage: 'downloading'; version: string; percent: number | null; message: string }
  | { stage: 'restarting'; version: string; message: string }
  | { stage: 'completed'; version: string; completedAt: string; message: string }
  | { stage: 'up-to-date'; version?: string; message: string }
  | { stage: 'error'; message: string }

export interface UpdateHistory {
  currentVersion: string | null
  lastCompleted: { version: string; completedAt: string } | null
}

const UPDATE_EVENT = 'gestion://update-status'
const PENDING_UPDATE_KEY = 'gestion.desktop.pending-update.v1'
const LAST_UPDATE_KEY = 'gestion.desktop.last-update.v1'
const LAST_SEEN_VERSION_KEY = 'gestion.desktop.last-seen-version.v1'

function hasTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Un stockage indisponible ne doit jamais bloquer l'updater natif.
  }
}

function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // no-op
  }
}

export function publishUpdateUiState(state: UpdateUiState): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<UpdateUiState>(UPDATE_EVENT, { detail: state }))
}

export function subscribeToGestionUpdateStatus(
  listener: (state: UpdateUiState) => void
): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<UpdateUiState>).detail)
  window.addEventListener(UPDATE_EVENT, handler)
  return () => window.removeEventListener(UPDATE_EVENT, handler)
}

async function currentVersion(): Promise<string | null> {
  if (!hasTauri()) return null
  try {
    const { getVersion } = await import('@tauri-apps/api/app')
    return await getVersion()
  } catch {
    return null
  }
}

export async function getGestionUpdateHistory(): Promise<UpdateHistory> {
  return {
    currentVersion: await currentVersion(),
    lastCompleted: readJson<{ version: string; completedAt: string }>(LAST_UPDATE_KEY),
  }
}

/**
 * À appeler au démarrage. Si l'updater avait marqué une installation avant le
 * relaunch et que la version courante correspond, publie une confirmation
 * persistante et retourne son détail.
 */
export async function detectCompletedGestionDesktopUpdate(): Promise<UpdateUiState | null> {
  if (!hasTauri()) return null
  const pending = readJson<{ version: string; state: string }>(PENDING_UPDATE_KEY)
  const installedVersion = await currentVersion()
  if (!installedVersion) return null
  const lastSeenVersion = readJson<string>(LAST_SEEN_VERSION_KEY)

  if (pending && (pending.state !== 'restarting' || installedVersion !== pending.version)) {
    return null
  }
  if (!pending && lastSeenVersion === installedVersion) return null

  const completedAt = new Date().toISOString()
  const completed = { version: installedVersion, completedAt }
  writeJson(LAST_UPDATE_KEY, completed)
  writeJson(LAST_SEEN_VERSION_KEY, installedVersion)
  removeStored(PENDING_UPDATE_KEY)
  const state: UpdateUiState = {
    stage: 'completed',
    version: installedVersion,
    completedAt,
    message: pending
      ? `Gestion Desktop a été mise à jour avec succès vers la version ${installedVersion}.`
      : `Gestion Desktop ${installedVersion} est installé et prêt.`,
  }
  publishUpdateUiState(state)
  return state
}

export async function checkForGestionDesktopUpdate(
  options: { silent?: boolean } = {}
): Promise<UpdateCheckResult> {
  if (!hasTauri()) return { status: 'unavailable' }
  if (!options.silent) {
    publishUpdateUiState({ stage: 'checking', message: 'Recherche d’une mise à jour…' })
  }

  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()
    if (!update) {
      const version = await currentVersion()
      if (!options.silent) {
        publishUpdateUiState({
          stage: 'up-to-date',
          version: version ?? undefined,
          message: version
            ? `Gestion Desktop ${version} est à jour.`
            : 'Gestion Desktop est à jour.',
        })
      }
      if (!options.silent) window.alert('Gestion Desktop est déjà à jour.')
      return { status: 'up-to-date' }
    }

    publishUpdateUiState({
      stage: 'available',
      version: update.version,
      message: `La mise à jour ${update.version} est disponible.`,
    })
    const shouldInstall = window.confirm(
      `Une mise à jour Gestion Desktop ${update.version} est disponible. Installer maintenant ?`
    )
    if (!shouldInstall) return { status: 'available', version: update.version }

    writeJson(PENDING_UPDATE_KEY, { version: update.version, state: 'downloading' })
    let downloaded = 0
    let total: number | null = null
    await update.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        total = event.data.contentLength ?? null
      } else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength
      }
      const percent =
        total && total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null
      publishUpdateUiState({
        stage: 'downloading',
        version: update.version,
        percent,
        message:
          percent === null
            ? `Téléchargement de la mise à jour ${update.version}…`
            : `Téléchargement de la mise à jour ${update.version} : ${percent} %`,
      })
    })

    writeJson(PENDING_UPDATE_KEY, { version: update.version, state: 'restarting' })
    publishUpdateUiState({
      stage: 'restarting',
      version: update.version,
      message: `Mise à jour ${update.version} installée. Redémarrage de Gestion Desktop…`,
    })
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
    return { status: 'installed', version: update.version }
  } catch (error) {
    removeStored(PENDING_UPDATE_KEY)
    const message = error instanceof Error ? error.message : String(error)
    if (!options.silent) {
      publishUpdateUiState({ stage: 'error', message: `Mise à jour impossible : ${message}` })
    }
    if (!options.silent) window.alert(`Recherche de mise à jour impossible : ${message}`)
    console.warn('[Gestion Desktop] vérification de mise à jour impossible', error)
    return { status: 'error', message }
  }
}
