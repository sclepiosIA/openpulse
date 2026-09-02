import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  resetPwaSession: vi.fn(),
  getPreferences: vi.fn(),
  setPreferences: vi.fn(),
  sendNotification: vi.fn(),
}))

vi.mock('../api/driveClient', () => ({
  logout: mocks.logout,
  resetPwaSession: mocks.resetPwaSession,
}))

vi.mock('../api/updaterClient', () => ({
  checkForGestionDesktopUpdate: vi.fn(),
  getGestionUpdateHistory: vi.fn().mockResolvedValue(null),
}))

vi.mock('../api/notificationsClient', () => ({
  getPreferences: mocks.getPreferences,
  setPreferences: mocks.setPreferences,
  sendNotification: mocks.sendNotification,
  minutesToTime: (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
  timeToMinutes: (value: string) => {
    const [hours, minutes] = value.split(':').map(Number)
    return hours * 60 + minutes
  },
  MODULE_LABELS: { pulse: 'Pulse', mail: 'Mail', todo: 'Todo', drive: 'Drive' },
}))

import PreferencesApp from './PreferencesApp'
import { useAppStore } from '../state/store'

const preferences = {
  notifications: { pulse: true, mail: true, todo: true, drive: true },
  do_not_disturb: {
    enabled: false,
    schedule_enabled: false,
    start_minutes: 0,
    end_minutes: 0,
  },
  launch_at_login: false,
  sync_paused: false,
  drive_auto_connect: true,
  poll_interval_secs: 60,
}

beforeEach(() => {
  mocks.logout.mockReset()
  mocks.resetPwaSession.mockReset()
  mocks.getPreferences.mockReset().mockResolvedValue(preferences)
  mocks.setPreferences.mockReset().mockImplementation(async (value) => value)
  mocks.sendNotification.mockReset().mockResolvedValue(undefined)
  useAppStore.setState({
    activeApp: 'preferences',
    screen: 'status',
    panelOpen: true,
    session: {
      user_email: 'utilisateur@gsi.fr',
      display_name: 'Utilisateur',
      device_registered: true,
    },
    config: null,
    spaces: [],
    selectedSpaceIds: [],
  })
})

afterEach(() => {
  cleanup()
})

describe('PreferencesApp — cycle de déconnexion', () => {
  it('purge toujours l’état UI même si le natif signale une erreur de persistance', async () => {
    mocks.logout.mockRejectedValue(new Error('préférence non persistée'))
    render(<PreferencesApp />)

    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))

    await waitFor(() => {
      expect(useAppStore.getState().session).toBeNull()
      expect(useAppStore.getState().activeApp).toBe('drive')
    })
    expect(screen.getByRole('alert').textContent).toContain('préférence non persistée')
  })

  it('nomme la cadence selon sa fonction réelle de synchronisation Drive', async () => {
    render(<PreferencesApp />)
    expect(await screen.findByText('Synchroniser Drive toutes les')).toBeTruthy()
  })
})
