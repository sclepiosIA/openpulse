/* eslint-disable react-refresh/only-export-components -- Desktop protocol validators are exported for contract tests; the packaged Tauri build does not use Fast Refresh. */
// Racine PWA embarquée : toute l'UI métier reste celle de Gestion web,
// affichée plein écran. Aucune surcouche visuelle permanente : les actions
// natives (recharger, navigateur, Drive, préférences, notifications) passent
// par le menu app/tray et par les préférences.

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { gestionWebUrl, openInGestionWeb } from '../api/desktopApi'
import {
  getSyncStatus,
  loginWithDriveSession,
  logout as logoutDrive,
  resetPwaSession,
  setDriveAutoConnect,
} from '../api/driveClient'
import { getPreferences, sendNotification } from '../api/notificationsClient'
import { subscribeToGestionUpdateStatus } from '../api/updaterClient'
import type { UpdateUiState } from '../api/updaterClient'
import type { SyncStatus } from '../api/types'
import DriveApp from './DriveApp'
import NotificationsApp from './NotificationsApp'
import PreferencesApp from './PreferencesApp'
import { getAppDefinition, resolveNavigateTarget } from './registry'
import type { PanelAppId } from './registry'
import { useAppStore } from '../state/store'

function hasTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export const FRAME_LOAD_TIMEOUT_MS = 120_000
export const OFFLINE_STATUS_POLL_MS = 10_000
export const DRIVE_AUTH_RESPONSE_TIMEOUT_MS = 10_000
const MAX_DRIVE_AUTH_ATTEMPTS = 2

export function pwaTargetOrigin(url: string): string {
  return new URL(url).origin
}

export function isTrustedPwaMessage(
  event: Pick<MessageEvent, 'origin' | 'source'>,
  frame: HTMLIFrameElement | null,
  expectedOrigin: string
): boolean {
  return event.origin === expectedOrigin && event.source === frame?.contentWindow
}

export interface DriveAuthStateMessage {
  type?: unknown
  nonce?: unknown
  authStatus?: unknown
  authenticated?: unknown
  driveAccessToken?: unknown
  driveRefreshToken?: unknown
  expiresAt?: unknown
  userEmail?: unknown
  displayName?: unknown
  handoffChallenge?: unknown
}

export type PwaAuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export function isValidPwaAuthStatus(value: unknown): value is {
  type: 'gestion-desktop-drive-auth-status'
  status: PwaAuthStatus
} {
  if (!value || typeof value !== 'object') return false
  const data = value as { type?: unknown; status?: unknown }
  return (
    data.type === 'gestion-desktop-drive-auth-status' &&
    (data.status === 'loading' ||
      data.status === 'authenticated' ||
      data.status === 'unauthenticated')
  )
}

export function isValidDriveAuthState(
  value: unknown,
  pendingNonces: ReadonlySet<string>
): value is DriveAuthStateMessage & {
  type: 'gestion-desktop-drive-auth-state'
  nonce: string
  authenticated: boolean
  driveAccessToken?: string
  driveRefreshToken?: string
  expiresAt?: number
  userEmail?: string
  displayName?: string
  handoffChallenge?: string
} {
  if (!value || typeof value !== 'object') return false
  const data = value as DriveAuthStateMessage
  if (
    data.type !== 'gestion-desktop-drive-auth-state' ||
    typeof data.nonce !== 'string' ||
    !pendingNonces.has(data.nonce) ||
    typeof data.authenticated !== 'boolean'
  ) {
    return false
  }
  const validStatus =
    data.authStatus === undefined ||
    data.authStatus === 'loading' ||
    data.authStatus === 'authenticated' ||
    data.authStatus === 'unauthenticated' ||
    data.authStatus === 'mfa-required'
  if (!validStatus) return false
  if (data.authenticated && data.authStatus && data.authStatus !== 'authenticated') return false
  if (!data.authenticated && data.authStatus === 'authenticated') return false
  if (data.authStatus === 'mfa-required') {
    return (
      !data.authenticated &&
      typeof data.handoffChallenge === 'string' &&
      data.handoffChallenge.length >= 32 &&
      data.handoffChallenge.length <= 1024
    )
  }
  return (
    !data.authenticated ||
    (typeof data.driveAccessToken === 'string' &&
      data.driveAccessToken.length >= 20 &&
      data.driveAccessToken.length <= 16_384 &&
      typeof data.driveRefreshToken === 'string' &&
      data.driveRefreshToken.length >= 32 &&
      data.driveRefreshToken.length <= 1024 &&
      typeof data.expiresAt === 'number' &&
      data.expiresAt > Date.now() / 1000 &&
      typeof data.userEmail === 'string' &&
      data.userEmail.includes('@') &&
      typeof data.displayName === 'string')
  )
}

