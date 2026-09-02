import '@testing-library/jest-dom/vitest'
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SVGProps,
} from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SavedViewsMenu } from './SavedViewsMenu'

const { toastSuccess, toastError, confirmMock } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  confirmMock: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('lucide-react', () => {
  const Icon = (props: SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" focusable="false" {...props} />
  )

  return {
    Bookmark: Icon,
    Check: Icon,
    Plus: Icon,
    Trash2: Icon,
    Pencil: Icon,
  }
})

vi.mock('@/components/ui/button', async () => {
  const ReactModule = await import('react')

  type MockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean
    variant?: string
    size?: string
  }

  const Button = ReactModule.forwardRef<HTMLButtonElement, MockButtonProps>(
    ({ asChild: _asChild, variant: _variant, size: _size, ...props }, ref) => (
      <button ref={ref} {...props} />
    ),
  )
  Button.displayName = 'Button'

  return {
    Button,
    buttonVariants: () => '',
  }
})

vi.mock('@/components/ui/dropdown-menu', async () => {
  const ReactModule = await import('react')

  type MockContainerProps = {
    children?: ReactNode
  }

  type MockDivProps = HTMLAttributes<HTMLDivElement> & {
    asChild?: boolean
    align?: string
    inset?: boolean
  }

  const DropdownMenu = ({ children }: MockContainerProps) => (
    <div data-testid="dropdown-menu">{children}</div>
  )

  const DropdownMenuTrigger = ({
    asChild: _asChild,
    children,
    ...props
  }: MockDivProps) => (
    <div data-testid="dropdown-trigger" {...props}>
      {children}
    </div>
  )

  const DropdownMenuContent = ReactModule.forwardRef<HTMLDivElement, MockDivProps>(
    ({ align: _align, children, ...props }, ref) => (
      <div ref={ref} role="menu" {...props}>
        {children}
      </div>
    ),
  )
  DropdownMenuContent.displayName = 'DropdownMenuContent'

  const DropdownMenuItem = ReactModule.forwardRef<HTMLDivElement, MockDivProps>(
    ({ inset: _inset, children, ...props }, ref) => (
      <div ref={ref} role="menuitem" tabIndex={0} {...props}>
        {children}
      </div>
    ),
  )
  DropdownMenuItem.displayName = 'DropdownMenuItem'

  const DropdownMenuLabel = ReactModule.forwardRef<HTMLDivElement, MockDivProps>(
    ({ inset: _inset, children, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    ),
  )
  DropdownMenuLabel.displayName = 'DropdownMenuLabel'

  const DropdownMenuSeparator = ReactModule.forwardRef<HTMLDivElement, MockDivProps>(
    (props, ref) => <div ref={ref} role="separator" {...props} />,
  )
  DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
  }
})

vi.mock('@/components/ui/dialog', async () => {
  const ReactModule = await import('react')

  type MockDialogProps = {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    children?: ReactNode
  }

  type MockDivProps = HTMLAttributes<HTMLDivElement>
  type MockHeadingProps = HTMLAttributes<HTMLHeadingElement>

  const Dialog = ({ open, onOpenChange: _onOpenChange, children }: MockDialogProps) =>
    open ? <div data-testid="dialog-root">{children}</div> : null

  const DialogContent = ReactModule.forwardRef<HTMLDivElement, MockDivProps>(
    ({ children, ...props }, ref) => (
      <div ref={ref} role="dialog" {...props}>
        {children}
      </div>
    ),
  )
  DialogContent.displayName = 'DialogContent'

  const DialogFooter = ({ children, ...props }: MockDivProps) => (
    <div {...props}>{children}</div>
  )

  const DialogHeader = ({ children, ...props }: MockDivProps) => (
    <div {...props}>{children}</div>
  )

  const DialogTitle = ReactModule.forwardRef<HTMLHeadingElement, MockHeadingProps>(
    ({ children, ...props }, ref) => (
      <h2 ref={ref} {...props}>
        {children}
      </h2>
    ),
  )
  DialogTitle.displayName = 'DialogTitle'

  return {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  }
})

vi.mock('@/components/ui/input', async () => {
  const ReactModule = await import('react')

  const Input = ReactModule.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => <input ref={ref} {...props} />,
  )
  Input.displayName = 'Input'

  return {
    Input,
  }
})

interface ViewState {
  status: string
  page: number
  tags: string[]
}

const allContactsView = {
  id: 'view-1',
  name: 'Tous les contacts',
  state: {
    status: 'all',
    page: 1,
    tags: ['contacts'],
  },
}

const hotProspectsView = {
  id: 'view-2',
  name: 'Prospects chauds',
  state: {
    status: 'hot',
    page: 2,
    tags: ['prospects', 'priority'],
  },
}

const savedViews = [allContactsView, hotProspectsView]

function createHandlers() {
  return {
    onApply: vi.fn<(state: ViewState, id: string) => void>(),
    onSave: vi.fn<(name: string) => void>(),
    onUpdate: vi.fn<(id: string) => void>(),
    onRename: vi.fn<(id: string, name: string) => void>(),
    onRemove: vi.fn<(id: string) => void>(),
  }
}

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

function firstElement<T>(items: T[], message: string): T {
  const item = items[0]
  if (item === undefined) {
    throw new Error(message)
  }
  return item
}

