import { useMemo } from 'react'
import { useProspects } from '@/hooks/crm/useProspects'

/**
 * Retourne la liste des établissements (phase commerciale) ciblés par un
 * apporteur d'affaires donné, via son `partenaireId`.
 */
export function useApporteurProspects(partenaireId?: string) {
  const query = useProspects()
  const prospects = useMemo(() => {
    if (!query.data || !partenaireId) return []
    return query.data.filter((p) => {
      const ids = (p as unknown as { apporteurs_affaires_ids?: string[] | null })
        .apporteurs_affaires_ids
      return Array.isArray(ids) && ids.includes(partenaireId)
    })
  }, [query.data, partenaireId])

  return { ...query, prospects }
}
