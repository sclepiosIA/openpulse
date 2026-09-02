export const AUTH_PERSISTENCE_DURATION_MS = 30 * 24 * 60 * 60 * 1000
export const AUTH_PERSISTENCE_DEADLINE_KEY = 'openpulse.auth.persistence-deadline'

const AUTH_PERSISTENCE_MODE_KEY = 'openpulse.auth.persistence-mode'
const SESSION_ONLY_MODE = 'session'

type AuthPersistenceMode = 'persistent' | 'session'

const getLocalStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

const getSessionStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

const initialMode = (): AuthPersistenceMode => {
  try {
    return getSessionStorage()?.getItem(AUTH_PERSISTENCE_MODE_KEY) === SESSION_ONLY_MODE
      ? 'session'
      : 'persistent'
  } catch {
    return 'persistent'
  }
}

let persistenceMode: AuthPersistenceMode = initialMode()

const requireStorage = (storage: Storage | null, label: string): Storage => {
  if (!storage) {
    throw new Error(`Le stockage ${label} est indisponible dans ce navigateur.`)
  }
  return storage
}

const isSupabaseAuthStorageKey = (key: string): boolean =>
  key === 'supabase.auth.token' || /^sb-[a-z0-9-]+-auth-token(?:[.-].*)?$/i.test(key)

const purgePersistentAuthSessions = (local: Storage): void => {
  const authKeys = Array.from({ length: local.length }, (_, index) => local.key(index)).filter(
    (key): key is string => key !== null && isSupabaseAuthStorageKey(key)
  )

  authKeys.forEach((key) => local.removeItem(key))
  local.removeItem(AUTH_PERSISTENCE_DEADLINE_KEY)
}

export function configureAuthSessionPersistence(persistSession: boolean): void {
  if (persistSession) {
    const local = requireStorage(getLocalStorage(), 'local')
    local.setItem(AUTH_PERSISTENCE_DEADLINE_KEY, String(Date.now() + AUTH_PERSISTENCE_DURATION_MS))
    getSessionStorage()?.removeItem(AUTH_PERSISTENCE_MODE_KEY)
    persistenceMode = 'persistent'
    return
  }

  const session = requireStorage(getSessionStorage(), 'de session')
  const local = getLocalStorage()
  session.setItem(AUTH_PERSISTENCE_MODE_KEY, SESSION_ONLY_MODE)
  if (local) purgePersistentAuthSessions(local)
  persistenceMode = 'session'
}

const getPersistentItem = (key: string): string | null => {
  const local = getLocalStorage()
  if (!local) return null

  const deadlineValue = local.getItem(AUTH_PERSISTENCE_DEADLINE_KEY)
  if (deadlineValue === null) {
    local.removeItem(key)
    return null
  }

  const deadline = Number(deadlineValue)
  if (!Number.isFinite(deadline) || Date.now() >= deadline) {
    local.removeItem(key)
    local.removeItem(AUTH_PERSISTENCE_DEADLINE_KEY)
    return null
  }

  return local.getItem(key)
}

export const authPersistenceStorage = {
  getItem(key: string): string | null {
    if (persistenceMode === 'session') {
      return getSessionStorage()?.getItem(key) ?? null
    }
    return getPersistentItem(key)
  },

  setItem(key: string, value: string): void {
    if (persistenceMode === 'session') {
      const session = requireStorage(getSessionStorage(), 'de session')
      session.setItem(key, value)
      try {
        getLocalStorage()?.removeItem(key)
      } catch (error) {
        session.removeItem(key)
        throw error
      }
      return
    }

    const local = requireStorage(getLocalStorage(), 'local')
    local.setItem(key, value)
    getSessionStorage()?.removeItem(key)
  },

  removeItem(key: string): void {
    getLocalStorage()?.removeItem(key)
    getSessionStorage()?.removeItem(key)
  },
}
