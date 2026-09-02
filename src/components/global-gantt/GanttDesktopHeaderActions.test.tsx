import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { GanttDesktopHeaderActions } from './GanttDesktopHeaderActions'

const {
  dropdownState,
  selectHandlers,
  cnMock,
} = vi.hoisted(() => ({
  dropdownState: {
    open: false,
  },
  selectHandlers: new Map<string, (value: string) => void>(),
  cnMock: vi.fn((...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')),
}))

vi.mock('@/lib/utils', () => ({
  cn: cnMock,
}))

vi.mock('lucide-react', () => ({
  Bell: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-bell" {...props} />,
  AlertCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-alert-circle" {...props} />,
  Plus: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-plus" {...props} />,
  ArrowUp: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-arrow-up" {...props} />,
  ArrowDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-arrow-down" {...props} />,
  ArrowUpDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-arrow-up-down" {...props} />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    title,
    className,
    variant,
    size,
  }: {
    children: React.ReactNode
    onClick?: () => void
    title?: string
    className?: string
    variant?: string
    size?: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode
    variant?: string
    className?: string
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  DropdownMenuContent: ({
    children,
    className,
  }: {
    children: React.ReactNode
    align?: string
    className?: string
  }) => (dropdownState.open ? <div data-testid="dropdown-content" className={className}>{children}</div> : null),
  DropdownMenuItem: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <div data-testid="dropdown-item" className={className}>{children}</div>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode
    value: string
    onValueChange: (value: string) => void
  }) => {
    const kind = value === 'etablissement' || value === 'categorie' || value === 'responsable' || value === 'statut'
      ? 'group'
      : 'sort'
    selectHandlers.set(kind, onValueChange)
    return (
      <div data-testid={`select-${kind}`} data-value={value}>
        {children}
      </div>
    )
  },
  SelectTrigger: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <button type="button" className={className}>{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? 'selected'}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    children,
    value,
    className,
  }: {
    children: React.ReactNode
    value: string
    className?: string
  }) => (
    <button
      type="button"
      data-testid={`select-item-${value}`}
      className={className}
      onClick={() => {
        const isGroup = value === 'etablissement' || value === 'categorie' || value === 'responsable' || value === 'statut'
        const isSortOnly = value === 'date_debut' || value === 'echeance' || value === 'titre' || value === 'priorite'
        if (isSortOnly) {
          selectHandlers.get('sort')?.(value)
          return
        }
        if (value === 'responsable' || value === 'statut') {
          const sortHandler = selectHandlers.get('sort')
          if (sortHandler) {
            sortHandler(value)
            return
          }
        }
        if (isGroup) {
          selectHandlers.get('group')?.(value)
        }
      }}
    >
      {children}
    </button>
  ),
}))

