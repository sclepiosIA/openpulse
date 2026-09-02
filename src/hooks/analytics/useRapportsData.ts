import { useMemo } from 'react'
import { useAllEtablissements } from '@/hooks/crm/useProspects'
import { useTaches } from '@/hooks/tasks/useTaches'
import { useProfiles } from '@/hooks/profile/useProfiles'
import { RapportsFilters } from './useRapportsFilters'
import { isWithinInterval } from 'date-fns'
import { calculateEtablissementValue } from '@/lib/valueCalculations'

const PASSAGES_NATIONAUX_ANNUEL = 24_000_000 // 24 millions de passages en France

export function useRapportsData(filters: RapportsFilters) {
  const { data: allEtablissements } = useAllEtablissements()
  const { data: allTaches } = useTaches()
  const { data: profiles } = useProfiles()

  const filteredEtablissements = useMemo(() => {
    if (!allEtablissements) return []

    return allEtablissements.filter(etablissement => {
      // Filter by date range
      if (etablissement.created_at) {
        const createdAt = new Date(etablissement.created_at)
        const inRange = isWithinInterval(createdAt, {
          start: filters.startDate,
          end: filters.endDate
        })
        if (!inRange && filters.periodPreset !== 'custom') {
          // For non-custom periods, we want all establishments, not just created in period
          // So skip date filtering for establishments
        }
      }

      // Filter by selected establishments
      if (filters.selectedEtablissements.length > 0 && !filters.selectedEtablissements.includes(etablissement.id)) {
        return false
      }

      // Filter by responsables
      if (filters.selectedResponsables.length > 0 && 
          etablissement.commercial_id &&
          !filters.selectedResponsables.includes(etablissement.commercial_id)) {
        return false
      }

      // Filter by statuts
      if (filters.selectedStatuts.length > 0 && !filters.selectedStatuts.includes(etablissement.statut)) {
        return false
      }

      // Filter by types offre
      if (filters.selectedTypesOffre.length > 0 && 
          etablissement.type_offre &&
          !filters.selectedTypesOffre.includes(etablissement.type_offre)) {
        return false
      }

      // Filter by palliers
      if (filters.selectedPalliers.length > 0 && 
          etablissement.pallier_vise &&
          !filters.selectedPalliers.includes(etablissement.pallier_vise)) {
        return false
      }

      // Filter by value range
      const valeurEtablissement = calculateEtablissementValue(etablissement)
      if (valeurEtablissement < filters.minValue || valeurEtablissement > filters.maxValue) {
        return false
      }

      // Filter by passages range
      const passages = etablissement.nombre_passages_urgences_annuel || 0
      if (passages < filters.minPassages || passages > filters.maxPassages) {
        return false
      }

      // Filter prospects/production
      if (filters.productionOnly && etablissement.statut !== 'Production' && etablissement.statut !== 'Go-Live') {
        return false
      }

      if (!filters.includeProspects && etablissement.statut === 'Prospect') {
        return false
      }

      return true
    })
  }, [allEtablissements, filters])

  const stats = useMemo(() => {
    if (!filteredEtablissements || filteredEtablissements.length === 0) {
      return {
        totalEtablissements: 0,
        prospects: 0,
        enProduction: 0,
        enDeploiement: 0,
        totalTaches: 0,
        tachesTerminees: 0,
        tachesArchivees: 0,
        progressionMoyenne: 0,
        totalPassages: 0,
        totalValeur: 0,
        caRealise: 0,
        caPrevisionnel: 0,
        tauxConversion: 0,
        pipelineValue: 0,
        passagesProduction: 0,
        partMarcheActuelle: 0,
        partMarchePotentielle: 0,
        passagesRestants: PASSAGES_NATIONAUX_ANNUEL,
        potentielMarcheRestant: PASSAGES_NATIONAUX_ANNUEL * 2.5,
        passagesNationaux: PASSAGES_NATIONAUX_ANNUEL
      }
    }

    const totalEtablissements = filteredEtablissements.length
    const prospects = filteredEtablissements.filter(e => e.statut === 'Prospect').length
    const enProduction = filteredEtablissements.filter(e => e.statut === 'Production' || e.statut === 'Go-Live').length
    const enDeploiement = filteredEtablissements.filter(e => ['Déploiement', 'Formation', 'Contractuel', 'Conformité'].includes(e.statut)).length
    
    const etablissementIds = filteredEtablissements.map(e => e.id)
    const filteredTaches = allTaches?.filter(t => t.etablissement_id && etablissementIds.includes(t.etablissement_id)) || []
    
    const totalTaches = filteredTaches.length
    const tachesTerminees = filteredTaches.filter(t => t.statut === 'Terminé' || t.archive === true).length
    const tachesArchivees = filteredTaches.filter(t => t.archive === true).length
    const totalPassages = filteredEtablissements.reduce((sum, e) => sum + (e.nombre_passages_urgences_annuel || 0), 0)
    
    const totalValeur = filteredEtablissements.reduce((sum, etablissement) => {
      return sum + calculateEtablissementValue(etablissement)
    }, 0)

    const caRealise = filteredEtablissements
      .filter(e => e.statut === 'Production' || e.statut === 'Go-Live')
      .reduce((sum, e) => sum + calculateEtablissementValue(e), 0)

    const caPrevisionnel = totalValeur
    const tauxConversion = prospects > 0 ? Math.round((enProduction / (prospects + enProduction)) * 100) : 0
    const pipelineValue = filteredEtablissements
      .filter(e => !['Production', 'Go-Live'].includes(e.statut))
      .reduce((sum, e) => sum + calculateEtablissementValue(e), 0)

    const progressionMoyenne = totalEtablissements > 0 
      ? Math.round(filteredEtablissements.reduce((acc, e) => acc + (e.progression || 0), 0) / totalEtablissements)
      : 0

    // Calculs de part de marché
    const passagesProduction = filteredEtablissements
      .filter(e => e.statut === 'Production' || e.statut === 'Go-Live')
      .reduce((sum, e) => sum + (e.nombre_passages_urgences_annuel || 0), 0)

    const partMarcheActuelle = (passagesProduction / PASSAGES_NATIONAUX_ANNUEL) * 100
    const partMarchePotentielle = (totalPassages / PASSAGES_NATIONAUX_ANNUEL) * 100
    const passagesRestants = PASSAGES_NATIONAUX_ANNUEL - passagesProduction
    const potentielMarcheRestant = passagesRestants * 2.5

    return {
      totalEtablissements,
      prospects,
      enProduction,
      enDeploiement,
      totalTaches,
      tachesTerminees,
      tachesArchivees,
      progressionMoyenne,
      totalPassages,
      totalValeur,
      caRealise,
      caPrevisionnel,
      tauxConversion,
      pipelineValue,
      passagesProduction,
      partMarcheActuelle,
      partMarchePotentielle,
      passagesRestants,
      potentielMarcheRestant,
      passagesNationaux: PASSAGES_NATIONAUX_ANNUEL
    }
  }, [filteredEtablissements, allTaches])

  return {
    etablissements: filteredEtablissements,
    stats,
    profiles
  }
}
