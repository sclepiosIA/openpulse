import type { ReactElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ColumnConfig } from '@/hooks/views/useColumnVisibility'

vi.mock('@/components/ui/button', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string
    size?: string
    asChild?: boolean
  }

  const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ children, variant: _variant, size: _size, asChild: _asChild, ...props }, ref) =>
      React.createElement('button', { ...props, ref }, children),
  )

  Button.displayName = 'Button'

  return {
    Button,
    buttonVariants: vi.fn(() => ''),
  }
})

vi.mock('@/components/ui/popover', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  type PopoverProps = {
    children?: React.ReactNode
  }

  type PopoverTriggerProps = {
    children?: React.ReactNode
    asChild?: boolean
  }

  type PopoverContentProps = React.HTMLAttributes<HTMLDivElement> & {
    align?: 'start' | 'center' | 'end'
  }

  const Popover = ({ children }: PopoverProps) =>
    React.createElement('div', { 'data-testid': 'popover' }, children)

  const PopoverTrigger = ({ children, asChild: _asChild }: PopoverTriggerProps) =>
    React.createElement(React.Fragment, null, children)

  const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
    ({ children, align: _align, ...props }, ref) =>
      React.createElement('div', { ...props, ref, 'data-testid': 'popover-content' }, children),
  )

  PopoverContent.displayName = 'PopoverContent'

  return {
    Popover,
    PopoverTrigger,
    PopoverContent,
  }
})

vi.mock('@/components/ui/checkbox', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> & {
    onCheckedChange?: (checked: boolean) => void
  }

  const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ onCheckedChange, checked, disabled, ...props }, ref) =>
      React.createElement('input', {
        ...props,
        ref,
        type: 'checkbox',
        checked: Boolean(checked),
        disabled,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          if (!disabled) {
            onCheckedChange?.(event.target.checked)
          }
        },
      }),
  )

  Checkbox.displayName = 'Checkbox'

  return { Checkbox }
})

vi.mock('lucide-react', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  const Icon = (props: React.SVGProps<SVGSVGElement>) =>
    React.createElement('svg', { ...props, 'aria-hidden': 'true' })

  return {
    Columns3: Icon,
    RotateCcw: Icon,
    ChevronUp: Icon,
    ChevronDown: Icon,
  }
})

import { ColumnVisibilityMenu } from './ColumnVisibilityMenu'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const columns = [
  { key: 'name', label: 'Nom', required: true },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Statut' },
] as ColumnConfig[]

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

function renderMenu(options?: { triggerClassName?: string }) {
  const visibleKeys = new Set(['name', 'status'])
  const isVisible = vi.fn((key: string) => visibleKeys.has(key))
  const toggle = vi.fn()
  const move = vi.fn()
  const reset = vi.fn()

  renderWithProviders(
    <ColumnVisibilityMenu
      columns={columns}
      isVisible={isVisible}
      toggle={toggle}
      move={move}
      reset={reset}
      triggerClassName={options?.triggerClassName}
    />,
  )

  return { isVisible, toggle, move, reset }
}

describe('ColumnVisibilityMenu', () => {
  it('affiche le bouton, le titre, les colonnes et les états de visibilité', () => {
    const { isVisible } = renderMenu()

    const trigger = screen.getByRole('button', { name: 'Colonnes affichées' }) as HTMLButtonElement
    expect(trigger.getAttribute('title')).toBe('Colonnes affichées')
    expect(trigger.getAttribute('class')).toBe('h-9 px-2')

    expect(screen.getByTestId('popover')).toBeTruthy()
    expect(screen.getByTestId('popover-content')).toBeTruthy()
    expect(screen.getByText('Colonnes')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Réinitialiser' })).toBeTruthy()

    expect(screen.getByText('Nom')).toBeTruthy()
    expect(screen.getByText('Email')).toBeTruthy()
    expect(screen.getByText('Statut')).toBeTruthy()
    expect(screen.getByText('(requis)')).toBeTruthy()

    const nameCheckbox = screen.getByRole('checkbox', { name: 'Afficher Nom' }) as HTMLInputElement
    const emailCheckbox = screen.getByRole('checkbox', { name: 'Afficher Email' }) as HTMLInputElement
    const statusCheckbox = screen.getByRole('checkbox', { name: 'Afficher Statut' }) as HTMLInputElement

    expect(nameCheckbox.checked).toBe(true)
    expect(nameCheckbox.disabled).toBe(true)
    expect(emailCheckbox.checked).toBe(false)
    expect(emailCheckbox.disabled).toBe(false)
    expect(statusCheckbox.checked).toBe(true)
    expect(statusCheckbox.disabled).toBe(false)

    expect(isVisible).toHaveBeenCalledTimes(3)
    expect(isVisible).toHaveBeenCalledWith('name')
    expect(isVisible).toHaveBeenCalledWith('email')
    expect(isVisible).toHaveBeenCalledWith('status')
  })

  it('appelle reset, toggle et move avec les clés et directions attendues', () => {
    const { toggle, move, reset } = renderMenu()

    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }))
    expect(reset).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Afficher Email' }))
    expect(toggle).toHaveBeenCalledTimes(1)
    expect(toggle).toHaveBeenCalledWith('email')

    const requiredCheckbox = screen.getByRole('checkbox', { name: 'Afficher Nom' }) as HTMLInputElement
    expect(requiredCheckbox.disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Descendre Nom' }))
    expect(move).toHaveBeenCalledWith('name', 'down')

    fireEvent.click(screen.getByRole('button', { name: 'Monter Email' }))
    expect(move).toHaveBeenCalledWith('email', 'up')

    fireEvent.click(screen.getByRole('button', { name: 'Descendre Email' }))
    expect(move).toHaveBeenCalledWith('email', 'down')

    expect(move).toHaveBeenCalledTimes(3)
  })

  it('désactive les boutons de déplacement impossibles aux bornes de la liste', () => {
    renderMenu()

    const moveNameUp = screen.getByRole('button', { name: 'Monter Nom' }) as HTMLButtonElement
    const moveNameDown = screen.getByRole('button', { name: 'Descendre Nom' }) as HTMLButtonElement
    const moveEmailUp = screen.getByRole('button', { name: 'Monter Email' }) as HTMLButtonElement
    const moveEmailDown = screen.getByRole('button', { name: 'Descendre Email' }) as HTMLButtonElement
    const moveStatusUp = screen.getByRole('button', { name: 'Monter Statut' }) as HTMLButtonElement
    const moveStatusDown = screen.getByRole('button', { name: 'Descendre Statut' }) as HTMLButtonElement

    expect(moveNameUp.disabled).toBe(true)
    expect(moveNameDown.disabled).toBe(false)
    expect(moveEmailUp.disabled).toBe(false)
    expect(moveEmailDown.disabled).toBe(false)
    expect(moveStatusUp.disabled).toBe(false)
    expect(moveStatusDown.disabled).toBe(true)
  })

  it('utilise la classe personnalisée du bouton déclencheur quand elle est fournie', () => {
    renderMenu({ triggerClassName: 'custom-trigger' })

    const trigger = screen.getByRole('button', { name: 'Colonnes affichées' }) as HTMLButtonElement
    expect(trigger.getAttribute('class')).toBe('custom-trigger')
  })
})