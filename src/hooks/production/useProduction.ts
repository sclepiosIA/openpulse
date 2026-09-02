import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { useToast } from '@/hooks/shared/use-toast'
import { useAuth } from '@/components/AuthProvider'
import type { Etablissement, EtablissementWithGroupLogo } from '@/hooks/crm/useEtablissements'
import { PHASE_GROUPS } from '@/config/phases'

// Fonction utilitaire pour enrichir les établissements avec les logos de groupe
async function enrichWithGroupLogos(etablissements: Etablissement[]): Promise<EtablissementWithGroupLogo[]> {
  if (!etablissements.length) return []

  const etabIds = etablissements.map(e => e.id)
  
  const { data: links } = await supabase
    .from('etablissements_groupes')
    .select('etablissement_id, groupe_id')
    .in('etablissement_id', etabIds)

  const groupeIds = [...new Set((links || []).map(l => l.groupe_id))]
  const { data: groupes } = groupeIds.length > 0 ? await supabase
    .from('groupes_etablissements')
    .select('id, logo_url')
    .in('id', groupeIds) : { data: [] }

  const groupeLogoMap = new Map<string, string | null>()
  for (const link of (links || [])) {
    const groupe = (groupes || []).find(g => g.id === link.groupe_id)
    if (groupe?.logo_url) {
      groupeLogoMap.set(link.etablissement_id, groupe.logo_url)
    }
  }

  return etablissements.map(etab => ({
    ...etab,
    groupe_logo_url: groupeLogoMap.get(etab.id) || null
  })) as EtablissementWithGroupLogo[]
}

// Hook pour récupérer uniquement les établissements en production
export function useProduction() {
  const { toast } = useToast()
  const { loading, user } = useAuth()

  return useQuery({
    queryKey: ['production'],
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etablissements')
        .select(`
          id, nom, ville, region, type, statut, progression,
          date_signature, date_previsionnelle_signature, date_go_live, date_fin_contrat,
          commercial_id, csm_id, chef_projet_id,
          pallier_vise, pallier_realise, modele_statique_succes,
          nombre_passages_urgences_annuel, type_offre, tarifs_palliers,
          adresse, code_postal, telephone, email, dpi, notes, logo_url,
          prochaine_action_orga,
          created_at, updated_at
        `)
        .eq('statut', 'Production')
        .order('created_at', { ascending: false })
        .limit(2000)

      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de charger les établissements en production",
          variant: "destructive"
        })
        throw error
      }

      return enrichWithGroupLogos(data as unknown as Etablissement[])
    },
    enabled: !loading && !!user,
  })
}

// Hook pour récupérer uniquement les établissements en déploiement
export function useDeploiement() {
  const { toast } = useToast()
  const { loading, user } = useAuth()

  return useQuery({
    queryKey: ['deploiement'],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etablissements')
        .select(`
          id, nom, ville, region, type, statut, progression,
          date_signature, date_previsionnelle_signature, date_go_live, date_fin_contrat,
          commercial_id, csm_id, chef_projet_id,
          pallier_vise, pallier_realise, modele_statique_succes,
          nombre_passages_urgences_annuel, type_offre, tarifs_palliers,
          adresse, code_postal, telephone, email, dpi, notes, logo_url,
          created_at, updated_at
        `)
        .in('statut', [...PHASE_GROUPS.deploiement.statuts])
        .order('created_at', { ascending: false })
        .limit(2000)

      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de charger les établissements en déploiement",
          variant: "destructive"
        })
        throw error
      }

      return enrichWithGroupLogos(data as Etablissement[])
    },
    enabled: !loading && !!user,
  })
}
