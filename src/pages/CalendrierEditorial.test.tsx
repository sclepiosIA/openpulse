import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SVGProps,
  TextareaHTMLAttributes,
} from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CalendrierEditorial from './CalendrierEditorial'

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-calendar-test' },
    loading: false,
  }),
}))

vi.mock('lucide-react', async () => {
  const React = await import('react')

  const Icon = (props: SVGProps<SVGSVGElement>) =>
    React.createElement('svg', {
      ...props,
      'aria-hidden': 'true',
      viewBox: '0 0 24 24',
    })

  return {
    Plus: Icon,
    X: Icon,
    Trash2: Icon,
    Image: Icon,
    Video: Icon,
    Linkedin: Icon,
    Download: Icon,
    Save: Icon,
    Undo2: Icon,
    Redo2: Icon,
    Bold: Icon,
    GripVertical: Icon,
    RefreshCw: Icon,
  }
})

vi.mock('@/components/ui/button', async () => {
  const React = await import('react')

  type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean
    variant?: string
    size?: string
  }

  const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ asChild: _asChild, variant: _variant, size: _size, ...props }, ref) =>
      React.createElement('button', { ...props, ref, type: props.type ?? 'button' })
  )
  Button.displayName = 'Button'

  return {
    Button,
    buttonVariants: () => '',
  }
})

vi.mock('@/components/ui/input', async () => {
  const React = await import('react')

  const Input = React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => React.createElement('input', { ...props, ref })
  )
  Input.displayName = 'Input'

  return { Input }
})

vi.mock('@/components/ui/textarea', async () => {
  const React = await import('react')

  const Textarea = React.forwardRef<
    HTMLTextAreaElement,
    TextareaHTMLAttributes<HTMLTextAreaElement>
  >((props, ref) => React.createElement('textarea', { ...props, ref }))
  Textarea.displayName = 'Textarea'

  return { Textarea }
})

vi.mock('@/components/ui/badge', async () => {
  const React = await import('react')

  type BadgeProps = HTMLAttributes<HTMLDivElement> & {
    variant?: string
  }

  const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
    ({ variant: _variant, ...props }, ref) => React.createElement('div', { ...props, ref })
  )
  Badge.displayName = 'Badge'

  return {
    Badge,
    badgeVariants: () => '',
  }
})

vi.mock('@/components/ui/card', async () => {
  const React = await import('react')

  const makeDiv = (displayName: string) => {
    const Component = React.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
      (props, ref) => React.createElement('div', { ...props, ref })
    )
    Component.displayName = displayName
    return Component
  }

  return {
    Card: makeDiv('Card'),
    CardHeader: makeDiv('CardHeader'),
    CardTitle: makeDiv('CardTitle'),
    CardDescription: makeDiv('CardDescription'),
    CardContent: makeDiv('CardContent'),
    CardFooter: makeDiv('CardFooter'),
  }
})

