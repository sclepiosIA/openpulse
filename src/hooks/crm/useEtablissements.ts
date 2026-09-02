import { sanitizePostgrestValue } from '@/lib/sanitize'
import { fetchInChunks } from '@/lib/supabaseChunk'
/**
 * @fileoverview Hooks pour la gestion des établissements de santé.
 *
 * Ce module fournit des hooks React Query pour toutes les opérations CRUD
 * sur les établissements, avec support de la pagination infinie, du cache
 * optimisé et des mises à jour optimistes.
 *
 * @module hooks/useEtablissements
 * @see {@link docs/CRM_TECH_GUIDE.md} pour la documentation technique complète
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  keepPreviousData,
} from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { useToast } from '@/hooks/shared/use-toast'
import {
  CreateEtablissementData,
  UpdateEtablissementData,
  EtablissementData,
} from '@/lib/validations'
export type { EtablissementData }

import { removeUndefinedFields } from '@/lib/utils/objectHelpers'
import { queryPresets } from '@/lib/queryPresets'
import { debug } from '@/lib/debug'

/**
 * Nettoie les données d'établissement avant envoi à Supabase.
 * Transforme les chaînes vides, "none", "unassigned" et valeurs nulles en undefined
 * pour éviter les erreurs de contrainte de base de données.
 *
 * @template T - Type des données d'entrée (doit être un objet)
 * @param {T} data - Données brutes de l'établissement
 * @returns {Partial<T>} Données nettoyées sans les valeurs indésirables
 *
 * @example
 * ```typescript
 * const cleanedData = cleanEtablissementData({
 *   nom: 'CHU Paris',
 *   commercial_id: 'none', // Sera transformé en undefined
 *   date_signature: '',    // Sera transformé en undefined
 * });
 * ```
 */
function cleanEtablissementData<T extends Record<string, unknown>>(data: T): Partial<T> {
  const cleaned = {
    ...data,
    // UUIDs : "" ou "none" ou "unassigned" → undefined
    commercial_id:
      !data.commercial_id || data.commercial_id === 'none' || data.commercial_id === 'unassigned'
        ? undefined
        : data.commercial_id,
    chef_projet_id:
      !data.chef_projet_id || data.chef_projet_id === 'none' || data.chef_projet_id === 'unassigned'
        ? undefined
        : data.chef_projet_id,
    csm_id:
      !data.csm_id || data.csm_id === 'none' || data.csm_id === 'unassigned'
        ? undefined
        : data.csm_id,

    // Dates : "" → undefined
    date_signature: data.date_signature === '' ? undefined : data.date_signature,
    date_fin_contrat: data.date_fin_contrat === '' ? undefined : data.date_fin_contrat,
    date_previsionnelle_signature:
      data.date_previsionnelle_signature === '' ? undefined : data.date_previsionnelle_signature,
    date_go_live: data.date_go_live === '' ? undefined : data.date_go_live,

    // Champs optionnels : "" → undefined
    adresse: data.adresse === '' ? undefined : data.adresse,
    code_postal: data.code_postal === '' ? undefined : data.code_postal,
    telephone: data.telephone === '' ? undefined : data.telephone,
    email: data.email === '' ? undefined : data.email,
    type_offre: data.type_offre === '' ? undefined : data.type_offre,
    notes: data.notes === '' ? undefined : data.notes,

    // DPI et numériques
    dpi: !data.dpi ? undefined : data.dpi,
    nombre_passages_urgences_annuel:
      data.nombre_passages_urgences_annuel === null
        ? undefined
        : data.nombre_passages_urgences_annuel,
  }

  return removeUndefinedFields(cleaned) as Partial<T>
}

/**
 * Clés de cache centralisées pour React Query.
 * Permet une gestion cohérente de l'invalidation du cache.
 *
 * @example
 * ```typescript
 * // Invalider toutes les listes
 * queryClient.invalidateQueries({ queryKey: etablissementKeys.lists() });
 *
 * // Invalider un établissement spécifique
 * queryClient.invalidateQueries({ queryKey: etablissementKeys.detail('uuid') });
 * ```
 */
export const etablissementKeys = {
  /** Clé racine pour tous les établissements */
  all: ['etablissements'] as const,
  /** Clé pour les listes d'établissements */
  lists: () => [...etablissementKeys.all, 'list'] as const,
  /** Clé pour une liste filtrée */
  list: (filters: Record<string, unknown>) => [...etablissementKeys.lists(), filters] as const,
  /** Clé pour les détails */
  details: () => [...etablissementKeys.all, 'detail'] as const,
  /** Clé pour un établissement spécifique */
  detail: (id: string) => [...etablissementKeys.details(), id] as const,
  /** Clé pour les statistiques */
  stats: () => [...etablissementKeys.all, 'stats'] as const,
  /** Clé pour la pagination infinie */
  infinite: (searchTerm: string, showOnlyMine: boolean, userProfileId?: string) =>
    [...etablissementKeys.lists(), 'infinite', searchTerm, showOnlyMine, userProfileId] as const,
}

