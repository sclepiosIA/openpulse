import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { FavoritesSidebarSection } from './FavoritesSidebarSection'

const {
  EMPTY_FAVORITES_RESULT,
  FILLED_FAVORITES_RESULT,
  MANY_FAVORITES_RESULT,
  EXPANDED_SIDEBAR_RESULT,
  COLLAPSED_SIDEBAR_RESULT,
  mockRemove,
  mockUseFavorites,
  mockUseSidebar,
} = vi.hoisted(() => {
  const mockRemove = vi.fn()

  const favoriteItems = [
    {
      id: 'alpha',
      type: 'project',
      title: 'Alpha project',
      url: '/projects/alpha',
    },
    {
      id: 'beta',
      type: 'document',
      title: 'Beta document',
      url: '/docs/beta',
    },
  ]

  const manyFavoriteItems = Array.from({ length: 12 }, (_, index) => ({
    id: `fav-${index + 1}`,
    type: 'workspace',
    title: `Favorite ${index + 1}`,
    url: `/many/${index + 1}`,
  }))

  const emptyFavoritesResult = {
    favorites: [],
    remove: mockRemove,
  }

  const filledFavoritesResult = {
    favorites: favoriteItems,
    remove: mockRemove,
  }

  const manyFavoritesResult = {
    favorites: manyFavoriteItems,
    remove: mockRemove,
  }

  const expandedSidebarResult = {
    state: 'expanded',
  }

  const collapsedSidebarResult = {
    state: 'collapsed',
  }

  return {
    EMPTY_FAVORITES_RESULT: emptyFavoritesResult,
    FILLED_FAVORITES_RESULT: filledFavoritesResult,
    MANY_FAVORITES_RESULT: manyFavoritesResult,
    EXPANDED_SIDEBAR_RESULT: expandedSidebarResult,
    COLLAPSED_SIDEBAR_RESULT: collapsedSidebarResult,
    mockRemove,
    mockUseFavorites: vi.fn(() => filledFavoritesResult),
    mockUseSidebar: vi.fn(() => expandedSidebarResult),
  }
})

vi.mock('lucide-react', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  type IconProps = {
    className?: string
  }

  return {
    Star: ({ className }: IconProps) =>
      React.createElement('svg', {
        'aria-hidden': 'true',
        className,
        'data-testid': 'star-icon',
      }),
    X: ({ className }: IconProps) =>
      React.createElement('svg', {
        'aria-hidden': 'true',
        className,
        'data-testid': 'x-icon',
      }),
  }
})

vi.mock('@/hooks/views/useFavorites', () => ({
  useFavorites: mockUseFavorites,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: Array<string | false | null | undefined>) =>
    inputs.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/sidebar', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  type BasicProps = import('react').PropsWithChildren<{
    className?: string
  }>

  type MenuButtonProps = import('react').PropsWithChildren<{
    asChild?: boolean
    tooltip?: string
    className?: string
  }>

  const createComponent =
    (testId: string) =>
    ({ children, className }: BasicProps) =>
      React.createElement(
        'div',
        {
          className,
          'data-testid': testId,
        },
        children,
      )

  return {
    useSidebar: mockUseSidebar,
    SidebarGroup: createComponent('sidebar-group'),
    SidebarGroupContent: createComponent('sidebar-group-content'),
    SidebarGroupLabel: createComponent('sidebar-group-label'),
    SidebarMenu: createComponent('sidebar-menu'),
    SidebarMenuItem: createComponent('sidebar-menu-item'),
    SidebarMenuButton: ({ children, tooltip, className }: MenuButtonProps) =>
      React.createElement(
        'div',
        {
          className,
          title: tooltip,
          'data-testid': 'sidebar-menu-button',
        },
        children,
      ),
  }
})

function renderFavoritesSidebar(initialPath = '/projects/alpha') {
  const queryClient = new QueryClient({
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

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <FavoritesSidebarSection />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockRemove.mockClear()
  mockUseFavorites.mockReset()
  mockUseSidebar.mockReset()
  mockUseFavorites.mockReturnValue(FILLED_FAVORITES_RESULT)
  mockUseSidebar.mockReturnValue(EXPANDED_SIDEBAR_RESULT)
})

afterEach(() => {
  cleanup()
})

describe('FavoritesSidebarSection', () => {
  it('renders nothing when there are no favorites', () => {
    mockUseFavorites.mockReturnValue(EMPTY_FAVORITES_RESULT)

    renderFavoritesSidebar()

    expect(screen.queryByTestId('sidebar-group')).not.toBeInTheDocument()
    expect(screen.queryByText('Favoris')).not.toBeInTheDocument()
    expect(mockUseFavorites).toHaveBeenCalledTimes(1)
    expect(mockUseSidebar).toHaveBeenCalledTimes(1)
  })

  it('renders expanded favorites with label, active link styling and remove action', () => {
    renderFavoritesSidebar('/projects/alpha')

    expect(screen.getByTestId('sidebar-group-label')).toHaveTextContent('Favoris')

    const alphaLink = screen.getByRole('link', { name: /Alpha project/ })
    expect(alphaLink).toHaveAttribute('href', '/projects/alpha')
    expect(alphaLink).toHaveClass('flex', 'items-center', 'gap-2', 'bg-primary/10', 'text-primary')

    const betaLink = screen.getByRole('link', { name: /Beta document/ })
    expect(betaLink).toHaveAttribute('href', '/docs/beta')
    expect(betaLink).not.toHaveClass('bg-primary/10')

    const removeAlphaButton = screen.getByRole('button', {
      name: 'Retirer Alpha project des favoris',
    })
    fireEvent.click(removeAlphaButton)

    expect(mockRemove).toHaveBeenCalledTimes(1)
    expect(mockRemove).toHaveBeenCalledWith('alpha', 'project')
  })

  it('renders collapsed favorites without section label or remove buttons and exposes tooltips', () => {
    mockUseSidebar.mockReturnValue(COLLAPSED_SIDEBAR_RESULT)

    renderFavoritesSidebar('/other')

    expect(screen.queryByTestId('sidebar-group-label')).not.toBeInTheDocument()
    expect(screen.queryByText('Favoris')).not.toBeInTheDocument()
    expect(screen.getByTitle('Alpha project')).toBeInTheDocument()
    expect(screen.getByTitle('Beta document')).toBeInTheDocument()
    expect(screen.queryByLabelText('Retirer Alpha project des favoris')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Retirer Beta document des favoris')).not.toBeInTheDocument()
  })

  it('limits the rendered favorites list to the first ten items', () => {
    mockUseFavorites.mockReturnValue(MANY_FAVORITES_RESULT)

    renderFavoritesSidebar('/many/1')

    expect(screen.getAllByRole('link')).toHaveLength(10)
    expect(screen.getByText('Favorite 1')).toBeInTheDocument()
    expect(screen.getByText('Favorite 10')).toBeInTheDocument()
    expect(screen.queryByText('Favorite 11')).not.toBeInTheDocument()
    expect(screen.queryByText('Favorite 12')).not.toBeInTheDocument()
    expect(screen.getAllByLabelText(/^Retirer Favorite \d+ des favoris$/)).toHaveLength(10)
  })
})