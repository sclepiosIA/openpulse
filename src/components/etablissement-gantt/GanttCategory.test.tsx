/* @vitest-environment jsdom */

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { GanttCategory } from './GanttCategory'

const {
  TASKS,
  CATEGORY,
  TIMELINE,
  PROFILES,
  taskBarSpy,
  summaryBarSpy,
  cnSpy,
} = vi.hoisted(() => {
  const TASKS = [
    {
      id: 't1',
      nom: 'Task 1',
      date_debut: '2024-01-03T00:00:00.000Z',
      echeance: '2024-01-06T00:00:00.000Z',
      statut: 'En cours',
      created_at: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 't2',
      nom: 'Task 2',
      created_at: '2024-01-02T00:00:00.000Z',
      statut: 'Terminé',
    },
    {
      id: 't3',
      nom: 'Task 3',
      date_debut: '2023-12-28T00:00:00.000Z',
      echeance: '2024-01-02T00:00:00.000Z',
      statut: 'En cours',
      created_at: '2023-12-28T00:00:00.000Z',
    },
  ]

  const CATEGORY = {
    id: 'c1',
    nom: 'Catégorie A',
    couleur: '#123456',
    tasks: TASKS,
  }

  const TIMELINE = {
    start: new Date('2024-01-01T00:00:00.000Z'),
    pixelsPerDay: 10,
  }

  const PROFILES = [{ id: 'p1', nom: 'Alice' }]

  return {
    TASKS,
    CATEGORY,
    TIMELINE,
    PROFILES,
    taskBarSpy: vi.fn(),
    summaryBarSpy: vi.fn(),
    cnSpy: vi.fn((...args: Array<string | false | undefined | null>) =>
      args.filter(Boolean).join(' ')
    ),
  }
})

vi.mock('@/lib/utils', () => ({
  cn: cnSpy,
}))

vi.mock('./GanttTaskBar', () => ({
  GanttTaskBar: (props: {
    task: { id: string; nom: string }
    position: { left: number; width: number; isOverdue: boolean }
    onClick: () => void
    onResizeStart?: (handle: string, startX: number) => void
    isDragging: boolean
    isResizing: boolean
    documentCount: number
    pixelsPerDay: number
    onDuplicate?: () => void
    onStatusChange?: (status: string) => void
    onAssign?: (responsableId: string) => void
    onArchive?: () => void
    onDelete?: () => void
    profiles: Array<{ id: string; nom: string }>
  }) => {
    taskBarSpy(props)
    return (
      <div data-testid={`task-bar-${props.task.id}`}>
        <span>{props.task.nom}</span>
        <span>{`${props.position.left}/${props.position.width}/${String(props.position.isOverdue)}`}</span>
        <span>{`docs:${props.documentCount}`}</span>
        <span>{`drag:${String(props.isDragging)}`}</span>
        <span>{`resize:${String(props.isResizing)}`}</span>
        <button onClick={props.onClick}>click-{props.task.id}</button>
        <button onClick={() => props.onResizeStart?.('end', 42)}>resize-{props.task.id}</button>
        <button onClick={() => props.onDuplicate?.()}>duplicate-{props.task.id}</button>
        <button onClick={() => props.onStatusChange?.('Bloqué')}>status-{props.task.id}</button>
        <button onClick={() => props.onAssign?.('p1')}>assign-{props.task.id}</button>
        <button onClick={() => props.onArchive?.()}>archive-{props.task.id}</button>
        <button onClick={() => props.onDelete?.()}>delete-{props.task.id}</button>
      </div>
    )
  },
}))

vi.mock('./GanttCategorySummaryBar', () => ({
  GanttCategorySummaryBar: (props: {
    category: { id: string; nom: string; tasks: unknown[] }
    timeline: { start: Date; pixelsPerDay: number }
    onClick: () => void
  }) => {
    summaryBarSpy(props)
    return (
      <button data-testid="summary-bar" onClick={props.onClick}>
        {`${props.category.nom}-${props.category.tasks.length}-${props.timeline.pixelsPerDay}`}
      </button>
    )
  },
}))

