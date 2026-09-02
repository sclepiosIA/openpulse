/**
 * JARVIS V12.0 - Collective Insights Panel
 *
 * Affiche les insights basés sur l'apprentissage collectif anonymisé
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Users,
  TrendingUp,
  Lightbulb,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Trophy,
  Target,
} from 'lucide-react'
import { useJarvisCollectiveLearning } from '@/hooks/jarvis/useJarvisCollectiveLearning'

export function JarvisCollectiveInsights() {
  const { insights, topSuggestions, isLoading, recordAction } = useJarvisCollectiveLearning()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-muted-foreground">Analyse collective en cours...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Intelligence Collective
          <Badge variant="secondary" className="ml-auto text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Anonymisé
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Top Suggestions */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Pratiques des Top Performers
          </h4>

          <ScrollArea className="h-[200px]">
            <div className="space-y-2 pr-4">
              {topSuggestions.map((suggestion, index) => (
                <motion.div
                  key={suggestion.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div
                    className="p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() =>
                      setExpandedId(expandedId === suggestion.id ? null : suggestion.id)
                    }
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{suggestion.title}</span>
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${
                              expandedId === suggestion.id ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {suggestion.description}
                        </p>
                      </div>
                      <Badge
                        variant={suggestion.effectiveness >= 80 ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {suggestion.effectiveness}% efficace
                      </Badge>
                    </div>

                    <AnimatePresence>
                      {expandedId === suggestion.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-3 pt-3 border-t border-border/50"
                        >
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-muted-foreground">Taux d'adoption</span>
                              <div className="flex items-center gap-2 mt-1">
                                <Progress value={suggestion.adoptionRate} className="h-1.5" />
                                <span className="font-medium">{suggestion.adoptionRate}%</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Basé sur</span>
                              <p className="font-medium mt-1">
                                {suggestion.sourceCount} utilisateurs
                              </p>
                            </div>
                          </div>

                          {suggestion.actionable && (
                            <Button
                              size="sm"
                              className="w-full mt-3"
                              onClick={(e) => {
                                e.stopPropagation()
                                recordAction(suggestion.type, suggestion.data, true)
                              }}
                            >
                              <Target className="h-4 w-4 mr-2" />
                              Appliquer cette pratique
                            </Button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}

              {topSuggestions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Pas encore assez de données collectives</p>
                  <p className="text-xs">
                    Continuez à utiliser Jarvis pour enrichir l'apprentissage
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Quick Insights */}
        {insights.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Recommandations
            </h4>

            <div className="space-y-1.5">
              {insights[0]?.recommendations?.slice(0, 3).map((rec, index) => (
                <div
                  key={`insight-reco-${index}-${typeof rec === 'string' ? rec.slice(0, 24) : index}`}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
