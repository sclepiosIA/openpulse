import { useState, useMemo } from 'react'
import { getPhaseByStatus, PhaseKey } from '@/config/phases'
import type { Task } from '@/types/gantt'

export interface GanttFilters {
  searchTerm: string
  categories: string[]
  statuts: string[]
  priorites: string[]
  responsables: string[]
  etablissements: string[]
  phases: string[]
  quickFilters: {
    highPriorityOnly: boolean
    overdueOnly: boolean
    hideCompleted: boolean
    blockedOnly: boolean
    commercialOnly: boolean
    deploiementOnly: boolean
    productionOnly: boolean
  }
}

interface EtablissementForFilter {
  id: string
  statut: string
}

export function useGanttFilters(tasks: Task[], etablissementsData?: EtablissementForFilter[]) {
  const [filters, setFilters] = useState<GanttFilters>({
    searchTerm: '',
    categories: [],
    statuts: [],
    priorites: [],
    responsables: [],
    etablissements: [],
    phases: [],
    quickFilters: {
      highPriorityOnly: false,
      overdueOnly: false,
      hideCompleted: true,
      blockedOnly: false,
      commercialOnly: false,
      deploiementOnly: false,
      productionOnly: false
    }
  })

  // Create a map of etablissement_id -> phase for quick lookup
  const etablissementPhaseMap = useMemo(() => {
    const map = new Map<string, PhaseKey | null>()
    if (etablissementsData) {
      etablissementsData.forEach(etab => {
        map.set(etab.id, getPhaseByStatus(etab.statut))
      })
    }
    return map
  }, [etablissementsData])

  const filteredTasks = useMemo(() => {
    if (!tasks) return []

    return tasks.filter(task => {
      // Quick filters
      if (filters.quickFilters.highPriorityOnly && task.priorite !== 'high') {
        return false
      }

      if (filters.quickFilters.overdueOnly) {
        if (task.statut === "Terminé" || !task.echeance) return false
        const isOverdue = new Date(task.echeance) < new Date()
        if (!isOverdue) return false
      }

      if (filters.quickFilters.hideCompleted && task.statut === "Terminé") {
        return false
      }

      if (filters.quickFilters.blockedOnly && task.statut !== "Bloqué") {
        return false
      }

      // Filtres par phase d'établissement (OU logique si plusieurs actifs)
      const anyPhaseFilterActive = 
        filters.quickFilters.commercialOnly || 
        filters.quickFilters.deploiementOnly || 
        filters.quickFilters.productionOnly

      if (anyPhaseFilterActive) {
        if (!task.etablissement_id) return false
        const taskPhase = etablissementPhaseMap.get(task.etablissement_id)
        if (!taskPhase) return false
        
        const matchesPhase = 
          (filters.quickFilters.commercialOnly && taskPhase === 'commercial') ||
          (filters.quickFilters.deploiementOnly && taskPhase === 'deploiement') ||
          (filters.quickFilters.productionOnly && taskPhase === 'production')
        
        if (!matchesPhase) return false
      }

      // Filtre par recherche
      if (filters.searchTerm) {
        const search = filters.searchTerm.toLowerCase()
        const matchTitle = task.titre?.toLowerCase().includes(search)
        const matchDesc = task.description?.toLowerCase().includes(search)
        if (!matchTitle && !matchDesc) return false
      }

      // Filtre par catégorie
      if (filters.categories.length > 0) {
        const categoryId = task.categorie_id || task.categories_taches?.id
        if (!categoryId || !filters.categories.includes(categoryId)) return false
      }

      // Filtre par statut
      if (filters.statuts.length > 0) {
        if (!filters.statuts.includes(task.statut)) return false
      }

      // Filtre par priorité
      if (filters.priorites.length > 0) {
        if (!task.priorite || !filters.priorites.includes(task.priorite)) return false
      }

      // Filtre par responsable
      if (filters.responsables.length > 0) {
        if (!task.responsable_id || !filters.responsables.includes(task.responsable_id)) {
          return false
        }
      }

      // Filtre par phase d'établissement
      if (filters.phases.length > 0) {
        if (!task.etablissement_id) return false
        const taskPhase = etablissementPhaseMap.get(task.etablissement_id)
        if (!taskPhase || !filters.phases.includes(taskPhase)) return false
      }

      return true
    })
  }, [tasks, filters, etablissementPhaseMap])

  const updateFilter = (key: keyof GanttFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      categories: [],
      statuts: [],
      priorites: [],
      responsables: [],
      etablissements: [],
      phases: [],
      quickFilters: {
        highPriorityOnly: false,
        overdueOnly: false,
        hideCompleted: true,
        blockedOnly: false,
        commercialOnly: false,
        deploiementOnly: false,
        productionOnly: false
      }
    })
  }

  const toggleQuickFilter = (filterKey: keyof GanttFilters['quickFilters']) => {
    setFilters(prev => ({
      ...prev,
      quickFilters: {
        ...prev.quickFilters,
        [filterKey]: !prev.quickFilters[filterKey]
      }
    }))
  }

  const hasActiveFilters = useMemo(() => {
    return filters.searchTerm !== '' ||
           filters.categories.length > 0 ||
           filters.statuts.length > 0 ||
           filters.priorites.length > 0 ||
           filters.responsables.length > 0 ||
           filters.etablissements.length > 0 ||
           filters.phases.length > 0 ||
           Object.values(filters.quickFilters).some(v => v === true)
  }, [filters])

  return {
    filters,
    filteredTasks,
    updateFilter,
    resetFilters,
    toggleQuickFilter,
    hasActiveFilters
  }
}
