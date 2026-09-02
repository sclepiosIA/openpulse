// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { GanttControls } from './GanttControls'

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    disabled,
    'aria-label': ariaLabel,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} className={className} disabled={disabled} aria-label={ariaLabel} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
  }: React.HTMLAttributes<HTMLSpanElement>) => <span className={className}>{children}</span>,
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: ({ className }: { className?: string }) => <div data-testid="separator" className={className} />,
}))

vi.mock('@/components/ui/toggle-group', () => ({
  ToggleGroup: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode
    type?: string
    value?: string
    onValueChange?: (value: string) => void
    className?: string
  }) => (
    <div data-testid="toggle-group" data-value={value}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ onSelect?: () => void }>, {
              onSelect: () => {
                const element = child as React.ReactElement<{ value: string }>
                onValueChange?.(element.props.value)
              },
            })
          : child
      )}
    </div>
  ),
  ToggleGroupItem: ({
    children,
    value,
    onSelect,
  }: {
    children: React.ReactNode
    value: string
    className?: string
    onSelect?: () => void
  }) => (
    <button type="button" data-testid={`zoom-${value}`} onClick={onSelect}>
      {children}
    </button>
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
  }) => <div className={className}>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLDivElement>
    className?: string
  }) => (
    <div role="menuitem" className={className} onClick={onClick}>
      {children}
    </div>
  ),
  DropdownMenuCheckboxItem: ({
    children,
    onCheckedChange,
    checked,
    className,
  }: {
    children: React.ReactNode
    onCheckedChange?: () => void
    checked?: boolean
    className?: string
  }) => (
    <div
      role="menuitemcheckbox"
      aria-checked={checked ? 'true' : 'false'}
      className={className}
      onClick={onCheckedChange}
    >
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <div data-testid="dropdown-separator" />,
  DropdownMenuLabel: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  PopoverContent: ({
    children,
    className,
  }: {
    children: React.ReactNode
    align?: string
    className?: string
  }) => <div className={className}>{children}</div>,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />
  return {
    ChevronLeft: Icon,
    ChevronRight: Icon,
    Calendar: Icon,
    Filter: Icon,
    FileImage: Icon,
    FileText: Icon,
    Loader2: Icon,
    Plus: Icon,
    Flame: Icon,
    AlertTriangle: Icon,
    CheckCircle2: Icon,
    Construction: Icon,
    BarChart3: Icon,
    Download: Icon,
    HelpCircle: Icon,
    Briefcase: Icon,
    Rocket: Icon,
    Settings: Icon,
  }
})

