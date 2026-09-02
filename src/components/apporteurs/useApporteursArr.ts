import { useMemo } from 'react'
import { useProspects } from '@/hooks/crm/useProspects'
import { calculateEtablissementValue } from '@/lib/valueCalculations'
import type { Apporteur } from './types'

/** Statuts considérés comme "client" pour le calcul de l'ARR. */
export const APPORTEUR_CLIENT_STATUTS = [
  'Vendu',
  'Production',
  'Go-Live',
  'Formation',
  'Déploiement',
] as const

/**
 * Calcule l'ARR d'un apporteur = somme des tarifs (calculateEtablissementValue)
 * des établissements liés à l'apporteur ET identifiés comme clients.
 *
 * Retourne aussi le total agrégé sur tous les apporteurs fournis.
 */
export function useApporteursArr(apporteurs: Apporteur[]) {
  const query = useProspects()

  const { arrByApporteurId, totalArr, clientsByApporteurId, totalClients, isReady } =
    useMemo(() => {
      const arrMap: Record<string, number> = {}
      const clientsMap: Record<string, number> = {}
      if (!query.data) {
        return {
          arrByApporteurId: arrMap,
          totalArr: 0,
          clientsByApporteurId: clientsMap,
          totalClients: 0,
          isReady: false,
        }
      }
      for (const a of apporteurs) {
        if (!a.partenaireId) {
          arrMap[a.id] = 0
          clientsMap[a.id] = 0
          continue
        }
        let arr = 0
        let clients = 0
        for (const p of query.data) {
          const ids = (p as unknown as { apporteurs_affaires_ids?: string[] | null })
            .apporteurs_affaires_ids
          if (!Array.isArray(ids) || !ids.includes(a.partenaireId!)) continue
          if (
            !APPORTEUR_CLIENT_STATUTS.includes(
              p.statut as (typeof APPORTEUR_CLIENT_STATUTS)[number]
            )
          )
            continue
          arr += calculateEtablissementValue(p as Parameters<typeof calculateEtablissementValue>[0])
          clients += 1
        }
        arrMap[a.id] = arr
        clientsMap[a.id] = clients
      }
      const totalArr = Object.values(arrMap).reduce((s, v) => s + v, 0)
      const totalClients = Object.values(clientsMap).reduce((s, v) => s + v, 0)
      return {
        arrByApporteurId: arrMap,
        totalArr,
        clientsByApporteurId: clientsMap,
        totalClients,
        isReady: true,
      }
    }, [query.data, apporteurs])

  return {
    arrByApporteurId,
    totalArr,
    clientsByApporteurId,
    totalClients,
    isLoading: query.isLoading,
    isReady,
  }
}
