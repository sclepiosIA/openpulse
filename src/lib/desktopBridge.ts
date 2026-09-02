export type DesktopNotificationModule = 'mail' | 'pulse' | 'todo' | 'drive' | 'system'

export interface DesktopNotificationPayload {
  module: DesktopNotificationModule
  title: string
  body: string
}

export const TRUSTED_DESKTOP_PARENT_ORIGINS = new Set([
  'http://tauri.localhost',
  'https://tauri.localhost',
  'tauri://localhost',
])

export function isTrustedDesktopAuthRequest(
  event: Pick<MessageEvent, 'origin' | 'source'>,
  parentWindow: Window | null = window.parent
): boolean {
  return (
    parentWindow !== null &&
    event.source === parentWindow &&
    TRUSTED_DESKTOP_PARENT_ORIGINS.has(event.origin)
  )
}

export type DesktopDriveAuthStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'mfa-required'

export interface DesktopDriveAuthRequest {
  nonce: string
  mfaCode?: string
  handoffChallenge?: string
}

export interface DesktopDriveSessionSnapshot {
  accessToken: string
  refreshToken: string
  expiresAt: number
  userEmail: string
  displayName: string
}

export interface DesktopDriveAuthSnapshot {
  status: DesktopDriveAuthStatus
  driveSession: DesktopDriveSessionSnapshot | null
  handoffChallenge?: string
}

export function replyToDesktopAuthRequest(
  event: Pick<MessageEvent, 'origin' | 'source' | 'data'>,
  parentWindow: Window | null,
  snapshot: DesktopDriveAuthSnapshot
): boolean {
  if (!isTrustedDesktopAuthRequest(event, parentWindow)) return false
  const data = event.data as { type?: unknown; nonce?: unknown } | null
  if (
    !data ||
    data.type !== 'gestion-desktop-drive-auth-request' ||
    typeof data.nonce !== 'string' ||
    data.nonce.length < 12 ||
    data.nonce.length > 128
  ) {
    return false
  }

  const authenticated = snapshot.status === 'authenticated' && Boolean(snapshot.driveSession)
  const response: Record<string, unknown> = {
    type: 'gestion-desktop-drive-auth-state',
    nonce: data.nonce,
    authStatus: snapshot.status,
    authenticated,
  }
  if (authenticated && snapshot.driveSession) {
    response.driveAccessToken = snapshot.driveSession.accessToken
    response.driveRefreshToken = snapshot.driveSession.refreshToken
    response.expiresAt = snapshot.driveSession.expiresAt
    response.userEmail = snapshot.driveSession.userEmail
    response.displayName = snapshot.driveSession.displayName
  }
  if (snapshot.status === 'mfa-required') {
    if (
      typeof snapshot.handoffChallenge !== 'string' ||
      snapshot.handoffChallenge.length < 32 ||
      snapshot.handoffChallenge.length > 1024
    ) {
      return false
    }
    response.handoffChallenge = snapshot.handoffChallenge
  }
  parentWindow!.postMessage(response, event.origin)
  return true
}

export function installDesktopAuthResponder(
  getSnapshot: (
    request: DesktopDriveAuthRequest
  ) => DesktopDriveAuthSnapshot | Promise<DesktopDriveAuthSnapshot>,
  target: EventTarget = window,
  parentWindow: Window | null = window.parent
): () => void {
  const handler = (rawEvent: Event) => {
    const event = rawEvent as MessageEvent
    if (!isTrustedDesktopAuthRequest(event, parentWindow)) return
    const data = event.data as {
      type?: unknown
      nonce?: unknown
      mfaCode?: unknown
      handoffChallenge?: unknown
    } | null
    if (
      !data ||
      data.type !== 'gestion-desktop-drive-auth-request' ||
      typeof data.nonce !== 'string' ||
      data.nonce.length < 12 ||
      data.nonce.length > 128
    ) {
      return
    }
    const hasMfa = data.mfaCode !== undefined || data.handoffChallenge !== undefined
    if (
      hasMfa &&
      (typeof data.mfaCode !== 'string' ||
        !/^\d{6}$/.test(data.mfaCode) ||
        typeof data.handoffChallenge !== 'string' ||
        data.handoffChallenge.length < 32 ||
        data.handoffChallenge.length > 1024)
    ) {
      return
    }
    const request: DesktopDriveAuthRequest = {
      nonce: data.nonce,
      ...(hasMfa
        ? { mfaCode: data.mfaCode as string, handoffChallenge: data.handoffChallenge as string }
        : {}),
    }
    const reply = (snapshot: DesktopDriveAuthSnapshot) =>
      replyToDesktopAuthRequest(event, parentWindow, snapshot)
    try {
      const snapshot = getSnapshot(request)
      if (snapshot instanceof Promise) {
        void snapshot
          .then(reply)
          .catch(() => reply({ status: 'unauthenticated', driveSession: null }))
      } else {
        reply(snapshot)
      }
    } catch {
      reply({ status: 'unauthenticated', driveSession: null })
    }
  }
  target.addEventListener('message', handler)
  return () => target.removeEventListener('message', handler)
}

export function desktopParentOrigin(referrer = document.referrer): string | null {
  if (!referrer) return null
  try {
    const url = new URL(referrer)
    if (url.origin !== 'null') return url.origin
    if (url.protocol === 'tauri:' && url.hostname === 'localhost') {
      return 'tauri://localhost'
    }
    return null
  } catch {
    return null
  }
}

export function isTrustedDesktopParentContext(
  parentWindow: Window | null = window.parent,
  currentWindow: Window = window,
  referrer = document.referrer
): boolean {
  if (!parentWindow || parentWindow === currentWindow) return false
  const origin = desktopParentOrigin(referrer)
  return Boolean(origin && TRUSTED_DESKTOP_PARENT_ORIGINS.has(origin))
}

/** Signale seulement l'état courant de la PWA ; ce message ne vaut jamais logout. */
export function notifyDesktopDriveAuthStatus(
  status: DesktopDriveAuthStatus,
  parentWindow: Window | null = window.parent,
  referrer = document.referrer
): boolean {
  if (!parentWindow || parentWindow === window) return false
  const targetOrigin = desktopParentOrigin(referrer)
  if (!targetOrigin || !TRUSTED_DESKTOP_PARENT_ORIGINS.has(targetOrigin)) return false
  parentWindow.postMessage({ type: 'gestion-desktop-drive-auth-status', status }, targetOrigin)
  return true
}

/** Événement utilisateur explicite : lui seul autorise la purge de la session native. */
export function notifyDesktopDriveLogout(
  parentWindow: Window | null = window.parent,
  referrer = document.referrer
): boolean {
  if (!parentWindow || parentWindow === window) return false
  const targetOrigin = desktopParentOrigin(referrer)
  if (!targetOrigin || !TRUSTED_DESKTOP_PARENT_ORIGINS.has(targetOrigin)) return false
  parentWindow.postMessage({ type: 'gestion-desktop-drive-auth-logout' }, targetOrigin)
  return true
}

/** Envoie au shell Tauri approuvé sans jamais diffuser le payload avec `*`. */
export function notifyDesktopShell(
  payload: DesktopNotificationPayload,
  parentWindow: Window | null = window.parent,
  referrer = document.referrer
): boolean {
  if (!parentWindow || parentWindow === window) return false
  const targetOrigin = desktopParentOrigin(referrer)
  if (!targetOrigin || !TRUSTED_DESKTOP_PARENT_ORIGINS.has(targetOrigin)) return false
  parentWindow.postMessage(
    { type: 'gestion-desktop-native-notification', ...payload },
    targetOrigin
  )
  return true
}
