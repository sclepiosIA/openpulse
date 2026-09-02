// @vitest-environment jsdom

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileMessageItem } from './MobileMessageItem'

const {
  sanitizeDisplayNameMock,
  formatDistanceToNowMock,
  badgeCalls,
  emailAvatarCalls,
} = vi.hoisted(() => ({
  sanitizeDisplayNameMock: vi.fn((name: string) => `sanitized:${name}`),
  formatDistanceToNowMock: vi.fn(() => 'il y a 5 minutes'),
  badgeCalls: [] as Array<{ variant?: string; className?: string }>,
  emailAvatarCalls: [] as Array<{ name: string; email: string; size: string }>,
}))

vi.mock('@/lib/emailUtils', () => ({
  sanitizeDisplayName: sanitizeDisplayNameMock,
}))

vi.mock('date-fns', () => ({
  formatDistanceToNow: formatDistanceToNowMock,
}))

vi.mock('date-fns/locale', () => ({
  fr: { code: 'fr' },
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode
    variant?: string
    className?: string
  }) => {
    badgeCalls.push({ variant, className })
    return (
      <div data-testid="badge" data-variant={variant} className={className}>
        {children}
      </div>
    )
  },
}))

vi.mock('./EmailAvatar', () => ({
  EmailAvatar: ({ name, email, size }: { name: string; email: string; size: string }) => {
    emailAvatarCalls.push({ name, email, size })
    return (
      <div data-testid="email-avatar" data-name={name} data-email={email} data-size={size}>
        avatar
      </div>
    )
  },
}))

vi.mock('lucide-react', () => ({
  Paperclip: ({ className }: { className?: string }) => (
    <svg data-testid="paperclip-icon" className={className}>
      paperclip
    </svg>
  ),
  ChevronDown: ({ className }: { className?: string }) => (
    <svg data-testid="chevron-icon" className={className}>
      chevron
    </svg>
  ),
}))

describe('MobileMessageItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    badgeCalls.length = 0
    emailAvatarCalls.length = 0
    formatDistanceToNowMock.mockReturnValue('il y a 5 minutes')
    sanitizeDisplayNameMock.mockImplementation((name: string) => `sanitized:${name}`)
  })

  it('affiche le nom en Title Case quand from_name est en majuscules, tronque le body_text, affiche la date et les pièces jointes', () => {
    const onClick = vi.fn()
    const message = {
      from_name: 'JEAN DUPONT',
      from_address: 'jean@example.com',
      body_text:
        'Bonjour ceci est un message assez long pour vérifier que le texte est tronqué correctement après quatre-vingts caractères exactement ou presque.',
      body_html: '<p>Ignoré car body_text existe</p>',
      sent_date: '2024-01-02T10:00:00.000Z',
      has_attachments: true,
      attachments_count: 3,
    }

    const { container } = render(
      <MobileMessageItem message={message} isExpanded={false} onClick={onClick} />
    )

    expect(screen.getByText('Jean Dupont')).toBeInTheDocument()
    expect(sanitizeDisplayNameMock).not.toHaveBeenCalled()

    expect(screen.getByTestId('email-avatar')).toHaveAttribute('data-name', 'Jean Dupont')
    expect(screen.getByTestId('email-avatar')).toHaveAttribute('data-email', 'jean@example.com')
    expect(screen.getByTestId('email-avatar')).toHaveAttribute('data-size', 'md')
    expect(emailAvatarCalls[0]).toEqual({
      name: 'Jean Dupont',
      email: 'jean@example.com',
      size: 'md',
    })

    expect(screen.getByText('il y a 5 minutes')).toBeInTheDocument()
    expect(formatDistanceToNowMock).toHaveBeenCalledTimes(1)
    expect(formatDistanceToNowMock.mock.calls[0][0]).toBeInstanceOf(Date)
    expect((formatDistanceToNowMock.mock.calls[0][0] as Date).toISOString()).toBe('2024-01-02T10:00:00.000Z')
    expect(formatDistanceToNowMock.mock.calls[0][1]).toMatchObject({
      addSuffix: false,
      locale: { code: 'fr' },
    })

    const expectedPreview =
      'Bonjour ceci est un message assez long pour vérifier que le texte est tronqué co...'
    expect(screen.getByText(expectedPreview)).toBeInTheDocument()

    expect(screen.getByTestId('badge')).toHaveAttribute('data-variant', 'outline')
    expect(screen.getByTestId('badge')).toHaveTextContent('3')
    expect(screen.getByTestId('paperclip-icon')).toBeInTheDocument()
    expect(badgeCalls[0]).toMatchObject({ variant: 'outline' })

    const root = container.firstElementChild
    expect(root?.className).toContain('hover:bg-accent/20')
    expect(root?.className).not.toContain('bg-accent/30')

    fireEvent.click(root as Element)
    expect(onClick).toHaveBeenCalledTimes(1)

    expect(screen.getByTestId('chevron-icon')).not.toHaveClass('rotate-180')
  })

  it('utilise sanitizeDisplayName pour un nom non majuscule, extrait le preview depuis le HTML, affiche le point bleu interne et le chevron retourné si expanded', () => {
    const onClick = vi.fn()
    const message = {
      from_name: 'jane DOE',
      from_address: 'jane@example.com',
      body_text: '',
      body_html:
        '<style>.x{color:red}</style><div>Hello <strong>world</strong><img src="x" /> and <em>team</em></div>',
      sent_date: '2024-03-10T08:30:00.000Z',
      has_attachments: false,
      attachments_count: 0,
    }

    const { container } = render(
      <MobileMessageItem
        message={message}
        isExpanded={true}
        onClick={onClick}
        isExternal={false}
      />
    )

    expect(sanitizeDisplayNameMock).toHaveBeenCalledWith('jane DOE')
    expect(screen.getByText('sanitized:jane DOE')).toBeInTheDocument()
    expect(screen.getByText('Hello world and team')).toBeInTheDocument()

    const root = container.firstElementChild
    expect(root?.className).toContain('bg-accent/30')
    expect(screen.getByTestId('chevron-icon')).toHaveClass('rotate-180')

    expect(container.querySelector('.bg-blue-500.rounded-full')).toBeTruthy()
    expect(screen.queryByTestId('badge')).not.toBeInTheDocument()

    fireEvent.click(root as Element)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("utilise la partie locale de l'email si from_name est null et n'affiche pas Inconnu", () => {
    const message = {
      from_name: null,
      from_address: 'localpart@example.com',
      body_text: 'Petit message',
      body_html: '',
      sent_date: '2024-04-01T09:00:00.000Z',
      has_attachments: false,
      attachments_count: 0,
    }

    render(<MobileMessageItem message={message} isExpanded={false} onClick={vi.fn()} />)

    expect(screen.getByText('localpart')).toBeInTheDocument()
    expect(screen.queryByText('Inconnu')).not.toBeInTheDocument()
    expect(sanitizeDisplayNameMock).not.toHaveBeenCalled()
    expect(screen.getByText('Petit message')).toBeInTheDocument()
  })

  it('utilise 1 par défaut pour le compteur de pièces jointes quand attachments_count est absent', () => {
    const message = {
      from_name: 'ALICE MARTIN',
      from_address: 'alice@example.com',
      body_text: 'Contenu',
      body_html: '',
      sent_date: '2024-05-01T12:00:00.000Z',
      has_attachments: true,
    }

    render(<MobileMessageItem message={message} isExpanded={false} onClick={vi.fn()} />)

    expect(screen.getByTestId('badge')).toBeInTheDocument()
    expect(screen.getByTestId('badge')).toHaveTextContent('1')
  })
})