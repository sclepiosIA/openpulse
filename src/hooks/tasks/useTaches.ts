/**
 * @fileoverview Hooks pour la gestion des tâches.
 * 
 * Ce module fournit des hooks React Query pour toutes les opérations CRUD
 * sur les tâches, avec support des mises à jour optimistes, de l'archivage
 * et de la duplication.
 * 
 * @module hooks/useTaches
 * @see {@link docs/CRM_TECH_GUIDE.md} pour la documentation technique
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { useToast } from '@/hooks/shared/use-toast'
import { CreateTacheData, UpdateTacheData, TacheData } from '@/lib/validations'
import { debug } from '@/lib/debug'
import { queryPresets } from '@/lib/queryPresets'

/**
 * Clés de cache centralisées pour les tâches.
 * Permet une gestion cohérente de l'invalidation du cache.
 * 
 * @example
 * ```typescript
 * // Invalider les tâches d'un établissement
 * queryClient.invalidateQueries({ 
 *   queryKey: tacheKeys.byEtablissement('etab-uuid') 
 * });
 * ```
 */
export const tacheKeys = {
  /** Clé racine pour toutes les tâches */
  all: ['taches'] as const,
  /** Clé pour les listes de tâches */
  lists: () => [...tacheKeys.all, 'list'] as const,
  /** Clé pour une liste filtrée */
  list: (filters: Record<string, unknown>) => [...tacheKeys.lists(), filters] as const,
  /** Clé pour les détails */
  details: () => [...tacheKeys.all, 'detail'] as const,
  /** Clé pour une tâche spécifique */
  detail: (id: string) => [...tacheKeys.details(), id] as const,
  /** Clé pour les tâches d'un établissement */
  byEtablissement: (etablissementId: string) => [...tacheKeys.all, 'etablissement', etablissementId] as const,
  /** Clé pour les statistiques */
  stats: () => [...tacheKeys.all, 'stats'] as const,
}

// Fonctions de fetching
const fetchTaches = async (): Promise<TacheData[]> => {
  const { data, error } = await supabase
    .from('taches')
    .select(`
      *,
      categories_taches (
        id,
        nom,
        couleur
      ),
      etablissements (
        id,
        nom
      ),
      responsable_profile:profiles!taches_responsable_id_fkey (
        id,
        prenom,
        nom,
        email,
        avatar_url
      )
    `)
    .eq('archive', false)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as TacheData[]
}

const fetchTachesByEtablissement = async (etablissementId: string): Promise<TacheData[]> => {
  const { data, error } = await supabase
    .from('taches')
    .select(`
      *,
      categories_taches (
        id,
        nom,
        couleur
      ),
      profiles!taches_responsable_id_fkey (
        user_id,
        prenom,
        nom,
        email
      )
    `)
    .eq('etablissement_id', etablissementId)
    .eq('archive', false)
    .order('ordre', { ascending: true })

  if (error) throw error
  return data as TacheData[]
}