/**
 * Type étendu d'établissement incluant le logo du groupe parent.
 * Utilisé pour l'affichage dans les listes avec avatar de groupe.
 */
export interface EtablissementWithGroupLogo extends EtablissementData {
  /** URL du logo du groupe parent (si l'établissement appartient à un groupe) */
  groupe_logo_url?: string | null
  /** Valeur potentielle du prospect (calculée en runtime) */
  valeur_potentielle?: number | null
  /** Score comportemental (table prospects_scores) */
  behavioral_score?: number | null
  /** Score de conversion calculé */
  score_conversion?: number | null
  /** Facteurs de score (debug) */
  score_conversion_factors?: Array<{ label: string; points: number; detail: string }> | null
  /** Vélocité d'engagement */
  engagement_velocity?: number | null
  /** Statut d'enrichissement (job batch) */
  enrichment_status?: string | null
  /** Date de dernier enrichissement */
  enrichment_at?: string | null
}

// Fonctions de fetching centralisées
const ETABLISSEMENT_SELECT =
  'id, nom, ville, region, pays, statut, type, progression, commercial_id, chef_projet_id, csm_id, dpi, nombre_passages_urgences_annuel, pallier_vise, pallier_realise, modele_statique_succes, type_offre, tarifs_palliers, date_signature, date_fin_contrat, date_previsionnelle_signature, date_go_live, date_prise_contact, adresse, adresse_facturation, code_postal, telephone, email, email_facturation, email_domains, notes, slug, logo_url, seuils_palliers, modele_detaille, vecteur_achat, engagement_score, relationship_status, contexte_csm, besoins_du_compte, derniers_echanges_resume, derniers_echanges_updated_at, point_hebdo, prochaine_action_csm, date_action_csm, prochaine_action_orga, date_action_orga, derniere_venue_site, modules_proposes, modules_actifs, apporteurs_affaires_ids, client_facturation, siret_facturation, siren_client, conditions_paiement_defaut, mode_paiement_prefere, periodicite_paiement, paiement_initial, date_premier_paiement, directeur_general_nom, directeur_general_prenom, directeur_general_email, stats_urgences_url, stats_utilisation_url, latitude, longitude, last_email_sent_at, last_email_received_at, qr_access_token, qr_access_expires_at, created_at, updated_at, updated_by' as const