describe('GanttControls', () => {
  it('affiche les contrôles principaux, la période visible et déclenche navigation/création', () => {
    const onZoomChange = vi.fn()
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    const onToday = vi.fn()
    const onToggleFilters = vi.fn()
    const onCreateTask = vi.fn()

    render(
      <GanttControls
        zoomLevel="week"
        onZoomChange={onZoomChange}
        onPrevious={onPrevious}
        onNext={onNext}
        onToday={onToday}
        onToggleFilters={onToggleFilters}
        visiblePeriod={{ start: new Date(2024, 0, 1), end: new Date(2024, 0, 31) }}
        onCreateTask={onCreateTask}
      />
    )

    expect(screen.getByLabelText('Précédent')).toBeInTheDocument()
    expect(screen.getByLabelText('Suivant')).toBeInTheDocument()
    expect(screen.getAllByText("Aujourd'hui")[0]).toBeInTheDocument()
    expect(screen.getByText('Nouvelle')).toBeInTheDocument()
    expect(screen.getByText(/1 janv/i)).toBeInTheDocument()
    expect(screen.getByText(/31 janv/i)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Précédent'))
    fireEvent.click(screen.getByLabelText('Suivant'))
    fireEvent.click(screen.getAllByText("Aujourd'hui")[0])
    fireEvent.click(screen.getByText('Nouvelle'))

    expect(onPrevious).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onToday).toHaveBeenCalledTimes(1)
    expect(onCreateTask).toHaveBeenCalledTimes(1)
  })

  it('déclenche le changement de zoom via les boutons du ToggleGroup', () => {
    const onZoomChange = vi.fn()

    render(
      <GanttControls
        zoomLevel="week"
        onZoomChange={onZoomChange}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
        onToggleFilters={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('zoom-day'))
    fireEvent.click(screen.getByTestId('zoom-month'))
    fireEvent.click(screen.getByTestId('zoom-year'))

    expect(onZoomChange).toHaveBeenNthCalledWith(1, 'day')
    expect(onZoomChange).toHaveBeenNthCalledWith(2, 'month')
    expect(onZoomChange).toHaveBeenNthCalledWith(3, 'year')
    expect(screen.getByTestId('toggle-group')).toHaveAttribute('data-value', 'week')
    expect(screen.getByText('J')).toBeInTheDocument()
    expect(screen.getByText('S')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('T')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('affiche le badge de filtres rapides avec le bon compteur et déclenche les actions de filtres', () => {
    const onToggleFilters = vi.fn()
    const onToggleQuickFilter = vi.fn()
    const onToggleHeatmap = vi.fn()

    render(
      <GanttControls
        zoomLevel="month"
        onZoomChange={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
        onToggleFilters={onToggleFilters}
        hasActiveFilters={true}
        quickFilters={{
          highPriorityOnly: true,
          overdueOnly: false,
          hideCompleted: true,
          blockedOnly: false,
          commercialOnly: false,
          deploiementOnly: true,
          productionOnly: false,
        }}
        onToggleQuickFilter={onToggleQuickFilter}
        heatmapEnabled={true}
        onToggleHeatmap={onToggleHeatmap}
      />
    )

    expect(screen.getByText('4')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Haute priorité'))
    fireEvent.click(screen.getByText('En retard'))
    fireEvent.click(screen.getByText('Masquer terminées'))
    fireEvent.click(screen.getByText('Bloquées uniquement'))
    fireEvent.click(screen.getByText('Prospect / Commercial'))
    fireEvent.click(screen.getByText('Déploiement'))
    fireEvent.click(screen.getByText('Production'))
    fireEvent.click(screen.getByText('Afficher heatmap'))
    fireEvent.click(screen.getByText('Filtres avancés...'))

    expect(onToggleQuickFilter).toHaveBeenCalledWith('highPriorityOnly')
    expect(onToggleQuickFilter).toHaveBeenCalledWith('overdueOnly')
    expect(onToggleQuickFilter).toHaveBeenCalledWith('hideCompleted')
    expect(onToggleQuickFilter).toHaveBeenCalledWith('blockedOnly')
    expect(onToggleQuickFilter).toHaveBeenCalledWith('commercialOnly')
    expect(onToggleQuickFilter).toHaveBeenCalledWith('deploiementOnly')
    expect(onToggleQuickFilter).toHaveBeenCalledWith('productionOnly')
    expect(onToggleHeatmap).toHaveBeenCalledTimes(1)
    expect(onToggleFilters).toHaveBeenCalledTimes(1)
  })

  it('affiche le badge ! quand seuls des filtres avancés sont actifs sans filtres rapides', () => {
    render(
      <GanttControls
        zoomLevel="day"
        onZoomChange={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
        onToggleFilters={vi.fn()}
        hasActiveFilters={true}
      />
    )

    expect(screen.getByText('!')).toBeInTheDocument()
  })

  it('gère les exports PNG/PDF et désactive le bouton pendant l’export', () => {
    const onExportPNG = vi.fn()
    const onExportPDF = vi.fn()

    const { rerender } = render(
      <GanttControls
        zoomLevel="quarter"
        onZoomChange={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
        onToggleFilters={vi.fn()}
        onExportPNG={onExportPNG}
        onExportPDF={onExportPDF}
        isExporting={false}
      />
    )

    fireEvent.click(screen.getByText('Export PNG'))
    fireEvent.click(screen.getByText('Export PDF'))

    expect(onExportPNG).toHaveBeenCalledTimes(1)
    expect(onExportPDF).toHaveBeenCalledTimes(1)

    rerender(
      <GanttControls
        zoomLevel="quarter"
        onZoomChange={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
        onToggleFilters={vi.fn()}
        onExportPNG={onExportPNG}
        onExportPDF={onExportPDF}
        isExporting={true}
      />
    )

    expect(screen.getByLabelText('Chargement')).toBeDisabled()
  })

  it('affiche la légende complète dans le popover sans ambiguïté sur les textes dupliqués', () => {
    render(
      <GanttControls
        zoomLevel="year"
        onZoomChange={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
        onToggleFilters={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Aide')).toBeInTheDocument()
    expect(screen.getByText('Légende')).toBeInTheDocument()
    expect(screen.getByText('Statuts')).toBeInTheDocument()
    expect(screen.getByText('À faire')).toBeInTheDocument()
    expect(screen.getByText('En cours')).toBeInTheDocument()
    expect(screen.getByText('Bloqué')).toBeInTheDocument()
    expect(screen.getByText('Terminé')).toBeInTheDocument()
    expect(screen.getByText('Priorités (bordure gauche)')).toBeInTheDocument()
    expect(screen.getByText('Haute')).toBeInTheDocument()
    expect(screen.getByText('Moyenne')).toBeInTheDocument()
    expect(screen.getByText('Basse')).toBeInTheDocument()
    expect(screen.getByText('Indicateurs')).toBeInTheDocument()
    expect(screen.getByText('-3j')).toBeInTheDocument()
    expect(screen.getByText('Jours de retard')).toBeInTheDocument()

    const indicateurs = screen.getByText('Indicateurs').closest('div')
    expect(indicateurs).not.toBeNull()
    if (indicateurs) {
      expect(within(indicateurs.parentElement ?? indicateurs).getByText("Aujourd'hui")).toBeInTheDocument()
    }
  })

  it('n’affiche pas les contrôles optionnels absents', () => {
    render(
      <GanttControls
        zoomLevel="month"
        onZoomChange={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
        onToggleFilters={vi.fn()}
      />
    )

    expect(screen.queryByText('Nouvelle')).not.toBeInTheDocument()
    expect(screen.queryByText('Export PNG')).not.toBeInTheDocument()
    expect(screen.queryByText('Export PDF')).not.toBeInTheDocument()
  })
})