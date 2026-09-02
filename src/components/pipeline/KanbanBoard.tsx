import { useState, useMemo, useCallback, memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Calendar,
  Users,
  MoreVertical,
  FileText,
  Archive,
  ArchiveRestore,
  GripVertical,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  useTaches,
  useTachesByEtablissement,
  useUpdateTache,
  useArchiveTache,
} from '@/hooks/tasks/useTaches'
import { useToast } from '@/hooks/shared/use-toast'
import { TacheDocuments } from '@/components/tasks/TacheDocuments'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
interface KanbanBoardProps {
  etablissementId?: string
}

interface DroppableColumnProps {
  column: { id: string; title: string; color: string }
  tasks: Array<{
    id: string
    titre: string
    description?: string
    statut: 'A faire' | 'En cours' | 'Bloqué' | 'Terminé'
    priorite: 'low' | 'medium' | 'high'
    archive: boolean
    categorie?: { nom: string; couleur: string }
    echeance?: string
    responsable?: { prenom: string; nom: string }
  }>
  getPriorityColor: (priorite: string) => string
  toggleArchive: (taskId: string, isArchived: boolean) => Promise<void>
  columns: Array<{ id: string; title: string; color: string }>
  updateTaskStatus: (
    taskId: string,
    newStatus: 'A faire' | 'En cours' | 'Bloqué' | 'Terminé'
  ) => Promise<void>
}

const DroppableColumn = memo(function DroppableColumn({
  column,
  tasks,
  getPriorityColor,
  toggleArchive,
  columns,
  updateTaskStatus,
}: DroppableColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column-${column.id}`,
    data: {
      type: 'column',
      columnId: column.id,
    },
  })

  const style = useMemo(
    () => ({
      backgroundColor: isOver ? 'rgba(59, 130, 246, 0.1)' : undefined,
      borderColor: isOver ? 'rgba(59, 130, 246, 0.5)' : undefined,
      borderWidth: isOver ? '2px' : '1px',
      borderStyle: 'dashed',
    }),
    [isOver]
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${column.color} rounded-lg p-3 sm:p-4 min-w-[280px] sm:min-w-[300px] lg:min-w-0 transition-all duration-300 border-transparent flex-shrink-0 animate-fade-in`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{column.title}</h3>
        <Badge variant="outline">{tasks.length}</Badge>
      </div>

      <div className="space-y-3 min-h-[200px]">
        {tasks.map((tache) => (
          <DraggableTaskCard
            key={tache.id}
            tache={tache}
            getPriorityColor={getPriorityColor}
            toggleArchive={toggleArchive}
            columns={columns}
            updateTaskStatus={updateTaskStatus}
          />
        ))}
        {tasks.length === 0 && isOver && (
          <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 text-center text-sm text-muted-foreground">
            Déposer la tâche ici
          </div>
        )}
      </div>
    </div>
  )
})

interface DraggableTaskCardProps {
  tache: {
    id: string
    titre: string
    description?: string
    statut: 'A faire' | 'En cours' | 'Bloqué' | 'Terminé'
    priorite: 'low' | 'medium' | 'high'
    archive: boolean
    categorie?: { nom: string; couleur: string }
    echeance?: string
    responsable?: { prenom: string; nom: string }
  }
  getPriorityColor: (priorite: string) => string
  toggleArchive: (taskId: string, isArchived: boolean) => Promise<void>
  columns: Array<{ id: string; title: string; color: string }>
  updateTaskStatus: (
    taskId: string,
    newStatus: 'A faire' | 'En cours' | 'Bloqué' | 'Terminé'
  ) => Promise<void>
}

