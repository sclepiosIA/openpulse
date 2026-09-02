import React, { createContext, useState, useCallback, ReactNode } from 'react'
import { RapportsView } from '@/hooks/analytics/useRapportsFilters'

// Types stricts pour les filtres de drill-down
export interface DrilldownFilters {
  etablissement_id?: string;
  commercial_id?: string;
  csm_id?: string;
  groupe_id?: string;
  partenaire_id?: string;
  statut?: string;
  type_offre?: string;
  periode_debut?: string;
  periode_fin?: string;
  segment_id?: string;
  categorie?: string;
  priorite?: string;
  selectedStatuts?: string[];
  [key: string]: string | string[] | undefined; // Index signature pour flexibilité
}

export interface DrilldownLevel {
  label: string
  filters: DrilldownFilters
  view: RapportsView
}

interface RapportsDrilldownContextType {
  breadcrumbs: DrilldownLevel[]
  currentFilters: DrilldownFilters
  drillDown: (level: DrilldownLevel) => void
  drillUp: (index: number) => void
  resetDrilldown: () => void
  goToLevel: (index: number) => void
}

export const RapportsDrilldownContext = createContext<RapportsDrilldownContextType | undefined>(undefined)

interface RapportsDrilldownProviderProps {
  children: ReactNode
  initialFilters?: DrilldownFilters
}

export function RapportsDrilldownProvider({ children, initialFilters = {} }: RapportsDrilldownProviderProps) {
  const [breadcrumbs, setBreadcrumbs] = useState<DrilldownLevel[]>([
    {
      label: 'Dashboard',
      filters: initialFilters,
      view: 'dashboard'
    }
  ])

  const currentFilters = breadcrumbs[breadcrumbs.length - 1]?.filters || initialFilters

  const drillDown = useCallback((level: DrilldownLevel) => {
    setBreadcrumbs(prev => [...prev, level])
  }, [])

  const drillUp = useCallback((index: number) => {
    setBreadcrumbs(prev => prev.slice(0, index + 1))
  }, [])

  const resetDrilldown = useCallback(() => {
    setBreadcrumbs([{
      label: 'Dashboard',
      filters: initialFilters,
      view: 'dashboard'
    }])
  }, [initialFilters])

  const goToLevel = useCallback((index: number) => {
    if (index >= 0 && index < breadcrumbs.length) {
      setBreadcrumbs(prev => prev.slice(0, index + 1))
    }
  }, [breadcrumbs.length])

  return (
    <RapportsDrilldownContext.Provider
      value={{
        breadcrumbs,
        currentFilters,
        drillDown,
        drillUp,
        resetDrilldown,
        goToLevel
      }}
    >
      {children}
    </RapportsDrilldownContext.Provider>
  )
}
