import { useState, useCallback } from 'react'
import { useSensors, useSensor, PointerSensor, DragEndEvent } from '@dnd-kit/core'
import { debug } from '@/lib/debug'
import { useQueryClient } from '@tanstack/react-query'
import { useUpdateTache, tacheKeys, Tache } from '@/hooks/tasks/useTaches'
import { addDays, differenceInDays, format } from 'date-fns'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { TimelineConfig } from './useGanttZoom'

/** Minimal task data needed for drag operations */
interface DraggableTask {
  id: string
  date_debut?: string | null
  echeance?: string | null
  created_at: string
}

export function useGanttDragDrop(timeline: TimelineConfig | null, containerRef: React.RefObject<HTMLElement>) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragStartInfo, setDragStartInfo] = useState<{
    taskId: string
    originalLeft: number
    originalStartDate: Date
    originalEndDate: Date | null
  } | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const updateTache = useUpdateTache()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = useCallback((taskId: string, task?: DraggableTask) => {
    setDraggedTaskId(taskId)
    
    if (task && timeline) {
      const originalStartDate = task.date_debut 
        ? new Date(task.date_debut) 
        : new Date(task.created_at)
      const originalEndDate = task.echeance ? new Date(task.echeance) : null
      
      const startOffset = differenceInDays(originalStartDate, timeline.start)
      const originalLeft = Math.max(0, startOffset * timeline.pixelsPerDay)
      
      setDragStartInfo({
        taskId,
        originalLeft,
        originalStartDate,
        originalEndDate
      })
    }
  }, [timeline])

  const handleDragEnd = useCallback(async (event: DragEndEvent, task: DraggableTask) => {
    setDraggedTaskId(null)
    
    if (!timeline || !event.delta || typeof event.delta.x !== 'number') {
      if (import.meta.env.DEV) {
        debug.warn('Invalid drag event: missing delta or timeline')
      }
      setDragStartInfo(null)
      return
    }

    try {
      const deltaX = event.delta.x
      
      // Ignorer les micro-mouvements
      if (Math.abs(deltaX) < timeline.pixelsPerDay / 2) {
        setDragStartInfo(null)
        return
      }

      // Calculer le nombre de jours de déplacement avec snapping
      // Utiliser pixelsPerDay directement pour un calcul précis
      const daysMoved = Math.round(deltaX / timeline.pixelsPerDay)
      
      if (daysMoved === 0) {
        setDragStartInfo(null)
        return
      }

      // Calculer les nouvelles dates
      const currentStart = task.date_debut 
        ? new Date(task.date_debut) 
        : new Date(task.created_at)
      
      const newStart = addDays(currentStart, daysMoved)
      const newDateDebut = format(newStart, 'yyyy-MM-dd')
      
      let newEcheance: string | null = null
      if (task.echeance) {
        const currentEnd = new Date(task.echeance)
        newEcheance = format(addDays(currentEnd, daysMoved), 'yyyy-MM-dd')
      }

      // Mettre à jour la tâche avec les nouvelles dates
      const updateData: Record<string, string> = {
        date_debut: newDateDebut
      }
      
      if (newEcheance) {
        updateData.echeance = newEcheance
      }

      // MISE À JOUR OPTIMISTE du cache pour feedback immédiat
      queryClient.setQueryData(tacheKeys.lists(), (oldData: Tache[] | undefined) => {
        if (!oldData) return oldData
        return oldData.map(t => {
          if (t.id === task.id) {
            return {
              ...t,
              date_debut: newDateDebut,
              ...(newEcheance && { echeance: newEcheance })
            }
          }
          return t
        })
      })

      await updateTache.mutateAsync({
        id: task.id,
        data: updateData
      })

      toast({
        title: "Tâche déplacée",
        description: `${daysMoved > 0 ? '+' : ''}${daysMoved} jour(s) → ${newDateDebut}${newEcheance ? ` - ${newEcheance}` : ''}`
      })
    } catch (error: unknown) {
      if (import.meta.env.DEV) {
        debug.error('Error moving task:', error)
      }
      // Rollback en cas d'erreur
      queryClient.invalidateQueries({ queryKey: tacheKeys.lists() })
      const message = sanitizeSupabaseError(error)
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive"
      })
    } finally {
      setDragStartInfo(null)
    }
  }, [timeline, updateTache, toast, queryClient])

  // Calculer la position projetée pendant le drag (pour le feedback visuel)
  const getProjectedPosition = useCallback((deltaX: number, originalLeft: number): number => {
    if (!timeline) return originalLeft
    
    // Snapper au jour le plus proche
    const newLeft = originalLeft + deltaX
    const daysFromStart = Math.round(newLeft / timeline.pixelsPerDay)
    return Math.max(0, daysFromStart * timeline.pixelsPerDay)
  }, [timeline])

  return {
    sensors,
    draggedTaskId,
    dragStartInfo,
    handleDragStart,
    handleDragEnd,
    getProjectedPosition,
    isDragging: !!draggedTaskId
  }
}