vi.mock('@/components/ui/dialog', async () => {
  const React = await import('react')

  type DialogProps = {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    children?: ReactNode
  }

  const Dialog = ({ open, children }: DialogProps) =>
    open ? React.createElement('div', { 'data-testid': 'dialog-root' }, children) : null

  const DialogContent = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', { ...props, role: 'dialog' }, children)

  const DialogHeader = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', props, children)

  const DialogFooter = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', props, children)

  const DialogTitle = React.forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
    (props, ref) => React.createElement('h2', { ...props, ref })
  )
  DialogTitle.displayName = 'DialogTitle'

  const DialogDescription = React.forwardRef<
    HTMLParagraphElement,
    HTMLAttributes<HTMLParagraphElement>
  >((props, ref) => React.createElement('p', { ...props, ref }))
  DialogDescription.displayName = 'DialogDescription'

  const DialogPortal = ({ children }: { children?: ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  const DialogOverlay = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', props, children)
  const DialogClose = ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
    React.createElement('button', { ...props, type: props.type ?? 'button' }, children)
  const DialogTrigger = ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
    React.createElement('button', { ...props, type: props.type ?? 'button' }, children)

  return {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogClose,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
  }
})

vi.mock('@/components/ui/tabs', async () => {
  const React = await import('react')

  type TabsContextValue = {
    value: string
    onValueChange: (value: string) => void
  }

  const TabsContext = React.createContext<TabsContextValue>({
    value: '',
    onValueChange: () => undefined,
  })

  type TabsProps = {
    value: string
    onValueChange?: (value: string) => void
    className?: string
    children?: ReactNode
  }

  type TabsTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    value: string
  }

  const Tabs = ({ value, onValueChange, className, children }: TabsProps) =>
    React.createElement(
      TabsContext.Provider,
      { value: { value, onValueChange: onValueChange ?? (() => undefined) } },
      React.createElement('div', { className }, children)
    )

  const TabsList = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', props, children)

  const TabsTrigger = ({ value, children, ...props }: TabsTriggerProps) => {
    const ctx = React.useContext(TabsContext)
    return React.createElement(
      'button',
      {
        ...props,
        type: props.type ?? 'button',
        'data-state': ctx.value === value ? 'active' : 'inactive',
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          props.onClick?.(event)
          ctx.onValueChange(value)
        },
      },
      children
    )
  }

  return {
    Tabs,
    TabsList,
    TabsTrigger,
  }
})

vi.mock('@/components/ui/select', async () => {
  const React = await import('react')

  type SelectContextValue = {
    value: string
    onValueChange: (value: string) => void
  }

  const SelectContext = React.createContext<SelectContextValue>({
    value: '',
    onValueChange: () => undefined,
  })

  type SelectProps = {
    value?: string
    defaultValue?: string
    onValueChange?: (value: string) => void
    children?: ReactNode
  }

  type SelectItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    value: string
  }

  const Select = ({ value, defaultValue, onValueChange, children }: SelectProps) =>
    React.createElement(
      SelectContext.Provider,
      {
        value: {
          value: value ?? defaultValue ?? '',
          onValueChange: onValueChange ?? (() => undefined),
        },
      },
      React.createElement('div', null, children)
    )

  const SelectTrigger = ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
    React.createElement('button', { ...props, type: props.type ?? 'button' }, children)

  const SelectValue = ({ placeholder }: { placeholder?: ReactNode }) =>
    React.createElement('span', null, placeholder ?? null)

  const SelectContent = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', props, children)

  const SelectItem = ({ value, children, ...props }: SelectItemProps) => {
    const ctx = React.useContext(SelectContext)
    return React.createElement(
      'button',
      {
        ...props,
        type: props.type ?? 'button',
        'data-state': ctx.value === value ? 'checked' : 'unchecked',
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          props.onClick?.(event)
          ctx.onValueChange(value)
        },
      },
      children
    )
  }

  return {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  }
})

const STORAGE_KEY = 'calendrier_editorial_v5'

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

