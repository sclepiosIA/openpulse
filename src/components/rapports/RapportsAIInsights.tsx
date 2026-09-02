import { Button } from '@/components/ui/button'
import { debug } from '@/lib/debug'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Brain,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Search,
  Clock,
  Sparkles,
} from 'lucide-react'
import {
  useAIInsights,
  type Trend,
  type Alert,
  type Recommendation,
  type Anomaly,
} from '@/hooks/ai/useAIInsights'
import { AIInsightCard } from './AIInsightCard'
import { useState, useMemo } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'

// Fonction pour générer un ID unique basé sur le contenu de l'insight
const generateInsightId = (type: string, title: string, description: string): string => {
  const content = `${type}-${title}-${description.substring(0, 100)}`
  // Simple hash pour générer un ID court
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return `insight-${Math.abs(hash)}`
}

// Hook pour gérer les insights rejetés
const useDismissedInsights = () => {
  const STORAGE_KEY = 'dismissed_ai_insights'

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  const dismissInsight = (insightId: string) => {
    setDismissedIds((prev) => {
      const newSet = new Set(prev)
      newSet.add(insightId)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(newSet)))
      } catch (error) {
        debug.error('Erreur lors de la sauvegarde des insights rejetés:', error)
      }
      return newSet
    })
  }

  return { dismissedIds, dismissInsight }
}

interface RapportsAIInsightsProps {
  stats: any
  etablissements: any[]
  filters: any
}

