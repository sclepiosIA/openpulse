import { useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FileQuestion } from "lucide-react"
import type { ModeletTache } from "@/hooks/tasks/useModelesTaches"
import type { Category } from "@/hooks/catalogue/useCategories"
import type { PhaseKey } from "@/config/phases"
import { TemplateTaskCard } from "./TemplateTaskCard"
import { useUpdateModeleTache } from "@/hooks/tasks/useModelesTaches"

interface TemplateTaskListProps {
  modeles: ModeletTache[]
  categories: Category[]
  isLoading: boolean
  phase: PhaseKey
}

export function TemplateTaskList({ modeles, categories, isLoading, phase }: TemplateTaskListProps) {
  const updateModele = useUpdateModeleTache()
  const [items, setItems] = useState<ModeletTache[]>([])

  // Sync items with modeles when they change
  if (JSON.stringify(items.map(i => i.id)) !== JSON.stringify(modeles.map(m => m.id))) {
    setItems(modeles)
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)
      
      const newItems = arrayMove(items, oldIndex, newIndex)
      setItems(newItems)

      // Update ordre in database
      for (let i = 0; i < newItems.length; i++) {
        if (newItems[i].ordre !== i) {
          await updateModele.mutateAsync({
            id: newItems[i].id,
            data: { ordre: i }
          })
        }
      }
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Templates de tâches</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={`template-task-skeleton-${i}`} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!modeles || modeles.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileQuestion className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">Aucun template pour cette phase</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Créez votre premier template de tâche pour automatiser la création de tâches.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Templates de tâches ({modeles.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((modele) => (
                <TemplateTaskCard
                  key={modele.id}
                  modele={modele}
                  categories={categories}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  )
}