const DraggableTaskCard = memo(function DraggableTaskCard({
  tache,
  getPriorityColor,
  toggleArchive,
  columns,
  updateTaskStatus,
}: DraggableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tache.id,
    data: {
      type: 'task',
      task: tache,
    },
  })

  const style = useMemo(
    () =>
      transform
        ? {
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
            opacity: isDragging ? 0.5 : 1,
            zIndex: isDragging ? 1000 : 'auto',
          }
        : {},
    [transform, isDragging]
  )

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="bg-card shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1">
            <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <h4 className="font-medium text-sm flex-1">{tache.titre}</h4>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Plus d'options" title="Plus d'options">
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {columns.map((col) => (
                <DropdownMenuItem
                  key={col.id}
                  onClick={() =>
                    updateTaskStatus(
                      tache.id,
                      col.id as 'A faire' | 'En cours' | 'Bloqué' | 'Terminé'
                    )
                  }
                >
                  Déplacer vers {col.title}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => toggleArchive(tache.id, tache.archive)}>
                {tache.archive ? 'Désarchiver' : 'Archiver'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {tache.archive && (
          <Badge variant="outline" className="text-xs mb-2 bg-muted">
            <Archive className="w-3 h-3 mr-1" />
            Archivé
          </Badge>
        )}

        {tache.categorie && (
          <Badge
            variant="outline"
            className="text-xs mb-2"
            style={{
              backgroundColor: tache.categorie.couleur + '20',
              borderColor: tache.categorie.couleur,
            }}
          >
            {tache.categorie.nom}
          </Badge>
        )}

        {tache.description && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{tache.description}</p>
        )}

        <div className="flex items-center justify-between">
          <Badge
            variant={
              getPriorityColor(tache.priorite) as
                | 'default'
                | 'destructive'
                | 'outline'
                | 'secondary'
            }
            className="text-xs"
          >
            {tache.priorite === 'high'
              ? 'Haute'
              : tache.priorite === 'medium'
                ? 'Moyenne'
                : 'Basse'}
          </Badge>

          <div className="flex items-center gap-1">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Voir les documents"
                  title="Voir les documents"
                  className="p-1 h-6 w-6"
                >
                  <FileText className="w-3 h-3" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>Documents - {tache.titre}</DialogTitle>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto">
                  <TacheDocuments tacheId={tache.id} tacheTitre={tache.titre} />
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-6 w-6"
              onClick={() => toggleArchive(tache.id, tache.archive)}
              title={tache.archive ? 'Désarchiver' : 'Archiver'}
            >
              {tache.archive ? (
                <ArchiveRestore className="w-3 h-3" />
              ) : (
                <Archive className="w-3 h-3" />
              )}
            </Button>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {tache.echeance && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(tache.echeance).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
              {tache.responsable && (
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>
                    {tache.responsable.prenom?.[0]}
                    {tache.responsable.nom?.[0]}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

export function KanbanBoard({ etablissementId }: KanbanBoardProps) {
  const [showArchived, setShowArchived] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const { data: allTachesGlobal } = useTaches()
  const { data: etabTaches } = useTachesByEtablissement(etablissementId || '')
  const sourceTaches = etablissementId ? etabTaches : allTachesGlobal
  const taches = sourceTaches?.filter((t) => showArchived || !t.archive)
  const updateTache = useUpdateTache()
  const archiveTache = useArchiveTache()
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  const updateTaskStatus = useCallback(
    async (taskId: string, newStatus: 'A faire' | 'En cours' | 'Bloqué' | 'Terminé') => {
      try {
        await updateTache.mutateAsync({
          id: taskId,
          data: { statut: newStatus },
        })
        toast({ title: 'Tâche mise à jour', description: `Statut: ${newStatus}` })
      } catch (error) {
        toast({
          title: 'Erreur',
          description: 'Impossible de mettre à jour',
          variant: 'destructive',
        })
      }
    },
    [updateTache, toast]
  )

  const toggleArchive = useCallback(
    async (taskId: string, isArchived: boolean) => {
      try {
        await archiveTache.mutateAsync({
          id: taskId,
          archive: !isArchived,
        })
      } catch (error) {
        toast({
          title: 'Erreur',
          description: "Impossible de modifier l'archivage",
          variant: 'destructive',
        })
      }
    },
    [archiveTache, toast]
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const taskId = active.id as string
    const overId = over.id as string

    // Extraire l'ID de la colonne si c'est un drop sur une colonne
    const targetColumnId = overId.startsWith('column-') ? overId.replace('column-', '') : overId

    // Vérifier que c'est un statut valide
    const validStatuses: Array<'A faire' | 'En cours' | 'Bloqué' | 'Terminé'> = [
      'A faire',
      'En cours',
      'Bloqué',
      'Terminé',
    ]
    if (!validStatuses.includes(targetColumnId as never)) {
      return
    }

    const newStatus = targetColumnId as 'A faire' | 'En cours' | 'Bloqué' | 'Terminé'

    // Trouver la tâche actuelle
    const currentTask = taches?.find((t) => t.id === taskId)
    if (!currentTask) {
      return
    }

    if (currentTask.statut === newStatus) {
      return // Même statut, pas de changement nécessaire
    }

    await updateTaskStatus(taskId, newStatus)
  }

  const getPriorityColor = useCallback((priorite: string) => {
    switch (priorite) {
      case 'high':
        return 'destructive'
      case 'medium':
        return 'default'
      case 'low':
        return 'secondary'
      default:
        return 'outline'
    }
  }, [])

  const columns = useMemo(
    () => [
      { id: 'A faire', title: 'À faire', color: 'bg-gray-50' },
      { id: 'En cours', title: 'En cours', color: 'bg-blue-50' },
      { id: 'Bloqué', title: 'Bloqué', color: 'bg-red-50' },
      { id: 'Terminé', title: 'Terminé', color: 'bg-green-50' },
    ],
    []
  )

  const columnTasks = useMemo(() => {
    if (!taches) return {}
    return columns.reduce(
      (acc, column) => {
        acc[column.id] = taches.filter((t) => t.statut === column.id)
        return acc
      },
      {} as Record<string, typeof taches>
    )
  }, [taches, columns])

  const activeTask = useMemo(
    () => (activeId ? taches?.find((t) => t.id === activeId) : null),
    [activeId, taches]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Vue Kanban</h3>
        <div className="flex items-center space-x-2">
          <Switch
            id="show-archived-kanban"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <Label htmlFor="show-archived-kanban" className="text-sm font-medium">
            Afficher archivées
          </Label>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto min-h-[500px] pb-4">
          <div className="flex sm:contents gap-4 min-w-max sm:min-w-0">
            {columns.map((column) => (
              <DroppableColumn
                key={column.id}
                column={column}
                tasks={columnTasks[column.id] || []}
                getPriorityColor={getPriorityColor}
                toggleArchive={toggleArchive}
                columns={columns}
                updateTaskStatus={updateTaskStatus}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeTask && (
            <Card className="bg-card shadow-2xl opacity-90 w-64">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <GripVertical className="w-3 h-3 text-muted-foreground" />
                    <h4 className="font-medium text-sm flex-1">{activeTask.titre}</h4>
                  </div>
                  <Badge variant={getPriorityColor(activeTask.priorite)}>
                    {activeTask.priorite}
                  </Badge>
                </div>

                {activeTask.description && (
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                    {activeTask.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {activeTask.echeance && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(activeTask.echeance).toLocaleDateString()}</span>
                    </div>
                  )}
                  {activeTask.responsable_id && (
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>Assigné</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