const ETABLISSEMENT_HARD_LIMIT = 5000
const fetchEtablissements = async (): Promise<EtablissementWithGroupLogo[]> => {
  const {
    data: etablissements,
    error: etabError,
    count,
  } = await supabase
    .from('etablissements')
    .select(ETABLISSEMENT_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(ETABLISSEMENT_HARD_LIMIT)

  if (etabError) throw etabError
  if (!etablissements) return []
  // Audit perf §9 P3 — alerte si troncature silencieuse (count exact vs limit).
  if (typeof count === 'number' && count > ETABLISSEMENT_HARD_LIMIT) {
    console.warn(
      `[useEtablissements] Truncation: ${count} rows in DB, only ${ETABLISSEMENT_HARD_LIMIT} loaded.`
    )
  }

  // Récupérer les liens établissements -> groupes.
  // Découpage obligatoire : la base compte 252 établissements, et au-delà de
  // ~200 ids l'URL PostgREST dépasse 8 Ko. Le backend répondait alors 414 sans
  // en-têtes CORS, ce qui remontait en `TypeError: Failed to fetch` : les logos
  // de groupe ne se chargeaient jamais en production (cf. `fetchInChunks`).
  const etabIds = etablissements.map((e) => e.id)
  const links = await fetchInChunks(etabIds, (chunk) =>
    supabase
      .from('etablissements_groupes')
      .select('etablissement_id, groupe_id')
      .in('etablissement_id', chunk)
  )

  // Récupérer les logos des groupes
  const groupeIds = [...new Set(links.map((l) => l.groupe_id))]
  const groupes = await fetchInChunks(groupeIds, (chunk) =>
    supabase.from('groupes_etablissements').select('id, logo_url').in('id', chunk)
  )

  // Créer un map etablissement_id -> groupe_logo_url
  const groupeLogoMap = new Map<string, string | null>()
  for (const link of links) {
    const groupe = groupes.find((g) => g.id === link.groupe_id)
    if (groupe?.logo_url) {
      groupeLogoMap.set(link.etablissement_id, groupe.logo_url)
    }
  }

  // Enrichir les établissements avec le logo du groupe
  return etablissements.map((etab) => ({
    ...etab,
    groupe_logo_url: groupeLogoMap.get(etab.id) || null,
  })) as EtablissementWithGroupLogo[]
}

const fetchEtablissement = async (id: string): Promise<EtablissementData | null> => {
  const { data, error } = await supabase
    .from('etablissements')
    .select(ETABLISSEMENT_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as EtablissementData | null
}

const fetchEtablissementStats = async () => {
  // RPC server-side: GROUP BY statut/type + AVG progression (évite fetch 5000 lignes)
  const { data, error } = await (supabase as any).rpc('get_etablissement_stats')
  if (error) throw error

  const json = (data || {}) as {
    total?: number
    byStatus?: Record<string, number>
    byType?: Record<string, number>
    avgProgression?: number
  }

  return {
    total: json.total || 0,
    byStatus: json.byStatus || {},
    byType: json.byType || {},
    avgProgression: json.avgProgression || 0,
  }
}

/**
 * Hook principal pour récupérer la liste de tous les établissements.
 *
 * Récupère tous les établissements avec leurs logos de groupe associés.
 * Utilise un cache de 2 minutes (queryPresets.standard) avec retry automatique.
 *
 * @returns {UseQueryResult<EtablissementWithGroupLogo[]>} Résultat de la query React Query
 * @property {EtablissementWithGroupLogo[]} data - Liste des établissements
 * @property {boolean} isLoading - État de chargement initial
 * @property {boolean} isFetching - État de récupération (incluant les refetch)
 * @property {Error | null} error - Erreur éventuelle
 * @property {function} refetch - Fonction pour forcer le rechargement
 *
 * @example
 * ```tsx
 * function EtablissementsList() {
 *   const { data: etablissements, isLoading, error } = useEtablissements();
 *
 *   if (isLoading) return <Skeleton />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <ul>
 *       {etablissements?.map(etab => (
 *         <li key={etab.id}>{etab.nom}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 *
 * @see {@link useEtablissementsInfinite} pour la pagination infinie
 * @see {@link useEtablissement} pour un établissement spécifique
 */
export function useEtablissements() {
  const { toast } = useToast()

  return useQuery({
    queryKey: etablissementKeys.lists(),
    queryFn: fetchEtablissements,
    placeholderData: keepPreviousData,
    ...queryPresets.standard, // Standardized 2 minutes staleTime
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    meta: {
      onError: (error: Error) => {
        debug.error('Error loading etablissements:', error)
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les établissements',
          variant: 'destructive',
        })
      },
    },
  })
}

// Hook pour la pagination infinie avec optimisations
export function useEtablissementsInfinite(
  searchTerm: string = '',
  showOnlyMine: boolean = false,
  userProfile: { id: string; role: string } | null = null
) {
  const { toast } = useToast()
  const ITEMS_PER_PAGE = 20

  return useInfiniteQuery({
    queryKey: etablissementKeys.infinite(searchTerm, showOnlyMine, userProfile?.id),
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1

      let query = supabase
        .from('etablissements')
        .select(ETABLISSEMENT_SELECT, { count: 'exact' })
        .neq('statut', 'Prospect')
        .order('created_at', { ascending: false })
        .range(from, to)

      // Filtrage par utilisateur
      if (showOnlyMine && userProfile) {
        switch (userProfile.role) {
          case 'commercial':
            query = query.eq('commercial_id', userProfile.id)
            break
          case 'chef_projet':
            query = query.eq('chef_projet_id', userProfile.id)
            break
          case 'csm':
            query = query.eq('csm_id', userProfile.id)
            break
        }
      }

      // Recherche textuelle - inclure aussi le champ 'type' côté serveur
      if (searchTerm) {
        query = query.or(
          `nom.ilike.%${sanitizePostgrestValue(searchTerm)}%,ville.ilike.%${sanitizePostgrestValue(searchTerm)}%,region.ilike.%${sanitizePostgrestValue(searchTerm)}%,type.ilike.%${sanitizePostgrestValue(searchTerm)}%`
        )
      }

      const { data, error, count } = await query

      if (error) {
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les établissements',
          variant: 'destructive',
        })
        throw error
      }

      // Retourner directement les données sans filtrage client-side redondant
      return {
        data: data as EtablissementData[],
        nextPage: data.length === ITEMS_PER_PAGE ? pageParam + 1 : undefined,
        totalCount: count || 0,
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 2 * 60 * 1000, // 2 minutes pour les listes infinies
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Hook pour un établissement spécifique
export function useEtablissement(id: string) {
  const { toast } = useToast()

  return useQuery({
    queryKey: etablissementKeys.detail(id),
    queryFn: () => fetchEtablissement(id),
    enabled: !!id,
    ...queryPresets.standard, // Standardized 2 minutes staleTime
    retry: 3,
    meta: {
      onError: (error: Error) => {
        debug.error('Error loading etablissement:', error)
        toast({
          title: 'Erreur',
          description: "Impossible de charger l'établissement",
          variant: 'destructive',
        })
      },
    },
  })
}

// Hook pour les statistiques
export function useEtablissementStats() {
  const { toast } = useToast()

  return useQuery({
    queryKey: etablissementKeys.stats(),
    queryFn: fetchEtablissementStats,
    staleTime: 10 * 60 * 1000, // 10 minutes pour les stats
    gcTime: 15 * 60 * 1000,
    retry: 2,
    meta: {
      onError: (error: Error) => {
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les statistiques',
          variant: 'destructive',
        })
      },
    },
  })
}