export function isExplicitPwaLogout(value: unknown): value is {
  type: 'gestion-desktop-drive-auth-logout'
} {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    (value as { type?: unknown }).type === 'gestion-desktop-drive-auth-logout'
  )
}

export function postDriveAuthRequest(
  frame: HTMLIFrameElement | null,
  targetOrigin: string,
  nonce: string,
  mfa?: { mfaCode: string; handoffChallenge: string }
): boolean {
  if (!frame?.contentWindow || nonce.length < 12 || nonce.length > 128) return false
  if (
    mfa &&
    (!/^\d{6}$/.test(mfa.mfaCode) ||
      mfa.handoffChallenge.length < 32 ||
      mfa.handoffChallenge.length > 1024)
  ) {
    return false
  }
  frame.contentWindow.postMessage(
    { type: 'gestion-desktop-drive-auth-request', nonce, ...(mfa ?? {}) },
    targetOrigin
  )
  return true
}

function driveAuthNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `drive-${Date.now()}-${Math.random().toString(36).slice(2, 18)}`
}

type FrameState = 'loading' | 'ready' | 'failed'

interface PendingDesktopMfa {
  nonce: string
  handoffChallenge: string
}

export function offlineCopy(status: SyncStatus | null): string {
  if (!status) {
    return 'Gestion web ne répond pas. Le diagnostic Drive local reste disponible en attendant le retour réseau.'
  }
  if (status.state === 'offline') {
    return 'Gestion web est indisponible et le Drive local est hors ligne : les actions seront reprises au retour réseau.'
  }
  if (status.pending_uploads > 0 || status.pending_downloads > 0) {
    return `Gestion web est indisponible. Drive garde ${status.pending_uploads} envoi(s) et ${status.pending_downloads} réception(s) en attente.`
  }
  if (status.conflicts > 0 || status.errors > 0) {
    return `Gestion web est indisponible. Drive signale ${status.conflicts} conflit(s) et ${status.errors} erreur(s) à traiter.`
  }
  return 'Gestion web ne répond pas. Le Drive local reste consultable et la synchronisation reprendra dès que possible.'
}

