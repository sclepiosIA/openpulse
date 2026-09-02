import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps, ReactNode, SVGProps } from 'react'
import { InlineEditCell, type InlineEditOption } from './InlineEditCell'

vi.mock('@/components/ui/input', async () => {
  const React = await import('react')

  const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>((props, ref) => (
    <input ref={ref} data-testid="inline-input" {...props} />
  ))

  Input.displayName = 'Input'

  return { Input }
})

vi.mock('@/components/ui/select', async () => {
  const React = await import('react')

  interface SelectContextValue {
    value: string
    onValueChange: (value: string) => void | Promise<void>
    onOpenChange?: (open: boolean) => void
  }

  interface SelectRootProps {
    open?: boolean
    value?: string
    onValueChange?: (value: string) => void | Promise<void>
    onOpenChange?: (open: boolean) => void
    children?: ReactNode
  }

  interface SelectTriggerProps {
    className?: string
    children?: ReactNode
  }

  interface SelectContentProps {
    children?: ReactNode
  }

  interface SelectItemProps {
    value: string
    children?: ReactNode
  }

  const SelectContext = React.createContext<SelectContextValue>({
    value: '',
    onValueChange: () => undefined,
  })

  const Select = ({ value = '', onValueChange, onOpenChange, children }: SelectRootProps) => (
    <SelectContext.Provider
      value={{
        value,
        onValueChange: onValueChange ?? (() => undefined),
        onOpenChange,
      }}
    >
      <div data-testid="select-root">{children}</div>
    </SelectContext.Provider>
  )

  const SelectTrigger = ({ className, children }: SelectTriggerProps) => (
    <button type="button" data-testid="select-trigger" className={className}>
      {children}
    </button>
  )

  const SelectValue = () => {
    const context = React.useContext(SelectContext)

    return <span data-testid="select-value">{context.value}</span>
  }

  const SelectContent = ({ children }: SelectContentProps) => (
    <div role="listbox" data-testid="select-content">
      {children}
    </div>
  )

  const SelectItem = ({ value, children }: SelectItemProps) => {
    const context = React.useContext(SelectContext)

    return (
      <button
        type="button"
        role="option"
        aria-selected={context.value === value}
        onClick={() => {
          void context.onValueChange(value)
        }}
      >
        {children}
      </button>
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

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: Array<string | false | null | undefined>) => inputs.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', () => ({
  Pencil: (props: SVGProps<SVGSVGElement>) => <svg data-testid="pencil-icon" {...props} />,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderCell(props: Partial<ComponentProps<typeof InlineEditCell>> = {}) {
  const defaultProps: ComponentProps<typeof InlineEditCell> = {
    value: 'Alice',
    onSave: vi.fn(),
  }

  return render(<InlineEditCell {...defaultProps} {...props} />)
}

function createDeferred<T>() {
  let resolvePromise: (value: T | PromiseLike<T>) => void = () => undefined
  let rejectPromise: (reason?: unknown) => void = () => undefined

  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  }
}

describe('InlineEditCell', () => {
  it('renders the read mode value, placeholder, custom display and edit icon', () => {
    const { rerender } = renderCell({
      value: 'Entreprise',
      ariaLabel: 'Modifier le nom',
    })

    expect(screen.getByRole('button', { name: 'Modifier le nom' }).textContent).toContain('Entreprise')
    expect(screen.getByTestId('pencil-icon')).toBeTruthy()

    rerender(
      <InlineEditCell
        value={null}
        onSave={vi.fn()}
        placeholder="Aucune valeur"
        ariaLabel="Modifier la valeur"
      />,
    )

    expect(screen.getByRole('button', { name: 'Modifier la valeur' }).textContent).toContain('Aucune valeur')

    rerender(
      <InlineEditCell
        value="won"
        onSave={vi.fn()}
        ariaLabel="Modifier le statut"
        renderDisplay={(value) => <strong>Statut: {value}</strong>}
      />,
    )

    expect(screen.getByText('Statut: won')).toBeTruthy()
  })

  it('does not enter edit mode when disabled', async () => {
    const user = userEvent.setup()

    renderCell({
      value: 'Verrouillé',
      disabled: true,
      ariaLabel: 'Modifier verrouillé',
    })

    const button = screen.getByRole('button', { name: 'Modifier verrouillé' }) as HTMLButtonElement

    expect(button.disabled).toBe(true)
    expect(screen.queryByTestId('pencil-icon')).toBeNull()

    await user.click(button)

    expect(screen.queryByTestId('inline-input')).toBeNull()
    expect(screen.getByRole('button', { name: 'Modifier verrouillé' }).textContent).toContain('Verrouillé')
  })

  it('enters text edit mode and saves a changed value with Enter', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn<(newValue: string | number | null) => Promise<void>>().mockResolvedValue(undefined)

    renderCell({
      value: 'Alice',
      onSave,
      ariaLabel: 'Modifier le nom',
    })

    await user.click(screen.getByRole('button', { name: 'Modifier le nom' }))

    const input = screen.getByRole('textbox') as HTMLInputElement

    expect(input.value).toBe('Alice')

    await user.clear(input)
    await user.type(input, 'Bob')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith('Bob')
    })

    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: 'Modifier le nom' }).textContent).toContain('Alice')
  })

  it('does not call onSave when Enter is pressed without changing the value', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn<(newValue: string | number | null) => Promise<void>>().mockResolvedValue(undefined)

    renderCell({
      value: 'Stable',
      onSave,
      ariaLabel: 'Modifier stable',
    })

    await user.click(screen.getByRole('button', { name: 'Modifier stable' }))
    await user.keyboard('{Enter}')

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: 'Modifier stable' }).textContent).toContain('Stable')
  })

  it('cancels edition with Escape and restores the original value', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn<(newValue: string | number | null) => Promise<void>>().mockResolvedValue(undefined)

    renderCell({
      value: 'Original',
      onSave,
      ariaLabel: 'Modifier original',
    })

    await user.click(screen.getByRole('button', { name: 'Modifier original' }))

    const input = screen.getByRole('textbox') as HTMLInputElement

    await user.clear(input)
    await user.type(input, 'Brouillon')
    await user.keyboard('{Escape}')

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: 'Modifier original' }).textContent).toContain('Original')
  })

  it('saves on blur for a text input', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn<(newValue: string | number | null) => Promise<void>>().mockResolvedValue(undefined)

    renderCell({
      value: 'Avant',
      onSave,
      ariaLabel: 'Modifier sur blur',
    })

    await user.click(screen.getByRole('button', { name: 'Modifier sur blur' }))

    const input = screen.getByRole('textbox') as HTMLInputElement

    await user.clear(input)
    await user.type(input, 'Après')
    input.blur()

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith('Après')
    })

    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('exposes a loading state by disabling the input while save is pending', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<void>()
    const onSave = vi.fn<(newValue: string | number | null) => Promise<void>>(() => deferred.promise)

    renderCell({
      value: 'Début',
      onSave,
      ariaLabel: 'Modifier chargement',
    })

    await user.click(screen.getByRole('button', { name: 'Modifier chargement' }))

    const input = screen.getByRole('textbox') as HTMLInputElement

    await user.clear(input)
    await user.type(input, 'Fin')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('Fin')
      expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true)
    })

    await act(async () => {
      deferred.resolve()
      await deferred.promise
    })

    await waitFor(() => {
      expect(screen.queryByRole('textbox')).toBeNull()
    })
  })

  it('keeps edit mode and restores the original value when save fails', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn<(newValue: string | number | null) => Promise<void>>().mockRejectedValue(new Error('x'))

    renderCell({
      value: 'Départ',
      onSave,
      ariaLabel: 'Modifier erreur',
    })

    await user.click(screen.getByRole('button', { name: 'Modifier erreur' }))

    const input = screen.getByRole('textbox') as HTMLInputElement

    await user.clear(input)
    await user.type(input, 'Valeur cassée')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith('Valeur cassée')
      expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Départ')
      expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(false)
    })
  })

  it('parses number edits as numbers and empty number edits as null', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn<(newValue: string | number | null) => Promise<void>>().mockResolvedValue(undefined)

    renderCell({
      value: 7,
      type: 'number',
      onSave,
      ariaLabel: 'Modifier montant',
    })

    await user.click(screen.getByRole('button', { name: 'Modifier montant' }))

    const firstInput = screen.getByRole('spinbutton') as HTMLInputElement

    expect(firstInput.type).toBe('number')
    expect(firstInput.value).toBe('7')

    await user.clear(firstInput)
    await user.type(firstInput, '42')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(42)
    })

    await user.click(screen.getByRole('button', { name: 'Modifier montant' }))

    const secondInput = screen.getByRole('spinbutton') as HTMLInputElement

    await user.clear(secondInput)
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(2)
      expect(onSave).toHaveBeenLastCalledWith(null)
    })
  })

  it('saves selected option values for select cells', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn<(newValue: string | number | null) => Promise<void>>().mockResolvedValue(undefined)
    const options: InlineEditOption[] = [
      { value: 'pending', label: 'En attente' },
      { value: 'active', label: 'Actif' },
      { value: 'closed', label: 'Fermé' },
    ]

    renderCell({
      value: 'pending',
      type: 'select',
      options,
      onSave,
      ariaLabel: 'Modifier statut',
    })

    await user.click(screen.getByRole('button', { name: 'Modifier statut' }))

    expect(screen.getByTestId('select-value').textContent).toBe('pending')
    expect(screen.getByRole('option', { name: 'En attente' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Actif' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Fermé' })).toBeTruthy()

    await user.click(screen.getByRole('option', { name: 'Actif' }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith('active')
      expect(screen.queryByRole('option', { name: 'Actif' })).toBeNull()
    })
  })

  it('restores select value and keeps editing closed when select save fails', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn<(newValue: string | number | null) => Promise<void>>().mockRejectedValue(new Error('x'))
    const options: InlineEditOption[] = [
      { value: 'lead', label: 'Prospect' },
      { value: 'customer', label: 'Client' },
    ]

    renderCell({
      value: 'lead',
      type: 'select',
      options,
      onSave,
      ariaLabel: 'Modifier type',
    })

    await user.click(screen.getByRole('button', { name: 'Modifier type' }))
    await user.click(screen.getByRole('option', { name: 'Client' }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('customer')
      expect(screen.getByTestId('select-value').textContent).toBe('lead')
    })
  })

  it('stops click propagation in read and edit modes', async () => {
    const user = userEvent.setup()
    const parentClick = vi.fn()
    const onSave = vi.fn<(newValue: string | number | null) => Promise<void>>().mockResolvedValue(undefined)

    render(
      <div onClick={parentClick}>
        <InlineEditCell value="Propagation" onSave={onSave} ariaLabel="Modifier propagation" />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: 'Modifier propagation' }))

    expect(parentClick).not.toHaveBeenCalled()

    await user.click(screen.getByRole('textbox'))

    expect(parentClick).not.toHaveBeenCalled()
  })
})