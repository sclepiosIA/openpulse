import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core"
import { SortableContext } from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Building2, Calendar, User, GripVertical } from "lucide-react"
import { useKanbanTaskMutation } from "@/hooks/tasks/useKanbanTaskMutation"
import { TaskEditDialog as TaskForm } from '@/components/tasks/TaskEditDialog'
import { Task } from "@/types/gantt"

interface MultiProjectKanbanViewProps {
  taches: Task[]
  getEtablissementColor: (id: string, nom: string) => string
}

interface Column {
  id: string
  title: string
  color: string
}

const getPriorityColor = (priorite: string) => {
  switch (priorite) {
    case 'high': return 'border-l-4 border-l-red-500'
    case 'medium': return 'border-l-4 border-l-orange-500'
    case 'low': return 'border-l-4 border-l-green-500'
    default: return 'border-l-4 border-l-gray-300'
  }
}

interface SortableTaskCardProps {
  tache: Task;
  etablissementColor: string | ((id: string, nom: string) => string);
  showEtablissementBadge: boolean;
}

function SortableTaskCard({ tache, etablissementColor, showEtablissementBadge }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tache.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    willChange: isDragging ? 'transform' : 'auto'
  }

  const computedColor = typeof etablissementColor === 'function' 
    ? etablissementColor(tache.etablissement_id || '', tache.etablissements?.nom || '')
    : etablissementColor || '#000';

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className={`mb-2 sm:mb-3 cursor-grab hover:shadow-lg hover:scale-[1.02] transition-all ${getPriorityColor(tache.priorite || 'low')}`}>
        <CardContent className="p-2 sm:p-3 space-y-1.5 sm:space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-xs sm:text-sm leading-tight line-clamp-2">
                {tache.titre}
              </h4>
            </div>
            <div {...listeners} className="cursor-grab active:cursor-grabbing flex-shrink-0 touch-none p-1 hover:bg-muted/50 rounded">
              <GripVertical className="w-3 sm:w-4 h-3 sm:h-4 text-muted-foreground" />
            </div>
          </div>

          {showEtablissementBadge && tache.etablissements && (
            <Badge 
              variant="outline" 
              className="text-[10px] sm:text-xs font-medium w-full justify-start"
              style={{ 
                borderColor: computedColor,
                backgroundColor: `${computedColor}15`,
                color: computedColor
              }}
            >
              <Building2 className="w-2.5 sm:w-3 h-2.5 sm:h-3 mr-1 flex-shrink-0" />
              <span className="truncate">{tache.etablissements?.nom}</span>
            </Badge>
          )}

          {tache.categories_taches && (
            <Badge 
              variant="outline" 
              className="text-[10px] sm:text-xs"
              style={{ 
                backgroundColor: tache.categories_taches.couleur + '20',
                borderColor: tache.categories_taches.couleur,
                color: tache.categories_taches.couleur
              }}
            >
              {tache.categories_taches.nom}
            </Badge>
          )}

          <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
            {tache.echeance && (
              <>
                <div className="flex items-center gap-1 bg-muted/50 px-1.5 sm:px-2 py-0.5 rounded sm:hidden">
                  <Calendar className="w-2.5 h-2.5" />
                  <span>{new Date(tache.echeance).toLocaleDateString('fr-FR', { 
                    day: '2-digit', 
                    month: '2-digit' 
                  })}</span>
                </div>
                <div className="hidden sm:flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(tache.echeance).toLocaleDateString('fr-FR', { 
                    day: 'numeric', 
                    month: 'short' 
                  })}</span>
                </div>
              </>
            )}
            {tache.responsable_profile && (
              <div className="flex items-center gap-1 bg-muted/50 px-1.5 sm:px-2 py-0.5 rounded">
                <User className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                <span className="max-w-[80px] sm:max-w-none truncate">
                  {tache.responsable_profile.prenom?.charAt(0)}. {tache.responsable_profile.nom}
                </span>
              </div>
            )}
          </div>

          <div className="pt-1">
            <TaskForm mode="edit" tache={tache as any} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface DroppableColumnProps {
  column: Column;
  tasks: Task[];
  etablissementColor: string | ((id: string, nom: string) => string);
  showEtablissementBadge: boolean;
}

