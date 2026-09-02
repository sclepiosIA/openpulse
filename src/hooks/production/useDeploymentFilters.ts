import { useMemo } from 'react'
import type { Etablissement } from '@/hooks/crm/useEtablissements'

export type DeploymentHealthStatus = 'healthy' | 'at-risk' | 'delayed' | 'blocked'

export interface DeploymentFilters {
  searchTerm: string
  regions: string[]
  types: string[]
  statuts: string[]
  healthStatuses: DeploymentHealthStatus[]
  teamMembers: string[]
  progressionMin?: number
  progressionMax?: number
  dateSignatureStart?: Date
  dateSignatureEnd?: Date
}

export type SortField = 'nom' | 'date_signature' | 'progression' | 'statut' | 'urgence'
export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  field: SortField
  direction: SortDirection
}

export function useDeploymentFilters(
  etablissements: Etablissement[],
  filters: DeploymentFilters,
  sortConfig: SortConfig,
  healthScores: Map<string, { score: number; status: DeploymentHealthStatus }>
) {
  return useMemo(() => {
    if (!etablissements) return []

    let filtered = [...etablissements]

    // Recherche textuelle
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase()
      filtered = filtered.filter(e =>
        e.nom.toLowerCase().includes(searchLower) ||
        e.ville.toLowerCase().includes(searchLower) ||
        e.region.toLowerCase().includes(searchLower) ||
        e.type.toLowerCase().includes(searchLower)
      )
    }

    // Filtres par région
    if (filters.regions.length > 0) {
      filtered = filtered.filter(e => filters.regions.includes(e.region))
    }

    // Filtres par type
    if (filters.types.length > 0) {
      filtered = filtered.filter(e => filters.types.includes(e.type))
    }

    // Filtres par statut
    if (filters.statuts.length > 0) {
      filtered = filtered.filter(e => filters.statuts.includes(e.statut))
    }

    // Filtres par santé
    if (filters.healthStatuses.length > 0) {
      filtered = filtered.filter(e => {
        const health = healthScores.get(e.id)
        return health && filters.healthStatuses.includes(health.status)
      })
    }

    // Filtres par équipe
    if (filters.teamMembers.length > 0) {
      filtered = filtered.filter(e =>
        (e.commercial_id && filters.teamMembers.includes(e.commercial_id)) ||
        (e.chef_projet_id && filters.teamMembers.includes(e.chef_projet_id)) ||
        (e.csm_id && filters.teamMembers.includes(e.csm_id))
      )
    }

    // Filtres par progression
    if (filters.progressionMin !== undefined) {
      filtered = filtered.filter(e => (e.progression || 0) >= filters.progressionMin!)
    }
    if (filters.progressionMax !== undefined) {
      filtered = filtered.filter(e => (e.progression || 0) <= filters.progressionMax!)
    }

    // Filtres par date de signature
    if (filters.dateSignatureStart) {
      filtered = filtered.filter(e =>
        e.date_signature && new Date(e.date_signature) >= filters.dateSignatureStart!
      )
    }
    if (filters.dateSignatureEnd) {
      filtered = filtered.filter(e =>
        e.date_signature && new Date(e.date_signature) <= filters.dateSignatureEnd!
      )
    }

    // Tri
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortConfig.field) {
        case 'nom':
          comparison = a.nom.localeCompare(b.nom)
          break
        case 'date_signature':
          comparison = (a.date_signature || '').localeCompare(b.date_signature || '')
          break
        case 'progression':
          comparison = (a.progression || 0) - (b.progression || 0)
          break
        case 'statut':
          comparison = a.statut.localeCompare(b.statut)
          break
        case 'urgence': {
          const healthA = healthScores.get(a.id)
          const healthB = healthScores.get(b.id)
          comparison = (healthB?.score || 0) - (healthA?.score || 0)
          break
        }
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [etablissements, filters, sortConfig, healthScores])
}
