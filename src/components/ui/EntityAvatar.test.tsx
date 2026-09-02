/* @vitest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { EntityAvatar } from './EntityAvatar'

const {
  mockUseEmailSenderLogo,
  mockUseProfileAvatarByEmail,
  mockIsMarqueEmail,
  mockCn,
  MARQUE_LOGO,
} = vi.hoisted(() => ({
  mockUseEmailSenderLogo: vi.fn(),
  mockUseProfileAvatarByEmail: vi.fn(),
  mockIsMarqueEmail: vi.fn(),
  mockCn: vi.fn((...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' ')
  ),
  MARQUE_LOGO: '/mocked/placeholder.svg',
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="avatar-root" className={className}>
      {children}
    </div>
  ),
  AvatarImage: ({ src, alt, className }: { src?: string; alt?: string; className?: string }) => (
    <img data-testid="avatar-image" src={src} alt={alt} className={className} />
  ),
  AvatarFallback: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="avatar-fallback" className={className}>
      {children}
    </div>
  ),
}))

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}))

vi.mock('@/assets/marque/logo.png', () => ({
  default: MARQUE_LOGO,
}))

vi.mock('@/hooks/email/useEmailSenderLogo', () => ({
  useEmailSenderLogo: mockUseEmailSenderLogo,
}))

vi.mock('@/hooks/profile/useProfileAvatarByEmail', () => ({
  useProfileAvatarByEmail: mockUseProfileAvatarByEmail,
}))

vi.mock('@/lib/internalEmailConfig', () => ({
  isMarqueEmail: mockIsMarqueEmail,
}))

describe('EntityAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCn.mockImplementation((...classes: Array<string | false | null | undefined>) =>
      classes.filter(Boolean).join(' ')
    )
    mockUseEmailSenderLogo.mockReturnValue({ data: null })
    mockUseProfileAvatarByEmail.mockReturnValue({ data: null })
    mockIsMarqueEmail.mockReturnValue(false)
  })

  it("affiche les initiales et les classes de taille quand aucun logo n'est disponible", () => {
    render(<EntityAvatar name="Jean Dupont" size="lg" className="custom-class" />)

    expect(screen.queryByTestId('avatar-image')).toBeNull()

    const fallback = screen.getByTestId('avatar-fallback')
    expect(fallback).toHaveTextContent('JD')
    expect(fallback.className).toContain('text-white font-medium')

    const root = screen.getByTestId('avatar-root')
    expect(root.className).toContain('h-12 w-12 text-base')
    expect(root.className).toContain('custom-class')

    expect(mockUseProfileAvatarByEmail).toHaveBeenCalledWith(undefined)
    expect(mockUseEmailSenderLogo).toHaveBeenCalledWith(undefined)
  })

  it("affiche l'avatar de profil interne en priorité et utilise le displayName comme alt", () => {
    mockIsMarqueEmail.mockReturnValue(true)
    mockUseProfileAvatarByEmail.mockReturnValue({
      data: {
        profileId: 'p1',
        avatarUrl: 'https://cdn.test/profile.png',
        displayName: 'Dr House',
      },
    })
    mockUseEmailSenderLogo.mockReturnValue({
      data: {
        logoUrl: 'https://cdn.test/sender-logo.png',
        entityName: 'Sender Corp',
      },
    })

    render(
      <EntityAvatar
        name="Maison Grise"
        email="doctor@marque.fr"
        logoUrl="https://cdn.test/prop-logo.png"
      />
    )

    const img = screen.getByTestId('avatar-image')
    expect(img).toHaveAttribute('src', 'https://cdn.test/profile.png')
    expect(img).toHaveAttribute('alt', 'Dr House')
    expect(img.className).toContain('object-cover')
    expect(img.className).not.toContain('p-1 bg-plaque')

    expect(mockUseProfileAvatarByEmail).toHaveBeenCalledWith('doctor@marque.fr')
    expect(mockUseEmailSenderLogo).toHaveBeenCalledWith('doctor@marque.fr')
  })

  it('affiche le logo OpenPulse pour un membre interne sans avatar personnel', () => {
    mockIsMarqueEmail.mockReturnValue(true)
    mockUseProfileAvatarByEmail.mockReturnValue({ data: null })

    render(<EntityAvatar name="Equipe Support" email="support@marque.fr" />)

    const img = screen.getByTestId('avatar-image')
    expect(img).toHaveAttribute('src', MARQUE_LOGO)
    expect(img).toHaveAttribute('alt', 'OpenPulse')
    expect(img.className).toContain('object-cover')
    expect(img.className).toContain('p-1 bg-plaque')
  })

  it('utilise internalProfileAvatarUrl et évite la requête de profil dupliquée', () => {
    mockIsMarqueEmail.mockReturnValue(true)

    render(
      <EntityAvatar
        name="Marie Curie"
        email="marie@marque.fr"
        internalProfileAvatarUrl="https://cdn.test/already-known.png"
      />
    )

    const img = screen.getByTestId('avatar-image')
    expect(img).toHaveAttribute('src', 'https://cdn.test/already-known.png')
    expect(img).toHaveAttribute('alt', 'Marie Curie')

    expect(mockUseProfileAvatarByEmail).toHaveBeenCalledWith(undefined)
  })

  it("considère un mapping de profil comme interne même si le domaine ne l'est pas", () => {
    mockIsMarqueEmail.mockReturnValue(false)
    mockUseProfileAvatarByEmail.mockReturnValue({
      data: {
        profileId: 'mapped-profile',
        avatarUrl: null,
        displayName: 'Mapped User',
      },
    })

    render(
      <EntityAvatar
        name="External Member"
        email="member@gmail.com"
        logoUrl="https://cdn.test/org-logo.png"
      />
    )

    const img = screen.getByTestId('avatar-image')
    expect(img).toHaveAttribute('src', 'https://cdn.test/org-logo.png')
    expect(img).toHaveAttribute('alt', 'OpenPulse')
    expect(img.className).toContain('p-1 bg-plaque')
  })

  it('utilise le logo fourni en prop pour une entité externe', () => {
    mockIsMarqueEmail.mockReturnValue(false)
    mockUseProfileAvatarByEmail.mockReturnValue({ data: null })
    mockUseEmailSenderLogo.mockReturnValue({
      data: {
        logoUrl: 'https://cdn.test/domain-logo.png',
        entityName: 'Domain Entity',
      },
    })

    render(
      <EntityAvatar
        name="Hopital Externe"
        email="contact@external.org"
        logoUrl="https://cdn.test/prop-logo.png"
      />
    )

    const img = screen.getByTestId('avatar-image')
    expect(img).toHaveAttribute('src', 'https://cdn.test/prop-logo.png')
    expect(img).toHaveAttribute('alt', 'Hopital Externe')
    expect(img.className).not.toContain('p-1 bg-plaque')
  })

  it("utilise le logo récupéré par mapping email quand aucun logo en prop n'existe", () => {
    mockUseEmailSenderLogo.mockReturnValue({
      data: {
        logoUrl: 'https://cdn.test/mapped-logo.png',
        entityName: 'Mapped Clinic',
      },
    })

    render(<EntityAvatar name="Clinique Inconnue" email="hello@clinic.example" />)

    const img = screen.getByTestId('avatar-image')
    expect(img).toHaveAttribute('src', 'https://cdn.test/mapped-logo.png')
    expect(img).toHaveAttribute('alt', 'Mapped Clinic')
  })

  it('applique les classes de surbrillance quand isUnread est true', () => {
    render(<EntityAvatar name="Alice Martin" isUnread />)

    const root = screen.getByTestId('avatar-root')
    const fallback = screen.getByTestId('avatar-fallback')

    expect(root.className).toContain('ring-2 ring-primary ring-offset-2 ring-offset-background')
    expect(fallback.className).toContain('ring-2 ring-primary ring-offset-2 ring-offset-background')
  })

  it("force le style interne même si le domaine n'est pas interne", () => {
    mockIsMarqueEmail.mockReturnValue(false)
    mockUseProfileAvatarByEmail.mockReturnValue({ data: null })

    render(<EntityAvatar name="Membre Gmail" email="member@gmail.com" forceInternal />)

    const img = screen.getByTestId('avatar-image')
    expect(img).toHaveAttribute('src', MARQUE_LOGO)
    expect(img).toHaveAttribute('alt', 'OpenPulse')
  })

  it('calcule correctement les initiales pour un nom simple', () => {
    render(<EntityAvatar name="plato" />)

    expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('PL')
  })
})
