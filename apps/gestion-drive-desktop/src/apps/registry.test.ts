// Tests du registre de modules et du pont Gestion web.

import { describe, expect, it } from 'vitest'
import {
  APP_DEFINITIONS,
  NOTIFICATIONS_APP,
  PANEL_APP_IDS,
  PREFERENCES_APP,
  getAppDefinition,
  resolveNavigateTarget,
} from './registry'
import { gestionWebUrl } from '../api/desktopApi'

describe('registre des modules', () => {
  it("expose les 6 modules de la sidebar dans l'ordre attendu", () => {
    expect(APP_DEFINITIONS.map((a) => a.id)).toEqual([
      'drive',
      'pulse',
      'mail',
      'todo',
      'calendar',
      'documents',
    ])
  })

  it('Drive est natif (pas de chemin web), les autres pointent vers Gestion web', () => {
    const drive = getAppDefinition('drive')
    expect(drive.webPath).toBeNull()

    const webPaths = APP_DEFINITIONS.filter((a) => a.id !== 'drive').map((a) => a.webPath)
    expect(webPaths).toEqual(['/pulse', '/emails', '/todos', '/calendrier', '/documents'])
  })

  it('Préférences et Notifications sont épinglés hors liste principale', () => {
    expect(APP_DEFINITIONS.some((a) => a.id === 'preferences')).toBe(false)
    expect(APP_DEFINITIONS.some((a) => a.id === 'notifications')).toBe(false)
    expect(getAppDefinition('preferences')).toBe(PREFERENCES_APP)
    expect(getAppDefinition('notifications')).toBe(NOTIFICATIONS_APP)
  })

  it('chaque module a un libellé et une description en français', () => {
    for (const app of [...APP_DEFINITIONS, PREFERENCES_APP, NOTIFICATIONS_APP]) {
      expect(app.label.length).toBeGreaterThan(1)
      expect(app.description.length).toBeGreaterThan(10)
    }
  })
})

describe('panneau natif (shell PWA plein écran)', () => {
  it('seuls Drive, Préférences et Notifications sont des modules panneau', () => {
    expect([...PANEL_APP_IDS]).toEqual(['drive', 'preferences', 'notifications'])
  })

  it('resolveNavigateTarget accepte les payloads tray valides', () => {
    expect(resolveNavigateTarget('drive')).toBe('drive')
    expect(resolveNavigateTarget('preferences')).toBe('preferences')
    expect(resolveNavigateTarget('notifications')).toBe('notifications')
  })

  it('resolveNavigateTarget rejette les payloads inconnus ou non-string', () => {
    expect(resolveNavigateTarget('pulse')).toBeNull()
    expect(resolveNavigateTarget('__proto__')).toBeNull()
    expect(resolveNavigateTarget('')).toBeNull()
    expect(resolveNavigateTarget(42)).toBeNull()
    expect(resolveNavigateTarget(null)).toBeNull()
    expect(resolveNavigateTarget(undefined)).toBeNull()
  })
})

describe('gestionWebUrl', () => {
  it('construit une URL absolue vers Gestion web', () => {
    expect(gestionWebUrl('/pulse')).toMatch(/^https:\/\/.+\/pulse$/)
  })

  it('normalise les chemins sans slash initial', () => {
    expect(gestionWebUrl('todos')).toMatch(/\/todos$/)
    expect(gestionWebUrl('todos')).not.toMatch(/\/\/todos$/)
  })
})
