import '@testing-library/jest-dom/vitest'
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ViewFilterChipsBar, type ActiveFilterChip } from './ViewFilterChipsBar'

interface BadgeMockProps extends HTMLAttributes<HTMLDivElement> {
  variant?: string
}

interface ButtonMockProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: string
  size?: string
}

interface IconMockProps {
  className?: string
}

const { mockCn } = vi.hoisted(() => ({
  mockCn: vi.fn((...inputs: unknown[]) =>
    inputs
      .filter((input): input is string => typeof input === 'string' && input.length > 0)
      .join(' '),
  ),
}))

vi.mock('lucide-react', async () => {
  const React = await import('react')

  const makeIcon = (name: string) =>
    function IconMock({ className }: IconMockProps) {
      return React.createElement('svg', {
        'aria-hidden': 'true',
        className,
        'data-testid': `icon-${name}`,
      })
    }

  return {
    X: makeIcon('x'),
    ArrowUpDown: makeIcon('arrow-up-down'),
    Layers: makeIcon('layers'),
    CheckSquare: makeIcon('check-square'),
  }
})

vi.mock('@/components/ui/badge', async () => {
  const React = await import('react')

  return {
    Badge: ({ children, className, variant }: BadgeMockProps) =>
      React.createElement(
        'div',
        {
          className,
          'data-testid': 'badge',
          'data-variant': variant,
        },
        children,
      ),
    badgeVariants: vi.fn(),
  }
})

vi.mock('@/components/ui/button', async () => {
  const React = await import('react')

  return {
    Button: ({
      children,
      className,
      disabled,
      onClick,
      size,
      type = 'button',
      variant,
    }: ButtonMockProps) =>
      React.createElement(
        'button',
        {
          className,
          disabled,
          onClick,
          type,
          'data-testid': 'button',
          'data-size': size,
          'data-variant': variant,
        },
        children,
      ),
    buttonVariants: vi.fn(),
  }
})

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}))

describe('ViewFilterChipsBar', () => {
  beforeEach(() => {
    mockCn.mockClear()
  })

  it('ne rend rien quand aucun chip actif nest fourni', () => {
    const { container } = render(<ViewFilterChipsBar chips={[]} />)

    expect(screen.queryByRole('region', { name: 'Filtres actifs' })).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
    expect(mockCn).not.toHaveBeenCalled()
  })

  it('rend les libellés, valeurs, badges et icônes des chips actifs', () => {
    const chips: ActiveFilterChip[] = [
      { key: 'sort-created', icon: 'sort', label: 'Tri', value: 'Créé ↓' },
      { key: 'group-status', icon: 'group', label: 'Groupe', value: 'Statut' },
      { key: 'selected-rows', icon: 'selection', label: 'Sélection', value: '3 lignes' },
    ]

    render(<ViewFilterChipsBar chips={chips} className="classe-personnalisee" />)

    const region = screen.getByRole('region', { name: 'Filtres actifs' })
    expect(region).toBeInTheDocument()
    expect(region).toHaveClass('flex')
    expect(region).toHaveClass('classe-personnalisee')
    expect(screen.getByText('Actifs :')).toBeInTheDocument()
    expect(screen.getByText('Tri :')).toBeInTheDocument()
    expect(screen.getByText('Créé ↓')).toBeInTheDocument()
    expect(screen.getByText('Groupe :')).toBeInTheDocument()
    expect(screen.getByText('Statut')).toBeInTheDocument()
    expect(screen.getByText('Sélection :')).toBeInTheDocument()
    expect(screen.getByText('3 lignes')).toBeInTheDocument()

    const badges = screen.getAllByTestId('badge')
    expect(badges).toHaveLength(3)
    expect(badges.map((badge) => badge.getAttribute('data-variant'))).toEqual([
      'secondary',
      'secondary',
      'secondary',
    ])

    expect(screen.getAllByTestId('icon-arrow-up-down')).toHaveLength(1)
    expect(screen.getByTestId('icon-layers')).toBeInTheDocument()
    expect(screen.getByTestId('icon-check-square')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tout effacer' })).not.toBeInTheDocument()

    expect(mockCn).toHaveBeenCalledWith(
      'flex items-center gap-1.5 flex-wrap px-2 py-1.5 border-b bg-muted/20',
      'classe-personnalisee',
    )
  })

  it('déclenche uniquement le callback de suppression du chip cliqué', () => {
    const onClearSort = vi.fn()
    const onClearGroup = vi.fn()
    const chips: ActiveFilterChip[] = [
      { key: 'sort-name', icon: 'sort', label: 'Tri', value: 'Nom A-Z', onClear: onClearSort },
      { key: 'group-owner', icon: 'group', label: 'Groupe', value: 'Responsable', onClear: onClearGroup },
      { key: 'filter-open', icon: 'filter', label: 'Statut', value: 'Ouvert' },
    ]

    render(<ViewFilterChipsBar chips={chips} />)

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Tri' }))

    expect(onClearSort).toHaveBeenCalledTimes(1)
    expect(onClearGroup).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Retirer Groupe' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retirer Statut' })).not.toBeInTheDocument()
    expect(screen.getAllByTestId('icon-x')).toHaveLength(2)
  })

  it('affiche et déclenche Tout effacer seulement avec plusieurs chips actifs', () => {
    const onClearAll = vi.fn()
    const firstChip: ActiveFilterChip = {
      key: 'sort-amount',
      icon: 'sort',
      label: 'Tri',
      value: 'Montant ↓',
    }
    const secondChip: ActiveFilterChip = {
      key: 'filter-won',
      icon: 'filter',
      label: 'Étape',
      value: 'Gagné',
    }

    const { rerender } = render(<ViewFilterChipsBar chips={[firstChip]} onClearAll={onClearAll} />)

    expect(screen.queryByRole('button', { name: 'Tout effacer' })).not.toBeInTheDocument()

    rerender(<ViewFilterChipsBar chips={[firstChip, secondChip]} onClearAll={onClearAll} />)

    const clearAllButton = screen.getByRole('button', { name: 'Tout effacer' })
    expect(clearAllButton).toHaveAttribute('data-variant', 'ghost')
    expect(clearAllButton).toHaveAttribute('data-size', 'sm')

    fireEvent.click(clearAllButton)

    expect(onClearAll).toHaveBeenCalledTimes(1)
  })
})