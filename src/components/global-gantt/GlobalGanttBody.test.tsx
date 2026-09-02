/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { GanttFixedColumn, GanttScrollableCanvas } from './GlobalGanttBody'

const {
  GROUPS,
  FILTERED_TASKS,
  TIMELINE,
  PROFILES,
  PROFILE_ROLE_MAP,
  DOCUMENT_COUNTS,
} = vi.hoisted(() => {
  const parentDone = {
    id: 't-done',
    titre: 'Tâche terminée',
    statut: 'Terminé',
    echeance: '2099-01-10',
    date_debut: '2099-01-01',
    created_at: '2099-01-01',
    responsable_id: 'p1',
  }

  const parentInProgress = {
    id: 't-progress',
    titre: 'Tâche en cours',
    statut: 'En cours',
    echeance: '2099-01-12',
    date_debut: '2099-01-05',
    created_at: '2099-01-05',
    responsable_id: 'p2',
  }

  const parentBlocked = {
    id: 't-blocked',
    titre: 'Tâche bloquée',
    statut: 'Bloqué',
    echeance: '2099-01-15',
    date_debut: '2099-01-06',
    created_at: '2099-01-06',
    responsable_id: 'p1',
  }

  const parentTodoOverdue = {
    id: 't-todo-overdue',
    titre: 'Tâche en retard',
    statut: 'A faire',
    echeance: '2000-01-02',
    date_debut: '2000-01-01',
    created_at: '2000-01-01',
    responsable_id: 'p2',
  }

  const recurringParent = {
    id: 't-rec',
    titre: 'Tâche récurrente',
    statut: 'En cours',
    echeance: '2099-01-20',
    date_debut: '2099-01-10',
    created_at: '2099-01-10',
    responsable_id: 'p1',
  }

  const groups = [
    {
      id: 'g1',
      nom: 'Catégorie Alpha',
      couleur: '#ff0000',
      tasks: [parentDone, parentInProgress, parentTodoOverdue],
      groupedTasks: [
        {
          parentTask: parentDone,
          isRecurring: false,
          occurrences: [],
        },
        {
          parentTask: recurringParent,
          isRecurring: true,
          occurrences: [
            { id: 'o1', statut: 'Terminé' },
            { id: 'o2', statut: 'En cours' },
            { id: 'o3', statut: 'Terminé' },
          ],
        },
      ],
    },
    {
      id: 'g2',
      nom: 'Catégorie Beta',
      couleur: '#00ff00',
      tasks: [parentBlocked],
      groupedTasks: [
        {
          parentTask: parentBlocked,
          isRecurring: false,
          occurrences: [],
        },
      ],
    },
  ]

  return {
    GROUPS: groups,
    FILTERED_TASKS: [
      parentDone,
      parentInProgress,
      parentBlocked,
      parentTodoOverdue,
      recurringParent,
    ],
    TIMELINE: {
      start: new Date('2099-01-01T00:00:00.000Z'),
      pixelsPerDay: 10,
    },
    PROFILES: [
      { id: 'p1', full_name: 'Alice' },
      { id: 'p2', full_name: 'Bob' },
    ],
    PROFILE_ROLE_MAP: new Map<string, string>([
      ['p1', 'Manager'],
      ['p2', 'Technicien'],
    ]),
    DOCUMENT_COUNTS: {
      't-done': 3,
      't-blocked': 1,
    } as Record<string, number>,
  }
})

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

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', () => ({
  ChevronDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-chevron-down" {...props} />,
  ChevronRight: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-chevron-right" {...props} />,
  CheckCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-check-circle" {...props} />,
  Clock: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-clock" {...props} />,
  AlertCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-alert-circle" {...props} />,
  Repeat: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-repeat" {...props} />,
}))

vi.mock('@dnd-kit/modifiers', () => ({
  restrictToHorizontalAxis: 'restrictToHorizontalAxis',
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragEnd,
  }: {
    children: React.ReactNode
    onDragStart?: (event: { active: { id: string } }) => void
    onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void
  }) => (
    <div>
      <button
        type="button"
        data-testid="trigger-drag-start"
        onClick={() => onDragStart?.({ active: { id: 't-blocked' } })}
      >
        start
      </button>
      <button
        type="button"
        data-testid="trigger-drag-end"
        onClick={() => onDragEnd?.({ active: { id: 't-blocked' }, over: { id: 'x' } })}
      >
        end
      </button>
      {children}
    </div>
  ),
}))

