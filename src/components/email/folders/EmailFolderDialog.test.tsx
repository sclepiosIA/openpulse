import type {
  ReactElement,
  ReactNode,
  HTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SVGProps,
} from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  EmailFolderDialog,
  FOLDER_COLORS,
  FOLDER_ICONS,
  getFolderColorClass,
  getFolderIconComponent,
} from './EmailFolderDialog'

const {
  mockCreateMutateAsync,
  mockUpdateMutateAsync,
  mockUseEmailFolders,
  createFolderState,
  updateFolderState,
} = vi.hoisted(() => {
  const mockCreateMutateAsync = vi.fn()
  const mockUpdateMutateAsync = vi.fn()

  const createFolderState = {
    isPending: false,
    mutateAsync: mockCreateMutateAsync,
  }

  const updateFolderState = {
    isPending: false,
    mutateAsync: mockUpdateMutateAsync,
  }

  const mockUseEmailFolders = vi.fn(() => ({
    createFolder: createFolderState,
    updateFolder: updateFolderState,
  }))

  return {
    mockCreateMutateAsync,
    mockUpdateMutateAsync,
    mockUseEmailFolders,
    createFolderState,
    updateFolderState,
  }
})

vi.mock('@/hooks/email/useEmailFolders', () => ({
  useEmailFolders: mockUseEmailFolders,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: Array<string | false | null | undefined>) => inputs.filter(Boolean).join(' '),
  formatNumber: (value: number) => new Intl.NumberFormat('fr-FR').format(value),
}))

vi.mock('@/components/ui/dialog', async () => {
  const React = await import('react')

  type DialogProps = {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    children?: ReactNode
  }

  const Dialog = ({ open, children }: DialogProps) =>
    open ? React.createElement('div', { 'data-testid': 'dialog-root' }, children) : null

  const DialogContent = ({ children, className }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', { role: 'dialog', className }, children)

  const DialogHeader = ({ children, className }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', { className }, children)

  const DialogFooter = ({ children, className }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', { className }, children)

  const DialogTitle = ({ children, className }: HTMLAttributes<HTMLHeadingElement>) =>
    React.createElement('h2', { className }, children)

  return {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogPortal: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    DialogOverlay: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    DialogClose: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    DialogTrigger: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    DialogDescription: ({ children }: { children?: ReactNode }) =>
      React.createElement('p', null, children),
  }
})

vi.mock('@/components/ui/input', async () => {
  const React = await import('react')

  const Input = React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => React.createElement('input', { ...props, ref })
  )

  return { Input }
})

vi.mock('@/components/ui/label', async () => {
  const React = await import('react')

  const Label = React.forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
    (props, ref) => React.createElement('label', { ...props, ref })
  )

  return { Label }
})

vi.mock('@/components/ui/button', async () => {
  const React = await import('react')

  type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string
    asChild?: boolean
  }

  const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant: _variant, asChild: _asChild, type, ...props }, ref) =>
      React.createElement('button', { ...props, ref, type: type ?? 'button' })
  )

  return {
    Button,
    buttonVariants: () => '',
  }
})

vi.mock('lucide-react', async () => {
  const React = await import('react')

  const makeIcon =
    (testId: string) =>
    ({ className }: SVGProps<SVGSVGElement>) =>
      React.createElement('svg', { className, 'data-testid': testId })

  return {
    Folder: makeIcon('icon-folder'),
    Star: makeIcon('icon-star'),
    Flag: makeIcon('icon-flag'),
    Inbox: makeIcon('icon-inbox'),
    Tag: makeIcon('icon-tag'),
    Bookmark: makeIcon('icon-bookmark'),
    Heart: makeIcon('icon-heart'),
    Briefcase: makeIcon('icon-briefcase'),
    Users: makeIcon('icon-users'),
    Zap: makeIcon('icon-zap'),
  }
})

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('EmailFolderDialog constants and helpers', () => {
  it('expose les couleurs de dossiers attendues', () => {
    expect(FOLDER_COLORS).toHaveLength(9)
    expect(FOLDER_COLORS.map((color) => color.value)).toEqual([
      'primary',
      'accent',
      'secondary',
      'destructive',
      'emerald',
      'amber',
      'sky',
      'violet',
      'pink',
    ])
    expect(FOLDER_COLORS[0]).toEqual({
      value: 'primary',
      label: 'Primaire',
      className: 'bg-primary text-primary-foreground',
    })
    expect(FOLDER_COLORS[5]).toEqual({
      value: 'amber',
      label: 'Ambre',
      className: 'bg-amber-500 text-white',
    })
    expect(new Set(FOLDER_COLORS.map((color) => color.value)).size).toBe(FOLDER_COLORS.length)
  })

  it('expose les icônes de dossiers attendues', () => {
    expect(FOLDER_ICONS).toHaveLength(10)
    expect(FOLDER_ICONS.map((icon) => icon.value)).toEqual([
      'folder',
      'star',
      'flag',
      'inbox',
      'tag',
      'bookmark',
      'heart',
      'briefcase',
      'users',
      'zap',
    ])
    expect(new Set(FOLDER_ICONS.map((icon) => icon.value)).size).toBe(FOLDER_ICONS.length)
  })

  it('résout une classe de couleur connue ou utilise la couleur primaire en repli', () => {
    expect(getFolderColorClass('emerald')).toBe('bg-emerald-500 text-white')
    expect(getFolderColorClass('violet')).toBe('bg-violet-500 text-white')
    expect(getFolderColorClass('unknown')).toBe('bg-primary text-primary-foreground')
  })

  it('résout une icône connue ou utilise Folder en repli', () => {
    expect(getFolderIconComponent('star')).toBe(FOLDER_ICONS[1].Icon)
    expect(getFolderIconComponent('zap')).toBe(FOLDER_ICONS[9].Icon)
    expect(getFolderIconComponent(null)).toBe(FOLDER_ICONS[0].Icon)
    expect(getFolderIconComponent(undefined)).toBe(FOLDER_ICONS[0].Icon)
    expect(getFolderIconComponent('missing')).toBe(FOLDER_ICONS[0].Icon)
  })
})

