import type { MouseEventHandler, ReactElement, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FavoriteItem } from '@/hooks/views/useFavorites'
import { EntityRowContextMenu } from './EntityRowContextMenu'

const {
  FAVORITE_ITEM,
  favoritesHookValue,
  mockIsFavorite,
  mockToggle,
  toastSuccess,
  toastError,
  clipboardWriteText,
} = vi.hoisted(() => {
  const mockIsFavorite = vi.fn()
  const mockToggle = vi.fn()
  const toastSuccess = vi.fn()
  const toastError = vi.fn()
  const clipboardWriteText = vi.fn()
  const favoritesHookValue = {
    isFavorite: mockIsFavorite,
    toggle: mockToggle,
  }
  const FAVORITE_ITEM = {
    id: 'entity-1',
    type: 'company',
    title: 'Société Acme',
    url: '/companies/entity-1',
  }

  return {
    FAVORITE_ITEM,
    favoritesHookValue,
    mockIsFavorite,
    mockToggle,
    toastSuccess,
    toastError,
    clipboardWriteText,
  }
})

vi.mock('@/hooks/views/useFavorites', () => ({
  useFavorites: () => favoritesHookValue,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/components/ui/context-menu', async () => {
  const React = await import('react')

  type BaseProps = {
    children?: ReactNode
    className?: string
    asChild?: boolean
  }

  type ItemProps = BaseProps & {
    onClick?: MouseEventHandler<HTMLButtonElement>
  }

  const ContextMenu = ({ children }: BaseProps) =>
    React.createElement('div', { 'data-testid': 'context-menu' }, children)

  const ContextMenuTrigger = ({ children }: BaseProps) =>
    React.createElement('div', { 'data-testid': 'context-menu-trigger' }, children)

  const ContextMenuContent = ({ children, className }: BaseProps) =>
    React.createElement(
      'div',
      { 'data-testid': 'context-menu-content', role: 'menu', className },
      children,
    )

  const ContextMenuItem = ({ children, onClick }: ItemProps) =>
    React.createElement('button', { type: 'button', role: 'menuitem', onClick }, children)

  const ContextMenuSeparator = () =>
    React.createElement('hr', { role: 'separator', 'data-testid': 'context-menu-separator' })

  return {
    ContextMenu,
    ContextMenuTrigger,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
  }
})

vi.mock('lucide-react', async () => {
  const React = await import('react')

  type IconProps = {
    className?: string
  }

  const createIcon =
    (testId: string) =>
    ({ className }: IconProps) =>
      React.createElement('span', {
        'aria-hidden': 'true',
        'data-testid': testId,
        className,
      })

  return {
    ExternalLink: createIcon('external-link-icon'),
    Link2: createIcon('link-icon'),
    Star: createIcon('star-icon'),
    StarOff: createIcon('star-off-icon'),
  }
})

type EntityRowTestProps = {
  children: ReactNode
  favoriteItem: FavoriteItem
  extraItems?: ReactNode
}

const favoriteItem = FAVORITE_ITEM as FavoriteItem

function renderComponent(overrides: Partial<EntityRowTestProps> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const props: EntityRowTestProps = {
    children: <div>Ligne société Acme</div>,
    favoriteItem,
    ...overrides,
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <EntityRowContextMenu favoriteItem={props.favoriteItem} extraItems={props.extraItems}>
        {props.children}
      </EntityRowContextMenu>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIsFavorite.mockReturnValue(false)
  mockToggle.mockReturnValue(true)
  clipboardWriteText.mockResolvedValue(undefined)

  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: clipboardWriteText,
    },
    configurable: true,
  })

  vi.spyOn(window, 'open').mockImplementation(() => null)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EntityRowContextMenu', () => {
  it('rend les enfants et les actions standard pour une entité non favorite', () => {
    renderComponent()

    expect(screen.getByTestId('context-menu-trigger')).toHaveTextContent('Ligne société Acme')
    expect(screen.getByRole('menuitem', { name: 'Ouvrir dans un nouvel onglet' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Copier le lien' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Ajouter aux favoris' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Retirer des favoris' })).not.toBeInTheDocument()
    expect(screen.getByTestId('context-menu-content')).toHaveClass('w-56')
    expect(mockIsFavorite).toHaveBeenCalledWith(FAVORITE_ITEM.id, FAVORITE_ITEM.type)
  })

  it('ouvre l’URL de l’entité dans un nouvel onglet', () => {
    renderComponent()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Ouvrir dans un nouvel onglet' }))

    expect(window.open).toHaveBeenCalledTimes(1)
    expect(window.open).toHaveBeenCalledWith(
      FAVORITE_ITEM.url,
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('copie le lien absolu et affiche un toast de succès', async () => {
    renderComponent()

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Copier le lien' }))
    })

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(`${window.location.origin}${FAVORITE_ITEM.url}`)
    })
    expect(toastSuccess).toHaveBeenCalledWith('Lien copié')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('affiche un toast d’erreur quand la copie du lien échoue', async () => {
    clipboardWriteText.mockRejectedValueOnce(new Error('refus'))

    renderComponent()

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Copier le lien' }))
    })

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Impossible de copier le lien')
    })
    expect(toastSuccess).not.toHaveBeenCalledWith('Lien copié')
  })

  it('ajoute l’entité aux favoris depuis l’action de menu', () => {
    mockToggle.mockReturnValueOnce(true)

    renderComponent()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Ajouter aux favoris' }))

    expect(mockToggle).toHaveBeenCalledTimes(1)
    expect(mockToggle).toHaveBeenCalledWith(favoriteItem)
    expect(toastSuccess).toHaveBeenCalledWith('Ajouté aux favoris')
  })

  it('rend l’action de retrait quand l’entité est déjà favorite', () => {
    mockIsFavorite.mockReturnValue(true)
    mockToggle.mockReturnValueOnce(false)

    renderComponent()

    expect(screen.getByRole('menuitem', { name: 'Retirer des favoris' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Ajouter aux favoris' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Retirer des favoris' }))

    expect(mockToggle).toHaveBeenCalledWith(favoriteItem)
    expect(toastSuccess).toHaveBeenCalledWith('Retiré des favoris')
  })

  it('ajoute les éléments de menu supplémentaires après les actions standard', () => {
    renderComponent({
      extraItems: <button type="button">Supprimer</button>,
    })

    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument()
    expect(screen.getAllByTestId('context-menu-separator')).toHaveLength(2)
  })
})