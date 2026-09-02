import { useState, useCallback } from 'react'
import { debug } from '@/lib/debug'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  ListTodo,
  RefreshCw,
  AlertTriangle,
  CheckCheck,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseBrowser'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

interface SmartTaskSuggestion {
  action_type: 'create_task' | 'update_task'
  action_data: {
    title?: string
    description?: string
    category?: string
    priority?: string
    deadline_days?: number
    task_id?: string
    new_status?: string
    note?: string
  }
  confidence_score: number
  reason: string
}

interface SmartTasksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceType: 'email' | 'pulse'
  sourceId: string
  etablissementId?: string | null
  partenaireId?: string | null
}

export function SmartTasksDialog({
  open,
  onOpenChange,
  sourceType,
  sourceId,
  etablissementId,
  partenaireId,
}: SmartTasksDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SmartTaskSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [processedIds, setProcessedIds] = useState<Set<number>>(new Set())
  const [isApplying, setIsApplying] = useState(false)
  const queryClient = useQueryClient()

  const analyzeContent = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setSuggestions([])
    setProcessedIds(new Set())

    try {
      const { data, error: fnError } = await supabase.functions.invoke('smart-tasks-from-content', {
        body: {
          source_type: sourceType,
          source_id: sourceId,
          etablissement_id: etablissementId,
          partenaire_id: partenaireId,
          force_analysis: true,
        },
      })

      if (fnError) throw fnError

      if (data?.suggestions) {
        setSuggestions(data.suggestions)
        if (data.suggestions.length === 0) {
          toast.info('Aucune suggestion de tâche détectée')
        }
      }
    } catch (err: unknown) {
      debug.error('Smart tasks analysis error:', err)
      const errorMessage = err instanceof Error ? err.message : "Erreur lors de l'analyse"
      setError(errorMessage)
      toast.error("Erreur lors de l'analyse IA")
    } finally {
      setIsLoading(false)
    }
  }, [sourceType, sourceId, etablissementId, partenaireId])

  // Start analysis when dialog opens
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen && suggestions.length === 0 && !isLoading) {
        analyzeContent()
      }
      onOpenChange(newOpen)
    },
    [onOpenChange, suggestions.length, isLoading, analyzeContent]
  )

  const applySuggestion = async (suggestion: SmartTaskSuggestion, index: number) => {
    setIsApplying(true)
    try {
      // First, save the suggestion to the database
      const { data: savedSuggestion, error: saveError } = await supabase
        .from('ai_suggested_actions')
        .insert({
          email_thread_id: sourceType === 'email' ? sourceId : null,
          etablissement_id: etablissementId,
          partenaire_id: partenaireId,
          action_type: suggestion.action_type,
          action_data: suggestion.action_data,
          confidence_score: suggestion.confidence_score,
          reason: suggestion.reason,
          status: 'pending',
        })
        .select()
        .single() // safe: guaranteed-row

      if (saveError) throw saveError

      // Now apply the suggestion
      const { error: applyError } = await supabase.functions.invoke('apply-ai-suggestion', {
        body: { suggestion_id: savedSuggestion.id },
      })

      if (applyError) throw applyError

      setProcessedIds((prev) => new Set([...prev, index]))
      toast.success(
        suggestion.action_type === 'create_task'
          ? 'Tâche créée avec succès'
          : 'Tâche mise à jour avec succès'
      )

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] })
    } catch (err: unknown) {
      debug.error('Error applying suggestion:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error(`Erreur: ${errorMessage}`)
    } finally {
      setIsApplying(false)
    }
  }

  const rejectSuggestion = (index: number) => {
    setProcessedIds((prev) => new Set([...prev, index]))
    toast.info('Suggestion ignorée')
  }

  const approveAll = async () => {
    for (let i = 0; i < suggestions.length; i++) {
      if (!processedIds.has(i)) {
        await applySuggestion(suggestions[i], i)
      }
    }
  }

  const rejectAll = () => {
    const newProcessed = new Set<number>()
    suggestions.forEach((_, i) => newProcessed.add(i))
    setProcessedIds(newProcessed)
    toast.info('Toutes les suggestions ignorées')
  }

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.9) {
      return <Badge className="bg-emerald-500 text-white">Très haute</Badge>
    } else if (score >= 0.85) {
      return <Badge className="bg-green-500 text-white">Haute</Badge>
    } else if (score >= 0.8) {
      return <Badge className="bg-amber-500 text-white">Moyenne</Badge>
    }
    return <Badge variant="outline">Faible</Badge>
  }

  const pendingCount = suggestions.filter((_, i) => !processedIds.has(i)).length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Tâches intelligentes
          </DialogTitle>
          <DialogDescription>
            Analyse IA du contenu pour détecter les tâches à créer ou mettre à jour
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyse en cours...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 gap-4 text-destructive">
              <AlertTriangle className="h-8 w-8" />
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={analyzeContent}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Réessayer
              </Button>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-4 text-muted-foreground">
              <ListTodo className="h-12 w-12 opacity-30" />
              <p>Aucune suggestion de tâche détectée</p>
              <Button variant="outline" size="sm" onClick={analyzeContent}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Réanalyser
              </Button>
            </div>
          ) : (
            <>
              {/* Action buttons */}
              {pendingCount > 0 && (
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-muted-foreground">
                    {pendingCount} suggestion{pendingCount > 1 ? 's' : ''} en attente
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={rejectAll} disabled={isApplying}>
                      <X className="h-4 w-4 mr-1" />
                      Tout ignorer
                    </Button>
                    <Button size="sm" onClick={approveAll} disabled={isApplying}>
                      <CheckCheck className="h-4 w-4 mr-1" />
                      Tout approuver
                    </Button>
                  </div>
                </div>
              )}

              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {suggestions.map((suggestion, index) => {
                    const isProcessed = processedIds.has(index)
                    const isCreateTask = suggestion.action_type === 'create_task'

                    return (
                      <div
                        key={`smart-task-${index}-${suggestion.action_type}-${suggestion.action_data?.title ?? suggestion.action_data?.new_status ?? ''}`}
                        className={cn(
                          'border rounded-lg p-4 transition-all',
                          isProcessed ? 'opacity-50 bg-muted/30' : 'bg-card hover:shadow-sm'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant={isCreateTask ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {isCreateTask ? 'Nouvelle tâche' : 'Mise à jour'}
                              </Badge>
                              {getConfidenceBadge(suggestion.confidence_score)}
                            </div>

                            <h4 className="font-medium text-sm mb-1">
                              {isCreateTask
                                ? suggestion.action_data.title
                                : `Mettre à jour: ${suggestion.action_data.new_status || 'statut'}`}
                            </h4>

                            {suggestion.action_data.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                {suggestion.action_data.description}
                              </p>
                            )}

                            <p className="text-xs text-muted-foreground italic">
                              {suggestion.reason}
                            </p>

                            <div className="flex gap-2 mt-2 flex-wrap">
                              {suggestion.action_data.category && (
                                <Badge variant="outline" className="text-xs">
                                  {suggestion.action_data.category}
                                </Badge>
                              )}
                              {suggestion.action_data.priority && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-xs',
                                    suggestion.action_data.priority === 'high' &&
                                      'border-red-500 text-red-500'
                                  )}
                                >
                                  {suggestion.action_data.priority}
                                </Badge>
                              )}
                              {suggestion.action_data.deadline_days && (
                                <Badge variant="outline" className="text-xs">
                                  +{suggestion.action_data.deadline_days}j
                                </Badge>
                              )}
                            </div>
                          </div>

                          {!isProcessed && (
                            <div className="flex flex-col gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => applySuggestion(suggestion, index)}
                                disabled={isApplying}
                                aria-label="Valider"
                              >
                                <CheckCircle2 className="h-5 w-5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => rejectSuggestion(index)}
                                disabled={isApplying}
                                aria-label="Fermer"
                              >
                                <XCircle className="h-5 w-5" />
                              </Button>
                            </div>
                          )}

                          {isProcessed && (
                            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <Separator />

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
