/**
 * La garde décide qui voit l'assistant. Chacun de ses trois cas a une raison,
 * et chacun est vérifié ici — le troisième surtout, qui est contre-intuitif :
 * quand l'état de configuration n'a pas pu être lu, on laisse passer plutôt que
 * d'ouvrir l'assistant, car le rouvrir sur une instance déjà configurée
 * écraserait des réglages en place.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const etatConfiguration = vi.fn()
const etatRole = vi.fn()

vi.mock('@/hooks/shared/useConfigurationInstance', () => ({
  useConfigurationInstance: () => etatConfiguration(),
  CLE_INSTANCE_CONFIGUREE: 'instance_configuree',
  VERSION_ASSISTANT: 1,
}))

vi.mock('@/hooks/shared/useUserRole', () => ({
  useUserRole: () => etatRole(),
}))

vi.mock('../AssistantPremierLancement', () => ({
  AssistantPremierLancement: () => <div>assistant de configuration</div>,
}))

vi.mock('@/components/ui/full-page-loader', () => ({
  FullPageLoader: () => <div>chargement</div>,
}))

import { GardePremierLancement } from '../GardePremierLancement'

const enfant = <div>application</div>

describe('GardePremierLancement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    etatRole.mockReturnValue({ role: 'admin', isLoading: false })
  })

  it("présente l'assistant à un administrateur sur une instance neuve", () => {
    etatConfiguration.mockReturnValue({ chargement: false, aConfigurer: true, indetermine: false })
    render(<GardePremierLancement>{enfant}</GardePremierLancement>)
    expect(screen.getByText('assistant de configuration')).toBeInTheDocument()
    expect(screen.queryByText('application')).not.toBeInTheDocument()
  })

  it("n'ouvre pas l'assistant pour un compte sans le rôle d'administrateur", () => {
    // La sécurité au niveau ligne refuserait l'écriture à la dernière étape :
    // lui faire saisir six écrans pour rien serait cruel.
    etatConfiguration.mockReturnValue({ chargement: false, aConfigurer: true, indetermine: false })
    etatRole.mockReturnValue({ role: 'commercial', isLoading: false })
    render(<GardePremierLancement>{enfant}</GardePremierLancement>)
    expect(screen.queryByText('assistant de configuration')).not.toBeInTheDocument()
    expect(screen.getByText(/Configuration en attente/)).toBeInTheDocument()
  })

  it('laisse passer quand l’instance est déjà configurée', () => {
    etatConfiguration.mockReturnValue({ chargement: false, aConfigurer: false, indetermine: false })
    render(<GardePremierLancement>{enfant}</GardePremierLancement>)
    expect(screen.getByText('application')).toBeInTheDocument()
  })

  it("laisse passer quand l'état de configuration n'a pas pu être lu", () => {
    // Le cas contre-intuitif : dans le doute, on n'interrompt pas. Rouvrir
    // l'assistant sur une instance configurée écraserait des réglages en place ;
    // laisser passer ne fait, au pire, que retarder une configuration.
    etatConfiguration.mockReturnValue({ chargement: false, aConfigurer: true, indetermine: true })
    render(<GardePremierLancement>{enfant}</GardePremierLancement>)
    expect(screen.getByText('application')).toBeInTheDocument()
    expect(screen.queryByText('assistant de configuration')).not.toBeInTheDocument()
  })

  it("n'affiche rien tant que l'état ou le rôle sont en cours de lecture", () => {
    etatConfiguration.mockReturnValue({ chargement: true, aConfigurer: false, indetermine: false })
    render(<GardePremierLancement>{enfant}</GardePremierLancement>)
    expect(screen.getByText('chargement')).toBeInTheDocument()
    expect(screen.queryByText('application')).not.toBeInTheDocument()
  })
})
