import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseBrowser'
import { debug } from '@/lib/debug'

export interface TasksBreakdown {
  commercial: { total: number; completed: number }
  contractuel: { total: number; completed: number }
  conformite: { total: number; completed: number }
  deploiement: { total: number; completed: number }
  formation: { total: number; completed: number }
  golive: { total: number; completed: number }
  production: { total: number; completed: number }
}

export function useTasksBreakdown(etablissementId: string) {
  const query = useQuery({
    queryKey: ['tasks-breakdown', etablissementId],
    queryFn: async (): Promise<TasksBreakdown> => {
      if (!etablissementId) {
        throw new Error('Etablissement ID is required')
      }

      // Récupérer toutes les tâches avec leurs catégories (incluant les archivées)
      const { data: tasks, error } = await supabase
        .from('taches')
        .select(`
          id,
          statut,
          archive,
          categorie:categories_taches(nom)
        `)
        .eq('etablissement_id', etablissementId)

      if (error) throw error

      // Initialiser le breakdown
      const breakdown: TasksBreakdown = {
        commercial: { total: 0, completed: 0 },
        contractuel: { total: 0, completed: 0 },
        conformite: { total: 0, completed: 0 },
        deploiement: { total: 0, completed: 0 },
        formation: { total: 0, completed: 0 },
        golive: { total: 0, completed: 0 },
        production: { total: 0, completed: 0 }
      }

      // Mapper les noms de catégories vers les clés du breakdown
      const categoryMapping: Record<string, keyof TasksBreakdown> = {
        'Commercial': 'commercial',
        'Contractuel': 'contractuel',
        'Conformité': 'conformite',
        'Déploiement': 'deploiement',
        'Configuration': 'deploiement',
        'Documentation': 'deploiement',
        'Formation': 'formation',
        'Go-Live': 'golive',
        'Suivi Production': 'production',
        'Suivi': 'production',
        'Support': 'production'
      }

      // Compter les tâches par catégorie (inclure les archivées pour les stats)
      tasks?.forEach(task => {
        const categoryName = task.categorie?.nom
        if (categoryName && categoryMapping[categoryName]) {
          const key = categoryMapping[categoryName]
          breakdown[key].total++
          if (task.statut === 'Terminé') {
            breakdown[key].completed++
          }
        }
      })

      return breakdown
    },
    enabled: !!etablissementId,
  })

  // Abonnement aux mises à jour en temps réel
  useEffect(() => {
    if (!etablissementId) return

    const channel = supabase
      .channel(`tasks-breakdown-${etablissementId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'taches',
          filter: `etablissement_id=eq.${etablissementId}`
        },
        (payload) => {
          if (document.visibilityState !== 'visible') return;
          debug.log('Tâche modifiée, invalidation du breakdown:', payload)
          query.refetch()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'etablissements',
          filter: `id=eq.${etablissementId}`
        },
        (payload) => {
          if (document.visibilityState !== 'visible') return;
          debug.log('Établissement modifié, invalidation du breakdown:', payload)
          query.refetch()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [etablissementId, query])

  return query
}