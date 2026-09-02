import { useQuery, useQueries, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { useToast } from '@/hooks/shared/use-toast'
import { useAuth } from '@/components/AuthProvider'
import { queryPresets } from '@/lib/queryPresets'
import { debug } from '@/lib/debug'

interface DashboardOverview {
  total_etablissements: number
  total_prospects: number
  total_pipeline: number       // Pipeline commercial complet
  total_contractuel: number    // Nombre d'établissements en phase contractuelle
  total_production: number
  total_bloques: number        // Nombre d'établissements bloqués
  valeur_bloquee: number       // Valeur totale bloquée
  total_taches: number
  valeur_totale: number        // CA potentiel total
  valeur_pipeline: number      // CA du pipeline commercial
}

interface PipelineBreakdown {
  statut: string
  count: number
  valeur_potentielle: number
}

// Hook pour obtenir les statistiques du dashboard
export function useDashboardOverview() {
  const { toast } = useToast()
  const { loading, user } = useAuth()

  return useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: async (): Promise<DashboardOverview> => {
      const { data, error } = await supabase
        .rpc('get_dashboard_overview')

      if (error) {
        debug.error('Error loading dashboard overview:', error)
        toast({
          title: "Erreur",
          description: "Impossible de charger les statistiques du dashboard",
          variant: "destructive"
        })
        throw error
      }

      // Les RPC functions retournent toujours un array, même pour une seule ligne
      const result = Array.isArray(data) ? data[0] : data
      
      return {
        total_etablissements: Number(result?.total_etablissements || 0),
        total_prospects: Number(result?.total_prospects || 0),
        total_pipeline: Number(result?.total_pipeline || 0),
        total_contractuel: Number(result?.total_contractuel || 0),
        total_production: Number(result?.total_production || 0),
        total_bloques: Number(result?.total_bloques || 0),
        valeur_bloquee: Number(result?.valeur_bloquee || 0),
        total_taches: Number(result?.total_taches || 0),
        valeur_totale: Number(result?.valeur_totale || 0),
        valeur_pipeline: Number(result?.valeur_pipeline || 0)
      }
    },
    enabled: !loading && !!user,
    placeholderData: keepPreviousData,
    ...queryPresets.standard, // 2 minutes staleTime - shared across dashboards
  })
}

// Hook pour obtenir la répartition du pipeline
export function usePipelineBreakdown() {
  const { toast } = useToast()
  const { loading, user } = useAuth()

  return useQuery({
    queryKey: ['pipeline-breakdown'],
    queryFn: async (): Promise<PipelineBreakdown[]> => {
      const { data, error } = await supabase
        .rpc('get_pipeline_breakdown')

      if (error) {
        debug.error('Error loading pipeline breakdown:', error)
        toast({
          title: "Erreur",
          description: "Impossible de charger la répartition du pipeline",
          variant: "destructive"
        })
        throw error
      }

      /** Type pour les données brutes de la RPC */
      interface PipelineBreakdownRaw {
        statut: string;
        count: number | string | null;
        valeur_potentielle: number | string | null;
      }

      return (data || []).map((item: PipelineBreakdownRaw) => ({
        statut: item.statut,
        count: Number(item.count || 0),
        valeur_potentielle: Number(item.valeur_potentielle || 0)
      }))
    },
    enabled: !loading && !!user,
    ...queryPresets.standard, // 2 minutes staleTime
  })
}

/**
 * Combined hook for dashboard overview + pipeline breakdown
 * Uses useQueries for parallel fetching with unified loading state
 */
export function useDashboardData() {
  const { toast } = useToast()
  const { loading, user } = useAuth()
  const enabled = !loading && !!user

  const results = useQueries({
    queries: [
      {
        queryKey: ['dashboard-overview'],
        queryFn: async (): Promise<DashboardOverview> => {
          const { data, error } = await supabase.rpc('get_dashboard_overview')
          if (error) {
            toast({ title: "Erreur", description: "Statistiques indisponibles", variant: "destructive" })
            throw error
          }
          const result = Array.isArray(data) ? data[0] : data
          return {
            total_etablissements: Number(result?.total_etablissements || 0),
            total_prospects: Number(result?.total_prospects || 0),
            total_pipeline: Number(result?.total_pipeline || 0),
            total_contractuel: Number(result?.total_contractuel || 0),
            total_production: Number(result?.total_production || 0),
            total_bloques: Number(result?.total_bloques || 0),
            valeur_bloquee: Number(result?.valeur_bloquee || 0),
            total_taches: Number(result?.total_taches || 0),
            valeur_totale: Number(result?.valeur_totale || 0),
            valeur_pipeline: Number(result?.valeur_pipeline || 0)
          }
        },
        enabled,
        ...queryPresets.standard,
      },
      {
        queryKey: ['pipeline-breakdown'],
        queryFn: async (): Promise<PipelineBreakdown[]> => {
          const { data, error } = await supabase.rpc('get_pipeline_breakdown')
          if (error) throw error
          return (data || []).map((item: { statut: string; count: number | string | null; valeur_potentielle: number | string | null }) => ({
            statut: item.statut,
            count: Number(item.count || 0),
            valeur_potentielle: Number(item.valeur_potentielle || 0)
          }))
        },
        enabled,
        ...queryPresets.standard,
      },
    ],
  })

  const [overviewQuery, breakdownQuery] = results

  return {
    overview: overviewQuery.data,
    breakdown: breakdownQuery.data,
    isLoading: overviewQuery.isLoading || breakdownQuery.isLoading,
    isLoadingOverview: overviewQuery.isLoading,
    isLoadingBreakdown: breakdownQuery.isLoading,
  }
}