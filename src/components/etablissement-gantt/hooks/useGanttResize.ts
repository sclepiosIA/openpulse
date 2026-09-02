import { useState, useCallback, useRef } from 'react'
import { debug } from '@/lib/debug'
import { useUpdateTache } from '@/hooks/tasks/useTaches'
import { addDays, differenceInDays, format } from 'date-fns'
import { useToast } from '@/hooks/shared/use-toast'
import { TimelineConfig } from './useGanttZoom'

export type ResizeHandle = 'left' | 'right' | null

interface ResizeState {
  id: string
  handle: ResizeHandle
  initialMouseX: number
  initialTaskLeft: number
  initialTaskWidth: number
  originalStartDate: Date
  originalEndDate: Date
}

export function useGanttResize(timeline: TimelineConfig | null, tasks: any[]) {
  const [resizingTask, setResizingTask] = useState<{ id: string; handle: ResizeHandle } | null>(null)
  const [resizeDelta, setResizeDelta] = useState(0)
  const { toast } = useToast()
  const updateTache = useUpdateTache()
  const resizeStateRef = useRef<ResizeState | null>(null)
  // Ref pour capturer le delta courant (évite les problèmes de closure)
  const resizeDeltaRef = useRef(0)

  const handleResizeStart = useCallback((
    taskId: string, 
    handle: ResizeHandle, 
    containerElement: HTMLElement,
    startClientX: number // Nouvelle signature avec position initiale
  ) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task || !timeline) return

    setResizingTask({ id: taskId, handle })
    setResizeDelta(0)

    // Calculer les positions initiales de la tâche
    const taskStartDate = task.date_debut 
      ? new Date(task.date_debut) 
      : new Date(task.created_at)
    const taskEndDate = task.echeance 
      ? new Date(task.echeance) 
      : addDays(taskStartDate, 7)

    const startOffset = differenceInDays(taskStartDate, timeline.start)
    const duration = differenceInDays(taskEndDate, taskStartDate) || 1
    
    const initialTaskLeft = Math.max(0, startOffset * timeline.pixelsPerDay)
    const initialTaskWidth = Math.max(timeline.pixelsPerDay * 2, duration * timeline.pixelsPerDay)

    // Stocker l'état initial avec initialMouseX immédiat
    resizeStateRef.current = {
      id: taskId,
      handle,
      initialMouseX: startClientX, // Position immédiate au démarrage
      initialTaskLeft,
      initialTaskWidth,
      originalStartDate: taskStartDate,
      originalEndDate: taskEndDate
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeStateRef.current || !timeline) return
      
      const state = resizeStateRef.current

      // Calculer le déplacement total depuis le début
      const totalDeltaX = event.clientX - state.initialMouseX

      // Calculer le nombre de jours de changement avec snapping
      const daysDelta = Math.round(totalDeltaX / timeline.pixelsPerDay)

      // Mettre à jour le delta pour le feedback visuel + ref
      resizeDeltaRef.current = daysDelta
      setResizeDelta(daysDelta)

      // Auto-scroll horizontal si proche des bords
      if (containerElement) {
        const rect = containerElement.getBoundingClientRect()
        const edgeThreshold = 40
        const scrollSpeed = 12

        if (event.clientX > rect.right - edgeThreshold) {
          containerElement.scrollLeft += scrollSpeed
        } else if (event.clientX < rect.left + edgeThreshold) {
          containerElement.scrollLeft -= scrollSpeed
        }
      }
    }

    const handleMouseUp = async () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      
      await finalizeResize()
    }

    // Empêcher la sélection de texte pendant le resize
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [tasks, timeline])

  const finalizeResize = useCallback(async () => {
    const state = resizeStateRef.current
    // Utiliser la ref pour avoir la valeur actuelle (évite les closures stales)
    const currentDelta = resizeDeltaRef.current
    
    if (!state || !timeline || currentDelta === 0) {
      setResizingTask(null)
      setResizeDelta(0)
      resizeDeltaRef.current = 0
      resizeStateRef.current = null
      return
    }

    const task = tasks.find(t => t.id === state.id)
    if (!task) {
      setResizingTask(null)
      setResizeDelta(0)
      resizeDeltaRef.current = 0
      resizeStateRef.current = null
      return
    }

    try {
      let newDateDebut: string | undefined
      let newEcheance: string

      if (state.handle === 'right') {
        // Resize à droite = modifier uniquement la date de fin
        newEcheance = format(addDays(state.originalEndDate, currentDelta), 'yyyy-MM-dd')
      } else {
        // Resize à gauche = modifier la date de début (la fin reste fixe)
        const newStart = addDays(state.originalStartDate, currentDelta)
        newDateDebut = format(newStart, 'yyyy-MM-dd')
        // La date de fin reste inchangée
        newEcheance = format(state.originalEndDate, 'yyyy-MM-dd')
      }

      // Validation: la date de fin doit être après le début
      const finalStart = state.handle === 'left' 
        ? addDays(state.originalStartDate, currentDelta) 
        : state.originalStartDate
      const finalEnd = new Date(newEcheance)

      // Durée minimale de 1 jour
      const durationDays = differenceInDays(finalEnd, finalStart)
      if (durationDays < 1) {
        toast({
          title: "Durée minimale",
          description: "La tâche doit durer au moins 1 jour",
          variant: "destructive"
        })
        setResizingTask(null)
        setResizeDelta(0)
        resizeDeltaRef.current = 0
        resizeStateRef.current = null
        return
      }

      const updateData: Record<string, string> = { echeance: newEcheance }
      if (newDateDebut) {
        updateData.date_debut = newDateDebut
      }

      // useUpdateTache gère l'optimistic update dans onMutate
      await updateTache.mutateAsync({
        id: task.id,
        data: updateData
      })

      toast({
        title: "Durée modifiée",
        description: `Nouvelle durée : ${durationDays} jour(s)`
      })
    } catch (error: unknown) {
      debug.error('Error resizing task:', error)
      // Le rollback est géré par useUpdateTache.onError
      toast({
        title: "Erreur",
        description: "Impossible de modifier la durée",
        variant: "destructive"
      })
    } finally {
      setResizingTask(null)
      setResizeDelta(0)
      resizeDeltaRef.current = 0
      resizeStateRef.current = null
    }
  }, [tasks, timeline, updateTache, toast])

  // Calculer la position/taille projetée pendant le resize
  const getResizePreview = useCallback((taskId: string): { left: number; width: number } | null => {
    const state = resizeStateRef.current
    if (!state || state.id !== taskId || !timeline) {
      return null
    }

    // Même si resizeDelta est 0, retourner la position initiale pour indiquer qu'on resize
    const pixelDelta = resizeDelta * timeline.pixelsPerDay

    if (state.handle === 'right') {
      // Resize à droite: le left reste fixe, la width change
      const newWidth = Math.max(timeline.pixelsPerDay, state.initialTaskWidth + pixelDelta)
      return { left: state.initialTaskLeft, width: newWidth }
    } else {
      // Resize à gauche: le left change, la width change inversement
      const newLeft = state.initialTaskLeft + pixelDelta
      const newWidth = Math.max(timeline.pixelsPerDay, state.initialTaskWidth - pixelDelta)
      return { left: Math.max(0, newLeft), width: newWidth }
    }
  }, [timeline, resizeDelta])

  return {
    resizingTask,
    resizeDelta,
    handleResizeStart,
    getResizePreview,
    isResizing: !!resizingTask
  }
}