const fetchTache = async (id: string): Promise<TacheData | null> => {
  const { data, error } = await supabase
    .from('taches')
    .select(`
      *,
      categories_taches (
        id,
        nom,
        couleur
      ),
      etablissements (
        id,
        nom
      ),
      profiles!taches_responsable_id_fkey (
        user_id,
        prenom,
        nom,
        email
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as TacheData | null
}

/**
 * Hook pour récupérer toutes les tâches actives (non archivées).
 * 
 * Retourne les tâches avec leurs relations (catégorie, établissement).
 * Utilise un cache de 2 minutes avec retry automatique.
 * 
 * @returns {UseQueryResult<TacheData[]>} Résultat de la query React Query
 * @property {TacheData[]} data - Liste des tâches
 * @property {boolean} isLoading - État de chargement
 * @property {Error | null} error - Erreur éventuelle
 * 
 * @example
 * ```tsx
 * function TaskList() {
 *   const { data: taches, isLoading } = useTaches();
 * 
 *   const aFaire = taches?.filter(t => t.statut === 'a_faire') || [];
 *   const enCours = taches?.filter(t => t.statut === 'en_cours') || [];
 * 
 *   return (
 *     <KanbanBoard aFaire={aFaire} enCours={enCours} />
 *   );
 * }
 * ```
 * 
 * @see {@link useTachesByEtablissement} pour les tâches d'un établissement
 * @see {@link useCreateTache} pour créer une tâche
 * @see {@link useUpdateTache} pour modifier une tâche
 */
export function useTaches() {
  const { toast } = useToast()

  return useQuery({
    queryKey: tacheKeys.lists(),
    queryFn: fetchTaches,
    ...queryPresets.standard, // Standardized 2 minutes staleTime
    retry: 3,
    meta: {
      onError: (error: Error) => {
        debug.error('Error loading taches:', error)
        toast({
          title: "Erreur",
          description: "Impossible de charger les tâches",
          variant: "destructive"
        })
      }
    }
  })
}

export interface DashboardTaskSummary {
  id: string
  titre: string
  statut?: string
  echeance?: string
  responsable_id?: string
  etablissement?: {
    nom: string
  }
}

const fetchDashboardTaskSummaries = async (): Promise<DashboardTaskSummary[]> => {
  // RPC Phase 3 : remplace la requête PostgREST nested (taches + etablissements)
  // par un plan SQL stable côté Postgres. RLS appliquée via SECURITY INVOKER.
  const { data, error } = await supabase.rpc('get_dashboard_task_summaries' as never)

  if (error) throw error

  type RpcRow = {
    id: string;
    titre: string;
    statut: string | null;
    echeance: string | null;
    responsable_id: string | null;
    etablissement_nom: string | null;
  };
  return ((data || []) as unknown as RpcRow[]).map((task) => ({
    id: task.id,
    titre: task.titre,
    statut: task.statut || undefined,
    echeance: task.echeance || undefined,
    responsable_id: task.responsable_id || undefined,
    etablissement: task.etablissement_nom ? { nom: task.etablissement_nom } : undefined,
  })) as DashboardTaskSummary[]
}

export function useDashboardTaskSummaries() {
  const { toast } = useToast()

  return useQuery({
    queryKey: [...tacheKeys.lists(), 'dashboard-summary'],
    queryFn: fetchDashboardTaskSummaries,
    ...queryPresets.standard,
    retry: 2,
    meta: {
      onError: (error: Error) => {
        debug.error('Error loading dashboard task summaries:', error)
        toast({
          title: "Erreur",
          description: "Impossible de charger le résumé des tâches",
          variant: "destructive"
        })
      }
    }
  })
}

// Hook pour les tâches d'un établissement
export function useTachesByEtablissement(etablissementId: string) {
  const { toast } = useToast()

  return useQuery({
    queryKey: tacheKeys.byEtablissement(etablissementId),
    queryFn: () => fetchTachesByEtablissement(etablissementId),
    enabled: !!etablissementId,
    ...queryPresets.standard, // Standardized 2 minutes staleTime
    retry: 3,
    meta: {
      onError: (error: Error) => {
        debug.error('Error loading taches for etablissement:', error)
        toast({
          title: "Erreur",
          description: "Impossible de charger les tâches de l'établissement",
          variant: "destructive"
        })
      }
    }
  })
}

// Hook pour une tâche spécifique
export function useTache(id: string) {
  const { toast } = useToast()

  return useQuery({
    queryKey: tacheKeys.detail(id),
    queryFn: () => fetchTache(id),
    enabled: !!id,
    ...queryPresets.standard, // Standardized 2 minutes staleTime
    retry: 3,
    meta: {
      onError: (error: Error) => {
        debug.error('Error loading tache:', error)
        toast({
          title: "Erreur",
          description: "Impossible de charger la tâche",
          variant: "destructive"
        })
      }
    }
  })
}

// Hook pour créer une tâche
export function useCreateTache() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (data: CreateTacheData) => {
      const { data: result, error } = await supabase
        .from('taches')
        .insert([data])
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return result as TacheData
    },
    onSuccess: (newTache) => {
      // Invalidation ciblée
      queryClient.invalidateQueries({ queryKey: tacheKeys.all })
      queryClient.invalidateQueries({ queryKey: tacheKeys.byEtablissement(newTache.etablissement_id) })
      
      toast({
        title: "Succès",
        description: "Tâche créée avec succès"
      })
    },
    onError: (error: Error) => {
      debug.error('Error creating tache:', error)
      toast({
        title: "Erreur",
        description: "Impossible de créer la tâche",
        variant: "destructive"
      })
    },
  })
}

// Mapping statut UI (taches) → statut client_portal_tasks
const PORTAL_STATUT_MAP: Record<string, 'todo' | 'in_progress' | 'done'> = {
  'A faire': 'todo',
  'En cours': 'in_progress',
  'Bloqué': 'in_progress',
  'Terminé': 'done',
}

// Hook pour mettre à jour une tâche (route automatiquement vers client_portal_tasks
// si l'id commence par "portal-")
export function useUpdateTache() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTacheData }) => {
      // 🔀 Routage tâches portail client (id synthétique "portal-<uuid>")
      if (typeof id === 'string' && id.startsWith('portal-')) {
        const rawId = id.replace(/^portal-/, '')
        const portalPatch: Record<string, unknown> = {}
        if (data.titre !== undefined) portalPatch.titre = data.titre
        if (data.description !== undefined) portalPatch.description = data.description
        if (data.echeance !== undefined) portalPatch.due_date = data.echeance || null
        if (data.statut !== undefined) {
          portalPatch.statut = PORTAL_STATUT_MAP[data.statut as string] ?? 'todo'
          if (portalPatch.statut === 'done') {
            portalPatch.done_at = new Date().toISOString()
          }
        }
        const { data: result, error } = await supabase
          .from('client_portal_tasks')
          .update(portalPatch as never)
          .eq('id', rawId)
          .select()
          // safe: guaranteed-row
          .single()
        if (error) throw error
        // Retourner un objet compatible TacheData (champs minimaux pour le cache)
        return {
          ...result,
          id, // garder l'id préfixé pour cohérence cache
          statut: data.statut ?? 'A faire',
          etablissement_id: result.etablissement_id,
        } as unknown as TacheData
      }

      const { data: result, error } = await supabase
        .from('taches')
        .update(data)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return result as TacheData
    },

    // OPTIMISTIC UPDATE - appliqué AVANT la mutation
    onMutate: async ({ id, data }) => {
      // Annuler les queries en cours pour éviter les conflits
      await queryClient.cancelQueries({ queryKey: tacheKeys.lists() })
      
      // Sauvegarder l'état précédent pour rollback
      const previousTaches = queryClient.getQueryData(tacheKeys.lists())
      
      // Appliquer l'update optimiste immédiatement
      queryClient.setQueryData(tacheKeys.lists(), (old: TacheData[] | undefined) => {
        if (!old) return old
        return old.map(t => t.id === id ? { ...t, ...data } : t)
      })
      
      return { previousTaches }
    },
    
    onError: (error: Error, variables, context) => {
      // Rollback en cas d'erreur
      if (context?.previousTaches) {
        queryClient.setQueryData(tacheKeys.lists(), context.previousTaches)
      }
      debug.error('Error updating tache:', error)
      toast({
        title: "Erreur",
        description: "Impossible de modifier la tâche",
        variant: "destructive"
      })
    },
    
    onSuccess: (updatedTache) => {
      // Mettre à jour le détail
      queryClient.setQueryData(tacheKeys.detail(updatedTache.id), updatedTache)
      
      // Invalider pour la prochaine fois (mais ne pas refetch immédiatement)
      queryClient.invalidateQueries({ 
        queryKey: tacheKeys.lists(),
        refetchType: 'none'
      })
      queryClient.invalidateQueries({ 
        queryKey: tacheKeys.byEtablissement(updatedTache.etablissement_id),
        refetchType: 'none'
      })
      // Tâches portail (vue /projets fusionnée)
      queryClient.invalidateQueries({ queryKey: ['all_portal_tasks_for_projets'] })
      queryClient.invalidateQueries({ queryKey: ['client_portal_tasks'] })
      // Mettre à jour les compteurs globaux (unified todos + badge)
      queryClient.invalidateQueries({ queryKey: ['unified-todos'] })
      queryClient.invalidateQueries({ queryKey: ['todos-unread-count'] })
      
      toast({
        title: "Succès",
        description: "Tâche mise à jour"
      })
    },
    
    // Toujours synchroniser avec le serveur après
    onSettled: () => {
      // Refetch après un délai pour s'assurer que le serveur a bien traité
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: tacheKeys.lists() })
      }, 500)
    }
  })
}

// Hook pour archiver une tâche (route portal- → suppression côté client_portal_tasks)
export function useArchiveTache() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      // Tâches portail : pas de colonne archive → supprimer
      if (typeof id === 'string' && id.startsWith('portal-')) {
        const rawId = id.replace(/^portal-/, '')
        const { error } = await supabase
          .from('client_portal_tasks')
          .delete()
          .eq('id', rawId)
        if (error) throw error
        return { id, archive, etablissement_id: null } as unknown as TacheData
      }

      const { data: result, error } = await supabase
        .from('taches')
        .update({ archive })
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return result as TacheData
    },
    onSuccess: (updatedTache, { archive }) => {
      queryClient.setQueryData(
        tacheKeys.detail(updatedTache.id),
        updatedTache
      )
      
      queryClient.invalidateQueries({ queryKey: tacheKeys.lists() })
      queryClient.invalidateQueries({ queryKey: tacheKeys.byEtablissement(updatedTache.etablissement_id) })
      queryClient.invalidateQueries({ queryKey: ['all_portal_tasks_for_projets'] })
      queryClient.invalidateQueries({ queryKey: ['client_portal_tasks'] })
      queryClient.invalidateQueries({ queryKey: ['unified-todos'] })
      queryClient.invalidateQueries({ queryKey: ['todos-unread-count'] })
      
      toast({
        title: "Succès",
        description: archive ? "Tâche archivée" : "Tâche désarchivée"
      })
    },
    onError: (error: Error) => {
      debug.error('Error archiving tache:', error)
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'archivage de la tâche",
        variant: "destructive"
      })
    },
  })
}

// Hook pour supprimer une tâche (route portal- → client_portal_tasks)
export function useDeleteTache() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      if (typeof id === 'string' && id.startsWith('portal-')) {
        const rawId = id.replace(/^portal-/, '')
        const { error } = await supabase
          .from('client_portal_tasks')
          .delete()
          .eq('id', rawId)
        if (error) throw error
        return id
      }

      const { error } = await supabase
        .from('taches')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: (deletedId) => {
      // Suppression du cache
      queryClient.removeQueries({ queryKey: tacheKeys.detail(deletedId) })
      
      // Invalidation des listes (taches + portail)
      queryClient.invalidateQueries({ queryKey: tacheKeys.all })
      queryClient.invalidateQueries({ queryKey: ['all_portal_tasks_for_projets'] })
      queryClient.invalidateQueries({ queryKey: ['client_portal_tasks'] })
      
      toast({
        title: "Succès",
        description: "Tâche supprimée avec succès"
      })
    },
    onError: (error: Error) => {
      debug.error('Error deleting tache:', error)
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la tâche",
        variant: "destructive"
      })
    },
  })
}

// Hook pour dupliquer une tâche
export function useDuplicateTache() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (tache: TacheData) => {
      // Exclure les champs qui ne doivent pas être copiés (y compris les relations jointes)
      // Exclure tous les champs qui ne doivent pas être copiés
      const { 
        id, 
        created_at, 
        updated_at, 
        date_realisation,     // On remet à null pour la copie
        completed_by,         // On remet à null pour la copie
        categories_taches,    // Relation jointe, pas une colonne
        etablissements,       // Relation jointe, pas une colonne
        profiles,             // Relation jointe, pas une colonne
        responsable_profile,  // Relation jointe, pas une colonne
        comments_count,       // Colonne calculée (n'existe pas en DB)
        date_fin_reelle,      // N'existe pas dans la table
        progression,          // N'existe pas dans la table
        date_echeance,        // Alias qui n'existe pas
        duree_estimee_jours,  // N'existe pas dans la table
        projet_id,            // N'existe pas dans la table
        tags,                 // N'existe pas dans la table
        ...rest 
      } = tache as Record<string, unknown> & { titre: string }
      
      const duplicatedData = {
        ...rest,
        titre: `${tache.titre} (copie)`,
        statut: 'A faire' as const,
      }
      
      const { data, error } = await supabase
        .from('taches')
        .insert(duplicatedData as never)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data as TacheData
    },
    onSuccess: (newTache) => {
      queryClient.invalidateQueries({ queryKey: tacheKeys.all })
      if (newTache.etablissement_id) {
        queryClient.invalidateQueries({ queryKey: tacheKeys.byEtablissement(newTache.etablissement_id) })
      }
      toast({
        title: "Succès",
        description: "Tâche dupliquée avec succès"
      })
    },
    onError: (error: Error) => {
      debug.error('Error duplicating tache:', error)
      toast({
        title: "Erreur",
        description: "Impossible de dupliquer la tâche",
        variant: "destructive"
      })
    },
  })
}

// Export types for compatibility
export type { TacheData as Tache, CreateTacheData, UpdateTacheData } from '@/lib/validations'