beforeEach(() => {
  vi.clearAllMocks()
  confirmMock.mockReset()
  confirmMock.mockReturnValue(true)
  vi.stubGlobal('confirm', confirmMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('SavedViewsMenu', () => {
  it('affiche la vue active et applique une vue enregistrée avec son état réel', async () => {
    const user = userEvent.setup()
    const handlers = createHandlers()

    renderWithProviders(
      <SavedViewsMenu<ViewState>
        views={savedViews}
        activeId={hotProspectsView.id}
        {...handlers}
      />,
    )

    expect(screen.getByRole('button', { name: /Prospects chauds/ })).toBeInTheDocument()
    expect(screen.getByText('Vues enregistrées')).toBeInTheDocument()
    expect(screen.queryByText('Aucune vue enregistrée')).not.toBeInTheDocument()
    expect(screen.getByText(/Mettre à jour « Prospects chauds »/)).toBeInTheDocument()

    await user.click(screen.getByText('Tous les contacts'))

    expect(handlers.onApply).toHaveBeenCalledTimes(1)
    expect(handlers.onApply).toHaveBeenCalledWith(allContactsView.state, allContactsView.id)
    expect(toastSuccess).toHaveBeenCalledWith('Vue « Tous les contacts » appliquée')
  })

  it('affiche l’état vide puis enregistre une nouvelle vue avec un nom trimé', async () => {
    const user = userEvent.setup()
    const handlers = createHandlers()

    renderWithProviders(
      <SavedViewsMenu<ViewState> views={[]} activeId={null} {...handlers} />,
    )

    expect(screen.getByRole('button', { name: /Vues/ })).toBeInTheDocument()
    expect(screen.getByText('Aucune vue enregistrée')).toBeInTheDocument()
    expect(screen.queryByText(/Mettre à jour/)).not.toBeInTheDocument()

    await user.click(screen.getByText('Enregistrer la vue actuelle'))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Enregistrer la vue')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith('Donnez un nom à la vue')
    expect(handlers.onSave).not.toHaveBeenCalled()

    await user.type(
      within(dialog).getByPlaceholderText('Ex. Mes prospects en cours'),
      '  Ma vue  ',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(handlers.onSave).toHaveBeenCalledTimes(1)
    expect(handlers.onSave).toHaveBeenCalledWith('Ma vue')
    expect(toastSuccess).toHaveBeenCalledWith('Vue « Ma vue » enregistrée')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('met à jour la vue active depuis l’action dédiée', async () => {
    const user = userEvent.setup()
    const handlers = createHandlers()

    renderWithProviders(
      <SavedViewsMenu<ViewState>
        views={savedViews}
        activeId={hotProspectsView.id}
        {...handlers}
      />,
    )

    await user.click(screen.getByText(/Mettre à jour « Prospects chauds »/))

    expect(handlers.onUpdate).toHaveBeenCalledTimes(1)
    expect(handlers.onUpdate).toHaveBeenCalledWith(hotProspectsView.id)
    expect(toastSuccess).toHaveBeenCalledWith('Vue « Prospects chauds » mise à jour')
  })

  it('renomme une vue enregistrée sans déclencher son application', async () => {
    const user = userEvent.setup()
    const handlers = createHandlers()

    renderWithProviders(
      <SavedViewsMenu<ViewState> views={savedViews} activeId={null} {...handlers} />,
    )

    await user.click(firstElement(screen.getAllByLabelText('Renommer'), 'Bouton renommer absent'))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Renommer la vue')).toBeInTheDocument()

    const input = within(dialog).getByDisplayValue('Tous les contacts')
    await user.clear(input)
    await user.type(input, 'Contacts importants')
    await user.click(within(dialog).getByRole('button', { name: 'Renommer' }))

    expect(handlers.onApply).not.toHaveBeenCalled()
    expect(handlers.onRename).toHaveBeenCalledTimes(1)
    expect(handlers.onRename).toHaveBeenCalledWith(allContactsView.id, 'Contacts importants')
    expect(toastSuccess).toHaveBeenCalledWith('Vue renommée')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('demande confirmation avant de supprimer une vue et empêche le clic de l’appliquer', async () => {
    const user = userEvent.setup()
    const handlers = createHandlers()

    renderWithProviders(
      <SavedViewsMenu<ViewState> views={savedViews} activeId={null} {...handlers} />,
    )

    const deleteButtons = screen.getAllByLabelText('Supprimer')
    const firstDeleteButton = firstElement(deleteButtons, 'Bouton supprimer absent')

    confirmMock.mockReturnValueOnce(false)

    await user.click(firstDeleteButton)

    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(confirmMock).toHaveBeenCalledWith('Supprimer la vue « Tous les contacts » ?')
    expect(handlers.onRemove).not.toHaveBeenCalled()
    expect(handlers.onApply).not.toHaveBeenCalled()

    confirmMock.mockReturnValueOnce(true)

    await user.click(firstDeleteButton)

    expect(confirmMock).toHaveBeenCalledTimes(2)
    expect(handlers.onRemove).toHaveBeenCalledTimes(1)
    expect(handlers.onRemove).toHaveBeenCalledWith(allContactsView.id)
    expect(handlers.onApply).not.toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('Vue supprimée')
  })
})