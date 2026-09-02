import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/components/AuthProvider'
import { debug } from '@/lib/debug'

export interface ObjectifCA {
  id: string
  user_id: string
  annee: number
  trimestre?: number
  mois?: number
  cible_ca: number
  realise_ca: number
  commentaire?: string
  created_by?: string
  created_at: string
  updated_at: string
  profiles?: {
    prenom: string
    nom: string
  }
}

export interface ObjectifCASummary {
  cible: number
  realise: number
  progression: number
  resteAFaire: number
}

export function useObjectifsCA(annee?: number, userId?: string) {
  const currentYear = annee || new Date().getFullYear()

  return useQuery({
    queryKey: ['objectifs-ca', currentYear, userId],
    queryFn: async () => {
      let query = supabase
        .from('objectifs_commerciaux')
        .select(
          'id, user_id, annee, trimestre, mois, cible_ca, realise_ca, commentaire, created_by, created_at, updated_at'
        )
        .eq('annee', currentYear)
        .order('trimestre', { ascending: true })
        .order('mois', { ascending: true })
        .limit(200)

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as ObjectifCA[]
    },
  })
}

/**
 * Hook pour récupérer le résumé des objectifs CA de l'année en cours
 * Calcule automatiquement le CA réalisé depuis les établissements en Production
 */
export function useObjectifCASummary(userId?: string) {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()
  const targetUserId = userId || user?.id

  return useQuery({
    queryKey: ['objectif-ca-summary', currentYear, targetUserId],
    queryFn: async (): Promise<ObjectifCASummary> => {
      // 1. Récupérer l'objectif annuel défini
      const { data: objectifs } = await supabase
        .from('objectifs_commerciaux')
        .select('cible_ca, realise_ca')
        .eq('annee', currentYear)
        .is('trimestre', null) // Objectif annuel global
        .is('mois', null)

      // Si pas d'objectif défini, essayer avec les objectifs trimestriels
      let cibleTotale = 0
      let realiseManuel = 0

      if (objectifs && objectifs.length > 0) {
        cibleTotale = objectifs.reduce((sum, o) => sum + Number(o.cible_ca || 0), 0)
        realiseManuel = objectifs.reduce((sum, o) => sum + Number(o.realise_ca || 0), 0)
      } else {
        // Fallback: sommer les objectifs trimestriels
        const { data: trimestriels } = await supabase
          .from('objectifs_commerciaux')
          .select('cible_ca, realise_ca')
          .eq('annee', currentYear)
          .not('trimestre', 'is', null)
          .limit(20)

        if (trimestriels && trimestriels.length > 0) {
          cibleTotale = trimestriels.reduce((sum, o) => sum + Number(o.cible_ca || 0), 0)
          realiseManuel = trimestriels.reduce((sum, o) => sum + Number(o.realise_ca || 0), 0)
        }
      }

      // 2. Calculer le CA réalisé depuis les établissements signés cette année et en Production
      const startOfYear = `${currentYear}-01-01`
      const { data: etablissements } = await supabase
        .from('etablissements')
        .select(
          'modele_statique_succes, tarifs_palliers, pallier_vise, type_offre, nombre_passages_urgences_annuel, date_signature'
        )
        .eq('statut', 'Production')
        .gte('date_signature', startOfYear)
        .limit(500)

      const caFromProduction =
        etablissements?.reduce((sum, e) => {
          // Calculer la valeur selon la logique de priorité unifiée
          let value = 0

          // Cast tarifs_palliers en Record si c'est un objet
          const tarifs =
            typeof e.tarifs_palliers === 'object' && e.tarifs_palliers !== null
              ? (e.tarifs_palliers as Record<string, number>)
              : null

          // Priorité 1: Palliers "Au succès"
          if (e.type_offre === 'Au succès' && e.pallier_vise && tarifs) {
            const palNum = String(e.pallier_vise).toLowerCase().match(/\d+/)?.[0]
            if (palNum) {
              const candidates = [
                `palier${palNum}`,
                `pallier${palNum}`,
                `palier_${palNum}`,
                `pallier_${palNum}`,
              ]
              const foundKey = Object.keys(tarifs).find((k) => candidates.includes(k.toLowerCase()))
              if (foundKey && tarifs[foundKey]) {
                value = Number(tarifs[foundKey]) || 0
              }
            }
          }

          // Priorité 2: Modèle statique numérique
          if (
            value === 0 &&
            e.modele_statique_succes &&
            /^[0-9]+\.?[0-9]*$/.test(String(e.modele_statique_succes))
          ) {
            value = Number(e.modele_statique_succes) || 0
          }

          // Priorité 3: Estimation 2€/passage
          if (value === 0 && e.nombre_passages_urgences_annuel) {
            value = Number(e.nombre_passages_urgences_annuel) * 2
          }

          return sum + value
        }, 0) || 0

      // Prendre le max entre réalisé manuel et calculé depuis Production
      const realise = Math.max(realiseManuel, caFromProduction)

      // Si pas de cible définie, mettre une valeur par défaut
      const cible = cibleTotale > 0 ? cibleTotale : 500000
      const progression = cible > 0 ? Math.round((realise / cible) * 100) : 0
      const resteAFaire = Math.max(0, cible - realise)

      return {
        cible,
        realise,
        progression: Math.min(progression, 100), // Capper à 100%
        resteAFaire,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateObjectifCA() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      objectif: Omit<ObjectifCA, 'id' | 'created_at' | 'updated_at' | 'profiles'>
    ) => {
      const { data, error } = await supabase
        .from('objectifs_commerciaux')
        .insert(objectif)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectifs-ca'] })
      queryClient.invalidateQueries({ queryKey: ['objectif-ca-summary'] })
      toast.success('Objectif CA créé avec succès')
    },
    onError: (error) => {
      toast.error("Erreur lors de la création de l'objectif")
      debug.error(error)
    },
  })
}

export function useUpdateObjectifCA() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...objectif }: Partial<ObjectifCA> & { id: string }) => {
      const { data, error } = await supabase
        .from('objectifs_commerciaux')
        .update(objectif as never)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectifs-ca'] })
      queryClient.invalidateQueries({ queryKey: ['objectif-ca-summary'] })
      toast.success('Objectif CA mis à jour')
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour')
      debug.error(error)
    },
  })
}
