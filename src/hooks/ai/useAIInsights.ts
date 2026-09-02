import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/shared/use-toast'
import { debug } from '@/lib/debug'

interface AIInsightsParams {
  stats: Record<string, unknown>
  etablissements: Array<Record<string, unknown>>
  filters: Record<string, unknown>
  analysisType: 'trends' | 'anomalies' | 'recommendations' | 'alerts' | 'all'
  enabled?: boolean
}

export interface Trend {
  title: string
  description: string
  impact: 'positive' | 'negative' | 'neutral'
  recommendation: string
}

export interface Anomaly {
  etablissement: string
  type: string
  severity: 'critical' | 'high' | 'medium'
  explanation: string
  action: string
}

export interface Recommendation {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  estimatedImpact: string
  actions: string[]
}

export interface Alert {
  title: string
  severity: 'critical' | 'warning' | 'info'
  description: string
  businessImpact: string
  actions: string[]
}

export interface AIInsights {
  trends?: Trend[]
  anomalies?: Anomaly[]
  recommendations?: Recommendation[]
  alerts?: Alert[]
}

export function useAIInsights({ stats, etablissements, filters, analysisType, enabled = true }: AIInsightsParams) {
  const { toast } = useToast()

  // 1️⃣ Récupérer les derniers insights sauvegardés depuis la DB
  const query = useQuery({
    queryKey: ['ai-insights', analysisType],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.user) return null

      // Récupérer les insights sauvegardés depuis la base de données
      const { data, error } = await supabase
        .from('ai_analysis_log')
        .select('insights_data, created_at, insights_count')
        .eq('user_id', session.session.user.id)
        .eq('analysis_type', analysisType)
        .not('insights_data', 'is', null)  // ✅ Seulement les analyses avec insights
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as unknown as { data: { insights_data: AIInsights; created_at: string; insights_count: number } | null; error: unknown }

      if (error) {
        debug.error('Error fetching saved insights:', error)
        throw error
      }

      if (!data) {
        return {
          no_insights_yet: true,
          message: 'Aucune analyse disponible. La prochaine analyse automatique aura lieu demain à 9h.'
        } as unknown as AIInsights
      }

      // Retourner les insights sauvegardés + métadonnées
      return {
        ...data.insights_data,
        _metadata: {
          created_at: data.created_at,
          insights_count: data.insights_count
        }
      } as AIInsights & { _metadata: { created_at: string; insights_count: number } }

    },
    enabled: enabled && etablissements.length > 0,
    staleTime: 60 * 60 * 1000, // 1 heure (les données changent seulement à 9h)
    gcTime: 24 * 60 * 60 * 1000, // 24 heures
    refetchOnWindowFocus: false,
    retry: 1
  })

  // 2️⃣ Fonction pour forcer une actualisation manuelle (hors cron)
  const manualRefetch = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-rapports-insights', {
        body: {
          stats,
          etablissements,
          filters,
          analysis_type: analysisType,
          force: true  // ✅ Bypass le rate-limit pour le refresh manuel
        }
      })

      if (error) throw error

      if (data.success && !data.is_rate_limited) {
        toast({
          title: "✅ Analyse mise à jour",
          description: `Nouvelle analyse générée avec succès`,
        })
        query.refetch() // Recharger depuis la DB
      } else if (data.is_rate_limited) {
        toast({
          title: "⏰ Analyse déjà effectuée",
          description: data.message,
          variant: "default"
        })
      }
    } catch (error) {
      debug.error('Manual refetch error:', error)
      toast({
        title: "Erreur",
        description: "Impossible de lancer l'analyse",
        variant: "destructive"
      })
    }
  }

  // 3️⃣ Calculer la prochaine analyse (9h le lendemain)
  const getNextScheduledAnalysis = () => {
    const now = new Date()
    const next9AM = new Date(now)
    next9AM.setHours(9, 0, 0, 0)
    
    if (now.getHours() >= 9) {
      next9AM.setDate(next9AM.getDate() + 1)
    }
    
    return next9AM
  }

  return {
    ...query,
    manualRefetch,
    nextScheduledAnalysis: getNextScheduledAnalysis()
  }
}
