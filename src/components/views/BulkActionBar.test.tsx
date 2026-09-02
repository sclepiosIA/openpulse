import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

vi.mock('@/components/ui/button', async () => {
  const React = await import('react')

  interface MockButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean
    variant?: string
    size?: string
  }

  const Button = React.forwardRef<HTMLButtonElement, MockButtonProps>(
    ({ asChild, variant, size, type, children, ...props }, ref) => {
      if (asChild && React.isValidElement(children)) {
        return children
      }

      return React.createElement(
        'button',
        {
          ...props,
          ref,
          type: type ?? 'button',
          'data-variant': variant,
          'data-size': size,
        },
        children,
      )
    },
  )

  Button.displayName = 'Button'

  return {
    Button,
    buttonVariants: () => 'mock-button-variants',
  }
})

vi.mock('@/components/ui/select', async () => {
  const React = await import('react')

  interface SelectContextValue {
    disabled: boolean
    value?: string
    onValueChange?: (value: string) => void
  }

  interface SelectProps {
    value?: string
    onValueChange?: (value: string) => void
    disabled?: boolean
    children?: ReactNode
  }

  interface SelectItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    value: string
  }

  const SelectContext = React.createContext<SelectContextValue>({ disabled: false })

  const Select = ({ value, onValueChange, disabled, children }: SelectProps) => {
    const contextValue: SelectContextValue = { disabled: Boolean(disabled) }

    if (value !== undefined) {
      contextValue.value = value
    }

    if (onValueChange !== undefined) {
      contextValue.onValueChange = onValueChange
    }

    return React.createElement(SelectContext.Provider, { value: contextValue }, children)
  }

  const SelectContent = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', { ...props, role: 'listbox' }, children)

  const SelectTrigger = React.forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, disabled, type, ...props }, ref) => {
      const context = React.useContext(SelectContext)

      return React.createElement(
        'button',
        {
          ...props,
          ref,
          type: type ?? 'button',
          disabled: disabled ?? context.disabled,
        },
        children,
      )
    },
  )

  SelectTrigger.displayName = 'SelectTrigger'

  const SelectValue = ({ placeholder }: { placeholder?: string }) =>
    React.createElement('span', null, placeholder)

  const SelectItem = ({ value, children, type, ...props }: SelectItemProps) => {
    const context = React.useContext(SelectContext)

    return React.createElement(
      'button',
      {
        ...props,
        type: type ?? 'button',
        role: 'option',
        disabled: context.disabled,
        'data-value': value,
        onClick: () => {
          if (!context.disabled) {
            context.onValueChange?.(value)
          }
        },
      },
      children,
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

vi.mock('@/components/ui/dropdown-menu', async () => {
  const React = await import('react')

  interface DropdownRootProps {
    children?: ReactNode
  }

  interface DropdownTriggerProps extends HTMLAttributes<HTMLButtonElement> {
    asChild?: boolean
    children?: ReactNode
  }

  interface DropdownContentProps extends HTMLAttributes<HTMLDivElement> {
    align?: string
    children?: ReactNode
  }

  interface DropdownItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children?: ReactNode
  }

  const DropdownMenu = ({ children }: DropdownRootProps) => React.createElement('div', null, children)

  const DropdownMenuTrigger = ({ asChild, children, type, ...props }: DropdownTriggerProps) => {
    if (asChild && React.isValidElement(children)) {
      return children
    }

    return React.createElement('button', { ...props, type: type ?? 'button' }, children)
  }

  const DropdownMenuContent = ({ align: _align, children, ...props }: DropdownContentProps) =>
    React.createElement('div', { ...props, role: 'menu' }, children)

  const DropdownMenuItem = ({ children, type, ...props }: DropdownItemProps) =>
    React.createElement('button', { ...props, type: type ?? 'button', role: 'menuitem' }, children)

  const DropdownMenuLabel = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', props, children)

  const DropdownMenuSeparator = (props: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', { ...props, role: 'separator' })

  const DropdownMenuSub = ({ children }: DropdownRootProps) => React.createElement('div', null, children)

  const DropdownMenuSubContent = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', props, children)

  const DropdownMenuSubTrigger = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', props, children)

  return {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
  }
})

vi.mock('lucide-react', async () => {
  const React = await import('react')

  interface IconProps extends HTMLAttributes<HTMLSpanElement> {
    className?: string
  }

  const createIcon = (name: string) => {
    const Icon = ({ className, ...props }: IconProps) =>
      React.createElement('span', {
        ...props,
        'aria-hidden': 'true',
        className,
        'data-testid': `icon-${name}`,
      })

    return Icon
  }

  return {
    Download: createIcon('Download'),
    Loader2: createIcon('Loader2'),
    UserCog: createIcon('UserCog'),
    X: createIcon('X'),
  }
})

import {
  BulkActionBar,
  type BulkActionOption,
  type BulkOwnerField,
  type BulkOwnerProfile,
} from './BulkActionBar'

function deferred<T>() {
  let resolveFn: (value: T | PromiseLike<T>) => void = () => undefined
  let rejectFn: (reason?: unknown) => void = () => undefined

  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve
    rejectFn = reject
  })

  return {
    promise,
    resolve: resolveFn,
    reject: rejectFn,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BulkActionBar', () => {
  it('ne rend rien quand aucun élément nest sélectionné', () => {
    const onClear = vi.fn()

    const { container } = render(<BulkActionBar count={0} onClear={onClear} />)

    expect(container.firstChild).toBeNull()
    expect(onClear).not.toHaveBeenCalled()
  })

  it('affiche le compteur, lexport, laction supplémentaire et efface la sélection', () => {
    const onClear = vi.fn()
    const onExportCsv = vi.fn()

    render(
      <BulkActionBar
        count={2}
        onClear={onClear}
        onExportCsv={onExportCsv}
        extraActions={<button type="button">Action bonus</button>}
      />,
    )

    expect(screen.getByText('2 sélectionnés').textContent).toBe('2 sélectionnés')
    expect(screen.getByRole('button', { name: 'Exporter CSV' }).textContent).toContain('Exporter CSV')
    expect(screen.getByRole('button', { name: 'Action bonus' }).textContent).toBe('Action bonus')

    fireEvent.click(screen.getByRole('button', { name: 'Exporter CSV' }))
    fireEvent.click(screen.getByRole('button', { name: 'Effacer la sélection' }))

    expect(onExportCsv).toHaveBeenCalledTimes(1)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('utilise le singulier pour une seule sélection', () => {
    render(<BulkActionBar count={1} onClear={vi.fn()} />)

    expect(screen.getByText('1 sélectionné').textContent).toBe('1 sélectionné')
    expect(screen.queryByText('1 sélectionnés')).toBeNull()
  })

  it('applique un statut, affiche létat de chargement puis réactive le contrôle', async () => {
    const pendingStatus = deferred<void>()
    const onApplyStatus = vi.fn((_status: string) => pendingStatus.promise)

    const statusOptions: BulkActionOption[] = [
      { value: 'new', label: 'Nouveau' },
      { value: 'qualified', label: 'Qualifié' },
      { value: 'lost', label: 'Perdu' },
    ]

    render(
      <BulkActionBar
        count={3}
        onClear={vi.fn()}
        statusOptions={statusOptions}
        onApplyStatus={onApplyStatus}
      />,
    )

    expect(screen.getByLabelText('Changer le statut').textContent).toBe('Changer le statut')
    expect(screen.getByRole('option', { name: 'Nouveau' }).textContent).toBe('Nouveau')
    expect(screen.getByRole('option', { name: 'Qualifié' }).textContent).toBe('Qualifié')

    fireEvent.click(screen.getByRole('option', { name: 'Qualifié' }))

    expect(onApplyStatus).toHaveBeenCalledTimes(1)
    expect(onApplyStatus).toHaveBeenCalledWith('qualified')

    await waitFor(() => {
      const trigger = screen.getByLabelText('Changer le statut') as HTMLButtonElement
      expect(trigger.disabled).toBe(true)
      expect(screen.getByText(/Application/).textContent).toContain('Application')
    })

    await act(async () => {
      pendingStatus.resolve()
      await pendingStatus.promise
    })

    await waitFor(() => {
      const trigger = screen.getByLabelText('Changer le statut') as HTMLButtonElement
      expect(trigger.disabled).toBe(false)
    })

    expect(screen.queryByText(/Application/)).toBeNull()
  })

  it('assigne un propriétaire puis permet de retirer lassignation', async () => {
    const assignment = deferred<void>()
    const onAssignOwner = vi.fn((_fieldKey: string, _profileId: string | null) => assignment.promise)

    const ownerFields: BulkOwnerField[] = [
      { key: 'commercial_id', label: 'Commercial' },
      { key: 'csm_id', label: 'CSM' },
    ]

    const ownerProfiles: BulkOwnerProfile[] = [
      { id: 'p1', label: 'Alice Dupont' },
      { id: 'p2', label: 'Bruno Martin' },
    ]

    render(
      <BulkActionBar
        count={4}
        onClear={vi.fn()}
        ownerFields={ownerFields}
        ownerProfiles={ownerProfiles}
        onAssignOwner={onAssignOwner}
      />,
    )

    expect(screen.getByRole('button', { name: 'Assigner' }).textContent).toContain('Assigner')
    expect(screen.getByText('Assigner à…').textContent).toBe('Assigner à…')
    expect(screen.getByText('Commercial').textContent).toBe('Commercial')
    expect(screen.getByText('CSM').textContent).toBe('CSM')

    const aliceItems = screen.getAllByRole('menuitem', { name: 'Alice Dupont' })
    expect(aliceItems.length).toBe(2)

    const firstAliceItem = aliceItems[0]
    if (firstAliceItem === undefined) {
      throw new Error('Menu item Alice Dupont introuvable')
    }

    fireEvent.click(firstAliceItem)

    expect(onAssignOwner).toHaveBeenCalledTimes(1)
    expect(onAssignOwner).toHaveBeenCalledWith('commercial_id', 'p1')

    await waitFor(() => {
      const assignButton = screen.getByRole('button', { name: 'Assigner' }) as HTMLButtonElement
      expect(assignButton.disabled).toBe(true)
    })

    await act(async () => {
      assignment.resolve()
      await assignment.promise
    })

    await waitFor(() => {
      const assignButton = screen.getByRole('button', { name: 'Assigner' }) as HTMLButtonElement
      expect(assignButton.disabled).toBe(false)
    })

    const emptyItems = screen.getAllByRole('menuitem', { name: 'Aucun' })
    expect(emptyItems.length).toBe(2)

    const firstEmptyItem = emptyItems[0]
    if (firstEmptyItem === undefined) {
      throw new Error('Menu item Aucun introuvable')
    }

    await act(async () => {
      fireEvent.click(firstEmptyItem)
      await Promise.resolve()
    })

    expect(onAssignOwner).toHaveBeenCalledTimes(2)
    expect(onAssignOwner).toHaveBeenLastCalledWith('commercial_id', null)
  })
})