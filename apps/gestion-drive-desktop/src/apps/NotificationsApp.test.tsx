// Tests du centre de notifications en mode panneau (mock navigateur).

import { beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import NotificationsApp, { formatNotificationTime } from './NotificationsApp'
import { __resetBrowserMocks, sendNotification } from '../api/notificationsClient'

beforeEach(() => {
  cleanup()
  __resetBrowserMocks()
})

describe('NotificationsApp — centre de notifications (panneau)', () => {
  it('affiche un état vide sans notification', async () => {
    render(<NotificationsApp />)
    await waitFor(() => {
      expect(screen.getByText('Aucune notification.')).toBeTruthy()
    })
    expect(
      (screen.getByRole('button', { name: 'Tout marquer comme lu' }) as HTMLButtonElement).disabled
    ).toBe(true)
    expect((screen.getByRole('button', { name: 'Vider' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("liste l'historique avec titre, corps, module et compteur non lus", async () => {
    await sendNotification('drive', 'Conflit détecté', '1 fichier en conflit')
    await sendNotification('mail', 'Nouveau message')

    render(<NotificationsApp />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Notifications (2)' })).toBeTruthy()
    })
    expect(screen.getByText('Conflit détecté')).toBeTruthy()
    expect(screen.getByText('1 fichier en conflit')).toBeTruthy()
    expect(screen.getByText(/Drive ·/)).toBeTruthy()
    expect(screen.getByText(/Mail ·/)).toBeTruthy()
  })

  it('marque une notification comme lue au clic', async () => {
    await sendNotification('drive', 'Sync terminée')
    render(<NotificationsApp />)

    await waitFor(() => {
      expect(screen.getByText('Sync terminée')).toBeTruthy()
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Sync terminée'))
    })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Notifications' })).toBeTruthy()
    })
  })

  it('"Tout marquer comme lu" remet le compteur à zéro', async () => {
    await sendNotification('pulse', 'A')
    await sendNotification('todo', 'B')
    render(<NotificationsApp />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Notifications (2)' })).toBeTruthy()
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tout marquer comme lu' }))
    })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Notifications' })).toBeTruthy()
    })
  })

  it('"Vider" efface l\'historique', async () => {
    await sendNotification('system', 'Test')
    render(<NotificationsApp />)

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeTruthy()
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Vider' }))
    })
    await waitFor(() => {
      expect(screen.getByText('Aucune notification.')).toBeTruthy()
    })
  })
})

describe('formatNotificationTime', () => {
  it("affiche l'heure seule le jour même", () => {
    const now = new Date(2026, 6, 8, 15, 30)
    const sameDay = Math.floor(new Date(2026, 6, 8, 9, 5).getTime() / 1000)
    expect(formatNotificationTime(sameDay, now)).toBe('09:05')
  })

  it('préfixe la date pour un autre jour', () => {
    const now = new Date(2026, 6, 8, 15, 30)
    const yesterday = Math.floor(new Date(2026, 6, 7, 9, 5).getTime() / 1000)
    expect(formatNotificationTime(yesterday, now)).toMatch(/^07\/07\/2026 09:05$/)
  })
})
