import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FavoriteButton } from './FavoriteButton'

const {
  favoriteItem,
  favoriteState,
  mockUseFavorites,
  mockIsFavorite,
  mockToggle,
  mockToastSuccess,
  mockToastError,
  mockCn,
} = vi.hoisted(() => {
  const favoriteItem = {
    id: 'company-1',
    type: 'company',
    label: 'Acme',
    href: '/companies/company-1',
  }

  const mockIsFavorite = vi.fn((_id: string, _type: string) => false)
  const mockToggle = vi.fn(() => true)

  const favoriteState = {
    isFavorite: mockIsFavorite,
    toggle: mockToggle,
  }

  return {
    favoriteItem,
    favoriteState,
    mockUseFavorites: vi.fn(() => favoriteState),
    mockIsFavorite,
    mockToggle,
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockCn: vi.fn((...inputs: unknown[]) =>
      inputs
        .filter((input): input is string => typeof input === 'string' && input.length > 0)
        .join(' '),
    ),
  }
})

vi.mock('@/hooks/views/useFavorites', () => ({
  useFavorites: mockUseFavorites,
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
  formatNumber: vi.fn((value: number) => String(value)),
}))

vi.mock('@/components/ui/button', async () => {
  const React = await import('react')

  type ButtonMockProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string
    size?: string
    asChild?: boolean
  }

  const Button = React.forwardRef<HTMLButtonElement, ButtonMockProps>(
    ({ variant, size, asChild: _asChild, children, ...props }, ref) =>
      React.createElement(
        'button',
        {
          ...props,
          ref,
          'data-variant': variant,
          'data-size': size,
        },
        children,
      ),
  )

  Button.displayName = 'MockButton'

  return {
    Button,
    buttonVariants: vi.fn(() => ''),
  }
})

vi.mock('lucide-react', async () => {
  const React = await import('react')

  return {
    Star: ({ className }: { className?: string }) =>
      React.createElement('svg', {
        'data-testid': 'star-icon',
        className,
        'aria-hidden': 'true',
      }),
  }
})

type FavoriteButtonItem = ComponentProps<typeof FavoriteButton>['item']

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

function renderWithProviders(ui: ReactElement) {
  const queryClient = createQueryClient()

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return render(ui, { wrapper: Wrapper })
}

describe('FavoriteButton', () => {
  beforeEach(() => {
    mockUseFavorites.mockClear()
    mockUseFavorites.mockReturnValue(favoriteState)

    mockIsFavorite.mockReset()
    mockIsFavorite.mockImplementation((_id: string, _type: string) => false)

    mockToggle.mockReset()
    mockToggle.mockReturnValue(true)

    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockCn.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the inactive favorite action with default variant and size', () => {
    const item = favoriteItem as FavoriteButtonItem

    renderWithProviders(<FavoriteButton item={item} className="custom-class" />)

    const button = screen.getByRole('button', { name: 'Ajouter aux favoris' })
    const icon = screen.getByTestId('star-icon')

    expect(mockUseFavorites).toHaveBeenCalledTimes(1)
    expect(mockIsFavorite).toHaveBeenCalledWith('company-1', 'company')
    expect(button.getAttribute('type')).toBe('button')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.getAttribute('title')).toBe('Ajouter aux favoris')
    expect(button.getAttribute('data-variant')).toBe('ghost')
    expect(button.getAttribute('data-size')).toBe('icon')
    expect(button.className).toContain('shrink-0')
    expect(button.className).toContain('custom-class')
    expect(icon.getAttribute('class')).toContain('h-4 w-4 transition-colors')
    expect(icon.getAttribute('class')).toContain('text-muted-foreground')
    expect(icon.getAttribute('class')).not.toContain('fill-amber-400')
  })

  it('renders the active favorite action with explicit variant and size', () => {
    const item = favoriteItem as FavoriteButtonItem
    mockIsFavorite.mockImplementation((id: string, type: string) => id === 'company-1' && type === 'company')

    renderWithProviders(<FavoriteButton item={item} variant="outline" size="sm" />)

    const button = screen.getByRole('button', { name: 'Retirer des favoris' })
    const icon = screen.getByTestId('star-icon')

    expect(mockIsFavorite).toHaveBeenCalledWith('company-1', 'company')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.getAttribute('title')).toBe('Retirer des favoris')
    expect(button.getAttribute('data-variant')).toBe('outline')
    expect(button.getAttribute('data-size')).toBe('sm')
    expect(icon.getAttribute('class')).toContain('fill-amber-400')
    expect(icon.getAttribute('class')).toContain('text-amber-400')
    expect(icon.getAttribute('class')).not.toContain('text-muted-foreground')
  })

  it('stops the click event, toggles the item and displays an added toast', async () => {
    const item = favoriteItem as FavoriteButtonItem
    const parentClick = vi.fn()

    renderWithProviders(
      <div onClick={parentClick}>
        <FavoriteButton item={item} />
      </div>,
    )

    const button = screen.getByRole('button', { name: 'Ajouter aux favoris' })
    let dispatchResult = true

    await act(async () => {
      dispatchResult = fireEvent.click(button)
    })

    expect(dispatchResult).toBe(false)
    expect(parentClick).not.toHaveBeenCalled()
    expect(mockToggle).toHaveBeenCalledTimes(1)
    expect(mockToggle).toHaveBeenCalledWith(favoriteItem)
    expect(mockToastSuccess).toHaveBeenCalledTimes(1)
    expect(mockToastSuccess).toHaveBeenCalledWith('Ajouté aux favoris')
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('displays a removed toast when toggle returns false', async () => {
    const item = favoriteItem as FavoriteButtonItem
    mockIsFavorite.mockReturnValue(true)
    mockToggle.mockReturnValue(false)

    renderWithProviders(<FavoriteButton item={item} />)

    const button = screen.getByRole('button', { name: 'Retirer des favoris' })

    await act(async () => {
      fireEvent.click(button)
    })

    expect(mockToggle).toHaveBeenCalledTimes(1)
    expect(mockToggle).toHaveBeenCalledWith(favoriteItem)
    expect(mockToastSuccess).toHaveBeenCalledTimes(1)
    expect(mockToastSuccess).toHaveBeenCalledWith('Retiré des favoris')
  })
})