vi.mock('@/components/etablissement-gantt/GanttTimeline', () => ({
  GanttTimeline: ({
    width,
    todayPosition,
    zoomLevel,
  }: {
    width: number
    todayPosition: number
    zoomLevel: string
  }) => (
    <div data-testid="gantt-timeline" data-width={width} data-today-position={todayPosition} data-zoom={zoomLevel} />
  ),
}))

vi.mock('@/components/etablissement-gantt/GanttGrid', () => ({
  GanttGrid: ({ height }: { height: number }) => <div data-testid="gantt-grid" data-height={height} />,
}))

vi.mock('@/components/etablissement-gantt/GanttWorkloadHeatmap', () => ({
  GanttWorkloadHeatmap: ({
    tasks,
    enabled,
  }: {
    tasks: Array<{ id: string }>
    enabled: boolean
  }) => <div data-testid="gantt-heatmap" data-enabled={String(enabled)} data-task-count={tasks.length} />,
}))

vi.mock('@/components/etablissement-gantt/GanttMilestones', () => ({
  GanttMilestones: ({ tasks }: { tasks: Array<{ id: string }> }) => (
    <div data-testid="gantt-milestones" data-task-count={tasks.length} />
  ),
}))

vi.mock('@/components/etablissement-gantt/GanttRecurringTaskRow', () => ({
  GanttRecurringTaskRow: ({
    parentTask,
    occurrences,
    responsableRole,
    onTaskClick,
  }: {
    parentTask: { id: string; titre: string }
    occurrences: Array<unknown>
    responsableRole?: string
    onTaskClick: (task: { id: string; titre: string }) => void
  }) => (
    <button
      type="button"
      data-testid={`recurring-row-${parentTask.id}`}
      data-occurrences={occurrences.length}
      data-role={responsableRole}
      onClick={() => onTaskClick(parentTask)}
    >
      {parentTask.titre}
    </button>
  ),
}))

vi.mock('@/components/etablissement-gantt/GanttTaskBar', () => ({
  GanttTaskBar: ({
    task,
    position,
    documentCount,
    isDragging,
    isResizing,
    responsableRole,
    onClick,
    onResizeStart,
    onDuplicate,
    onStatusChange,
    onAssign,
    onArchive,
    onDelete,
  }: {
    task: { id: string; titre: string }
    position: { left: number; width: number; isOverdue: boolean }
    documentCount: number
    isDragging: boolean
    isResizing: boolean
    responsableRole?: string
    onClick: () => void
    onResizeStart: (handle: string, startX: number) => void
    onDuplicate: () => void
    onStatusChange: (status: string) => void
    onAssign: (responsableId: string) => void
    onArchive: () => void
    onDelete: () => void
  }) => (
    <div
      data-testid={`taskbar-${task.id}`}
      data-left={position.left}
      data-width={position.width}
      data-overdue={String(position.isOverdue)}
      data-document-count={documentCount}
      data-dragging={String(isDragging)}
      data-resizing={String(isResizing)}
      data-role={responsableRole}
    >
      <button type="button" data-testid={`taskbar-click-${task.id}`} onClick={onClick}>
        {task.titre}
      </button>
      <button
        type="button"
        data-testid={`taskbar-resize-${task.id}`}
        onClick={() => onResizeStart('right', 123)}
      >
        resize
      </button>
      <button type="button" data-testid={`taskbar-duplicate-${task.id}`} onClick={onDuplicate}>
        duplicate
      </button>
      <button
        type="button"
        data-testid={`taskbar-status-${task.id}`}
        onClick={() => onStatusChange('Terminé')}
      >
        status
      </button>
      <button
        type="button"
        data-testid={`taskbar-assign-${task.id}`}
        onClick={() => onAssign('p2')}
      >
        assign
      </button>
      <button type="button" data-testid={`taskbar-archive-${task.id}`} onClick={onArchive}>
        archive
      </button>
      <button type="button" data-testid={`taskbar-delete-${task.id}`} onClick={onDelete}>
        delete
      </button>
    </div>
  ),
}))

