/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { GanttUnplannedTasksAlert } from './GanttUnplannedTasksAlert'

const { buttonClasses, contentClasses } = vi.hoisted(() => ({
  buttonClasses: 'mock-button',
  contentClasses: 'mock-collapsible-content',
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    ...props
  }: {
    children?: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    className?: string
    [key: string]: unknown
  }) => (
    <button type="button" onClick={onClick} className={[buttonClasses, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({
    children,
    open,
    onOpenChange,
  }: {
    children?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) => <div data-testid="collapsible-root" data-open={String(Boolean(open))} data-onopenchange={String(Boolean(onOpenChange))}>{children}</div>,
  CollapsibleTrigger: ({
    children,
    asChild,
  }: {
    children?: React.ReactNode
    asChild?: boolean
  }) => {
    if (asChild && React.isValidElement(children)) {
      const childProps = children.props as {
        onClick?: React.MouseEventHandler<HTMLButtonElement>
      }
      return React.cloneElement(children, {
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          childProps.onClick?.(event)
        },
      })
    }

    return <button type="button">{children}</button>
  },
  CollapsibleContent: ({
    children,
    className,
  }: {
    children?: React.ReactNode
    className?: string
  }) => <div data-testid="collapsible-content" className={[contentClasses, className].filter(Boolean).join(' ')}>{children}</div>,
}))

vi.mock('lucide-react', () => ({
  CalendarX: (props: Record<string, unknown>) => <svg data-testid="icon-calendar-x" {...props} />,
  ChevronDown: (props: Record<string, unknown>) => <svg data-testid="icon-chevron-down" {...props} />,
  ChevronRight: (props: Record<string, unknown>) => <svg data-testid="icon-chevron-right" {...props} />,
}))

describe('GanttUnplannedTasksAlert', () => {
  it('ne rend rien quand il n’y a aucune tâche sans dates', () => {
    const onExpandedChange = vi.fn()
    const onTaskClick = vi.fn()

    const { container } = render(
      <GanttUnplannedTasksAlert
        unplannedTasks={[]}
        expanded={false}
        onExpandedChange={onExpandedChange}
        onTaskClick={onTaskClick}
      />
    )

    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('collapsible-root')).not.toBeInTheDocument()
    expect(onExpandedChange).not.toHaveBeenCalled()
    expect(onTaskClick).not.toHaveBeenCalled()
  })

  it('affiche le bon libellé au singulier et l’icône fermée quand replié', () => {
    const onExpandedChange = vi.fn()
    const onTaskClick = vi.fn()
    const tasks = [{ id: 't1', titre: 'Tâche unique' }]

    render(
      <GanttUnplannedTasksAlert
        unplannedTasks={tasks}
        expanded={false}
        onExpandedChange={onExpandedChange}
        onTaskClick={onTaskClick}
      />
    )

    expect(screen.getByText('1 tâche sans dates')).toBeInTheDocument()
    expect(screen.getByTestId('icon-calendar-x')).toBeInTheDocument()
    expect(screen.getByTestId('icon-chevron-right')).toBeInTheDocument()
    expect(screen.queryByTestId('icon-chevron-down')).not.toBeInTheDocument()
    expect(screen.getByText('Tâche unique')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Planifier' })).toBeInTheDocument()
  })

  it('affiche le bon libellé au pluriel et l’icône ouverte', () => {
    const onExpandedChange = vi.fn()
    const onTaskClick = vi.fn()
    const tasks = [
      { id: 't1', titre: 'Première tâche' },
      { id: 't2', titre: 'Deuxième tâche' },
    ]

    render(
      <GanttUnplannedTasksAlert
        unplannedTasks={tasks}
        expanded={true}
        onExpandedChange={onExpandedChange}
        onTaskClick={onTaskClick}
      />
    )

    expect(screen.getByText('2 tâches sans dates')).toBeInTheDocument()
    expect(screen.getByTestId('icon-chevron-down')).toBeInTheDocument()
    expect(screen.queryByTestId('icon-chevron-right')).not.toBeInTheDocument()
    expect(screen.getByText('Première tâche')).toBeInTheDocument()
    expect(screen.getByText('Deuxième tâche')).toBeInTheDocument()
  })

  it('rend le trigger cliquable sans casser la structure asChild', () => {
    const onExpandedChange = vi.fn()
    const onTaskClick = vi.fn()
    const tasks = [
      { id: 't1', titre: 'Première tâche' },
      { id: 't2', titre: 'Deuxième tâche' },
    ]

    render(
      <GanttUnplannedTasksAlert
        unplannedTasks={tasks}
        expanded={true}
        onExpandedChange={onExpandedChange}
        onTaskClick={onTaskClick}
      />
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[0]).toHaveClass(buttonClasses)
    expect(buttons[0]).toHaveTextContent('')
    expect(buttons[1]).toHaveTextContent('Planifier')
    expect(buttons[2]).toHaveTextContent('Planifier')

    fireEvent.click(buttons[0])

    expect(onExpandedChange).not.toHaveBeenCalled()
  })

  it('affiche au maximum 10 tâches et un message pour les restantes', () => {
    const onExpandedChange = vi.fn()
    const onTaskClick = vi.fn()
    const tasks = Array.from({ length: 12 }, (_, index) => ({
      id: `t${index + 1}`,
      titre: `Tâche ${index + 1}`,
    }))

    render(
      <GanttUnplannedTasksAlert
        unplannedTasks={tasks}
        expanded={true}
        onExpandedChange={onExpandedChange}
        onTaskClick={onTaskClick}
      />
    )

    expect(screen.getByText('12 tâches sans dates')).toBeInTheDocument()
    expect(screen.getByText('Tâche 1')).toBeInTheDocument()
    expect(screen.getByText('Tâche 10')).toBeInTheDocument()
    expect(screen.queryByText('Tâche 11')).not.toBeInTheDocument()
    expect(screen.queryByText('Tâche 12')).not.toBeInTheDocument()
    expect(screen.getByText('Et 2 autres...')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Planifier' })).toHaveLength(10)
  })

  it('appelle onTaskClick avec la tâche correspondante quand on clique sur une ligne', () => {
    const onExpandedChange = vi.fn()
    const onTaskClick = vi.fn()
    const tasks = [
      { id: 'alpha', titre: 'Analyse' },
      { id: 'beta', titre: 'Développement' },
    ]

    render(
      <GanttUnplannedTasksAlert
        unplannedTasks={tasks}
        expanded={true}
        onExpandedChange={onExpandedChange}
        onTaskClick={onTaskClick}
      />
    )

    fireEvent.click(screen.getByText('Développement'))

    expect(onTaskClick).toHaveBeenCalledTimes(1)
    expect(onTaskClick).toHaveBeenCalledWith(tasks[1])
  })

  it('appelle aussi onTaskClick avec la bonne tâche quand on clique sur le bouton Planifier de la ligne', () => {
    const onExpandedChange = vi.fn()
    const onTaskClick = vi.fn()
    const tasks = [
      { id: 'alpha', titre: 'Analyse' },
      { id: 'beta', titre: 'Développement' },
    ]

    render(
      <GanttUnplannedTasksAlert
        unplannedTasks={tasks}
        expanded={true}
        onExpandedChange={onExpandedChange}
        onTaskClick={onTaskClick}
      />
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Planifier' })[1])

    expect(onTaskClick).toHaveBeenCalledTimes(1)
    expect(onTaskClick).toHaveBeenCalledWith(tasks[1])
  })
})