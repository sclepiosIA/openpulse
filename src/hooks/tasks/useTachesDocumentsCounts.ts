import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { isOccurrenceId } from '@/lib/recurrenceUtils'

/**
 * Batch query pour récupérer le nombre de documents par tâche
 * Plus performant que N requêtes individuelles
 */
export function useTachesDocumentsCounts(taskIds: string[]) {
  // Filter out virtual occurrence IDs (they don't exist in taches_documents table)
  const realTaskIds = taskIds.filter(id => !isOccurrenceId(id))
  
  return useQuery({
    queryKey: ['taches-documents-counts', realTaskIds],
    queryFn: async () => {
      if (realTaskIds.length === 0) return {}
      
      // Diviser en chunks de 30 pour éviter les erreurs 400 (IDs avec suffixes _occ_YYYY-MM-DD)
      const CHUNK_SIZE = 30
      const counts: Record<string, number> = {}
      
      for (let i = 0; i < realTaskIds.length; i += CHUNK_SIZE) {
        const chunk = realTaskIds.slice(i, i + CHUNK_SIZE)
        
        const { data, error } = await supabase
          .from('taches_documents')
          .select('tache_id')
          .in('tache_id', chunk)
        
        if (error) throw error
        
        // Compter par tache_id
        data?.forEach(d => {
          counts[d.tache_id] = (counts[d.tache_id] || 0) + 1
        })
      }
      
      return counts
    },
    enabled: realTaskIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}
