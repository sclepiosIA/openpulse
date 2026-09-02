import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTH_PERSISTENCE_DEADLINE_KEY,
  AUTH_PERSISTENCE_DURATION_MS,
  authPersistenceStorage,
  configureAuthSessionPersistence,
} from '@/lib/authPersistenceStorage'

describe('authPersistenceStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-25T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stores a 30-day persistent session in localStorage', () => {
    configureAuthSessionPersistence(true)
    authPersistenceStorage.setItem('supabase-token', 'persistent-token')

    expect(localStorage.getItem('supabase-token')).toBe('persistent-token')
    expect(sessionStorage.getItem('supabase-token')).toBeNull()
    expect(Number(localStorage.getItem(AUTH_PERSISTENCE_DEADLINE_KEY))).toBe(
      Date.now() + AUTH_PERSISTENCE_DURATION_MS
    )
  })

  it('purge immédiatement un ancien jeton persistant lors du passage en session temporaire', () => {
    localStorage.setItem('sb-instance-auth-token', 'old-persistent-token')
    localStorage.setItem('unrelated-preference', 'keep')

    configureAuthSessionPersistence(false)

    expect(localStorage.getItem('sb-instance-auth-token')).toBeNull()
    expect(localStorage.getItem('unrelated-preference')).toBe('keep')
  })

  it('stores a non-persistent session only in sessionStorage', () => {
    localStorage.setItem('supabase-token', 'old-persistent-token')

    configureAuthSessionPersistence(false)
    authPersistenceStorage.setItem('supabase-token', 'session-token')

    expect(sessionStorage.getItem('supabase-token')).toBe('session-token')
    expect(localStorage.getItem('supabase-token')).toBeNull()
    expect(localStorage.getItem(AUTH_PERSISTENCE_DEADLINE_KEY)).toBeNull()
  })

  it('expires newly persistent sessions after 30 days', () => {
    configureAuthSessionPersistence(true)
    authPersistenceStorage.setItem('supabase-token', 'persistent-token')

    vi.advanceTimersByTime(AUTH_PERSISTENCE_DURATION_MS + 1)

    expect(authPersistenceStorage.getItem('supabase-token')).toBeNull()
    expect(localStorage.getItem('supabase-token')).toBeNull()
    expect(localStorage.getItem(AUTH_PERSISTENCE_DEADLINE_KEY)).toBeNull()
  })

  it('refuse et purge une session persistante sans échéance explicite', () => {
    configureAuthSessionPersistence(true)
    localStorage.setItem('supabase-token', 'legacy-token')
    localStorage.removeItem(AUTH_PERSISTENCE_DEADLINE_KEY)

    expect(authPersistenceStorage.getItem('supabase-token')).toBeNull()
    expect(localStorage.getItem('supabase-token')).toBeNull()
  })

  it('refuse et purge une session persistante avec une échéance invalide', () => {
    configureAuthSessionPersistence(true)
    localStorage.setItem('supabase-token', 'invalid-token')
    localStorage.setItem(AUTH_PERSISTENCE_DEADLINE_KEY, 'not-a-timestamp')

    expect(authPersistenceStorage.getItem('supabase-token')).toBeNull()
    expect(localStorage.getItem('supabase-token')).toBeNull()
    expect(localStorage.getItem(AUTH_PERSISTENCE_DEADLINE_KEY)).toBeNull()
  })

  it('removes a session from both storage scopes', () => {
    localStorage.setItem('supabase-token', 'persistent-token')
    sessionStorage.setItem('supabase-token', 'session-token')

    authPersistenceStorage.removeItem('supabase-token')

    expect(localStorage.getItem('supabase-token')).toBeNull()
    expect(sessionStorage.getItem('supabase-token')).toBeNull()
  })
})
