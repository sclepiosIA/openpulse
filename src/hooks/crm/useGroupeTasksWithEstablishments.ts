import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { useTachesGroupe, TacheGroupe } from '@/hooks/tasks/useTachesGroupe'

export interface GroupeTask {
  id: string
  titre: string
  description: string | null
  statut: string
  priorite: string
  echeance: string | null
  created_at: string
  etablissement_id: string | null
  groupe_id: string | null
  niveau_tache: string
  source: 'groupe' | 'etablissement'
  etablissement_nom?: string
  categorie?: {
    nom: string
    couleur: string | null
  } | null
}

// Fetch all tasks for a groupe: direct groupe tasks + tasks from member establishments
export function useGroupeTasksWithEstablishments(groupeId?: string, options?: {
  includeEstablishmentTasks?: boolean
  status?: string
  hideCompleted?: boolean
}) {
  const { data: groupeTaches, isLoading: loadingGroupeTaches } = useTachesGroupe(groupeId)

  return useQuery({
    queryKey: ['groupe-tasks-with-establishments', groupeId, options],
    queryFn: async () => {
      if (!groupeId) return { groupeTasks: [], etablissementTasks: [], allTasks: [] }

      // Get all establishment IDs in this groupe
      const { data: groupeEtabs } = await supabase
        .from('etablissements_groupes')
        .select('etablissement_id, etablissement:etablissements(nom)')
        .eq('groupe_id', groupeId)
        .is('date_sortie', null)

      const etablissementIds = groupeEtabs?.map(eg => eg.etablissement_id) || []
      const etablissementNames = groupeEtabs?.reduce((acc, eg) => {
        const etab = eg.etablissement as { nom: string } | { nom: string }[] | null
        const nom = Array.isArray(etab) ? etab[0]?.nom : etab?.nom
        acc[eg.etablissement_id] = nom || 'Inconnu'
        return acc
      }, {} as Record<string, string>) || {}

      // Get establishment-level tasks
      let etablissementTasks: GroupeTask[] = []
      if (options?.includeEstablishmentTasks !== false && etablissementIds.length > 0) {
        let query = supabase
          .from('taches')
          .select(`
            id, titre, description, statut, priorite, echeance, created_at, etablissement_id,
            categorie:categories_taches(nom, couleur)
          `)
          .in('etablissement_id', etablissementIds)
          .eq('archive', false)
          .order('created_at', { ascending: false })

        if (options?.status) {
          query = query.eq('statut', options.status as never)
        }

        if (options?.hideCompleted) {
          query = query.neq('statut', 'Terminé')
        }

        const { data: etabTaches, error: etabError } = await query

        if (etabError) throw etabError

        etablissementTasks = (etabTaches || []).map(t => {
          const etabId = t.etablissement_id
          return {
            id: t.id,
            titre: t.titre,
            description: t.description || null,
            statut: t.statut,
            priorite: t.priorite,
            echeance: t.echeance || null,
            created_at: t.created_at,
            etablissement_id: etabId,
            groupe_id: null,
            niveau_tache: 'etablissement',
            source: 'etablissement' as const,
            etablissement_nom: etabId ? etablissementNames[etabId] : 'Inconnu',
            categorie: t.categorie as GroupeTask['categorie']
          }
        })
      }

      // Format groupe tasks from useTachesGroupe
      const groupeTasks: GroupeTask[] = (groupeTaches || []).map((t: TacheGroupe & { categorie?: GroupeTask['categorie'] }) => ({
        id: t.id,
        titre: t.titre,
        description: t.description || null,
        statut: t.statut,
        priorite: t.priorite,
        echeance: t.echeance || null,
        created_at: t.created_at,
        etablissement_id: null,
        groupe_id: t.groupe_id,
        niveau_tache: 'groupe',
        source: 'groupe' as const,
        categorie: t.categorie || null
      }))

      // Combine all tasks sorted by date
      const allTasks = [...groupeTasks, ...etablissementTasks].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      return {
        groupeTasks,
        etablissementTasks,
        allTasks
      }
    },
    enabled: !!groupeId && !loadingGroupeTaches,
    // Uses global staleTime from QueryClient (2 min)
  })
}

// Statistics for groupe tasks
export function useGroupeTaskStats(groupeId?: string) {
  const { data, isLoading } = useGroupeTasksWithEstablishments(groupeId)

  const stats = {
    groupeTotal: data?.groupeTasks.length || 0,
    groupeCompleted: data?.groupeTasks.filter(t => t.statut === 'Terminé').length || 0,
    etablissementTotal: data?.etablissementTasks.length || 0,
    etablissementCompleted: data?.etablissementTasks.filter(t => t.statut === 'Terminé').length || 0,
    total: data?.allTasks.length || 0,
    completed: data?.allTasks.filter(t => t.statut === 'Terminé').length || 0,
    inProgress: data?.allTasks.filter(t => t.statut === 'En cours').length || 0,
    todo: data?.allTasks.filter(t => t.statut === 'À faire' || t.statut === 'A faire').length || 0
  }

  return { stats, isLoading }
}
