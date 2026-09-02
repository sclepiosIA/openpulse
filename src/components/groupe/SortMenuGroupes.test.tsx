import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { routerState, mockSetSearchParams } = vi.hoisted(() => {
  const routerState = {
    params: new URLSearchParams(),
    setCalls: [],
  }
  const mockSetSearchParams = vi.fn((p) => {
    // Record call
    routerState.setCalls.push(p)
    // Keep latest params to allow assertions
    if (p instanceof URLSearchParams) {
      routerState.params = p
    }
  })
  return { routerState, mockSetSearchParams }
})

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [routerState.params, mockSetSearchParams],
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children, ...props }) => (
    <div role="menu" {...props}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({ children, onClick, className }) => (
    <button role="menuitem" className={className} onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}))

vi.mock('lucide-react', () => ({
  ArrowUpDown: (props) => <span aria-hidden="true" {...props} />,
  ArrowUp: (props) => <span aria-hidden="true" {...props} />,
  ArrowDown: (props) => <span aria-hidden="true" {...props} />,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}))

import { SortMenuGroupes } from './SortMenuGroupes'

describe('SortMenuGroupes', () => {
  beforeEach(() => {
    routerState.params = new URLSearchParams()
    routerState.setCalls.length = 0
    mockSetSearchParams.mockClear()
  })

  it('affiche le libellé par défaut "Nom (A-Z)" et surligne l’option correspondante', () => {
    render(<SortMenuGroupes />)
    const trigger = screen.getByRole('button', { name: /Nom \(A-Z\)/i })
    expect(trigger).toBeTruthy()
    expect(trigger.textContent || '').toContain('Nom (A-Z)')

    const highlighted = screen.getByRole('menuitem', { name: 'Nom (A-Z)' })
    expect((highlighted as HTMLButtonElement).className).toContain('bg-accent')
  })

  it('met à jour les paramètres de recherche en cliquant sur une option', async () => {
    const user = userEvent.setup()
    render(<SortMenuGroupes />)

    const option = screen.getByRole('menuitem', { name: 'Plus ancien' })
    await user.click(option)

    expect(mockSetSearchParams).toHaveBeenCalledTimes(1)
    expect(routerState.params.get('sort')).toBe('created-asc')
  })

  it('affiche "Trier par" quand le sort courant est inconnu', () => {
    routerState.params = new URLSearchParams([['sort', 'inconnue']])
    render(<SortMenuGroupes />)

    const trigger = screen.getByRole('button', { name: /Trier par/i })
    expect(trigger).toBeTruthy()
    expect(trigger.textContent || '').toContain('Trier par')
  })

  it('applique les classes spécifiques au variant="default"', () => {
    render(<SortMenuGroupes variant="default" />)
    const button = screen.getByRole('button')
    const className = (button as HTMLButtonElement).className
    expect(className).toContain('border')
    expect(className).toContain('hover:bg-muted')
    expect(className).not.toContain('bg-card/10')
  })

  it('surligne la valeur initiale depuis les search params', () => {
    routerState.params = new URLSearchParams([['sort', 'progression-desc']])
    render(<SortMenuGroupes />)

    const highlighted = screen.getByRole('menuitem', { name: 'Progression (↓)' })
    expect((highlighted as HTMLButtonElement).className).toContain('bg-accent')
  })
})