describe('GanttDesktopHeaderActions', () => {
  beforeEach(() => {
    dropdownState.open = false
    selectHandlers.clear()
    cnMock.mockClear()
  })

  it('affiche les alertes avec badge destructif et le détail du menu', () => {
    dropdownState.open = true

    render(
      <GanttDesktopHeaderActions
        alerts={[
          { id: 'a1', type: 'critical', message: 'Retard critique' },
          { id: 'a2', type: 'warning', message: 'Échéance proche' },
          { id: 'a3', type: 'info', message: 'Information' },
        ]}
        groupBy="etablissement"
        onGroupByChange={vi.fn()}
        sortField="date_debut"
        onSortFieldChange={vi.fn()}
        sortDirection="asc"
        onSortDirectionToggle={vi.fn()}
        onCreateTask={vi.fn()}
      />
    )

    expect(screen.getByTestId('badge')).toHaveTextContent('3')
    expect(screen.getByTestId('badge')).toHaveAttribute('data-variant', 'destructive')

    const items = screen.getAllByTestId('dropdown-item')
    expect(items).toHaveLength(3)
    expect(screen.getByText('Retard critique')).toBeInTheDocument()
    expect(screen.getByText('Échéance proche')).toBeInTheDocument()
    expect(screen.getByText('Information')).toBeInTheDocument()

    expect(cnMock).toHaveBeenCalledTimes(3)
    const classes = cnMock.mock.calls.map(call => call.filter(Boolean).join(' '))
    expect(classes[0]).toContain('text-destructive')
    expect(classes[1]).toContain('text-warning')
    expect(classes[2]).toContain('text-primary')
  })

  it('n affiche pas les éléments liés aux alertes quand la liste est vide', () => {
    render(
      <GanttDesktopHeaderActions
        alerts={[]}
        groupBy="categorie"
        onGroupByChange={vi.fn()}
        sortField="titre"
        onSortFieldChange={vi.fn()}
        sortDirection="desc"
        onSortDirectionToggle={vi.fn()}
        onCreateTask={vi.fn()}
      />
    )

    expect(screen.queryByTestId('icon-bell')).not.toBeInTheDocument()
    expect(screen.queryByTestId('badge')).not.toBeInTheDocument()
    expect(screen.queryByTestId('dropdown-content')).not.toBeInTheDocument()
  })

  it('déclenche les callbacks de groupement, tri, inversion du tri et création', () => {
    const onGroupByChange = vi.fn()
    const onSortFieldChange = vi.fn()
    const onSortDirectionToggle = vi.fn()
    const onCreateTask = vi.fn()

    const { rerender } = render(
      <GanttDesktopHeaderActions
        alerts={[{ id: 'a1', type: 'info', message: 'Note' }]}
        groupBy="etablissement"
        onGroupByChange={onGroupByChange}
        sortField="date_debut"
        onSortFieldChange={onSortFieldChange}
        sortDirection="asc"
        onSortDirectionToggle={onSortDirectionToggle}
        onCreateTask={onCreateTask}
      />
    )

    const sortSelect = screen.getByTestId('select-sort')
    fireEvent.click(within(sortSelect).getByTestId('select-item-responsable'))
    fireEvent.click(within(sortSelect).getByTestId('select-item-statut'))

    expect(onSortFieldChange).toHaveBeenCalledTimes(2)
    expect(onSortFieldChange).toHaveBeenNthCalledWith(1, 'responsable')
    expect(onSortFieldChange).toHaveBeenNthCalledWith(2, 'statut')

    fireEvent.click(screen.getByTitle('Croissant'))
    expect(onSortDirectionToggle).toHaveBeenCalledTimes(1)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1])
    expect(onCreateTask).toHaveBeenCalledTimes(1)

    rerender(
      <GanttDesktopHeaderActions
        alerts={[]}
        groupBy="etablissement"
        onGroupByChange={onGroupByChange}
        sortField="date_debut"
        onSortFieldChange={onSortFieldChange}
        sortDirection="asc"
        onSortDirectionToggle={onSortDirectionToggle}
        onCreateTask={onCreateTask}
      />
    )

    const groupSelect = screen.getByTestId('select-group')
    fireEvent.click(within(groupSelect).getByTestId('select-item-categorie'))
    expect(onGroupByChange).toHaveBeenCalledWith('categorie')
  })

  it('affiche le tri décroissant avec la bonne icône et le bon titre', () => {
    render(
      <GanttDesktopHeaderActions
        alerts={[]}
        groupBy="statut"
        onGroupByChange={vi.fn()}
        sortField="priorite"
        onSortFieldChange={vi.fn()}
        sortDirection="desc"
        onSortDirectionToggle={vi.fn()}
        onCreateTask={vi.fn()}
      />
    )

    expect(screen.getByTitle('Décroissant')).toBeInTheDocument()
    expect(screen.getByTestId('icon-arrow-down')).toBeInTheDocument()
    expect(screen.queryByTestId('icon-arrow-up')).not.toBeInTheDocument()
    expect(screen.getByText('Tâche')).toBeInTheDocument()
    expect(screen.getByTestId('select-sort')).toHaveAttribute('data-value', 'priorite')
    expect(screen.getByTestId('select-group')).toHaveAttribute('data-value', 'statut')
  })
})