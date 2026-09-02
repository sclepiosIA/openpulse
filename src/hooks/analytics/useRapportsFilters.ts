import { useState, useMemo, useCallback } from 'react'
import { subYears, subDays } from 'date-fns'
import { useUserPreferences } from '../profile/useUserPreferences'

export type PeriodPreset = '7d' | '30d' | '90d' | '1y' | 'custom'
export type RapportsView = 'dashboard' | 'charts' | 'table' | 'evolution' | 'goals' | 'comparative'

export interface RapportsFilters {
  periodPreset: PeriodPreset
  startDate: Date
  endDate: Date
  compareWithPrevious: boolean
  previousStartDate: Date
  previousEndDate: Date
  selectedEtablissements: string[]
  selectedResponsables: string[]
  selectedStatuts: string[]
  selectedTypesOffre: string[]
  selectedPalliers: string[]
  minValue: number
  maxValue: number
  minPassages: number
  maxPassages: number
  includeProspects: boolean
  productionOnly: boolean
}

export function useRapportsFilters() {
  const { getPreference, updatePreference } = useUserPreferences()
  const [view, setViewState] = useState<RapportsView>(
    (getPreference('rapports_view', 'dashboard') as RapportsView) || 'dashboard'
  )

  const setView = useCallback(
    (newView: RapportsView) => {
      setViewState(newView)
      updatePreference('rapports_view', newView)
    },
    [updatePreference]
  )
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30d')
  const [compareWithPrevious, setCompareWithPrevious] = useState(false)

  const [customStartDate, setCustomStartDate] = useState<Date>(subDays(new Date(), 30))
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date())

  const [selectedEtablissements, setSelectedEtablissements] = useState<string[]>([])
  const [selectedResponsables, setSelectedResponsables] = useState<string[]>([])
  const [selectedStatuts, setSelectedStatuts] = useState<string[]>([])
  const [selectedTypesOffre, setSelectedTypesOffre] = useState<string[]>([])
  const [selectedPalliers, setSelectedPalliers] = useState<string[]>([])
  const [minValue, setMinValue] = useState(0)
  const [maxValue, setMaxValue] = useState(1000000)
  const [minPassages, setMinPassages] = useState(0)
  const [maxPassages, setMaxPassages] = useState(200000)
  const [includeProspects, setIncludeProspects] = useState(true)
  const [productionOnly, setProductionOnly] = useState(false)

  const { startDate, endDate, previousStartDate, previousEndDate } = useMemo(() => {
    const now = new Date()
    let start: Date
    let end: Date = now

    switch (periodPreset) {
      case '7d':
        start = subDays(now, 7)
        break
      case '30d':
        start = subDays(now, 30)
        break
      case '90d':
        start = subDays(now, 90)
        break
      case '1y':
        start = subYears(now, 1)
        break
      case 'custom':
        start = customStartDate
        end = customEndDate
        break
      default:
        start = subDays(now, 30)
    }

    // Calculate previous period
    const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const prevEnd = subDays(start, 1)
    const prevStart = subDays(prevEnd, daysDiff)

    return {
      startDate: start,
      endDate: end,
      previousStartDate: prevStart,
      previousEndDate: prevEnd,
    }
  }, [periodPreset, customStartDate, customEndDate])

  const filters: RapportsFilters = {
    periodPreset,
    startDate,
    endDate,
    compareWithPrevious,
    previousStartDate,
    previousEndDate,
    selectedEtablissements,
    selectedResponsables,
    selectedStatuts,
    selectedTypesOffre,
    selectedPalliers,
    minValue,
    maxValue,
    minPassages,
    maxPassages,
    includeProspects,
    productionOnly,
  }

  const resetFilters = () => {
    setPeriodPreset('30d')
    setCompareWithPrevious(false)
    setSelectedEtablissements([])
    setSelectedResponsables([])
    setSelectedStatuts([])
    setSelectedTypesOffre([])
    setSelectedPalliers([])
    setMinValue(0)
    setMaxValue(1000000)
    setMinPassages(0)
    setMaxPassages(200000)
    setIncludeProspects(true)
    setProductionOnly(false)
  }

  return {
    view,
    setView,
    filters,
    periodPreset,
    setPeriodPreset,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    compareWithPrevious,
    setCompareWithPrevious,
    selectedEtablissements,
    setSelectedEtablissements,
    selectedResponsables,
    setSelectedResponsables,
    selectedStatuts,
    setSelectedStatuts,
    selectedTypesOffre,
    setSelectedTypesOffre,
    selectedPalliers,
    setSelectedPalliers,
    minValue,
    setMinValue,
    maxValue,
    setMaxValue,
    minPassages,
    setMinPassages,
    maxPassages,
    setMaxPassages,
    includeProspects,
    setIncludeProspects,
    productionOnly,
    setProductionOnly,
    resetFilters,
  }
}
