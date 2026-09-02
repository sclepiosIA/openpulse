import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { useToast } from '@/hooks/shared/use-toast'
import { type Etablissement, type EtablissementWithGroupLogo } from '@/hooks/crm/useEtablissements'
import { useAuth } from '@/components/AuthProvider'
import type { Database } from '@/integrations/supabase/types'
import { calculateEtablissementValue } from '@/lib/valueCalculations'
import { queryPresets } from '@/lib/queryPresets'
import { fetchInChunks } from '@/lib/supabaseChunk'

type StatutEtablissement = Database['public']['Enums']['statut_etablissement']

// Fonction utilitaire pour enrichir les établissements avec les logos de groupe
async function enrichWithGroupLogos(
  etablissements: Etablissement[]
): Promise<EtablissementWithGroupLogo[]> {
  if (!etablissements.length) return []

  const etabIds = etablissements.map((e) => e.id)

  // Récupérer les liens établissements -> groupes.
  // Découpage obligatoire : au-delà de ~200 ids, l'URL PostgREST dépasse 8 Ko
  // et le backend répond 414 sans en-têtes CORS (cf. `fetchInChunks`).
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

  // Enrichir les établissements
  return etablissements.map((etab) => ({
    ...etab,
    groupe_logo_url: groupeLogoMap.get(etab.id) || null,
  })) as EtablissementWithGroupLogo[]
}

// Hook pour récupérer les établissements commerciaux (avant déploiement/production)
export function useProspects() {
  const { toast } = useToast()
  const { loading, user } = useAuth()

  return useQuery({
    queryKey: ['prospects'],
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    retry: 2,
    queryFn: async () => {
      // Récupérer les établissements en phase commerciale (EXCLUS Bloqué pour le pipeline actif)
      const { data, error } = await supabase
        .from('etablissements')
        .select(
          `
          id, nom, ville, region, type, statut, progression,
          date_signature, date_previsionnelle_signature,
          commercial_id, csm_id, chef_projet_id,
          pallier_vise, pallier_realise, modele_statique_succes,
          nombre_passages_urgences_annuel, type_offre, tarifs_palliers,
          adresse, code_postal, telephone, email, dpi, notes, logo_url,
          derniers_echanges_resume, derniers_echanges_updated_at,
          last_email_received_at, last_email_sent_at,
          prochaine_action_orga, date_action_orga,
          apporteurs_affaires_ids,
          modules_proposes,
          created_at, updated_at
        `
        )
        .in('statut', [
          'Prospect',
          'Contacté',
          'Attente RDV',
          'RDV pris',
          'Attente post RDV',
          'Dans les RDV',
          'Etude émise',
          'Dans les RDV post EME',
          'Négociation',
          'Contractualisation',
          'Contractuel',
          'Conformité',
          'Déploiement',
          'Formation',
          'Go-Live',
          'Production',
          'Vendu',
          'Reporté',
          'Refus',
          'Autre compte / GHT',
        ])
        .order('created_at', { ascending: false })

      if (error) {
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les établissements commerciaux',
          variant: 'destructive',
        })
        throw error
      }

      return data as unknown as Etablissement[]
    },
    enabled: !loading && !!user, // Only run when authenticated
  })
}

// Hook pour récupérer les statistiques du pipeline commercial
export function useProspectStats() {
  const { toast } = useToast()
  const { loading, user } = useAuth()

  return useQuery({
    queryKey: ['prospect-stats'],
    queryFn: async () => {
      // Récupérer les établissements en phase commerciale (EXCLUS Bloqué du pipeline actif)
      const { data, error } = await supabase
        .from('etablissements')
        .select(
          `
          id,
          nom,
          statut,
          commercial_id,
          created_at,
          pallier_vise,
          pallier_realise,
          modele_statique_succes,
          nombre_passages_urgences_annuel,
          type_offre,
          tarifs_palliers,
          taches:taches(
            id,
            statut,
            categorie:categories_taches(nom)
          )
        `
        )
        .in('statut', [
          'Prospect',
          'Contacté',
          'Attente RDV',
          'RDV pris',
          'Attente post RDV',
          'Dans les RDV',
          'Etude émise',
          'Dans les RDV post EME',
          'Négociation',
          'Contractualisation',
          'Contractuel',
          'Conformité',
          'Déploiement',
          'Formation',
          'Go-Live',
          'Production',
          'Vendu',
          'Reporté',
          'Refus',
          'Autre compte / GHT',
        ])

      if (error) {
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les statistiques commerciales',
          variant: 'destructive',
        })
        throw error
      }

      // Calculer les statistiques
      const stats = {
        totalProspects: data.length,
        prospectsByCommercial: data.reduce((acc: Record<string, number>, etablissement) => {
          const commercialId = etablissement.commercial_id || 'Non assigné'
          acc[commercialId] = (acc[commercialId] || 0) + 1
          return acc
        }, {}),
        prospectsPipelineProgress: data.map((etablissement) => {
          const commercialTasks = etablissement.taches.filter(
            (tache) => tache.categorie?.nom === 'Commercial'
          )
          const completedTasks = commercialTasks.filter((tache) => tache.statut === 'Terminé')
          const progress =
            commercialTasks.length > 0 ? (completedTasks.length / commercialTasks.length) * 100 : 0

          // Calcul du CA potentiel selon la logique unifiée
          const potentialValue = calculateEtablissementValue(etablissement)

          return {
            id: etablissement.id,
            nom: etablissement.nom,
            progress,
            totalTasks: commercialTasks.length,
            completedTasks: completedTasks.length,
            potentialValue,
          }
        }),
      }

      return stats
    },
    enabled: !loading && !!user, // Only run when authenticated
  })
}

// Hook pour récupérer TOUS les établissements pour les statistiques globales
export function useAllEtablissements() {
  const { toast } = useToast()
  const { loading, user } = useAuth()

  return useQuery({
    queryKey: ['all-etablissements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etablissements')
        .select(
          `
          id, nom, ville, region, type, statut, dpi, progression,
          date_signature, date_previsionnelle_signature,
          commercial_id, csm_id, chef_projet_id,
          pallier_vise, pallier_realise, modele_statique_succes,
          nombre_passages_urgences_annuel, type_offre, tarifs_palliers,
          created_at, updated_at
        `
        )
        .order('created_at', { ascending: false })

      if (error) {
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les établissements',
          variant: 'destructive',
        })
        throw error
      }

      return enrichWithGroupLogos(data as Etablissement[])
    },
    enabled: !loading && !!user,
    ...queryPresets.standard, // 2 minutes staleTime - shared across dashboards
  })
}

export interface CsmDashboardEtablissement {
  id: string
  nom: string
  ville: string | null
  statut: StatutEtablissement
  date_fin_contrat: string | null
}

// Hook léger pour le dashboard CSM : uniquement les champs nécessaires au premier écran.
export function useCsmDashboardEtablissements() {
  const { toast } = useToast()
  const { loading, user } = useAuth()

  return useQuery({
    queryKey: ['csm-dashboard-etablissements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etablissements')
        .select('id, nom, ville, statut, date_fin_contrat')
        .eq('statut', 'Production')
        .order('nom', { ascending: true })

      if (error) {
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les indicateurs CSM',
          variant: 'destructive',
        })
        throw error
      }

      return (data || []) as CsmDashboardEtablissement[]
    },
    enabled: !loading && !!user,
    ...queryPresets.standard,
  })
}
