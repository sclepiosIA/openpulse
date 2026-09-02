import { render, screen } from '@testing-library/react'
import { PresenceAvatars, type PresenceUser } from './PresenceAvatars'
import React from 'react'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: Array<string | false | null | undefined>) => inputs.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const USERS: PresenceUser[] = [
  { user_id: 'u1', user_name: 'Alice Dupont', user_avatar: null, user_color: '#ff0000' },
  { user_id: 'u2', user_name: 'Bob', user_avatar: null, user_color: '#00ff00' },
  {
    user_id: 'u3',
    user_name: 'Charlie Martin',
    user_avatar: 'https://example.com/c.png',
    user_color: '#0000ff',
  },
  { user_id: 'u4', user_name: 'Diane Roy', user_avatar: null, user_color: '#ffff00' },
  { user_id: 'u5', user_name: 'Eve Noir', user_avatar: null, user_color: '#ff00ff' },
]

describe('PresenceAvatars', () => {
  it('ne rend rien quand la liste des utilisateurs est vide', () => {
    const { container } = render(<PresenceAvatars users={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('affiche les initiales des utilisateurs visibles (défaut max=3)', () => {
    render(<PresenceAvatars users={USERS.slice(0, 2)} />)
    // Alice Dupont → AD (première + dernière partie)
    expect(screen.getByText('AD')).toBeTruthy()
    // Bob → BO (nom unique, 2 premières lettres)
    expect(screen.getByText('BO')).toBeTruthy()
  })

  it('affiche un aria-label avec le nombre total d’utilisateurs', () => {
    render(<PresenceAvatars users={USERS} />)
    expect(screen.getByLabelText('5 utilisateur(s) en ligne')).toBeTruthy()
  })

  it('affiche le badge de dépassement +N avec les noms restants dans le tooltip', () => {
    render(<PresenceAvatars users={USERS} max={3} />)
    // 5 utilisateurs, 3 visibles → +2
    expect(screen.getByText('+2')).toBeTruthy()
    expect(screen.getByText('Diane Roy, Eve Noir')).toBeTruthy()
  })

  it('n’affiche pas de badge de dépassement quand users.length <= max', () => {
    render(<PresenceAvatars users={USERS.slice(0, 3)} max={3} />)
    expect(screen.queryByText(/^\+\d+$/)).toBeNull()
  })

  it('affiche une image quand user_avatar est défini', () => {
    render(<PresenceAvatars users={[USERS[2]]} />)
    const img = screen.getByAltText('Charlie Martin')
    expect(img.getAttribute('src')).toBe('https://example.com/c.png')
    // Pas d'initiales pour cet utilisateur
    expect(screen.queryByText('CM')).toBeNull()
  })

  it('applique la couleur utilisateur en background sur l’avatar', () => {
    render(<PresenceAvatars users={[USERS[0]]} />)
    const avatar = screen.getByText('AD')
    expect(avatar.getAttribute('style')).toContain('background-color: rgb(255, 0, 0)')
  })

  it('applique opacity-60 quand isConnected=false', () => {
    render(<PresenceAvatars users={[USERS[0]]} isConnected={false} />)
    const wrapper = screen.getByLabelText('1 utilisateur(s) en ligne')
    expect(wrapper.className).toContain('opacity-60')
  })

  it('n’applique pas opacity-60 quand isConnected=true (défaut)', () => {
    render(<PresenceAvatars users={[USERS[0]]} />)
    const wrapper = screen.getByLabelText('1 utilisateur(s) en ligne')
    expect(wrapper.className).not.toContain('opacity-60')
  })

  it('respecte un max personnalisé', () => {
    render(<PresenceAvatars users={USERS} max={1} />)
    expect(screen.getByText('AD')).toBeTruthy()
    expect(screen.getByText('+4')).toBeTruthy()
    expect(screen.getByText('Bob, Charlie Martin, Diane Roy, Eve Noir')).toBeTruthy()
  })

  it('propage la prop className sur le conteneur', () => {
    render(<PresenceAvatars users={[USERS[0]]} className="ma-classe" />)
    const wrapper = screen.getByLabelText('1 utilisateur(s) en ligne')
    expect(wrapper.className).toContain('ma-classe')
  })
})
