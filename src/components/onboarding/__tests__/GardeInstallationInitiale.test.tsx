import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoquer = vi.fn()
const connecter = vi.fn()

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoquer(...args) },
    auth: { signInWithPassword: (...args: unknown[]) => connecter(...args) },
  },
}))

import { GardeInstallationInitiale } from '../GardeInstallationInitiale'

describe('GardeInstallationInitiale', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, '', '/')
    connecter.mockResolvedValue({ error: null })
  })

  it("laisse passer vers la connexion quand l'instance possède déjà un administrateur", async () => {
    invoquer.mockResolvedValue({ data: { installation_requise: false }, error: null })

    render(
      <GardeInstallationInitiale>
        <div>écran de connexion</div>
      </GardeInstallationInitiale>
    )

    expect(await screen.findByText('écran de connexion')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /Créez votre compte administrateur/i })
    ).not.toBeInTheDocument()
  })

  it('affiche un onboarding centré avant la connexion sur une instance vierge', async () => {
    invoquer.mockResolvedValue({ data: { installation_requise: true }, error: null })

    render(
      <GardeInstallationInitiale>
        <div>écran de connexion</div>
      </GardeInstallationInitiale>
    )

    const titre = await screen.findByRole('heading', { name: /Créez votre compte administrateur/i })
    expect(titre).toBeInTheDocument()
    expect(screen.queryByText('écran de connexion')).not.toBeInTheDocument()
    expect(titre.closest('[data-onboarding-card]')).toHaveClass('mx-auto')
  })

  it('crée le premier administrateur puis affiche la connexion sans session transitoire', async () => {
    window.location.hash = 'installation=jeton-activation'
    invoquer
      .mockResolvedValueOnce({ data: { installation_requise: true }, error: null })
      .mockResolvedValueOnce({ data: { success: true }, error: null })

    render(
      <GardeInstallationInitiale>
        <div>écran de connexion</div>
      </GardeInstallationInitiale>
    )

    await screen.findByRole('heading', { name: /Créez votre compte administrateur/i })
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Andréï' } })
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Galindo' } })
    fireEvent.change(screen.getByLabelText('Adresse e-mail'), {
      target: { value: 'admin@openpulse.test' },
    })
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'MotDePasse!2026' },
    })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'MotDePasse!2026' },
    })
    expect(screen.queryByLabelText("Code d'installation")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Créer mon espace OpenPulse/i }))

    await waitFor(() => {
      expect(invoquer).toHaveBeenLastCalledWith('bootstrap-admin', {
        body: {
          action: 'create',
          email: 'admin@openpulse.test',
          password: 'MotDePasse!2026',
          prenom: 'Andréï',
          nom: 'Galindo',
          installation_code: 'jeton-activation',
        },
      })
    })
    expect(connecter).not.toHaveBeenCalled()
    expect(await screen.findByText('écran de connexion')).toBeInTheDocument()
  })

  it('refuse deux mots de passe différents sans appeler le serveur', async () => {
    window.location.hash = 'installation=jeton-activation'
    invoquer.mockResolvedValue({ data: { installation_requise: true }, error: null })

    render(
      <GardeInstallationInitiale>
        <div>écran de connexion</div>
      </GardeInstallationInitiale>
    )

    await screen.findByRole('heading', { name: /Créez votre compte administrateur/i })
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Andréï' } })
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Galindo' } })
    fireEvent.change(screen.getByLabelText('Adresse e-mail'), {
      target: { value: 'admin@openpulse.test' },
    })
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'MotDePasse!2026' },
    })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'different' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Créer mon espace OpenPulse/i }))

    expect(
      await screen.findByText(/Les deux mots de passe doivent être identiques/i)
    ).toBeInTheDocument()
    expect(invoquer).toHaveBeenCalledTimes(1)
  })

  it("guide l'utilisateur quand le lien d'activation est absent", async () => {
    invoquer.mockResolvedValue({ data: { installation_requise: true }, error: null })

    render(
      <GardeInstallationInitiale>
        <div>écran de connexion</div>
      </GardeInstallationInitiale>
    )

    expect(await screen.findByText(/ouvrez le lien d’activation/i)).toBeInTheDocument()
    expect(screen.queryByLabelText("Code d'installation")).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Créer mon espace OpenPulse/i })).toBeDisabled()
  })
})
