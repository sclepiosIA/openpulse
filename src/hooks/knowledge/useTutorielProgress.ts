import { useState, useEffect, useCallback, useMemo } from 'react'
import { debug } from '@/lib/debug'

interface ModuleProgress {
  moduleId: string
  completedSections: string[]
  lastVisited: string
  isCompleted: boolean
}

interface UseTutorielProgressReturn {
  progress: ModuleProgress | null
  markSectionRead: (sectionId: string) => void
  percentComplete: number
  isCompleted: boolean
  completedSections: string[]
}

const STORAGE_KEY_PREFIX = 'tutoriel-progress-'

export function useTutorielProgress(moduleId: string, totalSections: number): UseTutorielProgressReturn {
  const [progress, setProgress] = useState<ModuleProgress | null>(null)

  // Charger depuis localStorage au montage
  useEffect(() => {
    if (!moduleId) return
    
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${moduleId}`)
      if (stored) {
        const parsed = JSON.parse(stored) as ModuleProgress
        setProgress(parsed)
      } else {
        // Initialiser une progression vide
        setProgress({
          moduleId,
          completedSections: [],
          lastVisited: new Date().toISOString(),
          isCompleted: false
        })
      }
    } catch (error) {
      debug.error('Error loading tutorial progress:', error)
      setProgress({
        moduleId,
        completedSections: [],
        lastVisited: new Date().toISOString(),
        isCompleted: false
      })
    }
  }, [moduleId])

  // Marquer une section comme lue
  const markSectionRead = useCallback((sectionId: string) => {
    setProgress(prev => {
      if (!prev) return prev
      
      // Ne pas ajouter si déjà présent
      if (prev.completedSections.includes(sectionId)) {
        return prev
      }

      const newCompletedSections = [...prev.completedSections, sectionId]
      const isCompleted = newCompletedSections.length >= totalSections

      const newProgress: ModuleProgress = {
        ...prev,
        completedSections: newCompletedSections,
        lastVisited: new Date().toISOString(),
        isCompleted
      }

      // Sauvegarder dans localStorage
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${moduleId}`, JSON.stringify(newProgress))
      } catch (error) {
        debug.error('Error saving tutorial progress:', error)
      }

      return newProgress
    })
  }, [moduleId, totalSections])

  // Calcul du pourcentage de complétion
  const percentComplete = useMemo(() => {
    if (!progress || totalSections === 0) return 0
    return Math.round((progress.completedSections.length / totalSections) * 100)
  }, [progress, totalSections])

  const isCompleted = progress?.isCompleted ?? false
  const completedSections = progress?.completedSections ?? []

  return {
    progress,
    markSectionRead,
    percentComplete,
    isCompleted,
    completedSections
  }
}

// Hook pour récupérer la progression globale de tous les modules
export function useAllTutorielProgress(moduleIds: string[]): Record<string, ModuleProgress | null> {
  const [allProgress, setAllProgress] = useState<Record<string, ModuleProgress | null>>({})

  useEffect(() => {
    const progressMap: Record<string, ModuleProgress | null> = {}
    
    moduleIds.forEach(moduleId => {
      try {
        const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${moduleId}`)
        if (stored) {
          progressMap[moduleId] = JSON.parse(stored)
        } else {
          progressMap[moduleId] = null
        }
      } catch {
        progressMap[moduleId] = null
      }
    })

    setAllProgress(progressMap)
  }, [moduleIds])

  return allProgress
}
