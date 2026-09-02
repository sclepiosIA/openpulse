import { useMemo } from 'react'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import type { CustomerHealthStatus, CustomerHealthScore } from '../crm/useCustomerHealth'
import { calculateEtablissementValue } from '@/lib/valueCalculations'

export interface ProductionFilters {
  search: string
  regions: string[]
  types: string[]
  healthStatuses: CustomerHealthStatus[]
  csmIds: string[]
  durationRanges: string[]
  adoptionRanges: string[]
  npsRanges: string[]
  supportLevels: string[]
  renewalPeriods: string[]
}

export type ProductionSortField = 'nom' | 'health' | 'revenue' | 'date_signature' | 'nps' | 'adoption' | 'renewal'
export type SortDirection = 'asc' | 'desc'

export interface ProductionSortConfig {
  field: ProductionSortField
  direction: SortDirection
}

export function useProductionFilters(
  etablissements: Etablissement[],
  filters: ProductionFilters,
  sortConfig: ProductionSortConfig,
  healthScores: Map<string, CustomerHealthScore>,
  healthMetrics?: Map<string, any>
) {
  return useMemo(() => {
    let filtered = [...etablissements]

    // Filtre recherche
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(e =>
        e.nom.toLowerCase().includes(searchLower) ||
        e.ville.toLowerCase().includes(searchLower) ||
        e.region.toLowerCase().includes(searchLower) ||
        e.type.toLowerCase().includes(searchLower)
      )
    }

    // Filtre régions
    if (filters.regions.length > 0) {
      filtered = filtered.filter(e => filters.regions.includes(e.region))
    }

    // Filtre types
    if (filters.types.length > 0) {
      filtered = filtered.filter(e => filters.types.includes(e.type))
    }

    // Filtre santé
    if (filters.healthStatuses.length > 0) {
      filtered = filtered.filter(e => {
        const health = healthScores.get(e.id)
        return health && filters.healthStatuses.includes(health.status)
      })
    }

    // Filtre CSM
    if (filters.csmIds.length > 0) {
      filtered = filtered.filter(e => e.csm_id && filters.csmIds.includes(e.csm_id))
    }

    // Filtre durée en production
    if (filters.durationRanges.length > 0) {
      filtered = filtered.filter(e => {
        if (!e.date_signature) return false
        const months = Math.floor((Date.now() - new Date(e.date_signature).getTime()) / (1000 * 60 * 60 * 24 * 30))
        return filters.durationRanges.some(range => {
          if (range === '0-3') return months >= 0 && months < 3
          if (range === '3-6') return months >= 3 && months < 6
          if (range === '6-12') return months >= 6 && months < 12
          if (range === '12-24') return months >= 12 && months < 24
          if (range === '24+') return months >= 24
          return false
        })
      })
    }

    // Filtre adoption
    if (filters.adoptionRanges.length > 0) {
      filtered = filtered.filter(e => {
        const metrics = healthMetrics?.get(e.id)
        const adoption = metrics?.adoption_rate || 70
        return filters.adoptionRanges.some(range => {
          if (range === '<50') return adoption < 50
          if (range === '50-75') return adoption >= 50 && adoption < 75
          if (range === '75+') return adoption >= 75
          return false
        })
      })
    }

    // Filtre NPS
    if (filters.npsRanges.length > 0) {
      filtered = filtered.filter(e => {
        const metrics = healthMetrics?.get(e.id)
        const nps = metrics?.nps_score
        if (nps === undefined) return false
        return filters.npsRanges.some(range => {
          if (range === 'detractors') return nps <= 6
          if (range === 'passives') return nps > 6 && nps <= 8
          if (range === 'promoters') return nps > 8
          return false
        })
      })
    }

    // Filtre support
    if (filters.supportLevels.length > 0) {
      filtered = filtered.filter(e => {
        const metrics = healthMetrics?.get(e.id)
        const tickets = metrics?.support_tickets_open || 0
        return filters.supportLevels.some(level => {
          if (level === 'none') return tickets === 0
          if (level === 'low') return tickets >= 1 && tickets <= 3
          if (level === 'high') return tickets > 3
          return false
        })
      })
    }

    // Filtre renouvellement
    if (filters.renewalPeriods.length > 0) {
      filtered = filtered.filter(e => {
        const metrics = healthMetrics?.get(e.id)
        if (!metrics?.contract_end_date) return false
        const days = Math.floor((new Date(metrics.contract_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        return filters.renewalPeriods.some(period => {
          if (period === '<30') return days >= 0 && days < 30
          if (period === '30-90') return days >= 30 && days < 90
          if (period === '90+') return days >= 90
          if (period === 'expired') return days < 0
          return false
        })
      })
    }

    // Tri
    filtered.sort((a, b) => {
      let compareValue = 0

      switch (sortConfig.field) {
        case 'nom':
          compareValue = a.nom.localeCompare(b.nom)
          break
        case 'health': {
          const healthA = healthScores.get(a.id)?.score || 0
          const healthB = healthScores.get(b.id)?.score || 0
          compareValue = healthA - healthB
          break
        }
        case 'revenue': {
          const revenueA = calculateEtablissementValue(a)
          const revenueB = calculateEtablissementValue(b)
          compareValue = revenueA - revenueB
          break
        }
        case 'date_signature': {
          const dateA = a.date_signature ? new Date(a.date_signature).getTime() : 0
          const dateB = b.date_signature ? new Date(b.date_signature).getTime() : 0
          compareValue = dateA - dateB
          break
        }
        case 'nps': {
          const npsA = healthMetrics?.get(a.id)?.nps_score || 0
          const npsB = healthMetrics?.get(b.id)?.nps_score || 0
          compareValue = npsA - npsB
          break
        }
        case 'adoption': {
          const adoptionA = healthMetrics?.get(a.id)?.adoption_rate || 0
          const adoptionB = healthMetrics?.get(b.id)?.adoption_rate || 0
          compareValue = adoptionA - adoptionB
          break
        }
        case 'renewal': {
          const daysA = healthMetrics?.get(a.id)?.contract_end_date 
            ? Math.floor((new Date(healthMetrics.get(a.id).contract_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : 999999
          const daysB = healthMetrics?.get(b.id)?.contract_end_date
            ? Math.floor((new Date(healthMetrics.get(b.id).contract_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : 999999
          compareValue = daysA - daysB
          break
        }
      }

      return sortConfig.direction === 'asc' ? compareValue : -compareValue
    })

    return filtered
  }, [etablissements, filters, sortConfig, healthScores, healthMetrics])
}