describe('GanttCategory', () => {
  beforeEach(() => {
    taskBarSpy.mockClear()
    summaryBarSpy.mockClear()
    cnSpy.mockClear()
  })

  it('rend l’en-tête, les tâches étendues et calcule les positions métier correctement', () => {
    const onTaskClick = vi.fn()
    const onToggleExpand = vi.fn()
    const getResizePreview = vi.fn((taskId: string) =>
      taskId === 't2' ? { left: 999, width: 77 } : null
    )

    render(
      <GanttCategory
        category={CATEGORY}
        timeline={TIMELINE}
        onTaskClick={onTaskClick}
        onToggleExpand={onToggleExpand}
        draggedTaskId="t2"
        resizingTaskId="t3"
        documentCounts={{ t1: 2, t3: 5 }}
        getResizePreview={getResizePreview}
        profiles={PROFILES}
      />
    )

    expect(screen.getByText('Catégorie A')).toBeInTheDocument()
    expect(screen.getByText('(3)')).toBeInTheDocument()
    expect(taskBarSpy).toHaveBeenCalledTimes(3)
    expect(summaryBarSpy).not.toHaveBeenCalled()

    const firstCall = taskBarSpy.mock.calls[0][0]
    expect(firstCall.task.id).toBe('t1')
    expect(firstCall.position).toEqual({ left: 20, width: 30, isOverdue: true })
    expect(firstCall.documentCount).toBe(2)
    expect(firstCall.isDragging).toBe(false)
    expect(firstCall.isResizing).toBe(false)
    expect(firstCall.pixelsPerDay).toBe(10)
    expect(firstCall.profiles).toEqual(PROFILES)

    const secondCall = taskBarSpy.mock.calls[1][0]
    expect(secondCall.task.id).toBe('t2')
    expect(secondCall.position).toEqual({ left: 999, width: 77, isOverdue: false })
    expect(secondCall.documentCount).toBe(0)
    expect(secondCall.isDragging).toBe(true)
    expect(secondCall.isResizing).toBe(false)

    const thirdCall = taskBarSpy.mock.calls[2][0]
    expect(thirdCall.task.id).toBe('t3')
    expect(thirdCall.position).toEqual({ left: 0, width: 50, isOverdue: true })
    expect(thirdCall.documentCount).toBe(5)
    expect(thirdCall.isDragging).toBe(false)
    expect(thirdCall.isResizing).toBe(true)

    fireEvent.click(screen.getByText('click-t1'))
    expect(onTaskClick).toHaveBeenCalledTimes(1)
    expect(onTaskClick).toHaveBeenCalledWith(TASKS[0])

    const header = screen.getByText('Catégorie A').closest('div')
    expect(header).not.toBeNull()
    if (header) {
      fireEvent.click(header)
    }
    expect(onToggleExpand).toHaveBeenCalledTimes(1)

    expect(getResizePreview).toHaveBeenCalledWith('t1')
    expect(getResizePreview).toHaveBeenCalledWith('t2')
    expect(getResizePreview).toHaveBeenCalledWith('t3')
  })

  it('propage tous les callbacks d’actions et de resize au bon taskId', () => {
    const onTaskClick = vi.fn()
    const onTaskResizeStart = vi.fn()
    const onTaskDuplicate = vi.fn()
    const onTaskStatusChange = vi.fn()
    const onTaskAssign = vi.fn()
    const onTaskArchive = vi.fn()
    const onTaskDelete = vi.fn()

    render(
      <GanttCategory
        category={CATEGORY}
        timeline={TIMELINE}
        onTaskClick={onTaskClick}
        onTaskResizeStart={onTaskResizeStart}
        onTaskDuplicate={onTaskDuplicate}
        onTaskStatusChange={onTaskStatusChange}
        onTaskAssign={onTaskAssign}
        onTaskArchive={onTaskArchive}
        onTaskDelete={onTaskDelete}
        profiles={PROFILES}
      />
    )

    fireEvent.click(screen.getByText('resize-t1'))
    expect(onTaskResizeStart).toHaveBeenCalledTimes(1)
    expect(onTaskResizeStart).toHaveBeenCalledWith('t1', 'end', 42)

    fireEvent.click(screen.getByText('duplicate-t2'))
    expect(onTaskDuplicate).toHaveBeenCalledTimes(1)
    expect(onTaskDuplicate).toHaveBeenCalledWith(TASKS[1])

    fireEvent.click(screen.getByText('status-t3'))
    expect(onTaskStatusChange).toHaveBeenCalledTimes(1)
    expect(onTaskStatusChange).toHaveBeenCalledWith('t3', 'Bloqué')

    fireEvent.click(screen.getByText('assign-t1'))
    expect(onTaskAssign).toHaveBeenCalledTimes(1)
    expect(onTaskAssign).toHaveBeenCalledWith('t1', 'p1')

    fireEvent.click(screen.getByText('archive-t2'))
    expect(onTaskArchive).toHaveBeenCalledTimes(1)
    expect(onTaskArchive).toHaveBeenCalledWith(TASKS[1])

    fireEvent.click(screen.getByText('delete-t3'))
    expect(onTaskDelete).toHaveBeenCalledTimes(1)
    expect(onTaskDelete).toHaveBeenCalledWith('t3')
  })

  it('rend la vue réduite quand isExpanded=false et clique sur la barre récapitulative', () => {
    const onToggleExpand = vi.fn()

    render(
      <GanttCategory
        category={CATEGORY}
        timeline={TIMELINE}
        onTaskClick={vi.fn()}
        isExpanded={false}
        onToggleExpand={onToggleExpand}
      />
    )

    expect(taskBarSpy).not.toHaveBeenCalled()
    expect(summaryBarSpy).toHaveBeenCalledTimes(1)

    const summaryProps = summaryBarSpy.mock.calls[0][0]
    expect(summaryProps.category).toEqual(CATEGORY)
    expect(summaryProps.timeline).toEqual(TIMELINE)

    fireEvent.click(screen.getByTestId('summary-bar'))
    expect(onToggleExpand).toHaveBeenCalledTimes(1)
  })

  it('utilise les valeurs par défaut quand couleur, profils et documentCounts sont absents', () => {
    const categoryWithoutColor = {
      ...CATEGORY,
      couleur: undefined,
    }

    render(
      <GanttCategory
        category={categoryWithoutColor}
        timeline={TIMELINE}
        onTaskClick={vi.fn()}
      />
    )

    expect(screen.getByText('Catégorie A')).toBeInTheDocument()
    expect(taskBarSpy).toHaveBeenCalledTimes(3)

    const firstCall = taskBarSpy.mock.calls[0][0]
    expect(firstCall.documentCount).toBe(0)
    expect(firstCall.profiles).toEqual([])

    const header = screen.getByText('Catégorie A').closest('div')
    expect(header).not.toBeNull()
    if (header) {
      expect(header).toHaveStyle({ borderLeftColor: '#888' })
    }
  })
})