export function RapportsAIInsights({ stats, etablissements, filters }: RapportsAIInsightsProps) {
  const [activeTab, setActiveTab] = useState<'trends' | 'alerts' | 'recommendations' | 'anomalies'>(
    'trends'
  )
  const { dismissedIds, dismissInsight } = useDismissedInsights()

  const {
    data: insights,
    isLoading,
    isFetching,
    manualRefetch,
    nextScheduledAnalysis,
  } = useAIInsights({
    stats,
    etablissements,
    filters,
    analysisType: activeTab,
    enabled: true,
  })

  // États transverses retournés par l'edge function (métadonnées, rate-limit, no-data)
  const insightsMeta = insights as
    | undefined
    | {
        _metadata?: { created_at?: string }
        no_insights_yet?: boolean
        is_rate_limited?: boolean
        message?: string
        nextAvailableAt?: string
      }

  // Filtrer les insights rejetés
  const filteredInsights = useMemo(() => {
    if (!insights) return insights

    const filterByDismissed = (
      items: any[],
      type: string,
      getTitleDesc: (item: any) => { title: string; description: string }
    ) => {
      return (
        items?.filter((item) => {
          const { title, description } = getTitleDesc(item)
          const id = generateInsightId(type, title, description)
          return !dismissedIds.has(id)
        }) || []
      )
    }

    return {
      ...insights,
      trends: filterByDismissed(insights.trends || [], 'trend', (t: Trend) => ({
        title: t.title,
        description: t.description,
      })),
      alerts: filterByDismissed(insights.alerts || [], 'alert', (a: Alert) => ({
        title: a.title,
        description: a.description,
      })),
      recommendations: filterByDismissed(
        insights.recommendations || [],
        'recommendation',
        (r: Recommendation) => ({ title: r.title, description: r.description })
      ),
      anomalies: filterByDismissed(insights.anomalies || [], 'anomaly', (a: Anomaly) => ({
        title: `${a.etablissement} - ${a.type}`,
        description: a.explanation,
      })),
    }
  }, [insights, dismissedIds])

  const handleRefresh = () => {
    manualRefetch()
  }

  if (!etablissements || etablissements.length === 0) {
    return null
  }

  return (
    <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-l-4 border-l-violet-500 border-violet-500/10 shadow-lg">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-violet-500/10 to-transparent pointer-events-none" />

      <CardHeader className="relative border-b border-border/50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500/20 rounded-full blur-lg opacity-60" />
              <div className="relative p-2.5 rounded-full bg-gradient-to-br from-violet-500/20 to-violet-500/5 ring-2 ring-violet-500/20">
                <Brain className="w-5 h-5 text-violet-600" />
              </div>
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-violet-700 to-violet-500 bg-clip-text text-transparent">
                  Insights IA
                </span>
                {isFetching && (
                  <div className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Analyse en cours...
                  </div>
                )}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <CardDescription>Analyse automatique par GPT-5</CardDescription>
                {insightsMeta?._metadata?.created_at && (
                  <Badge
                    variant="outline"
                    className="gap-1.5 bg-violet-50 border-violet-200 text-violet-700 shadow-sm"
                  >
                    <Clock className="w-3 h-3" />
                    Analysé le{' '}
                    {format(new Date(insightsMeta._metadata.created_at), 'dd/MM à HH:mm', {
                      locale: fr,
                    })}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isFetching}
                    className="h-9 gap-2 rounded-xl border-violet-200 hover:bg-violet-50 hover:border-violet-300 transition-all"
                  >
                    <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Actualiser</span>
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent className="rounded-xl">
                <p>Actualiser l'analyse maintenant</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Prochaine analyse automatique :{' '}
                  {format(nextScheduledAnalysis, 'dd/MM à 09:00', { locale: fr })}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="relative pt-4">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="w-full"
        >
          <TabsList className="inline-flex h-11 items-center justify-start p-1 bg-card/60 backdrop-blur-sm border border-violet-500/10 shadow-md rounded-xl mb-4 w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger
              value="trends"
              className="gap-2 px-4 h-9 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border-b-2 data-[state=active]:border-b-emerald-500 transition-all"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Tendances</span>
            </TabsTrigger>
            <TabsTrigger
              value="alerts"
              className="gap-2 px-4 h-9 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border-b-2 data-[state=active]:border-b-destructive transition-all"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Alertes</span>
            </TabsTrigger>
            <TabsTrigger
              value="recommendations"
              className="gap-2 px-4 h-9 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border-b-2 data-[state=active]:border-b-amber-500 transition-all"
            >
              <Lightbulb className="w-4 h-4" />
              <span className="hidden sm:inline">Recommandations</span>
            </TabsTrigger>
            <TabsTrigger
              value="anomalies"
              className="gap-2 px-4 h-9 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border-b-2 data-[state=active]:border-b-blue-500 transition-all"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Anomalies</span>
            </TabsTrigger>
          </TabsList>

          {isLoading || isFetching ? (
            <div className="relative">
              {/* Overlay animé */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse rounded-lg" />

              <div className="relative py-12 px-6 text-center space-y-6">
                {/* Icône animée */}
                <div className="flex justify-center">
                  <div className="relative">
                    <Brain className="w-16 h-16 text-primary animate-pulse" />
                    <Sparkles className="w-6 h-6 text-primary absolute -top-1 -right-1 animate-spin" />
                  </div>
                </div>

                {/* Texte principal */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">Analyse IA en cours...</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    GPT-5 analyse vos données pour générer des insights personnalisés
                  </p>
                </div>

                {/* Barre de progression animée */}
                <div className="max-w-xs mx-auto space-y-2">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-primary/50 animate-shimmer w-full" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cela peut prendre quelques secondes...
                  </p>
                </div>
              </div>
            </div>
          ) : insightsMeta?.no_insights_yet ? (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-6 text-center">
              <Brain className="w-12 h-12 text-amber-600 dark:text-amber-400 mx-auto mb-3" />
              <p className="font-medium text-amber-900 dark:text-amber-100 mb-2">
                Aucune analyse disponible
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                {insightsMeta.message}
              </p>
              <Button onClick={handleRefresh} variant="outline" size="sm">
                Lancer l'analyse maintenant
              </Button>
            </div>
          ) : insightsMeta?.is_rate_limited ? (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Analyse déjà effectuée
                </p>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300">{insightsMeta.message}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                Prochaine analyse disponible{' '}
                {insightsMeta?.nextAvailableAt
                  ? formatDistanceToNow(new Date(insightsMeta.nextAvailableAt), {
                      addSuffix: true,
                      locale: fr,
                    })
                  : 'bientôt'}
              </p>
            </div>
          ) : (
            <>
              <TabsContent value="trends" className="space-y-4">
                {filteredInsights?.trends && filteredInsights.trends.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredInsights.trends.map((trend: Trend, index: number) => {
                      const insightId = generateInsightId('trend', trend.title, trend.description)
                      return (
                        <AIInsightCard
                          key={insightId}
                          insightId={insightId}
                          type="trend"
                          title={trend.title}
                          description={trend.description}
                          impact={trend.impact}
                          actions={trend.recommendation ? [trend.recommendation] : undefined}
                          onDismiss={dismissInsight}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune tendance significative détectée
                  </p>
                )}
              </TabsContent>

              <TabsContent value="alerts" className="space-y-4">
                {filteredInsights?.alerts && filteredInsights.alerts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredInsights.alerts.map((alert: Alert, index: number) => {
                      const description = `${alert.description}\n\nImpact: ${alert.businessImpact}`
                      const insightId = generateInsightId('alert', alert.title, description)
                      return (
                        <AIInsightCard
                          key={insightId}
                          insightId={insightId}
                          type="alert"
                          title={alert.title}
                          description={description}
                          priority={alert.severity}
                          actions={alert.actions}
                          onDismiss={dismissInsight}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Aucune alerte détectée</p>
                )}
              </TabsContent>

              <TabsContent value="recommendations" className="space-y-4">
                {filteredInsights?.recommendations &&
                filteredInsights.recommendations.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredInsights.recommendations.map((rec: Recommendation, index: number) => {
                      const description = `${rec.description}\n\nImpact estimé: ${rec.estimatedImpact}`
                      const insightId = generateInsightId('recommendation', rec.title, description)
                      return (
                        <AIInsightCard
                          key={insightId}
                          insightId={insightId}
                          type="recommendation"
                          title={rec.title}
                          description={description}
                          priority={rec.priority}
                          actions={rec.actions}
                          onDismiss={dismissInsight}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune recommandation disponible
                  </p>
                )}
              </TabsContent>

              <TabsContent value="anomalies" className="space-y-4">
                {filteredInsights?.anomalies && filteredInsights.anomalies.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredInsights.anomalies.map((anomaly: Anomaly, index: number) => {
                      const title = `${anomaly.etablissement} - ${anomaly.type}`
                      const insightId = generateInsightId('anomaly', title, anomaly.explanation)
                      return (
                        <AIInsightCard
                          key={insightId}
                          insightId={insightId}
                          type="anomaly"
                          title={title}
                          description={anomaly.explanation}
                          priority={anomaly.severity}
                          actions={[anomaly.action]}
                          onDismiss={dismissInsight}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Aucune anomalie détectée</p>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </CardContent>
    </Card>
  )
}