async function expectSavedColumnsLength(expectedLength: number) {
  await waitFor(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(typeof raw).toBe('string')

    if (typeof raw !== 'string') return

    const parsed: unknown = JSON.parse(raw)
    expect(Array.isArray(parsed)).toBe(true)

    if (Array.isArray(parsed)) {
      expect(parsed).toHaveLength(expectedLength)
    }
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('CalendrierEditorial', () => {
  it('affiche le calendrier initial 2026 avec les mois, semaines ISO et actions principales', async () => {
    renderWithProviders(<CalendrierEditorial />)

    expect(
      screen.getByRole('heading', { name: /Calendrier éditorial OpenPulse/i }).textContent
    ).toContain('Calendrier éditorial OpenPulse')
    expect(screen.getByText('Septembre 2026').textContent).toBe('Septembre 2026')
    expect(screen.getByText('Octobre 2026').textContent).toBe('Octobre 2026')
    expect(screen.getByText('Novembre 2026').textContent).toBe('Novembre 2026')
    expect(screen.getByText('Décembre 2026').textContent).toBe('Décembre 2026')
    expect(screen.queryByText('Janvier 2027')).toBeNull()
    expect(screen.getByText('S36').textContent).toBe('S36')
    expect(screen.getByText('S53').textContent).toBe('S53')
    expect(screen.getAllByText('À rédiger')).toHaveLength(18)
    expect(screen.getAllByRole('button', { name: /Ajouter une carte/i })).toHaveLength(4)

    await expectSavedColumnsLength(16)
  })

  it('bascule sur le plan 2027 via les onglets années', () => {
    renderWithProviders(<CalendrierEditorial />)

    fireEvent.click(screen.getByRole('button', { name: '2027' }))

    expect(screen.getByText('Janvier 2027').textContent).toBe('Janvier 2027')
    expect(screen.getByText('Décembre 2027').textContent).toBe('Décembre 2027')
    expect(screen.getByText('S1').textContent).toBe('S1')
    expect(screen.queryByText('Septembre 2026')).toBeNull()
    expect(screen.getAllByRole('button', { name: /Ajouter une carte/i })).toHaveLength(12)
  })

  it('normalise les données stockées et conserve les valeurs métier des cartes existantes', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: '2026-09',
          label: 'Septembre 2026',
          cards: [
            {
              id: 'c1',
              title: 'Ancien titre',
              weekNumber: 36,
              content: 'Brief LinkedIn septembre',
              tags: '#ia #linkedin',
              image: null,
              video: null,
              status: 'a_revoir',
            },
          ],
        },
      ])
    )

    renderWithProviders(<CalendrierEditorial />)

    expect(screen.getByText('Septembre 2026').parentElement?.textContent).toContain('1/1 carte')
    expect(screen.getByText('S36').textContent).toBe('S36')
    expect(screen.getByText('À revoir').textContent).toBe('À revoir')
    expect(screen.getAllByText('À rédiger')).toHaveLength(14)

    await waitFor(() => {
      const raw = localStorage.getItem(STORAGE_KEY)
      expect(raw).not.toBeNull()
      const persisted = JSON.parse(raw ?? '[]') as Array<{
        id: string
        cards: Array<{ id: string; content: string; tags: string }>
      }>
      const september = persisted.find((column) => column.id === '2026-09')
      const existing = september?.cards.find((card) => card.id === 'c1')
      expect(existing).toMatchObject({
        content: 'Brief LinkedIn septembre',
        tags: '#ia #linkedin',
      })
    })

    await expectSavedColumnsLength(16)
  })

  it('ajoute une publication additionnelle dans la première colonne visible', async () => {
    renderWithProviders(<CalendrierEditorial />)

    const addButtons = screen.getAllByRole('button', { name: /Ajouter une carte/i })
    expect(addButtons).toHaveLength(4)

    const firstAddButton = addButtons.at(0)
    expect(firstAddButton).toBeDefined()

    if (firstAddButton) {
      fireEvent.click(firstAddButton)
    }

    expect(screen.getByText('Publication additionnelle').textContent).toBe(
      'Publication additionnelle'
    )
    expect(screen.getByText('Septembre 2026').parentElement?.textContent).toContain('5 cartes')
    expect(screen.getAllByText('À rédiger')).toHaveLength(19)

    await waitFor(() => {
      const raw = localStorage.getItem(STORAGE_KEY)
      expect(typeof raw).toBe('string')
      expect(raw?.includes('Publication additionnelle')).toBe(true)
    })
  })

  it('retombe sur le calendrier initial quand le stockage local contient une valeur invalide', async () => {
    localStorage.setItem(STORAGE_KEY, '{invalide')

    renderWithProviders(<CalendrierEditorial />)

    expect(screen.getByText('Septembre 2026').textContent).toBe('Septembre 2026')
    expect(screen.getByText('Décembre 2026').textContent).toBe('Décembre 2026')
    expect(screen.getByText('S36').textContent).toBe('S36')
    expect(screen.getByText('S53').textContent).toBe('S53')
    expect(screen.getAllByText('À rédiger')).toHaveLength(18)

    await expectSavedColumnsLength(16)
  })
})
