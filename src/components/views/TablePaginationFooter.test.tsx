import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ChangeEvent, ComponentProps, ComponentPropsWithoutRef, ReactNode } from 'react'
import { TablePaginationFooter } from './TablePaginationFooter'

vi.mock('@/components/ui/button', async () => {
  const React = await import('react')

  type ButtonProps = ComponentPropsWithoutRef<'button'> & {
    variant?: string
    size?: string
    asChild?: boolean
  }

  const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant, size, asChild, className, ...props }, ref) => {
      void variant
      void size
      void asChild
      void className

      return React.createElement('button', { ...props, ref, type: 'button' })
    },
  )

  Button.displayName = 'Button'

  return {
    Button,
    buttonVariants: () => '',
  }
})

vi.mock('@/components/ui/select', async () => {
  const React = await import('react')

  type SelectProps = {
    value?: string
    onValueChange?: (value: string) => void
    children?: ReactNode
  }

  type ChildrenProps = {
    children?: ReactNode
    className?: string
  }

  type SelectItemProps = ChildrenProps & {
    value: string
  }

  const Select = ({ value, onValueChange, children }: SelectProps) =>
    React.createElement(
      'select',
      {
        'aria-label': 'Lignes',
        'data-testid': 'page-size-select',
        value,
        onChange: (event: ChangeEvent<HTMLSelectElement>) => {
          onValueChange?.(event.currentTarget.value)
        },
      },
      children,
    )

  const SelectContent = ({ children, className }: ChildrenProps) => {
    void className

    return React.createElement(React.Fragment, null, children)
  }

  const SelectItem = ({ value, children, className }: SelectItemProps) => {
    void className

    return React.createElement('option', { value }, children)
  }

  const SelectTrigger = ({ children, className }: ChildrenProps) => {
    void children
    void className

    return null
  }

  const SelectValue = () => null

  return {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  }
})

vi.mock('lucide-react', async () => {
  const React = await import('react')

  type IconProps = {
    className?: string
  }

  const Icon = ({ className }: IconProps) =>
    React.createElement('svg', {
      'aria-hidden': 'true',
      className,
      viewBox: '0 0 24 24',
    })

  return {
    ChevronLeft: Icon,
    ChevronRight: Icon,
    ChevronsLeft: Icon,
    ChevronsRight: Icon,
  }
})

type FooterProps = ComponentProps<typeof TablePaginationFooter>

const makeProps = (overrides: Partial<FooterProps> = {}): FooterProps => ({
  page: 2,
  pageCount: 5,
  pageSize: 50,
  pageSizeOptions: [25, 50, 100, 200, 'all'],
  from: 51,
  to: 100,
  total: 240,
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
  ...overrides,
})

const textOf = (element: HTMLElement): string => element.textContent ?? ''

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TablePaginationFooter', () => {
  it('ne rend rien quand le total est nul', () => {
    const { container } = render(
      <TablePaginationFooter {...makeProps({ total: 0, from: 0, to: 0 })} />,
    )

    expect(container.firstChild).toBeNull()
  })

  it('affiche la plage formatée, le total, les options de taille et la page courante', () => {
    const { container } = render(
      <TablePaginationFooter
        {...makeProps({
          from: 1000,
          to: 1250,
          total: 10000,
          page: 3,
          pageCount: 8,
          pageSize: 100,
        })}
      />,
    )

    const expectedRange = `${(1000).toLocaleString('fr-FR')}–${(1250).toLocaleString(
      'fr-FR',
    )} sur ${(10000).toLocaleString('fr-FR')}`

    expect(textOf(container)).toContain(expectedRange)
    expect(textOf(container)).toContain('Lignes')
    expect(textOf(container)).toContain('3 / 8')

    const selectElement = screen.getByTestId('page-size-select')
    expect(selectElement).toBeInstanceOf(HTMLSelectElement)

    const select = selectElement as HTMLSelectElement

    expect(select.value).toBe('100')
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      '25',
      '50',
      '100',
      '200',
      'all',
    ])
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      '25',
      '50',
      '100',
      '200',
      'Toutes',
    ])
  })

  it('déclenche les changements de page avec les valeurs attendues', () => {
    const onPageChange = vi.fn()

    render(<TablePaginationFooter {...makeProps({ page: 2, pageCount: 5, onPageChange })} />)

    fireEvent.click(screen.getByLabelText('Première page'))
    fireEvent.click(screen.getByLabelText('Page précédente'))
    fireEvent.click(screen.getByLabelText('Page suivante'))
    fireEvent.click(screen.getByLabelText('Dernière page'))

    expect(onPageChange).toHaveBeenCalledTimes(4)
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1)
    expect(onPageChange).toHaveBeenNthCalledWith(2, 1)
    expect(onPageChange).toHaveBeenNthCalledWith(3, 3)
    expect(onPageChange).toHaveBeenNthCalledWith(4, 5)
  })

  it('désactive les boutons de début sur la première page et les boutons de fin sur la dernière page', () => {
    const { rerender } = render(<TablePaginationFooter {...makeProps({ page: 1, pageCount: 5 })} />)

    expect((screen.getByLabelText('Première page') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Page précédente') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Page suivante') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByLabelText('Dernière page') as HTMLButtonElement).disabled).toBe(false)

    rerender(<TablePaginationFooter {...makeProps({ page: 5, pageCount: 5 })} />)

    expect((screen.getByLabelText('Première page') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByLabelText('Page précédente') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByLabelText('Page suivante') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Dernière page') as HTMLButtonElement).disabled).toBe(true)
  })

  it('convertit les changements de taille en nombre ou en valeur all', () => {
    const onPageSizeChange = vi.fn()

    render(
      <TablePaginationFooter
        {...makeProps({
          pageSize: 50,
          onPageSizeChange,
        })}
      />,
    )

    const select = screen.getByTestId('page-size-select')

    fireEvent.change(select, { target: { value: '100' } })
    fireEvent.change(select, { target: { value: 'all' } })

    expect(onPageSizeChange).toHaveBeenCalledTimes(2)
    expect(onPageSizeChange).toHaveBeenNthCalledWith(1, 100)
    expect(onPageSizeChange).toHaveBeenNthCalledWith(2, 'all')
  })

  it('masque les contrôles de pagination quand ils sont désactivés, inutiles ou incompatibles avec all', () => {
    const { container, rerender } = render(
      <TablePaginationFooter {...makeProps({ disabled: true, page: 2, pageCount: 5 })} />,
    )

    expect(screen.queryByLabelText('Première page')).toBeNull()
    expect(screen.queryByLabelText('Page suivante')).toBeNull()
    expect(textOf(container)).toContain('51–100 sur 240')

    rerender(<TablePaginationFooter {...makeProps({ pageSize: 'all', page: 1, pageCount: 5 })} />)

    expect(screen.queryByLabelText('Page suivante')).toBeNull()

    const allSelectElement = screen.getByTestId('page-size-select')
    expect(allSelectElement).toBeInstanceOf(HTMLSelectElement)
    expect((allSelectElement as HTMLSelectElement).value).toBe('all')

    rerender(<TablePaginationFooter {...makeProps({ pageSize: 50, page: 1, pageCount: 1 })} />)

    expect(screen.queryByLabelText('Dernière page')).toBeNull()
    expect(textOf(container)).not.toContain('1 / 1')
    expect(textOf(container)).toContain('51–100 sur 240')
  })
})