import type { ComponentProps, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { EtablissementSidePeekContent } from './EtablissementSidePeekContent'

type BasicMockProps = {
  children?: ReactNode
  className?: string
}

const { FULL_ETAB, MINIMAL_ETAB, FALLBACK_CONTACT_ETAB, PROFILES } = vi.hoisted(() => ({
  FULL_ETAB: {
    id: 'etab-1',
    nom: 'Hôpital Central',
    ville: 'Lyon',
    region: 'Auvergne-Rhône-Alpes',
    statut: 'Client',
    logo_url: '/logo.png',
    groupe_logo_url: '/groupe.png',
    progression: 42.6,
    score_conversion: 77.8,
    dpi: 'DPI-2',
    email_contact: 'contact@hop.fr',
    email: 'accueil@hop.fr',
    telephone: '0472000000',
    tel: '0472111111',
    type: 'CHU',
    commercial_id: 'profile-1',
    chef_projet_id: 'profile-2',
    csm_id: 'profile-3',
  },
  MINIMAL_ETAB: {
    id: 'etab-2',
    nom: 'Clinique Simple',
  },
  FALLBACK_CONTACT_ETAB: {
    id: 'etab-3',
    nom: 'Institut Nord',
    progression: 10,
    email: 'nord@hop.fr',
    tel: '0320000000',
  },
  PROFILES: [
    { id: 'profile-1', prenom: 'Alice', nom: 'Martin' },
    { id: 'profile-2', prenom: 'Benoît', nom: 'Leroy' },
    { id: 'profile-3', prenom: '', nom: '' },
  ],
}))

vi.mock('@/components/ui/badge', async () => {
  const React = await import('react')

  return {
    Badge: ({
      children,
      className,
      variant,
    }: BasicMockProps & { variant?: string }) =>
      React.createElement(
        'span',
        { className, 'data-testid': 'badge', 'data-variant': variant },
        children,
      ),
  }
})

vi.mock('@/components/ui/progress', async () => {
  const React = await import('react')

  return {
    Progress: ({ value, className }: { value?: number; className?: string }) =>
      React.createElement('div', {
        className,
        role: 'progressbar',
        'data-testid': 'progress',
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': value ?? 0,
      }),
  }
})

vi.mock('@/components/ui/EntityAvatar', async () => {
  const React = await import('react')

  return {
    EntityAvatar: ({
      name,
      logoUrl,
      size,
      className,
    }: {
      name: string
      logoUrl?: string | null
      size?: string
      className?: string
    }) =>
      React.createElement('div', {
        className,
        'data-testid': 'entity-avatar',
        'data-name': name,
        'data-logo-url': logoUrl ?? '',
        'data-size': size ?? '',
      }),
  }
})

vi.mock('@/components/ui/avatar', async () => {
  const React = await import('react')

  return {
    Avatar: ({ children, className }: BasicMockProps) =>
      React.createElement('div', { className, 'data-testid': 'avatar' }, children),
    AvatarImage: ({ className }: { className?: string; src?: string; alt?: string }) =>
      React.createElement('img', { className, alt: '' }),
    AvatarFallback: ({ children, className }: BasicMockProps) =>
      React.createElement('span', { className, 'data-testid': 'avatar-fallback' }, children),
  }
})

vi.mock('@/components/ui/button', async () => {
  const React = await import('react')

  return {
    Button: ({
      children,
      className,
      asChild,
      size,
      variant,
    }: BasicMockProps & {
      asChild?: boolean
      size?: string
      variant?: string
    }) =>
      React.createElement(
        asChild ? 'span' : 'button',
        {
          className,
          'data-testid': 'button',
          'data-size': size,
          'data-variant': variant,
        },
        children,
      ),
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

type Props = ComponentProps<typeof EtablissementSidePeekContent>

describe('EtablissementSidePeekContent', () => {
  it('affiche les informations métier principales, les KPIs, l’équipe et les actions de contact', () => {
    const etab = FULL_ETAB as unknown as Props['etab']
    const profiles = PROFILES as unknown as NonNullable<Props['profiles']>

    render(<EtablissementSidePeekContent etab={etab} profiles={profiles} />)

    expect(screen.getByRole('heading', { name: 'Hôpital Central' })).toBeInTheDocument()
    expect(screen.getByText('Lyon · Auvergne-Rhône-Alpes')).toBeInTheDocument()
    expect(screen.getByText('Client')).toBeInTheDocument()
    expect(screen.getByText('DPI · DPI-2')).toBeInTheDocument()

    expect(screen.getByText('Progression')).toBeInTheDocument()
    expect(screen.getByText('43%')).toBeInTheDocument()
    expect(screen.getByTestId('progress')).toHaveAttribute('aria-valuenow', '42.6')

    expect(screen.getByText('Score')).toBeInTheDocument()
    expect(screen.getByText('78')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('CHU')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Équipe' })).toBeInTheDocument()
    expect(screen.getByText('Alice Martin')).toBeInTheDocument()
    expect(screen.getByText('Commercial')).toBeInTheDocument()
    expect(screen.getByText('AM')).toBeInTheDocument()
    expect(screen.getByText('Benoît Leroy')).toBeInTheDocument()
    expect(screen.getByText('Chef de projet')).toBeInTheDocument()
    expect(screen.getByText('BL')).toBeInTheDocument()
    expect(screen.getByText('Sans nom')).toBeInTheDocument()
    expect(screen.getByText('CSM')).toBeInTheDocument()
    expect(screen.getByText('SN')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /email/i })).toHaveAttribute(
      'href',
      'mailto:contact@hop.fr',
    )
    expect(screen.getByRole('link', { name: /appeler/i })).toHaveAttribute(
      'href',
      'tel:0472000000',
    )
  })

  it('utilise les valeurs de repli et masque les sections optionnelles quand les données manquent', () => {
    const etab = MINIMAL_ETAB as unknown as Props['etab']

    render(<EtablissementSidePeekContent etab={etab} />)

    expect(screen.getByRole('heading', { name: 'Clinique Simple' })).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByTestId('progress')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getAllByText('—')).toHaveLength(3)

    expect(screen.queryByRole('heading', { name: 'Équipe' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /email/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /appeler/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('badge')).not.toBeInTheDocument()
  })

  it('rend les liens de contact depuis email et tel quand les champs prioritaires sont absents', () => {
    const etab = FALLBACK_CONTACT_ETAB as unknown as Props['etab']

    render(<EtablissementSidePeekContent etab={etab} />)

    expect(screen.getByRole('heading', { name: 'Institut Nord' })).toBeInTheDocument()
    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /email/i })).toHaveAttribute(
      'href',
      'mailto:nord@hop.fr',
    )
    expect(screen.getByRole('link', { name: /appeler/i })).toHaveAttribute(
      'href',
      'tel:0320000000',
    )
  })
})