// Hook pour créer un établissement
export function useCreateEtablissement() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (data: CreateEtablissementData) => {
      // Nettoyage centralisé des données avant envoi
      const cleanedData = cleanEtablissementData(data)

      const { data: result, error } = await supabase
        .from('etablissements')
        .insert([cleanedData as never]) // Le slug sera généré par le trigger
        .select()
        .single()

      if (error) throw error
      return result as EtablissementData
    },
    onSuccess: (newEtablissement) => {
      // Invalidation ciblée et efficace
      queryClient.invalidateQueries({ queryKey: etablissementKeys.all })

      // Mise à jour optimiste des listes
      queryClient.setQueryData<EtablissementData[]>(etablissementKeys.lists(), (oldData) =>
        oldData ? [newEtablissement, ...oldData] : [newEtablissement]
      )

      toast({
        title: 'Succès',
        description: 'Établissement créé avec succès',
      })
    },
    onError: (error: Error) => {
      debug.error('Error creating etablissement:', error)
      toast({
        title: 'Erreur',
        description: "Impossible de créer l'établissement",
        variant: 'destructive',
      })
    },
  })
}

// Hook pour mettre à jour un établissement
export function useUpdateEtablissement() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateEtablissementData }) => {
      // Nettoyage centralisé des données avant envoi
      const cleanedData = cleanEtablissementData(data)

      const { data: result, error } = await supabase
        .from('etablissements')
        .update(cleanedData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return result as EtablissementData
    },
    onSuccess: (updatedEtablissement) => {
      // Mise à jour optimiste du cache
      queryClient.setQueryData(
        etablissementKeys.detail(updatedEtablissement.id),
        updatedEtablissement
      )

      // Mise à jour des listes
      queryClient.setQueryData<EtablissementData[]>(etablissementKeys.lists(), (oldData) =>
        oldData?.map((item) => (item.id === updatedEtablissement.id ? updatedEtablissement : item))
      )

      // Invalidation sélective
      queryClient.invalidateQueries({ queryKey: etablissementKeys.stats() })

      toast({
        title: 'Succès',
        description: 'Établissement mis à jour',
      })
    },
    onError: (error: Error) => {
      debug.error('Error updating etablissement:', error)
      toast({
        title: 'Erreur',
        description: "Impossible de modifier l'établissement",
        variant: 'destructive',
      })
    },
  })
}

// Hook pour supprimer un établissement
export function useDeleteEtablissement() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('etablissements').delete().eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: (deletedId) => {
      // Suppression optimiste du cache
      queryClient.setQueryData<EtablissementData[]>(etablissementKeys.lists(), (oldData) =>
        oldData?.filter((item) => item.id !== deletedId)
      )

      // Suppression du détail
      queryClient.removeQueries({ queryKey: etablissementKeys.detail(deletedId) })

      // Invalidation des stats
      queryClient.invalidateQueries({ queryKey: etablissementKeys.stats() })

      toast({
        title: 'Succès',
        description: 'Établissement supprimé avec succès',
      })
    },
    onError: (error: Error) => {
      debug.error('Error deleting etablissement:', error)
      toast({
        title: 'Erreur',
        description: "Impossible de supprimer l'établissement",
        variant: 'destructive',
      })
    },
  })
}

// Export types for compatibility
export type {
  EtablissementData as Etablissement,
  CreateEtablissementData,
  UpdateEtablissementData,
} from '@/lib/validations'
