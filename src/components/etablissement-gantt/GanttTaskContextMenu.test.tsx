/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { GanttTaskContextMenu } from './GanttTaskContextMenu'

const {
  EDIT_LABEL,
  DUPLICATE_LABEL,
  DELETE_LABEL,
  ARCHIVE_LABEL,
  UNARCHIVE_LABEL,
  ASSIGN_LABEL,
  STATUS_DONE_LABEL,
  STATUS_PROGRESS_LABEL,
  STATUS_BLOCKED_LABEL,
  STATUS_TODO_LABEL,
  CONFIRM_TITLE,
  CANCEL_LABEL,
  TASK_TITLE,
  CHILD_LABEL,
  PROFILES,
  BASE_TASK,
} = vi.hoisted(() => ({
  EDIT_LABEL: 'Modifier',
  DUPLICATE_LABEL: 'Dupliquer',
  DELETE_LABEL: 'Supprimer',
  ARCHIVE_LABEL: 'Archiver',
  UNARCHIVE_LABEL: 'Désarchiver',
  ASSIGN_LABEL: 'Attribuer à',
  STATUS_DONE_LABEL: 'Marquer terminé',
  STATUS_PROGRESS_LABEL: 'Marquer en cours',
  STATUS_BLOCKED_LABEL: 'Marquer bloqué',
  STATUS_TODO_LABEL: 'Marquer à faire',
  CONFIRM_TITLE: 'Supprimer cette tâche ?',
  CANCEL_LABEL: 'Annuler',
  TASK_TITLE: 'Tâche planning',
  CHILD_LABEL: 'Contenu tâche',
  PROFILES: [
    { id: 'p1', prenom: 'Alice', nom: 'Martin', email: 'alice@example.test' },
    { id: 'p2', prenom: 'Bob', nom: 'Durand', email: 'bob@example.test' },
  ],
  BASE_TASK: {
    id: 'task-1',
    titre: 'Tâche planning',
    statut: 'A faire',
    archive: false,
    responsable_id: 'p1',
  },
}))

vi.mock('lucide-react', () => {
  const Icon = () => React.createElement('svg', { 'data-testid': 'icon' })
  return {
    Edit: Icon,
    Trash2: Icon,
    CheckCircle: Icon,
    PlayCircle: Icon,
    AlertCircle: Icon,
    Clock: Icon,
    Copy: Icon,
    UserPlus: Icon,
    Archive: Icon,
  }
})

vi.mock('@/components/ui/context-menu', () => {
  return {
    ContextMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="context-menu">{children}</div>,
    ContextMenuTrigger: ({
      children,
      onContextMenu,
    }: {
      children: React.ReactNode
      onContextMenu?: React.MouseEventHandler<HTMLDivElement>
    }) => (
      <div data-testid="context-menu-trigger" onContextMenu={onContextMenu}>
        {children}
      </div>
    ),
    ContextMenuContent: ({ children }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="context-menu-content">{children}</div>
    ),
    ContextMenuItem: ({
      children,
      onClick,
      className,
    }: {
      children: React.ReactNode
      onClick?: () => void
      className?: string
    }) => (
      <button type="button" data-classname={className} onClick={onClick}>
        {children}
      </button>
    ),
    ContextMenuSeparator: () => <div data-testid="context-menu-separator" />,
    ContextMenuSub: ({ children }: { children: React.ReactNode }) => <div data-testid="context-menu-sub">{children}</div>,
    ContextMenuSubTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="context-menu-sub-trigger" data-classname={className}>
        {children}
      </div>
    ),
    ContextMenuSubContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="context-menu-sub-content" data-classname={className}>
        {children}
      </div>
    ),
  }
})

vi.mock('@/components/ui/alert-dialog', () => {
  return {
    AlertDialog: ({
      children,
      open,
    }: {
      children: React.ReactNode
      open?: boolean
      onOpenChange?: (value: boolean) => void
    }) => (open ? <div data-testid="alert-dialog">{children}</div> : null),
    AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
    AlertDialogAction: ({
      children,
      onClick,
      className,
    }: {
      children: React.ReactNode
      onClick?: () => void
      className?: string
    }) => (
      <button type="button" data-testid="alert-dialog-action" data-classname={className} onClick={onClick}>
        {children}
      </button>
    ),
  }
})

