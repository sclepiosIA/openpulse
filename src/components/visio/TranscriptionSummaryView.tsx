import { useState } from 'react'
import {
  CheckCircle,
  ListTodo,
  FileText,
  Building2,
  ChevronDown,
  Plus,
  Loader2,
  Archive,
  CalendarPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type {
  TranscriptionSessionWithDetails,
  TranscriptionDecision,
  TranscriptionNextStep,
} from '@/types/transcription'

interface TranscriptionSummaryViewProps {
  session: TranscriptionSessionWithDetails
  onCreateTask?: (nextStep: TranscriptionNextStep) => Promise<void>
  onCreateEvent?: (nextStep: TranscriptionNextStep) => Promise<void>
  onAssociateEntity?: (type: 'etablissement' | 'partenaire' | 'groupe', id: string) => Promise<void>
  onArchive?: () => Promise<void>
  isArchiving?: boolean
}

export function TranscriptionSummaryView({
  session,
  onCreateTask,
  onCreateEvent,
  onAssociateEntity,
  onArchive,
  isArchiving,
}: TranscriptionSummaryViewProps) {
  const [showFullTranscript, setShowFullTranscript] = useState(false)
  const [creatingTaskIndex, setCreatingTaskIndex] = useState<number | null>(null)
  const [creatingEventIndex, setCreatingEventIndex] = useState<number | null>(null)

  const decisions = session.decisions || []
  const nextSteps = session.next_steps || []

  const formatDuration = () => {
    if (!session.started_at || !session.ended_at) return 'N/A'
    const start = new Date(session.started_at).getTime()
    const end = new Date(session.ended_at).getTime()
    const durationMs = end - start
    const minutes = Math.floor(durationMs / 60000)
    const seconds = Math.floor((durationMs % 60000) / 1000)
    return `${minutes} min ${seconds} sec`
  }

  const handleCreateTask = async (nextStep: TranscriptionNextStep, index: number) => {
    if (!onCreateTask) return
    setCreatingTaskIndex(index)
    try {
      await onCreateTask(nextStep)
    } finally {
      setCreatingTaskIndex(null)
    }
  }

  const handleCreateEvent = async (nextStep: TranscriptionNextStep, index: number) => {
    if (!onCreateEvent) return
    setCreatingEventIndex(index)
    try {
      await onCreateEvent(nextStep)
    } finally {
      setCreatingEventIndex(null)
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'haute':
        return 'text-red-600 bg-red-50'
      case 'moyenne':
        return 'text-yellow-600 bg-yellow-50'
      case 'basse':
        return 'text-green-600 bg-green-50'
      default:
        return 'text-muted-foreground bg-muted'
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{session.title}</CardTitle>
              <CardDescription className="mt-1">
                {new Date(session.started_at).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' · '}
                Durée: {formatDuration()}
              </CardDescription>
            </div>
            <Badge
              variant={session.status === 'archived' ? 'secondary' : 'outline'}
              className="capitalize"
            >
              {session.status === 'processing'
                ? 'En traitement...'
                : session.status === 'archived'
                  ? 'Archivé'
                  : session.status}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Résumé
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/90 whitespace-pre-line">
            {session.summary || 'Résumé en cours de génération...'}
          </p>
        </CardContent>
      </Card>

      {/* Decisions */}
      {decisions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Décisions prises
              <Badge variant="secondary" className="ml-2">
                {decisions.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {decisions.map((decision: TranscriptionDecision, index: number) => (
                <li
                  key={`decision-${index}-${decision.decision.slice(0, 20)}`}
                  className="flex items-start gap-2"
                >
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm">{decision.decision}</p>
                    {decision.owner && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Responsable: {decision.owner}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      {nextSteps.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-blue-600" />
              Prochaines étapes
              <Badge variant="secondary" className="ml-2">
                {nextSteps.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {nextSteps.map((step: TranscriptionNextStep, index: number) => (
                <li
                  key={`step-${index}-${step.task.slice(0, 20)}`}
                  className="flex items-start gap-3 p-2 rounded-md bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{step.task}</p>
                      {step.priority && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${getPriorityColor(step.priority)}`}
                        >
                          {step.priority}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {step.assignee && <span>→ {step.assignee}</span>}
                      {step.deadline && <span>📅 {step.deadline}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {onCreateTask && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCreateTask(step, index)}
                        disabled={creatingTaskIndex === index}
                      >
                        {creatingTaskIndex === index ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Plus className="h-3 w-3 mr-1" />
                            Créer tâche
                          </>
                        )}
                      </Button>
                    )}
                    {onCreateEvent && step.deadline && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCreateEvent(step, index)}
                        disabled={creatingEventIndex === index}
                      >
                        {creatingEventIndex === index ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <CalendarPlus className="h-3 w-3 mr-1" />
                            Événement
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Association */}
      {onAssociateEntity &&
        !session.etablissement_id &&
        !session.partenaire_id &&
        !session.groupe_id && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Associer à une entité
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Vous pourrez associer cette transcription à un établissement, partenaire ou groupe
                depuis leurs fiches respectives.
              </p>
            </CardContent>
          </Card>
        )}

      {/* Full Transcript */}
      {session.full_transcript && (
        <Collapsible open={showFullTranscript} onOpenChange={setShowFullTranscript}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Transcription complète
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showFullTranscript ? 'rotate-180' : ''}`}
                  />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <ScrollArea className="h-80">
                  <pre className="text-xs whitespace-pre-wrap font-mono text-foreground/80">
                    {session.full_transcript}
                  </pre>
                </ScrollArea>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Archive button */}
      {session.status !== 'archived' && onArchive && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onArchive} disabled={isArchiving}>
            {isArchiving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Archive className="h-4 w-4 mr-2" />
            )}
            Archiver
          </Button>
        </div>
      )}
    </div>
  )
}
