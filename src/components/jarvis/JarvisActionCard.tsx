/**
 * JarvisActionCard - Carte d'action proposée par Jarvis
 */

import { useState } from 'react'
import {
  Mail,
  CheckSquare,
  Building2,
  Calendar,
  Ticket,
  Check,
  X,
  Pencil,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { JarvisSourceBadge } from './JarvisSourceBadge'
import type { JarvisPendingAction } from '@/types/jarvis'

interface JarvisActionCardProps {
  action: JarvisPendingAction
  onApprove: (actionId: string) => Promise<void>
  onReject: (actionId: string, reason?: string) => Promise<void>
  onModify: (actionId: string) => void
  isApproving?: boolean
  isRejecting?: boolean
}

const ACTION_CONFIG = {
  send_email: {
    icon: Mail,
    title: 'Email à envoyer',
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-gradient-to-br from-sky-500/15 to-sky-500/5',
    borderColor: 'border-l-sky-500',
  },
  create_task: {
    icon: CheckSquare,
    title: 'Tâche à créer',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5',
    borderColor: 'border-l-emerald-500',
  },
  update_status: {
    icon: Building2,
    title: 'Statut à mettre à jour',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-gradient-to-br from-purple-500/15 to-purple-500/5',
    borderColor: 'border-l-purple-500',
  },
  close_ticket: {
    icon: Ticket,
    title: 'Ticket à clôturer',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-gradient-to-br from-amber-500/15 to-amber-500/5',
    borderColor: 'border-l-amber-500',
  },
  schedule_meeting: {
    icon: Calendar,
    title: 'Réunion à planifier',
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-gradient-to-br from-pink-500/15 to-pink-500/5',
    borderColor: 'border-l-pink-500',
  },
  draft_response: {
    icon: Mail,
    title: 'Brouillon de réponse',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    borderColor: 'border-l-muted-foreground/50',
  },
  summarize: {
    icon: BookOpen,
    title: 'Résumé',
    color: 'text-primary',
    bgColor: 'bg-gradient-to-br from-primary/15 to-primary/5',
    borderColor: 'border-l-primary',
  },
  analyze: {
    icon: BookOpen,
    title: 'Analyse',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-gradient-to-br from-cyan-500/15 to-cyan-500/5',
    borderColor: 'border-l-cyan-500',
  },
  remind: {
    icon: Clock,
    title: 'Rappel',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-gradient-to-br from-orange-500/15 to-orange-500/5',
    borderColor: 'border-l-orange-500',
  },
  none: {
    icon: BookOpen,
    title: 'Information',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    borderColor: 'border-l-muted-foreground/50',
  },
}

export function JarvisActionCard({
  action,
  onApprove,
  onReject,
  onModify,
  isApproving = false,
  isRejecting = false,
}: JarvisActionCardProps) {
  const [showSources, setShowSources] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const proposedAction = action.proposed_action
  const actionType = proposedAction?.type || 'create_task'
  const config =
    ACTION_CONFIG[actionType as keyof typeof ACTION_CONFIG] || ACTION_CONFIG.create_task
  const Icon = config.icon

  const confidenceScore = proposedAction?.confidence_score || 0
  const confidencePercent = Math.round(confidenceScore * 100)

  const expiresAt = action.expires_at ? new Date(action.expires_at) : null
  const timeLeft = expiresAt
    ? formatDistanceToNow(expiresAt, { locale: fr, addSuffix: false })
    : null

  const kbSources = action.kb_sources || []

  const handleApprove = async () => {
    setIsProcessing(true)
    try {
      await onApprove(action.id)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    setIsProcessing(true)
    try {
      await onReject(action.id)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card
      className={cn(
        'overflow-hidden border-l-4 shadow-md hover:shadow-lg transition-shadow bg-card/80 backdrop-blur-sm',
        config.borderColor
      )}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={cn('p-2.5 rounded-xl shrink-0 ring-1 ring-border/50', config.bgColor)}>
            <Icon className={cn('h-5 w-5', config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">{config.title}</span>
              <Badge
                variant={confidencePercent >= 90 ? 'default' : 'secondary'}
                className={cn(
                  'text-xs',
                  confidencePercent >= 90 &&
                    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                )}
              >
                {confidencePercent}%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {proposedAction?.preview_text || 'Action en attente de validation'}
            </p>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Confiance</span>
            <span
              className={cn(
                confidencePercent >= 90 && 'text-primary',
                confidencePercent >= 70 && confidencePercent < 90 && 'text-accent-foreground',
                confidencePercent < 70 && 'text-destructive'
              )}
            >
              {confidencePercent}%
            </span>
          </div>
          <Progress value={confidencePercent} className="h-1.5" />
        </div>

        {/* Reasoning */}
        {proposedAction?.reasoning && (
          <div className="p-3 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 text-xs text-muted-foreground border border-border/30">
            <span className="font-semibold text-foreground/80">Raisonnement :</span>{' '}
            {proposedAction.reasoning}
          </div>
        )}

        {/* KB Sources */}
        {kbSources.length > 0 && (
          <Collapsible open={showSources} onOpenChange={setShowSources}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-xs">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  {kbSources.length} source{kbSources.length > 1 ? 's' : ''} utilisée
                  {kbSources.length > 1 ? 's' : ''}
                </span>
                {showSources ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {kbSources.map((source, index) => (
                <JarvisSourceBadge
                  key={`kb-source-${source.article_id}-${index}`}
                  source={source}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-border/50">
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-primary hover:bg-primary/90"
            onClick={handleApprove}
            disabled={isProcessing || isApproving || isRejecting}
          >
            {isApproving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Approuver
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-border/50 hover:bg-muted/50"
            onClick={() => onModify(action.id)}
            disabled={isProcessing || isApproving || isRejecting}
          >
            <Pencil className="h-4 w-4" />
            Modifier
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleReject}
            disabled={isProcessing || isApproving || isRejecting}
          >
            {isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </Button>
        </div>

        {/* Expiration */}
        {timeLeft && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
            <Clock className="h-3 w-3" />
            <span>Expire dans {timeLeft}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