describe('GanttTaskContextMenu', () => {
  it('rend les actions principales, les statuts disponibles, les profils et déclenche les callbacks métier', () => {
    const onEdit = vi.fn()
    const onDuplicate = vi.fn()
    const onStatusChange = vi.fn()
    const onAssign = vi.fn()
    const onArchive = vi.fn()
    const onDelete = vi.fn()

    render(
      <GanttTaskContextMenu
        task={BASE_TASK}
        profiles={PROFILES}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onStatusChange={onStatusChange}
        onAssign={onAssign}
        onArchive={onArchive}
        onDelete={onDelete}
      >
        <span>{CHILD_LABEL}</span>
      </GanttTaskContextMenu>
    )

    expect(screen.getByText(CHILD_LABEL)).toBeInTheDocument()
    expect(screen.getByText(EDIT_LABEL)).toBeInTheDocument()
    expect(screen.getByText(DUPLICATE_LABEL)).toBeInTheDocument()
    expect(screen.getByText(STATUS_DONE_LABEL)).toBeInTheDocument()
    expect(screen.getByText(STATUS_PROGRESS_LABEL)).toBeInTheDocument()
    expect(screen.getByText(STATUS_BLOCKED_LABEL)).toBeInTheDocument()
    expect(screen.queryByText(STATUS_TODO_LABEL)).not.toBeInTheDocument()
    expect(screen.getByText(ASSIGN_LABEL)).toBeInTheDocument()
    expect(screen.getByText('Alice Martin')).toBeInTheDocument()
    expect(screen.getByText('Bob Durand')).toBeInTheDocument()
    expect(screen.getByText(ARCHIVE_LABEL)).toBeInTheDocument()
    expect(screen.getByText(DELETE_LABEL)).toBeInTheDocument()

    fireEvent.click(screen.getByText(EDIT_LABEL))
    expect(onEdit).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText(DUPLICATE_LABEL))
    expect(onDuplicate).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText(STATUS_DONE_LABEL))
    expect(onStatusChange).toHaveBeenCalledWith('Terminé')

    fireEvent.click(screen.getByText(STATUS_PROGRESS_LABEL))
    expect(onStatusChange).toHaveBeenCalledWith('En cours')

    fireEvent.click(screen.getByText(STATUS_BLOCKED_LABEL))
    expect(onStatusChange).toHaveBeenCalledWith('Bloqué')

    fireEvent.click(screen.getByText('Bob Durand'))
    expect(onAssign).toHaveBeenCalledWith('p2')

    fireEvent.click(screen.getByText(ARCHIVE_LABEL))
    expect(onArchive).toHaveBeenCalledTimes(1)
  })

  it('affiche le bon libellé d’archive et masque les options non fournies', () => {
    const archivedTask = {
      ...BASE_TASK,
      archive: true,
      statut: 'Terminé',
    }

    render(
      <GanttTaskContextMenu task={archivedTask} onEdit={vi.fn()}>
        <span>{CHILD_LABEL}</span>
      </GanttTaskContextMenu>
    )

    expect(screen.getByText(EDIT_LABEL)).toBeInTheDocument()
    expect(screen.queryByText(DUPLICATE_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByText(DELETE_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByText(ASSIGN_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByText(STATUS_DONE_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByText(STATUS_PROGRESS_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByText(STATUS_BLOCKED_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByText(STATUS_TODO_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByText(ARCHIVE_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByText(UNARCHIVE_LABEL)).not.toBeInTheDocument()
  })

  it('ouvre la confirmation de suppression avec le titre de tâche puis confirme la suppression', () => {
    const onDelete = vi.fn()

    render(
      <GanttTaskContextMenu task={BASE_TASK} onEdit={vi.fn()} onDelete={onDelete}>
        <span>{CHILD_LABEL}</span>
      </GanttTaskContextMenu>
    )

    expect(screen.queryByText(CONFIRM_TITLE)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(DELETE_LABEL))

    expect(screen.getByText(CONFIRM_TITLE)).toBeInTheDocument()
    expect(
      screen.getByText(`La tâche "${TASK_TITLE}" sera définitivement supprimée. Cette action est irréversible.`)
    ).toBeInTheDocument()
    expect(screen.getByText(CANCEL_LABEL)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('alert-dialog-action'))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(CONFIRM_TITLE)).not.toBeInTheDocument()
  })

  it('stoppe la propagation sur le clic droit du trigger et du conteneur enfant', () => {
    render(
      <GanttTaskContextMenu task={BASE_TASK} onEdit={vi.fn()}>
        <span>{CHILD_LABEL}</span>
      </GanttTaskContextMenu>
    )

    const triggerEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    const triggerStopPropagation = vi.spyOn(triggerEvent, 'stopPropagation')
    screen.getByTestId('context-menu-trigger').dispatchEvent(triggerEvent)

    const childContainer = screen.getByText(CHILD_LABEL).parentElement
    expect(childContainer).not.toBeNull()

    const childEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    const childStopPropagation = vi.spyOn(childEvent, 'stopPropagation')
    childContainer?.dispatchEvent(childEvent)

    expect(triggerStopPropagation).toHaveBeenCalledTimes(1)
    expect(childStopPropagation).toHaveBeenCalledTimes(1)
  })
})