function DroppableColumn({ 
  column, 
  tasks, 
  etablissementColor, 
  showEtablissementBadge
}: DroppableColumnProps) {
  const { setNodeRef } = useSortable({
    id: `column-${column.id}`,
    data: { type: 'column' }
  })

  return (
    <div className="flex flex-col min-h-[600px] max-h-[calc(100vh-20rem)] w-full min-w-0 transition-all duration-300">
      <div 
        className="rounded-t-lg p-2 sm:p-2.5 border-b flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm"
        style={{
          borderTop: `3px solid hsl(var(--primary))`,
          backgroundColor: `hsl(var(--muted))`
        }}
      >
        <h3 className="font-semibold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
          <span className="truncate">{column.title}</span>
          <Badge variant="secondary" className="text-[10px] sm:text-xs">{tasks.length}</Badge>
        </h3>
      </div>
      
      <div ref={setNodeRef} className="flex-1 min-h-0 p-2 sm:p-3 bg-muted/30 rounded-b-lg overflow-y-auto">
        {tasks.map((tache) => (
          <SortableTaskCard
            key={tache.id}
            tache={tache}
            etablissementColor={typeof etablissementColor === 'function' 
              ? etablissementColor(tache.etablissement_id || '', tache.etablissements?.nom || '')
              : etablissementColor}
            showEtablissementBadge={showEtablissementBadge}
          />
        ))}
      </div>
    </div>
  )
}

export function MultiProjectKanbanView({ taches, getEtablissementColor }: MultiProjectKanbanViewProps) {
  const [groupBy, setGroupBy] = useState<'status' | 'category'>('status')
  const [showArchived, setShowArchived] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 }
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 }
    }),
    useSensor(KeyboardSensor)
  )

  const updateTache = useKanbanTaskMutation();

  const filteredTaches = showArchived ? (taches || []) : (taches || []).filter(t => !t.archive)

  const columns: Column[] = useMemo(() => {
    if (groupBy === 'status') {
      return [
        { id: 'A faire', title: 'À faire', color: 'bg-gray-100' },
        { id: 'En cours', title: 'En cours', color: 'bg-blue-100' },
        { id: 'Bloqué', title: 'Bloqué', color: 'bg-red-100' },
        { id: 'Terminé', title: 'Terminé', color: 'bg-green-100' }
      ]
    } else {
      const categories = Array.from(new Set(filteredTaches.map(t => t.categorie_id).filter((id): id is string => Boolean(id))))
      return categories.map(catId => {
        const cat = filteredTaches.find(t => t.categorie_id === catId)?.categories_taches
        return {
          id: catId,
          title: cat?.nom || 'Inconnu',
          color: 'bg-gray-100'
        }
      })
    }
  }, [groupBy, filteredTaches])

  const getTasksForColumn = (columnId: string) => {
    if (groupBy === 'status') {
      return filteredTaches.filter(t => t.statut === columnId)
    } else {
      return filteredTaches.filter(t => t.categorie_id === columnId)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    
    if (!over) return

    const taskId = active.id as string
    let targetColumnId: string | undefined = over.id as string
    
    // Si on dépose sur une colonne
    if (targetColumnId.startsWith('column-')) {
      targetColumnId = targetColumnId.replace('column-', '')
    } else {
      // Si on dépose sur une tâche => trouver sa colonne
      const overTask = filteredTaches.find(t => t.id === targetColumnId)
      if (!overTask) return
      
      if (groupBy === 'status') {
        targetColumnId = overTask.statut
      } else {
        targetColumnId = overTask.categorie_id
      }
    }

    if (!targetColumnId) return;

    if (groupBy === 'status') {
      await updateTache.mutateAsync({
        id: taskId,
        data: { statut: targetColumnId }
      })
    } else {
      await updateTache.mutateAsync({
        id: taskId,
        data: { categorie_id: targetColumnId }
      })
    }
  }

  const activeTask = activeId ? filteredTaches.find(t => t.id === activeId) : null

  return (
    <Card className="flex flex-col max-h-[calc(100vh-12rem)] overflow-hidden">
      <CardHeader className="flex-shrink-0 border-b p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-semibold">Vue Kanban</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
              <SelectTrigger className="w-full sm:w-[180px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Par statut</SelectItem>
                <SelectItem value="category">Par catégorie</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} id="archive-switch" />
              <Label htmlFor="archive-switch" className="text-xs sm:text-sm">Afficher archivées</Label>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-hidden p-2 sm:p-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 h-full auto-rows-fr">
              <SortableContext items={columns.map(c => `column-${c.id}`)}>
                {columns.map(column => (
                  <DroppableColumn
                    key={column.id}
                    column={column}
                    tasks={getTasksForColumn(column.id)}
                    etablissementColor={getEtablissementColor}
                    showEtablissementBadge={true}
                  />
                ))}
              </SortableContext>
            </div>

            <DragOverlay>
              {activeTask && (
                <Card className={`w-[90vw] max-w-xs sm:max-w-sm md:w-64 shadow-xl ${getPriorityColor(activeTask.priorite || 'low')} opacity-90`}>
                  <CardContent className="p-2 sm:p-3">
                    <h4 className="font-medium text-xs sm:text-sm line-clamp-2">{activeTask.titre}</h4>
                    {activeTask.etablissements && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                        {activeTask.etablissements?.nom}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </CardContent>
    </Card>
  )
}
