import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Le composant importe directement l'asset logo (pas via useInfraUrls)
vi.mock('@/assets/marque/logo.png', () => ({
  default: 'mocked-logo.png',
}))

import { AuthBrandingPanel } from '../AuthBrandingPanel'

/**
 * Ces attentes ont changé avec le panneau lui-même : la maquette de charte
 * remplace les quatre arguments produit à icônes par une accroche et trois
 * mentions. Le test suit ce changement de contenu — il ne l'accompagne pas
 * pour le faire passer.
 */
describe('AuthBrandingPanel', () => {
  it('affiche l’accroche de la charte', () => {
    render(<AuthBrandingPanel />)
    expect(screen.getByText(/Vos données restent/)).toBeInTheDocument()
    expect(screen.getByText(/chez vous\./)).toBeInTheDocument()
  })

  it('affiche les trois mentions', () => {
    render(<AuthBrandingPanel />)
    expect(screen.getByText('instance auto-hébergée')).toBeInTheDocument()
    expect(screen.getByText('aucune télémétrie par défaut')).toBeInTheDocument()
    expect(screen.getByText('licence MIT')).toBeInTheDocument()
  })

  it('ne promet ni chiffrement ni durée de rétention, que la distribution ne garantit pas', () => {
    // Garde-fou : la maquette proposait « chiffrement au repos actif » et
    // « journal d'audit 90 jours ». Ces deux affirmations dépendent de
    // l'installation. Les réintroduire ferait promettre à chaque exploitant,
    // dès son écran de connexion, quelque chose que personne n'a vérifié chez
    // lui.
    const { container } = render(<AuthBrandingPanel />)
    expect(container.textContent).not.toMatch(/chiffrement/i)
    expect(container.textContent).not.toMatch(/\d+\s*jours/i)
  })

  it('affiche le pied de page légal de la maquette', () => {
    render(<AuthBrandingPanel />)
    expect(screen.getByText('Licence MIT')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mentions légales' })).toHaveAttribute(
      'href',
      '/mentions-legales'
    )
    expect(screen.getByRole('link', { name: 'RGPD' })).toHaveAttribute(
      'href',
      '/politique-confidentialite'
    )
  })

  it('affiche le logo', () => {
    render(<AuthBrandingPanel />)
    expect(screen.getByRole('img', { name: 'OpenPulse' })).toBeInTheDocument()
  })
})
