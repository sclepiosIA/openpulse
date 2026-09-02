import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  MouseEvent,
  ReactElement,
  ReactNode,
} from 'react'
import { GroupByMenu } from './GroupByMenu'

const { FIELDS } = vi.hoisted(() => ({
  FIELDS: [
    { key: 'status', label: 'Statut' },
    { key: 'owner', label: 'Responsable' },
    { key: 'created_at', label: 'Date de création' },
  ],
}))

vi.mock('@/components/ui/button', async () => {
  const React = await import('react')

  type ButtonMockProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean
    variant?: string
    size?: string
  }

  const Button = React.forwardRef<HTMLButtonElement, ButtonMockProps>(
    function ButtonMock(props, ref) {
      const {
        children,
        asChild: _asChild,
        variant: _variant,
        size: _size,
        type,
        ...rest
      } = props

      return React.createElement(
        'button',
        {
          ...rest,
          ref,
          type: type ?? 'button',
        },
        children,
      )
    },
  )

  return {
    Button,
    buttonVariants: () => '',
  }
})

vi.mock('@/components/ui/dropdown-menu', async () => {
  const React = await import('react')

  type DropdownContainerProps = {
    children?: ReactNode
  }

  type DropdownTriggerProps = HTMLAttributes<HTMLDivElement> & {
    asChild?: boolean
    children?: ReactNode
  }

  type DropdownContentProps = HTMLAttributes<HTMLDivElement> & {
    align?: string
    children?: ReactNode
  }

  type DropdownCheckboxItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    children?: ReactNode
  }

  const DropdownMenu = ({ children }: DropdownContainerProps) =>
    React.createElement('div', { 'data-testid': 'dropdown-menu' }, children)

  const DropdownMenuTrigger = React.forwardRef<
    HTMLDivElement,
    DropdownTriggerProps
  >(function DropdownMenuTriggerMock(props, ref) {
    const { children, asChild: _asChild, ...rest } = props

    return React.createElement(
      'div',
      {
        ...rest,
        ref,
        'data-testid': 'dropdown-trigger',
      },
      children,
    )
  })

  const DropdownMenuContent = React.forwardRef<
    HTMLDivElement,
    DropdownContentProps
  >(function DropdownMenuContentMock(props, ref) {
    const { children, align, ...rest } = props

    return React.createElement(
      'div',
      {
        ...rest,
        ref,
        role: 'menu',
        'data-align': align,
        'data-testid': 'dropdown-content',
      },
      children,
    )
  })

  const DropdownMenuItem = React.forwardRef<
    HTMLButtonElement,
    ButtonHTMLAttributes<HTMLButtonElement>
  >(function DropdownMenuItemMock(props, ref) {
    const { children, type, ...rest } = props

    return React.createElement(
      'button',
      {
        ...rest,
        ref,
        type: type ?? 'button',
        role: 'menuitem',
      },
      children,
    )
  })

  const DropdownMenuLabel = React.forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement>
  >(function DropdownMenuLabelMock(props, ref) {
    const { children, ...rest } = props

    return React.createElement(
      'div',
      {
        ...rest,
        ref,
      },
      children,
    )
  })

  const DropdownMenuSeparator = React.forwardRef<
    HTMLHRElement,
    HTMLAttributes<HTMLHRElement>
  >(function DropdownMenuSeparatorMock(props, ref) {
    return React.createElement('hr', {
      ...props,
      ref,
      role: 'separator',
    })
  })

  const DropdownMenuCheckboxItem = React.forwardRef<
    HTMLButtonElement,
    DropdownCheckboxItemProps
  >(function DropdownMenuCheckboxItemMock(props, ref) {
    const {
      children,
      checked = false,
      onCheckedChange,
      onClick,
      type,
      ...rest
    } = props

    return React.createElement(
      'button',
      {
        ...rest,
        ref,
        type: type ?? 'button',
        role: 'menuitemcheckbox',
        'aria-checked': checked,
        onClick: (event: MouseEvent<HTMLButtonElement>) => {
          onClick?.(event)
          if (!event.defaultPrevented) {
            onCheckedChange?.(!checked)
          }
        },
      },
      children,
    )
  })

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuCheckboxItem,
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

const renderWithProviders = (ui: ReactElement) => {
  const queryClient = createQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

describe('GroupByMenu', () => {
  it('affiche l’état sans groupement et tous les choix disponibles', () => {
    const onChange = vi.fn<(key: string | null) => void>()

    renderWithProviders(
      <GroupByMenu fields={FIELDS} groupBy={null} onChange={onChange} />,
    )

    expect(screen.getByRole('button', { name: 'Grouper' })).toBeTruthy()
    expect(screen.getByText('Grouper par')).toBeTruthy()

    const checkboxItems = screen.getAllByRole('menuitemcheckbox')
    expect(checkboxItems).toHaveLength(4)

    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Aucun groupement' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Statut' })
        .getAttribute('aria-checked'),
    ).toBe('false')
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Responsable' })
        .getAttribute('aria-checked'),
    ).toBe('false')
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Date de création' })
        .getAttribute('aria-checked'),
    ).toBe('false')
  })

  it('affiche le libellé actif et coche uniquement le champ groupé', () => {
    const onChange = vi.fn<(key: string | null) => void>()

    renderWithProviders(
      <GroupByMenu fields={FIELDS} groupBy="status" onChange={onChange} />,
    )

    expect(
      screen.getByRole('button', { name: 'Groupé par Statut' }),
    ).toBeTruthy()
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Aucun groupement' })
        .getAttribute('aria-checked'),
    ).toBe('false')
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Statut' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Responsable' })
        .getAttribute('aria-checked'),
    ).toBe('false')
  })

  it('appelle onChange avec la clé du champ sélectionné quand aucun groupement est actif', () => {
    const onChange = vi.fn<(key: string | null) => void>()

    renderWithProviders(
      <GroupByMenu fields={FIELDS} groupBy={null} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Statut' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('status')
  })

  it('appelle onChange avec null pour retirer le groupement courant', () => {
    const onChange = vi.fn<(key: string | null) => void>()

    renderWithProviders(
      <GroupByMenu fields={FIELDS} groupBy="status" onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Statut' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('permet de basculer vers un autre champ ou vers aucun groupement', () => {
    const onChange = vi.fn<(key: string | null) => void>()

    renderWithProviders(
      <GroupByMenu fields={FIELDS} groupBy="status" onChange={onChange} />,
    )

    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: 'Responsable' }),
    )
    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: 'Aucun groupement' }),
    )

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenNthCalledWith(1, 'owner')
    expect(onChange).toHaveBeenNthCalledWith(2, null)
  })
})