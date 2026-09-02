import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage'

const resetStore = async () => {
  const { useAppStore } = await import('../state/store')
  useAppStore.getState().reset()
}

describe('LoginPage', () => {
  afterEach(async () => {
    cleanup()
    await resetStore()
  })

  it('attend la réactivation native avant de demander la session Gestion', async () => {
    const reconnect = vi.fn().mockResolvedValue(undefined)
    render(<LoginPage onUseGestionSession={reconnect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Utiliser la session Gestion' }))

    await waitFor(() => expect(reconnect).toHaveBeenCalledTimes(1))
  })

  it('ne propose jamais de fallback mot de passe qui contournerait le MFA', () => {
    render(<LoginPage onUseGestionSession={vi.fn()} />)

    expect(screen.queryByRole('textbox')).toBeNull()
    expect(document.querySelector('input[type="password"]')).toBeNull()
    expect(screen.getByText(/authentification multifacteur/i)).toBeTruthy()
  })
})
