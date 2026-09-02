import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/components/ui/groupe-badge', () => {
  type GroupeBadgeProps = { type: string }
  const GroupeBadge = ({ type }: GroupeBadgeProps) => (
    <span data-testid="groupe-badge" data-type={type}>Type: {type}</span>
  )
  return { GroupeBadge }
})

vi.mock('@/components/ui/badge', () => {
  type BadgeProps = { children?: React.ReactNode; variant?: string; className?: string }
  const Badge = ({ children, variant }: BadgeProps) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  )
  return { Badge }
})

vi.mock('@/components/ui/button', () => {
  type ButtonProps = { children?: React.ReactNode; variant?: string; size?: string; className?: string }
  const Button = ({ children, variant, size }: ButtonProps) => (
    <button data-testid="button" data-variant={variant} data-size={size}>{children}</button>
  )
  return { Button }
})

vi.mock('@/components/ui/progress', () => {
  type ProgressProps = { value: number; className?: string }
  const Progress = ({ value }: ProgressProps) => (
    <div data-testid="progress" data-value={value} />
  )
  return { Progress }
})

vi.mock('@/components/ui/EntityAvatar', () => {
  type EntityAvatarProps = { name: string; logoUrl?: string | null; size?: string }
  const EntityAvatar = ({ name, logoUrl, size }: EntityAvatarProps) => (
    <div data-testid="entity-avatar" data-name={name} data-url={logoUrl ?? ''} data-size={size ?? ''} />
  )
  return { EntityAvatar }
})

vi.mock('@/hooks/crm/useGroupes', () => ({}))

const { GROUPS } = vi.hoisted(() => ({
  GROUPS: [
    {
      id: 'g1',
      nom: 'Alpha Group',
      logo_url: 'https://example.com/logo1.png',
      type: 'PRIVE',
      region: 'Île-de-France',
      nombre_etablissements: 12,
      progression_moyenne: 42.345,
      modules_deployes: ['Admissions', 'Finance'],
    },
    {
      id: 'g2',
      nom: 'Beta Group',
      logo_url: 'https://example.com/logo2.png',
      type: 'PUBLIC',
      region: null,
      nombre_etablissements: 3,
      progression_moyenne: 8,
      modules_deployes: ['ERP', 'BI', 'CRM', 'HR'],
    },
    {
      id: 'g3',
      nom: 'Gamma Group',
      logo_url: null,
      type: 'ASSOCIATION',
      region: 'Occitanie',
      nombre_etablissements: 0,
      progression_moyenne: 0,
      modules_deployes: [],
    },
  ],
}))

import { GroupesListView } from './GroupesListView'

describe('GroupesListView', () => {
  it('affiche l’état vide quand aucun groupe', () => {
    render(
      <MemoryRouter>
        <GroupesListView groupes={[]} />
      </MemoryRouter>
    )

    expect(screen.getByText('Aucun groupe trouvé')).toBeInTheDocument()
  })

  it('affiche les groupes avec détails, modules, progression et liens', () => {
    render(
      <MemoryRouter>
        <GroupesListView groupes={GROUPS as unknown as any[]} />
      </MemoryRouter>
    )

    // Noms et liens principaux
    const alphaNameLink = screen.getByRole('link', { name: 'Alpha Group' })
    expect(alphaNameLink.getAttribute('href')).toContain('/groupes/g1')

    const betaNameLink = screen.getByRole('link', { name: 'Beta Group' })
    expect(betaNameLink.getAttribute('href')).toContain('/groupes/g2')

    const gammaNameLink = screen.getByRole('link', { name: 'Gamma Group' })
    expect(gammaNameLink.getAttribute('href')).toContain('/groupes/g3')

    // Liens d’action avec aria-label
    const alphaActionLink = screen.getByRole('link', { name: 'Voir le détail du groupe Alpha Group' })
    expect(alphaActionLink.getAttribute('href')).toContain('/groupes/g1')

    const betaActionLink = screen.getByRole('link', { name: 'Voir le détail du groupe Beta Group' })
    expect(betaActionLink.getAttribute('href')).toContain('/groupes/g2')

    const gammaActionLink = screen.getByRole('link', { name: 'Voir le détail du groupe Gamma Group' })
    expect(gammaActionLink.getAttribute('href')).toContain('/groupes/g3')

    // Régions affichées si présentes
    expect(screen.getByText('Île-de-France')).toBeInTheDocument()
    expect(screen.getByText('Occitanie')).toBeInTheDocument()

    // Établissements - vérifier que les valeurs apparaissent
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()

    // Progression (texte formaté)
    expect(screen.getByText('42.3%')).toBeInTheDocument()
    expect(screen.getByText('8.0%')).toBeInTheDocument()
    expect(screen.getByText('0.0%')).toBeInTheDocument()

    // Progress components reçoivent les bonnes valeurs
    const progressEls = screen.getAllByTestId('progress')
    const progressValues = progressEls.map(el => el.getAttribute('data-value'))
    expect(progressValues).toEqual(['42.345', '8', '0'])

    // Modules
    expect(screen.getByText('Admissions')).toBeInTheDocument()
    expect(screen.getByText('Finance')).toBeInTheDocument()
    // Beta: 4 modules -> 2 badges + +2
    expect(screen.getByText('ERP')).toBeInTheDocument()
    expect(screen.getByText('BI')).toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
    // Gamma: aucun module
    expect(screen.getAllByText('Aucun module').length).toBeGreaterThanOrEqual(1)

    // GroupeBadge contient les bons types
    const typeBadges = screen.getAllByTestId('groupe-badge')
    const types = typeBadges.map(el => el.getAttribute('data-type'))
    expect(types).toContain('PRIVE')
    expect(types).toContain('PUBLIC')
    expect(types).toContain('ASSOCIATION')

    // EntityAvatar reçoit bien les props
    const avatars = screen.getAllByTestId('entity-avatar')
    const firstAvatar = avatars[0]
    expect(firstAvatar.getAttribute('data-name')).toBe('Alpha Group')
    expect(firstAvatar.getAttribute('data-url')).toBe('https://example.com/logo1.png')
    expect(firstAvatar.getAttribute('data-size')).toBe('sm')

    const secondAvatar = avatars[1]
    expect(secondAvatar.getAttribute('data-name')).toBe('Beta Group')
    expect(secondAvatar.getAttribute('data-url')).toBe('https://example.com/logo2.png')

    const thirdAvatar = avatars[2]
    expect(thirdAvatar.getAttribute('data-name')).toBe('Gamma Group')
    expect(thirdAvatar.getAttribute('data-url')).toBe('')
  })
})