describe('EmailFolderDialog', () => {
  beforeEach(() => {
    mockCreateMutateAsync.mockReset()
    mockUpdateMutateAsync.mockReset()
    mockCreateMutateAsync.mockResolvedValue(undefined)
    mockUpdateMutateAsync.mockResolvedValue(undefined)
    createFolderState.isPending = false
    updateFolderState.isPending = false
    mockUseEmailFolders.mockClear()
    mockUseEmailFolders.mockImplementation(() => ({
      createFolder: createFolderState,
      updateFolder: updateFolderState,
    }))
  })

  it('affiche le formulaire de création avec ses champs métier', () => {
    const onOpenChange = vi.fn()

    renderWithClient(<EmailFolderDialog open={true} onOpenChange={onOpenChange} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Nouveau dossier')).toBeInTheDocument()
    expect(screen.getByLabelText('Nom')).toHaveValue('')
    expect(screen.getByPlaceholderText('Ex. Urgent, Clients VIP, À relire…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Primaire' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ambre' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'star' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'zap' })).toBeInTheDocument()
  })

  it('ne rend pas le contenu lorsque la boîte de dialogue est fermée', () => {
    const onOpenChange = vi.fn()

    renderWithClient(<EmailFolderDialog open={false} onOpenChange={onOpenChange} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Nouveau dossier')).not.toBeInTheDocument()
  })

  it('désactive les actions pendant une mise à jour en cours', () => {
    updateFolderState.isPending = true
    const onOpenChange = vi.fn()
    const folder = {
      id: 'folder-1',
      name: 'Clients',
      color: 'sky',
      icon: 'users',
      email_count: 0,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    } as React.ComponentProps<typeof EmailFolderDialog>['folder']

    renderWithClient(<EmailFolderDialog open={true} onOpenChange={onOpenChange} folder={folder} />)

    expect(screen.getByText('Modifier le dossier')).toBeInTheDocument()
    expect(screen.getByLabelText('Nom')).toHaveValue('Clients')
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })

  it("crée un dossier avec le nom trimé, la couleur et l'icône sélectionnées", async () => {
    const onOpenChange = vi.fn()

    renderWithClient(<EmailFolderDialog open={true} onOpenChange={onOpenChange} />)

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: '  Urgent  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ambre' }))
    fireEvent.click(screen.getByRole('button', { name: 'star' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer' }))
    })

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        name: 'Urgent',
        color: 'amber',
        icon: 'star',
      })
    })

    expect(mockUpdateMutateAsync).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('crée un dossier via la touche Entrée quand le nom est valide', async () => {
    const onOpenChange = vi.fn()

    renderWithClient(<EmailFolderDialog open={true} onOpenChange={onOpenChange} />)

    const input = screen.getByLabelText('Nom')
    fireEvent.change(input, { target: { value: '  Relances  ' } })

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        name: 'Relances',
        color: 'primary',
        icon: 'folder',
      })
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('ignore la création lorsque le nom ne contient que des espaces', async () => {
    const onOpenChange = vi.fn()

    renderWithClient(<EmailFolderDialog open={true} onOpenChange={onOpenChange} />)

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: '   ' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer' }))
    })

    expect(mockCreateMutateAsync).not.toHaveBeenCalled()
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('met à jour un dossier existant avec son id et les nouvelles valeurs', async () => {
    const onOpenChange = vi.fn()
    const folder = {
      id: 'folder-2',
      name: 'Clients',
      color: 'sky',
      icon: 'users',
      email_count: 3,
      created_at: '2024-02-01',
      updated_at: '2024-02-02',
    } as React.ComponentProps<typeof EmailFolderDialog>['folder']

    renderWithClient(<EmailFolderDialog open={true} onOpenChange={onOpenChange} folder={folder} />)

    expect(screen.getByText('Modifier le dossier')).toBeInTheDocument()
    expect(screen.getByLabelText('Nom')).toHaveValue('Clients')

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: '  Clients importants  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Violet' }))
    fireEvent.click(screen.getByRole('button', { name: 'zap' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    })

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: 'folder-2',
        name: 'Clients importants',
        color: 'violet',
        icon: 'zap',
      })
    })

    expect(mockCreateMutateAsync).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("ferme la boîte de dialogue sans mutation lors de l'annulation", () => {
    const onOpenChange = vi.fn()

    renderWithClient(<EmailFolderDialog open={true} onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockCreateMutateAsync).not.toHaveBeenCalled()
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled()
  })
})
