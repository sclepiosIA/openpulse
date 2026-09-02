import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  CheckSquare,
  Building2,
  Tag,
  AlertCircle,
  Repeat,
  FileText,
  Loader2,
  Flag,
  UserCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CalendarEvent } from '@/types/calendar'
import { cn } from '@/lib/utils'
import { useEventTranscription } from '@/hooks/calendar/useEventTranscription'
import { ClickableLocation } from './ClickableLocation'

interface Task {
  id: string
  titre: string
  echeance?: string
  statut: string
  priorite?: string
  description?: string
  categories_taches?: { nom: string; couleur?: string } | null
  etablissements?: { nom: string } | null
}

interface CalendarItemTooltipProps {
  item: CalendarEvent | Task
  type: 'event' | 'task'
}

export function CalendarItemTooltip({ item, type }: CalendarItemTooltipProps) {
  if (type === 'event') {
    return <EventTooltip event={item as CalendarEvent} />
  }

  return <TaskTooltip task={item as Task} />
}

// Separate component for events to allow hook usage
function EventTooltip({ event }: { event: CalendarEvent }) {
  const eventColor = event.color || event.calendar?.color || 'hsl(var(--primary))'
  const isRecurring = !!event.recurrence_rule

  // Fetch transcription if video URL exists
  const { transcription, isLoading: isLoadingTranscription } = useEventTranscription(
    event.id,
    event.video_conference_url
  )

  // Determine transcription status badge
  const getTranscriptionBadge = () => {
    if (!transcription) return null

    switch (transcription.status) {
      case 'active':
        return (
          <Badge variant="default" className="text-[10px] gap-0.5 bg-green-600">
            <div className="h-1.5 w-1.5 rounded-full bg-card animate-pulse" />
            En cours
          </Badge>
        )
      case 'processing':
        return (
          <Badge variant="secondary" className="text-[10px] gap-0.5">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Traitement
          </Badge>
        )
      case 'ended':
      case 'archived':
        return (
          <Badge variant="outline" className="text-[10px] gap-0.5 text-primary border-primary">
            <FileText className="h-2.5 w-2.5" />
            Transcription
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-2 min-w-[200px] max-w-[280px]">
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="mt-0.5 p-1 rounded" style={{ backgroundColor: `${eventColor}20` }}>
          <CalendarIcon className="h-3.5 w-3.5" style={{ color: eventColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm line-clamp-2">{event.title}</p>
          {event.calendar?.name && (
            <p className="text-xs text-muted-foreground">{event.calendar.name}</p>
          )}
        </div>
      </div>

      {/* Time */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
        {event.all_day ? (
          <span>Toute la journée</span>
        ) : (
          <span>
            {format(parseISO(event.start_time), 'HH:mm')} -{' '}
            {format(parseISO(event.end_time), 'HH:mm')}
          </span>
        )}
        {isRecurring && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
            <Repeat className="h-2.5 w-2.5" />
            Récurrent
          </Badge>
        )}
        {event.display_as_banner && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
            <Flag className="h-2.5 w-2.5" />
            Bannière
          </Badge>
        )}
      </div>

      {/* Disponibilité */}
      <div className="flex items-center gap-2 text-xs">
        <UserCheck
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0',
            event.availability === 'free' ? 'text-emerald-600' : 'text-muted-foreground'
          )}
        />
        <span
          className={
            event.availability === 'free' ? 'text-emerald-700 font-medium' : 'text-muted-foreground'
          }
        >
          {event.availability === 'free' ? 'Disponible pour des réunions' : 'Occupé'}
        </span>
      </div>

      {/* Location - cliquable si c'est un lien visio */}
      {event.location && <ClickableLocation location={event.location} />}

      {/* Video link */}
      {event.video_conference_url && (
        <div className="space-y-1">
          <a
            href={event.video_conference_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <Video className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Rejoindre la visio</span>
          </a>

          {/* Transcription status/link */}
          {isLoadingTranscription ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Chargement...</span>
            </div>
          ) : transcription ? (
            <div className="flex items-center gap-2">
              {getTranscriptionBadge()}
              {(transcription.status === 'ended' || transcription.status === 'archived') && (
                <Link
                  to={`/visio/transcription/${transcription.id}`}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FileText className="h-3 w-3" />
                  Voir l'enregistrement
                </Link>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Description */}
      {event.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-2 border-border/50">
          {event.description}
        </p>
      )}
    </div>
  )
}

// Task tooltip component
function TaskTooltip({ task }: { task: Task }) {
  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'Terminé':
        return 'bg-green-500/20 text-green-700 border-green-500/30'
      case 'En cours':
        return 'bg-blue-500/20 text-blue-700 border-blue-500/30'
      case 'Bloqué':
        return 'bg-red-500/20 text-red-700 border-red-500/30'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getPriorityColor = (priorite?: string) => {
    switch (priorite) {
      case 'Haute':
        return 'text-red-600'
      case 'Basse':
        return 'text-muted-foreground'
      default:
        return 'text-amber-600'
    }
  }

  return (
    <div className="space-y-2 min-w-[200px] max-w-[280px]">
      {/* Header */}
      <div className="flex items-start gap-2">
        <div
          className={cn(
            'mt-0.5 p-1 rounded',
            task.statut === 'Terminé' && 'bg-green-500/20',
            task.statut === 'En cours' && 'bg-blue-500/20',
            task.statut === 'Bloqué' && 'bg-red-500/20',
            task.statut === 'A faire' && 'bg-muted'
          )}
        >
          <CheckSquare className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm line-clamp-2">{task.titre}</p>
        </div>
      </div>

      {/* Status & Priority */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={cn('text-[10px]', getStatusColor(task.statut))}>
          {task.statut}
        </Badge>
        {task.priorite && task.priorite !== 'Moyenne' && (
          <Badge
            variant="outline"
            className={cn('text-[10px] gap-0.5', getPriorityColor(task.priorite))}
          >
            <AlertCircle className="h-2.5 w-2.5" />
            {task.priorite}
          </Badge>
        )}
      </div>

      {/* Due date */}
      {task.echeance && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Échéance: {format(parseISO(task.echeance), 'dd MMM yyyy', { locale: fr })}</span>
        </div>
      )}

      {/* Etablissement */}
      {task.etablissements?.nom && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{task.etablissements.nom}</span>
        </div>
      )}

      {/* Category */}
      {task.categories_taches?.nom && (
        <div className="flex items-center gap-2 text-xs">
          <Tag className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <Badge
            variant="outline"
            className="text-[10px]"
            style={{
              backgroundColor: `${task.categories_taches.couleur}20`,
              borderColor: task.categories_taches.couleur,
            }}
          >
            {task.categories_taches.nom}
          </Badge>
        </div>
      )}

      {/* Description */}
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-2 border-border/50">
          {task.description}
        </p>
      )}
    </div>
  )
}
