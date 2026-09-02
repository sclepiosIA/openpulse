// Tests du client API mock (mode navigateur) — logique métier UI.

import { describe, expect, it, vi } from 'vitest'
import {
  clearSyncLogs,
  exportSyncLogs,
  getSyncLogs,
  isConfirmedSessionRevocation,
  loginWithDriveSession,
  logout,
  listSpaces,
  MOCK_SPACES,
  runPullSync,
  runPushSync,
  selectSpaces,
} from '../api/driveClient'
import { isSpaceSyncable } from '../api/types'

describe('session Gestion MFA', () => {
  it('accepte une session Drive dédiée sans demander le mot de passe', async () => {
    const session = await loginWithDriveSession({
      accessToken: 'drive-access-token-long-enough',
      refreshToken: 'drive-refresh-token-opaque-long-enough',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      userEmail: 'session@gsi.fr',
      displayName: 'Session Gestion',
    })
    expect(session).toMatchObject({
      user_email: 'session@gsi.fr',
      display_name: 'Session Gestion',
      device_registered: true,
    })
  })

  it('refuse un jeton Drive vide', async () => {
    await expect(
      loginWithDriveSession({
        accessToken: '  ',
        refreshToken: 'drive-refresh-token-opaque-long-enough',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        userEmail: 'session@gsi.fr',
        displayName: 'Session Gestion',
      })
    ).rejects.toThrow('Jeton Drive requis')
  })
})

describe('session persistence', () => {
  it('ne déconnecte que sur une révocation confirmée par le refresh', () => {
    expect(isConfirmedSessionRevocation('SESSION_REVOKED: Session Desktop révoquée')).toBe(true)
    expect(isConfirmedSessionRevocation('HTTP 401 Unauthorized')).toBe(false)
    expect(isConfirmedSessionRevocation('Session expirée : reconnectez-vous')).toBe(false)
    expect(isConfirmedSessionRevocation('API Drive inaccessible: offline')).toBe(false)
  })

  it('un logout explicite désactive immédiatement le pont de reconnexion PWA', async () => {
    const disabled = vi.fn()
    window.addEventListener('gestion-desktop-drive-auth-disabled', disabled)
    await logout()
    window.removeEventListener('gestion-desktop-drive-auth-disabled', disabled)
    expect(disabled).toHaveBeenCalledTimes(1)
  })
})

describe('spaces (mock)', () => {
  it('retourne les 4 espaces de démo', async () => {
    const spaces = await listSpaces()
    expect(spaces).toHaveLength(4)
    expect(spaces.map((s) => s.slug)).toContain('dpo-preuves')
  })

  it("l'espace DPO est web_only et non synchronisable", () => {
    const dpo = MOCK_SPACES.find((s) => s.slug === 'dpo-preuves')!
    expect(dpo.sync_policy).toBe('web_only')
    expect(isSpaceSyncable(dpo)).toBe(false)
  })

  it('selectSpaces filtre les espaces web_only', async () => {
    const ids = MOCK_SPACES.map((s) => s.id) // tente de tout sélectionner
    const kept = await selectSpaces(ids)
    expect(kept).toHaveLength(3) // le DPO web_only est exclu
    expect(kept).not.toContain('33333333-3333-3333-3333-333333333333')
  })
})

describe('sync logs (mock)', () => {
  it('journalise pull/push, exporte puis vide le diagnostic', async () => {
    await clearSyncLogs()
    await expect(exportSyncLogs()).rejects.toThrow('Journal vide')

    await runPullSync()
    await runPushSync()

    const logs = await getSyncLogs(10)
    expect(logs).toHaveLength(2)
    expect(logs[0]).toMatchObject({ level: 'info', scope: 'push' })
    expect(logs[1]).toMatchObject({ level: 'info', scope: 'pull' })
    expect(await exportSyncLogs()).toBe('journal-mock://gestion-drive-sync.log')

    await clearSyncLogs()
    expect(await getSyncLogs()).toEqual([])
  })
})