describe('GlobalGanttBody', () => {
  it('renders GanttFixedColumn expanded and handles clicks on categories and tasks', () => {
    const toggleCategory = vi.fn()
    const onTaskClick = vi.fn()

    render(
      <GanttFixedColumn
        groupedTasks={GROUPS}
        collapsedCategories={new Set<string>()}
        toggleCategory={toggleCategory}
        onTaskClick={onTaskClick}
        zoomLevel="day"
      />
    )

    expect(screen.getByText('Catégorie Alpha')).toBeInTheDocument()
    expect(screen.getByText('Catégorie Beta')).toBeInTheDocument()
    expect(screen.getByText('Tâche terminée')).toBeInTheDocument()
    expect(screen.getByText('Tâche récurrente')).toBeInTheDocument()
    expect(screen.getByText('2/3')).toBeInTheDocument()
    expect(screen.getAllByTestId('icon-chevron-down')).toHaveLength(2)
    expect(screen.getByTestId('icon-repeat')).toBeInTheDocument()
    expect(screen.getAllByTestId('icon-check-circle').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByTestId('icon-alert-circle')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Catégorie Alpha'))
    expect(toggleCategory).toHaveBeenCalledWith('g1')

    fireEvent.click(screen.getByText('Tâche terminée'))
    expect(onTaskClick).toHaveBeenCalledWith(GROUPS[0].groupedTasks[0].parentTask)
  })

  it('renders GanttFixedColumn collapsed stats with overdue and in-progress badges', () => {
    render(
      <GanttFixedColumn
        groupedTasks={GROUPS}
        collapsedCategories={new Set<string>(['g1'])}
        toggleCategory={vi.fn()}
        onTaskClick={vi.fn()}
        zoomLevel="week"
      />
    )

    expect(screen.getByText('Catégorie Alpha')).toBeInTheDocument()
    expect(screen.getByText('Catégorie Beta')).toBeInTheDocument()
    expect(screen.getByTestId('icon-chevron-right')).toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(screen.getAllByTestId('badge').length).toBeGreaterThanOrEqual(3)
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText('Tâche récurrente')).not.toBeInTheDocument()
  })

  it('renders GanttScrollableCanvas and forwards business props/actions correctly', () => {
    const onDragStart = vi.fn()
    const onDragEnd = vi.fn()
    const handleResizeStart = vi.fn()
    const onTaskClick = vi.fn()
    const onTaskDuplicate = vi.fn()
    const onTaskStatusChange = vi.fn()
    const onTaskAssign = vi.fn()
    const onTaskArchive = vi.fn()
    const onTaskDelete = vi.fn()

    const scrollableRef: React.RefObject<HTMLDivElement> = {
      current: document.createElement('div'),
    }

    render(
      <GanttScrollableCanvas
        groupedTasks={GROUPS}
        collapsedCategories={new Set<string>()}
        filteredTasks={FILTERED_TASKS}
        timeline={TIMELINE}
        zoomLevel="day"
        ganttWidth={500}
        totalHeight={240}
        todayPosition={80}
        heatmapEnabled
        draggedTaskId="t-blocked"
        resizingTask={{ id: 't-blocked' }}
        sensors={[]}
        documentCounts={DOCUMENT_COUNTS}
        profiles={PROFILES}
        profileRoleMap={PROFILE_ROLE_MAP}
        scrollableRef={scrollableRef}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        handleResizeStart={handleResizeStart}
        onTaskClick={onTaskClick}
        onTaskDuplicate={onTaskDuplicate}
        onTaskStatusChange={onTaskStatusChange}
        onTaskAssign={onTaskAssign}
        onTaskArchive={onTaskArchive}
        onTaskDelete={onTaskDelete}
      />
    )

    expect(screen.getByTestId('gantt-timeline')).toHaveAttribute('data-width', '500')
    expect(screen.getByTestId('gantt-grid')).toHaveAttribute('data-height', '240')
    expect(screen.getByTestId('gantt-heatmap')).toHaveAttribute('data-task-count', String(FILTERED_TASKS.length))
    expect(screen.getByTestId('gantt-milestones')).toHaveAttribute('data-task-count', String(FILTERED_TASKS.length))
    expect(screen.getByText('Auj.')).toBeInTheDocument()

    const blockedBar = screen.getByTestId('taskbar-t-blocked')
    expect(blockedBar).toHaveAttribute('data-left', '50')
    expect(blockedBar).toHaveAttribute('data-width', '90')
    expect(blockedBar).toHaveAttribute('data-overdue', 'false')
    expect(blockedBar).toHaveAttribute('data-document-count', '1')
    expect(blockedBar).toHaveAttribute('data-dragging', 'true')
    expect(blockedBar).toHaveAttribute('data-resizing', 'true')
    expect(blockedBar).toHaveAttribute('data-role', 'Manager')

    const recurringRow = screen.getByTestId('recurring-row-t-rec')
    expect(recurringRow).toHaveAttribute('data-occurrences', '3')
    expect(recurringRow).toHaveAttribute('data-role', 'Manager')

    fireEvent.click(screen.getByTestId('trigger-drag-start'))
    expect(onDragStart).toHaveBeenCalledWith('t-blocked', FILTERED_TASKS[2])

    fireEvent.click(screen.getByTestId('trigger-drag-end'))
    expect(onDragEnd).toHaveBeenCalledWith(
      { active: { id: 't-blocked' }, over: { id: 'x' } },
      FILTERED_TASKS[2]
    )

    fireEvent.click(screen.getByTestId('taskbar-click-t-blocked'))
    expect(onTaskClick).toHaveBeenCalledWith(FILTERED_TASKS[2])

    fireEvent.click(screen.getByTestId('taskbar-resize-t-blocked'))
    expect(handleResizeStart).toHaveBeenCalledWith('t-blocked', 'right', scrollableRef.current, 123)

    fireEvent.click(screen.getByTestId('taskbar-duplicate-t-blocked'))
    expect(onTaskDuplicate).toHaveBeenCalledWith(FILTERED_TASKS[2])

    fireEvent.click(screen.getByTestId('taskbar-status-t-blocked'))
    expect(onTaskStatusChange).toHaveBeenCalledWith('t-blocked', 'Terminé')

    fireEvent.click(screen.getByTestId('taskbar-assign-t-blocked'))
    expect(onTaskAssign).toHaveBeenCalledWith('t-blocked', 'p2')

    fireEvent.click(screen.getByTestId('taskbar-archive-t-blocked'))
    expect(onTaskArchive).toHaveBeenCalledWith(FILTERED_TASKS[2])

    fireEvent.click(screen.getByTestId('taskbar-delete-t-blocked'))
    expect(onTaskDelete).toHaveBeenCalledWith('t-blocked')

    fireEvent.click(recurringRow)
    expect(onTaskClick).toHaveBeenCalledWith(GROUPS[0].groupedTasks[1].parentTask)
  })

  it('does not render heatmap or today marker when disabled or outside width and keeps collapsed canvas rows', () => {
    render(
      <GanttScrollableCanvas
        groupedTasks={GROUPS}
        collapsedCategories={new Set<string>(['g1'])}
        filteredTasks={FILTERED_TASKS}
        timeline={TIMELINE}
        zoomLevel="week"
        ganttWidth={50}
        totalHeight={180}
        todayPosition={999}
        heatmapEnabled={false}
        draggedTaskId={null}
        resizingTask={null}
        sensors={[]}
        documentCounts={DOCUMENT_COUNTS}
        profiles={PROFILES}
        profileRoleMap={PROFILE_ROLE_MAP}
        scrollableRef={{ current: document.createElement('div') } as React.RefObject<HTMLDivElement>}
        onDragStart={vi.fn()}
        onDragEnd={vi.fn()}
        handleResizeStart={vi.fn()}
        onTaskClick={vi.fn()}
        onTaskDuplicate={vi.fn()}
        onTaskStatusChange={vi.fn()}
        onTaskAssign={vi.fn()}
        onTaskArchive={vi.fn()}
        onTaskDelete={vi.fn()}
      />
    )

    expect(screen.queryByTestId('gantt-heatmap')).not.toBeInTheDocument()
    expect(screen.queryByText('Auj.')).not.toBeInTheDocument()
    expect(screen.queryByTestId('recurring-row-t-rec')).not.toBeInTheDocument()
    expect(screen.getByTestId('gantt-milestones')).toHaveAttribute('data-task-count', String(FILTERED_TASKS.length))
    expect(screen.getByTestId('taskbar-t-blocked')).toBeInTheDocument()
  })
})