export default function GestionPwaApp() {
  const [reloadKey, setReloadKey] = useState(0)
  const [frameState, setFrameState] = useState<FrameState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [offlineStatus, setOfflineStatus] = useState<SyncStatus | null>(null)
  const [updateUi, setUpdateUi] = useState<UpdateUiState | null>(null)
  const [drivePreferencesLoaded, setDrivePreferencesLoaded] = useState(false)
  const [pendingMfa, setPendingMfa] = useState<PendingDesktopMfa | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaError, setMfaError] = useState<string | null>(null)
  const [mfaSubmitting, setMfaSubmitting] = useState(false)
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const pendingAuthNoncesRef = useRef(new Set<string>())
  const pendingAuthTimeoutRef = useRef<number | undefined>(undefined)
  const driveAuthAttemptRef = useRef(0)
  const requestDriveAuthRef = useRef<(force?: boolean) => boolean>(() => false)
  const mfaSubmissionInFlightRef = useRef(false)
  const driveAutoConnectRef = useRef(false)
  const authExchangeInFlightRef = useRef(false)
  const authEpochRef = useRef(0)
  const pwaAuthStatusRef = useRef<PwaAuthStatus>('loading')
  const nativeLogoutRef = useRef<Promise<void> | null>(null)
  const explicitPwaLogoutRef = useRef(false)

  const activeApp = useAppStore((s) => s.activeApp)
  const setActiveApp = useAppStore((s) => s.setActiveApp)
  const panelOpen = useAppStore((s) => s.panelOpen)
  const setPanelOpen = useAppStore((s) => s.setPanelOpen)
  const config = useAppStore((s) => s.config)
  const setSession = useAppStore((s) => s.setSession)
  const setScreen = useAppStore((s) => s.setScreen)
  const hasNativeSession = useAppStore((s) => s.session !== null)

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const requestedPath = params?.get('pwaPath') || '/'
  const isDedicatedDesktopWindow = params?.get('desktopWindow') === '1'
  const iframePath = isDedicatedDesktopWindow
    ? `${requestedPath}${requestedPath.includes('?') ? '&' : '?'}desktopWindow=1`
    : requestedPath
  const url = gestionWebUrl(iframePath)
  const targetOrigin = pwaTargetOrigin(url)

  const requestDriveAuth = useCallback(
    (force = false) => {
      if (!force && !driveAutoConnectRef.current) return false
      const pending = pendingAuthNoncesRef.current
      // Les signaux iframe load et auth-status peuvent arriver dans le même tick.
      // Un seul challenge serveur doit rester actif jusqu'à sa réponse ou son invalidation.
      if (pending.size > 0) return false
      const nonce = driveAuthNonce()
      const attempt = driveAuthAttemptRef.current + 1
      driveAuthAttemptRef.current = attempt
      pending.add(nonce)
      if (!postDriveAuthRequest(frameRef.current, targetOrigin, nonce)) {
        pending.delete(nonce)
        driveAuthAttemptRef.current = 0
        return false
      }
      window.clearTimeout(pendingAuthTimeoutRef.current)
      pendingAuthTimeoutRef.current = window.setTimeout(() => {
        if (!pending.delete(nonce)) return
        pendingAuthTimeoutRef.current = undefined
        if (
          attempt < MAX_DRIVE_AUTH_ATTEMPTS &&
          driveAutoConnectRef.current &&
          pwaAuthStatusRef.current === 'authenticated' &&
          !explicitPwaLogoutRef.current
        ) {
          requestDriveAuthRef.current(true)
          return
        }
        driveAuthAttemptRef.current = 0
      }, DRIVE_AUTH_RESPONSE_TIMEOUT_MS)
      return true
    },
    [targetOrigin]
  )
  requestDriveAuthRef.current = requestDriveAuth

  const reconnectDriveFromGestion = useCallback(async () => {
    const logoutEpoch = authEpochRef.current
    await (nativeLogoutRef.current ?? Promise.resolve()).catch(() => undefined)
    if (authEpochRef.current !== logoutEpoch) {
      throw new Error('La session Drive a changé pendant la reconnexion.')
    }

    await setDriveAutoConnect(true)
    if (authEpochRef.current !== logoutEpoch) {
      await setDriveAutoConnect(false).catch(() => undefined)
      throw new Error('La session Drive a changé pendant la reconnexion.')
    }

    authEpochRef.current += 1
    explicitPwaLogoutRef.current = false
    driveAutoConnectRef.current = true
    authExchangeInFlightRef.current = false
    pendingAuthNoncesRef.current.clear()
    window.clearTimeout(pendingAuthTimeoutRef.current)
    pendingAuthTimeoutRef.current = undefined
    driveAuthAttemptRef.current = 0
    mfaSubmissionInFlightRef.current = false
    if (!requestDriveAuth(true)) {
      explicitPwaLogoutRef.current = true
      driveAutoConnectRef.current = false
      authExchangeInFlightRef.current = false
      pendingAuthNoncesRef.current.clear()
      await setDriveAutoConnect(false).catch(() => undefined)
      throw new Error('La session Gestion embarquée n’est pas encore disponible.')
    }
  }, [requestDriveAuth])

  const submitFreshMfa = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      if (mfaSubmissionInFlightRef.current) return
      if (!pendingMfa || !/^\d{6}$/.test(mfaCode)) {
        setMfaError('Saisissez le code à 6 chiffres de votre application d’authentification.')
        return
      }
      mfaSubmissionInFlightRef.current = true
      pendingAuthNoncesRef.current.add(pendingMfa.nonce)
      if (
        !postDriveAuthRequest(frameRef.current, targetOrigin, pendingMfa.nonce, {
          mfaCode,
          handoffChallenge: pendingMfa.handoffChallenge,
        })
      ) {
        mfaSubmissionInFlightRef.current = false
        pendingAuthNoncesRef.current.delete(pendingMfa.nonce)
        setMfaError('La session Gestion embarquée n’est plus disponible.')
        return
      }
      window.clearTimeout(pendingAuthTimeoutRef.current)
      pendingAuthTimeoutRef.current = window.setTimeout(() => {
        if (!pendingAuthNoncesRef.current.delete(pendingMfa.nonce)) return
        pendingAuthTimeoutRef.current = undefined
        mfaSubmissionInFlightRef.current = false
        setMfaSubmitting(false)
        setMfaError('Le challenge MFA a expiré. Relancez l’appairage Drive.')
      }, DRIVE_AUTH_RESPONSE_TIMEOUT_MS)
      setMfaSubmitting(true)
      setMfaError(null)
    },
    [mfaCode, pendingMfa, targetOrigin]
  )

  const cancelFreshMfa = useCallback(() => {
    if (pendingMfa) pendingAuthNoncesRef.current.delete(pendingMfa.nonce)
    window.clearTimeout(pendingAuthTimeoutRef.current)
    pendingAuthTimeoutRef.current = undefined
    driveAuthAttemptRef.current = 0
    setPendingMfa(null)
    setMfaCode('')
    setMfaError(null)
    setMfaSubmitting(false)
    mfaSubmissionInFlightRef.current = false
    driveAutoConnectRef.current = false
    void setDriveAutoConnect(false).catch(() => undefined)
  }, [pendingMfa])

  const reloadPwaFrame = useCallback(() => {
    authEpochRef.current += 1
    authExchangeInFlightRef.current = false
    pendingAuthNoncesRef.current.clear()
    window.clearTimeout(pendingAuthTimeoutRef.current)
    pendingAuthTimeoutRef.current = undefined
    driveAuthAttemptRef.current = 0
    mfaSubmissionInFlightRef.current = false
    pwaAuthStatusRef.current = 'loading'
    setPendingMfa(null)
    setMfaCode('')
    setMfaError(null)
    setMfaSubmitting(false)
    setError(null)
    setReloadKey((key) => key + 1)
  }, [])

  const openPanel = useCallback(
    (app: PanelAppId) => {
      setActiveApp(app)
      setPanelOpen(true)
    },
    [setActiveApp, setPanelOpen]
  )

  useEffect(() => {
    const pendingAuthNonces = pendingAuthNoncesRef.current
    return () => {
      window.clearTimeout(pendingAuthTimeoutRef.current)
      pendingAuthTimeoutRef.current = undefined
      pendingAuthNonces.clear()
      driveAuthAttemptRef.current = 0
      mfaSubmissionInFlightRef.current = false
      requestDriveAuthRef.current = () => false
    }
  }, [])

  useEffect(() => {
    let dismissTimer: number | undefined
    const unsubscribe = subscribeToGestionUpdateStatus((state) => {
      window.clearTimeout(dismissTimer)
      setUpdateUi(state)
      if (state.stage === 'completed' || state.stage === 'up-to-date') {
        dismissTimer = window.setTimeout(
          () => setUpdateUi(null),
          state.stage === 'completed' ? 20_000 : 8_000
        )
      }
    })
    return () => {
      window.clearTimeout(dismissTimer)
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getPreferences()
      .then((preferences) => {
        if (!cancelled) {
          driveAutoConnectRef.current = preferences.drive_auto_connect
          setDrivePreferencesLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Une préférence absente/corrompue ne doit jamais annuler un logout
          // explicite au prochain démarrage.
          driveAutoConnectRef.current = false
          pendingAuthNoncesRef.current.clear()
          window.clearTimeout(pendingAuthTimeoutRef.current)
          pendingAuthTimeoutRef.current = undefined
          driveAuthAttemptRef.current = 0
          mfaSubmissionInFlightRef.current = false
          setDrivePreferencesLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (frameState !== 'ready' || !drivePreferencesLoaded || hasNativeSession) return
    requestDriveAuth()
  }, [drivePreferencesLoaded, frameState, hasNativeSession, requestDriveAuth])

  useEffect(() => {
    const disable = () => {
      driveAutoConnectRef.current = false
      pendingAuthNoncesRef.current.clear()
      window.clearTimeout(pendingAuthTimeoutRef.current)
      pendingAuthTimeoutRef.current = undefined
      driveAuthAttemptRef.current = 0
      mfaSubmissionInFlightRef.current = false
    }
    window.addEventListener('gestion-desktop-drive-auth-disabled', disable)
    return () => {
      window.removeEventListener('gestion-desktop-drive-auth-disabled', disable)
    }
  }, [])

  useEffect(() => {
    setFrameState('loading')
    setOfflineStatus(null)
    const timer = setTimeout(
      () => setFrameState((s) => (s === 'loading' ? 'failed' : s)),
      FRAME_LOAD_TIMEOUT_MS
    )
    return () => clearTimeout(timer)
  }, [reloadKey])

  useEffect(() => {
    if (frameState !== 'failed') return
    let alive = true
    const refreshOfflineStatus = () => {
      getSyncStatus()
        .then((status) => alive && setOfflineStatus(status))
        .catch(() => alive && setOfflineStatus(null))
    }
    refreshOfflineStatus()
    const id = setInterval(refreshOfflineStatus, OFFLINE_STATUS_POLL_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [frameState])

  useEffect(() => {
    if (!hasTauri()) return
    let unlistenNavigate: (() => void) | undefined
    let unlistenReload: (() => void) | undefined
    let unlistenJarvis: (() => void) | undefined
    let unlistenResetSession: (() => void) | undefined
    let cancelled = false

    import('@tauri-apps/api/event')
      .then(async ({ listen }) => {
        const nav = await listen<string>('gestion://navigate', (event) => {
          const target = resolveNavigateTarget(event.payload)
          if (target) openPanel(target)
        })
        const reload = await listen('gestion://reload', () => {
          reloadPwaFrame()
        })
        const jarvis = await listen('gestion://open-jarvis', () => {
          frameRef.current?.contentWindow?.postMessage(
            { type: 'gestion-desktop-open-jarvis' },
            targetOrigin
          )
        })
        const resetSession = await listen('gestion://reset-pwa-session-requested', () => {
          void resetPwaSession().catch((cause) => {
            setError(cause instanceof Error ? cause.message : String(cause))
          })
        })
        return { nav, reload, jarvis, resetSession }
      })
      .then(({ nav, reload, jarvis, resetSession }) => {
        if (cancelled) {
          nav()
          reload()
          jarvis()
          resetSession()
        } else {
          unlistenNavigate = nav
          unlistenReload = reload
          unlistenJarvis = jarvis
          unlistenResetSession = resetSession
        }
      })
      .catch(console.error)

    return () => {
      cancelled = true
      unlistenNavigate?.()
      unlistenReload?.()
      unlistenJarvis?.()
      unlistenResetSession?.()
    }
  }, [openPanel, reloadPwaFrame, targetOrigin])

  useEffect(() => {
    const applyPwaAuthStatus = (status: PwaAuthStatus) => {
      const previous = pwaAuthStatusRef.current
      pwaAuthStatusRef.current = status
      if (status === 'loading') return

      if (status === 'unauthenticated') {
        // Absence/erreur de session web ≠ logout utilisateur : préserver la
        // session Drive native pour l'offline et invalider seulement l'échange.
        const mfaWasInFlight = mfaSubmissionInFlightRef.current
        authEpochRef.current += 1
        authExchangeInFlightRef.current = false
        pendingAuthNoncesRef.current.clear()
        window.clearTimeout(pendingAuthTimeoutRef.current)
        pendingAuthTimeoutRef.current = undefined
        driveAuthAttemptRef.current = 0
        mfaSubmissionInFlightRef.current = false
        if (mfaWasInFlight && pendingMfa) {
          setMfaSubmitting(false)
          setMfaError('Code invalide ou challenge expiré. Réessayez ou annulez l’appairage.')
        }
        return
      }

      if (explicitPwaLogoutRef.current) {
        // Un statut de cycle générique peut provenir d'un échange lancé avant
        // le logout. Seule l'action locale explicite de reconnexion est
        // autorisée à lever le tombstone natif.
        return
      }
      if (previous === 'authenticated') return
      if (driveAutoConnectRef.current) requestDriveAuth(true)
    }

    const applyExplicitPwaLogout = () => {
      explicitPwaLogoutRef.current = true
      pwaAuthStatusRef.current = 'unauthenticated'
      const epoch = ++authEpochRef.current
      driveAutoConnectRef.current = false
      authExchangeInFlightRef.current = false
      pendingAuthNoncesRef.current.clear()
      window.clearTimeout(pendingAuthTimeoutRef.current)
      pendingAuthTimeoutRef.current = undefined
      driveAuthAttemptRef.current = 0
      // Le logout PWA est effectif : vider l'UI même si la commande native
      // retourne ensuite une erreur de persistance après avoir tenté sa purge.
      setSession(null)
      setScreen('login')
      setError(null)
      setPendingMfa(null)
      setMfaCode('')
      setMfaError(null)
      setMfaSubmitting(false)
      mfaSubmissionInFlightRef.current = false
      const logoutPromise = logoutDrive()
      nativeLogoutRef.current = logoutPromise
      void logoutPromise.catch(() => {
        if (authEpochRef.current === epoch) {
          setError('La session Gestion est fermée ; vérifiez la purge Drive locale.')
        }
      })
    }

    const onMessage = (event: MessageEvent) => {
      if (!isTrustedPwaMessage(event, frameRef.current, targetOrigin)) return
      const data = event.data

      if (isExplicitPwaLogout(data)) {
        applyExplicitPwaLogout()
        return
      }

      if (isValidPwaAuthStatus(data)) {
        applyPwaAuthStatus(data.status)
        return
      }

      if (isValidDriveAuthState(data, pendingAuthNoncesRef.current)) {
        if (data.authStatus === 'mfa-required' && mfaSubmissionInFlightRef.current) return
        pendingAuthNoncesRef.current.delete(data.nonce)
        window.clearTimeout(pendingAuthTimeoutRef.current)
        pendingAuthTimeoutRef.current = undefined
        driveAuthAttemptRef.current = 0
        if (data.authStatus === 'mfa-required' && data.handoffChallenge) {
          mfaSubmissionInFlightRef.current = false
          setPendingMfa({ nonce: data.nonce, handoffChallenge: data.handoffChallenge })
          setMfaCode('')
          setMfaError(null)
          setMfaSubmitting(false)
          return
        }
        if (data.authStatus === 'loading') return
        if (data.authStatus === 'unauthenticated') {
          if (pendingMfa) {
            mfaSubmissionInFlightRef.current = false
            setMfaError('Code invalide ou challenge expiré. Réessayez ou annulez l’appairage.')
            setMfaSubmitting(false)
            return
          }
          applyPwaAuthStatus('unauthenticated')
          return
        }
        if (
          !data.authenticated ||
          !data.driveAccessToken ||
          !data.driveRefreshToken ||
          !data.expiresAt ||
          !data.userEmail ||
          data.displayName === undefined ||
          !driveAutoConnectRef.current ||
          authExchangeInFlightRef.current
        ) {
          return
        }
        // Cette réponse est liée au nonce créé par l'action locale : elle peut
        // donc établir l'état authentifié, contrairement au statut générique.
        pwaAuthStatusRef.current = 'authenticated'
        mfaSubmissionInFlightRef.current = false
        setPendingMfa(null)
        setMfaCode('')
        setMfaError(null)
        setMfaSubmitting(false)
        const epoch = authEpochRef.current
        authExchangeInFlightRef.current = true
        pendingAuthNoncesRef.current.clear()
        void loginWithDriveSession({
          accessToken: data.driveAccessToken,
          refreshToken: data.driveRefreshToken,
          expiresAt: data.expiresAt,
          userEmail: data.userEmail,
          displayName: data.displayName,
        })
          .then((session) => {
            if (
              authEpochRef.current !== epoch ||
              !driveAutoConnectRef.current ||
              pwaAuthStatusRef.current === 'unauthenticated'
            ) {
              return
            }
            setSession(session)
            setScreen(config?.sync_root ? 'spaces' : 'folder')
            setError(null)
          })
          .catch(() => {
            if (authEpochRef.current === epoch && driveAutoConnectRef.current) {
              setError(
                'Connexion automatique au Drive impossible. Réessayez depuis le panneau Drive.'
              )
            }
          })
          .finally(() => {
            authExchangeInFlightRef.current = false
          })
        return
      }

      if (!data || data.type !== 'gestion-desktop-native-notification') return
      const module =
        data.module === 'mail' ||
        data.module === 'pulse' ||
        data.module === 'todo' ||
        data.module === 'drive'
          ? data.module
          : 'system'
      void sendNotification(module, String(data.title || 'Gestion'), String(data.body || ''))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [config?.sync_root, pendingMfa, requestDriveAuth, setScreen, setSession, targetOrigin])

  useEffect(() => {
    if (!panelOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPanelOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [panelOpen, setPanelOpen])

  async function openBrowser() {
    setError(null)
    try {
      await openInGestionWeb('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const panelApp: PanelAppId =
    activeApp === 'preferences' || activeApp === 'notifications' ? activeApp : 'drive'
  const panelLabel = getAppDefinition(panelApp).label

  return (
    <main className="pwa-root">
      {error && (
        <p className="pwa-root-error error" role="alert">
          {error}
        </p>
      )}

      {updateUi && (
        <section
          className={`update-banner update-banner-${updateUi.stage}`}
          role={updateUi.stage === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span className="update-banner-icon" aria-hidden="true">
            {updateUi.stage === 'completed' ? '✓' : updateUi.stage === 'error' ? '!' : '↻'}
          </span>
          <div className="update-banner-copy">
            <strong>
              {updateUi.stage === 'completed'
                ? 'Mise à jour terminée'
                : updateUi.stage === 'restarting'
                  ? 'Mise à jour installée'
                  : 'Gestion Desktop'}
            </strong>
            <span>{updateUi.message}</span>
            {updateUi.stage === 'downloading' && updateUi.percent !== null && (
              <progress
                max={100}
                value={updateUi.percent}
                aria-label="Progression de la mise à jour"
              />
            )}
          </div>
          <button
            type="button"
            className="update-banner-close"
            onClick={() => setUpdateUi(null)}
            aria-label="Masquer l’état de mise à jour"
          >
            ×
          </button>
        </section>
      )}

      {pendingMfa && (
        <>
          <div className="pwa-panel-backdrop" onClick={cancelFreshMfa} />
          <section
            className="pwa-panel desktop-mfa-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="desktop-mfa-title"
          >
            <h2 id="desktop-mfa-title">Validation MFA Drive</h2>
            <p>
              Confirmez cet appairage Desktop avec un nouveau code de votre application
              d’authentification.
            </p>
            <form className="form" onSubmit={submitFreshMfa}>
              <label htmlFor="desktop-mfa-code">Code à 6 chiffres</label>
              <input
                id="desktop-mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
              />
              {mfaError && <p role="alert">{mfaError}</p>}
              <div className="actions">
                <button type="submit" disabled={mfaSubmitting || mfaCode.length !== 6}>
                  {mfaSubmitting ? 'Validation…' : 'Valider et connecter'}
                </button>
                <button type="button" className="secondary" onClick={cancelFreshMfa}>
                  Annuler
                </button>
              </div>
            </form>
          </section>
        </>
      )}

      {frameState === 'loading' && (
        <div className="pwa-loading" role="status">
          <span className="pwa-loading-spinner" aria-hidden="true" />
          Chargement de Gestion…
        </div>
      )}

      <iframe
        ref={frameRef}
        key={reloadKey}
        className="pwa-root-frame"
        title="Gestion"
        src={url}
        onLoad={() => setFrameState('ready')}
        allow="clipboard-write; camera; microphone; fullscreen; autoplay"
      />

      {frameState === 'failed' && (
        <div className="pwa-failed">
          <section className="card" aria-label="Gestion inaccessible">
            <h1>Impossible d'afficher Gestion</h1>
            <p className="muted">{offlineCopy(offlineStatus)}</p>
            {offlineStatus && (
              <dl className="offline-drive-summary" aria-label="État Drive hors ligne">
                <div>
                  <dt>À envoyer</dt>
                  <dd>{offlineStatus.pending_uploads}</dd>
                </div>
                <div>
                  <dt>À recevoir</dt>
                  <dd>{offlineStatus.pending_downloads}</dd>
                </div>
                <div>
                  <dt>Conflits</dt>
                  <dd>{offlineStatus.conflicts}</dd>
                </div>
                <div>
                  <dt>Erreurs</dt>
                  <dd>{offlineStatus.errors}</dd>
                </div>
              </dl>
            )}
            <div className="actions">
              <button type="button" onClick={reloadPwaFrame}>
                Réessayer
              </button>
              <button type="button" className="secondary" onClick={() => openPanel('drive')}>
                Diagnostic Drive
              </button>
              <button type="button" className="secondary" onClick={openBrowser}>
                Ouvrir dans le navigateur
              </button>
            </div>
          </section>
        </div>
      )}

      {panelOpen && (
        <>
          <div
            className="pwa-panel-backdrop"
            data-testid="pwa-panel-backdrop"
            onClick={() => setPanelOpen(false)}
          />
          <aside className="pwa-panel" role="dialog" aria-label={panelLabel}>
            <header className="pwa-panel-header">
              <strong>{panelLabel}</strong>
              <button
                type="button"
                className="secondary"
                onClick={() => setPanelOpen(false)}
                aria-label="Fermer le panneau"
              >
                ✕
              </button>
            </header>
            <div className="pwa-panel-body">
              {panelApp === 'preferences' ? (
                <PreferencesApp />
              ) : panelApp === 'notifications' ? (
                <NotificationsApp />
              ) : (
                <DriveApp onUseGestionSession={reconnectDriveFromGestion} />
              )}
            </div>
          </aside>
        </>
      )}
    </main>
  )
}
