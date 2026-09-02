import { useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Edit,
  Trash2,
  CheckCircle,
  PlayCircle,
  AlertCircle,
  Clock,
  Copy,
  UserPlus,
  Archive,
} from 'lucide-react'
import { Task } from '@/types/gantt'
import { ProfilePublic } from '@/hooks/profile/useProfiles'

interface GanttTaskContextMenuProps {
  children: React.ReactNode
  task: Task
  profiles?: ProfilePublic[]
  onEdit: () => void
  onDuplicate?: () => void
  onStatusChange?: (status: string) => void
  onAssign?: (responsableId: string) => void
  onArchive?: () => void
  onDelete?: () => void
}

export function GanttTaskContextMenu({
  children,
  task,
  profiles = [],
  onEdit,
  onDuplicate,
  onStatusChange,
  onAssign,
  onArchive,
  onDelete
}: GanttTaskContextMenuProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleDelete = () => {
    setShowDeleteDialog(false)
    onDelete?.()
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild onContextMenu={(e) => e.stopPropagation()}>
          <div className="contents" onContextMenu={(e) => e.stopPropagation()}>
            {children}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {/* Modifier */}
          <ContextMenuItem onClick={onEdit} className="gap-2">
            <Edit className="h-4 w-4" />
            Modifier
          </ContextMenuItem>

          {/* Dupliquer */}
          {onDuplicate && (
            <ContextMenuItem onClick={onDuplicate} className="gap-2">
              <Copy className="h-4 w-4" />
              Dupliquer
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          {/* Changement de statut */}
          {onStatusChange && (
            <>
              {task.statut !== 'Terminé' && (
                <ContextMenuItem 
                  onClick={() => onStatusChange('Terminé')} 
                  className="gap-2 text-success"
                >
                  <CheckCircle className="h-4 w-4" />
                  Marquer terminé
                </ContextMenuItem>
              )}
              {task.statut !== 'En cours' && (
                <ContextMenuItem 
                  onClick={() => onStatusChange('En cours')} 
                  className="gap-2 text-primary"
                >
                  <PlayCircle className="h-4 w-4" />
                  Marquer en cours
                </ContextMenuItem>
              )}
              {task.statut !== 'Bloqué' && (
                <ContextMenuItem 
                  onClick={() => onStatusChange('Bloqué')} 
                  className="gap-2 text-destructive"
                >
                  <AlertCircle className="h-4 w-4" />
                  Marquer bloqué
                </ContextMenuItem>
              )}
              {task.statut !== 'A faire' && (
                <ContextMenuItem 
                  onClick={() => onStatusChange('A faire')} 
                  className="gap-2 text-muted-foreground"
                >
                  <Clock className="h-4 w-4" />
                  Marquer à faire
                </ContextMenuItem>
              )}
              <ContextMenuSeparator />
            </>
          )}

          {/* Attribution */}
          {onAssign && profiles.length > 0 && (
            <>
              <ContextMenuSub>
                <ContextMenuSubTrigger className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Attribuer à
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-64 overflow-y-auto">
                  {profiles.map(profile => (
                    <ContextMenuItem
                      key={profile.id}
                      onClick={() => onAssign(profile.id)}
                      className={task.responsable_id === profile.id ? 'bg-accent' : ''}
                    >
                      {[profile.prenom, profile.nom].filter(Boolean).join(' ') || profile.email}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSeparator />
            </>
          )}

          {/* Archiver */}
          {onArchive && (
            <ContextMenuItem onClick={onArchive} className="gap-2">
              <Archive className="h-4 w-4" />
              {task.archive ? 'Désarchiver' : 'Archiver'}
            </ContextMenuItem>
          )}

          {/* Supprimer */}
          {onDelete && (
            <ContextMenuItem 
              onClick={() => setShowDeleteDialog(true)} 
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
            <AlertDialogDescription>
              La tâche "{task.titre}" sera définitivement supprimée. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
