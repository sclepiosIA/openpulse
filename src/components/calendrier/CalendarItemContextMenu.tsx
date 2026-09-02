import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Edit,
  Trash2,
  UserPlus,
  Video,
  CheckCircle2,
  PlayCircle,
  AlertCircle,
  CalendarMinus,
  CalendarX,
  Clock,
  Search,
  User,
  FileText,
  Copy,
} from 'lucide-react'
import { DuplicateEventDialog } from './DuplicateEventDialog'
import { CalendarEvent } from '@/types/calendar'
import { useDeleteEvent, useDeleteOccurrence } from '@/hooks/calendar/useCalendarEvents'
import { useUpdateTache } from '@/hooks/tasks/useTaches'
import { useAddAttendee } from '@/hooks/calendar/useEventAttendees'
import { useAttendeeSearch } from '@/hooks/search/useAttendeeSearch'
import { useEventTranscription } from '@/hooks/calendar/useEventTranscription'
import { isOccurrenceId, parseOccurrenceId } from '@/lib/recurrenceUtils'
import { cn } from '@/lib/utils'

interface Task {
  id: string
  titre: string
  echeance?: string
  statut: string
  priorite?: string
}

interface CalendarItemContextMenuProps {
  children: React.ReactNode
  item: CalendarEvent | Task
  type: 'event' | 'task'
  onEdit: () => void
  onDelete?: () => void
  triggerClassName?: string
  triggerStyle?: CSSProperties
}

export function CalendarItemContextMenu({
  children,
  item,
  type,
  onEdit,
  onDelete,
  triggerClassName,
  triggerStyle,
}: CalendarItemContextMenuProps) {
  const navigate = useNavigate()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteType, setDeleteType] = useState<'single' | 'series'>('single')
  const [attendeeSearch, setAttendeeSearch] = useState('')
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

  const deleteEvent = useDeleteEvent()
  const deleteOccurrence = useDeleteOccurrence()
  const updateTache = useUpdateTache()
  const addAttendee = useAddAttendee()
  const { data: searchResults = [], isLoading: isSearching } = useAttendeeSearch(attendeeSearch)

  const isEvent = type === 'event'
  const event = isEvent ? (item as CalendarEvent) : null
  const task = !isEvent ? (item as Task) : null

  // Fetch transcription for events with video
  const { transcription } = useEventTranscription(event?.id, event?.video_conference_url)

  // Check if it's a recurring event occurrence
  const isRecurringOccurrence = event && isOccurrenceId(event.id)
  const hasRecurrence = event?.recurrence_rule

  const handleDeleteEvent = () => {
    if (!event) return

    if (isRecurringOccurrence || hasRecurrence) {
      setShowDeleteDialog(true)
    } else {
      deleteEvent.mutate(event.id)
    }
  }

  const confirmDeleteEvent = () => {
    if (!event) return

    if (deleteType === 'single' && isRecurringOccurrence) {
      const parsed = parseOccurrenceId(event.id)
      if (parsed) {
        deleteOccurrence.mutate({
          parentId: parsed.parentId,
          occurrenceDate: parsed.occurrenceDate,
        })
      }
    } else {
      // Delete the whole series (use parent ID if it's an occurrence)
      const parentId = isRecurringOccurrence
        ? parseOccurrenceId(event.id)?.parentId || event.id
        : event.id
      deleteEvent.mutate(parentId)
    }
    setShowDeleteDialog(false)
  }

  const handleDeleteTask = () => {
    if (onDelete) {
      onDelete()
    }
  }

  const handleTaskStatusChange = (newStatut: 'A faire' | 'En cours' | 'Bloqué' | 'Terminé') => {
    if (!task) return
    updateTache.mutate({ id: task.id, data: { statut: newStatut } })
  }

  const handleAddAttendee = (attendee: { email: string; displayName: string }) => {
    if (!event) return

    // Get real event ID (parent ID if occurrence)
    const eventId = isRecurringOccurrence
      ? parseOccurrenceId(event.id)?.parentId || event.id
      : event.id

    addAttendee.mutate({
      event_id: eventId,
      email: attendee.email,
      display_name: attendee.displayName,
      role: 'required',
    })
    setAttendeeSearch('')
  }

  const handleJoinVideo = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (event?.video_conference_url) {
      window.open(event.video_conference_url, '_blank')
    }
  }

  const handleViewTranscription = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (transcription) {
      navigate(`/visio/transcription/${transcription.id}`)
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger className={cn('block w-full', triggerClassName)} style={triggerStyle}>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent
          className="w-56"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
          {isEvent ? (
            <>
              {/* Event actions */}
              <ContextMenuItem onClick={onEdit} className="gap-2">
                <Edit className="h-4 w-4" />
                Modifier
              </ContextMenuItem>

              {/* Video conference */}
              {event?.video_conference_url && (
                <ContextMenuItem onClick={handleJoinVideo} className="gap-2 text-primary">
                  <Video className="h-4 w-4" />
                  Rejoindre la visio
                </ContextMenuItem>
              )}

              {/* Transcription link - only if available */}
              {transcription &&
                (transcription.status === 'ended' || transcription.status === 'archived') && (
                  <ContextMenuItem onClick={handleViewTranscription} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Voir la transcription
                  </ContextMenuItem>
                )}

              {/* Invite submenu */}
              <ContextMenuSub>
                <ContextMenuSubTrigger className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Inviter quelqu'un
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-64 p-2">
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un contact..."
                      value={attendeeSearch}
                      onChange={(e) => setAttendeeSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <ScrollArea className="max-h-[200px]">
                    {isSearching ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        Recherche...
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="space-y-1">
                        {searchResults.slice(0, 5).map((result) => (
                          <button
                            key={result.id}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors text-left"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAddAttendee({
                                email: result.email || '',
                                displayName: result.displayName,
                              })
                            }}
                          >
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium">{result.displayName}</p>
                              {result.email && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {result.email}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : attendeeSearch.length >= 2 ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        Aucun résultat
                      </div>
                    ) : (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        Tapez pour rechercher
                      </div>
                    )}
                  </ScrollArea>
                </ContextMenuSubContent>
              </ContextMenuSub>

              <ContextMenuSeparator />

              {/* Duplicate to other dates */}
              <ContextMenuItem onClick={() => setShowDuplicateDialog(true)} className="gap-2">
                <Copy className="h-4 w-4" />
                Dupliquer vers d'autres dates…
              </ContextMenuItem>

              <ContextMenuSeparator />

              {isRecurringOccurrence || hasRecurrence ? (
                <>
                  <ContextMenuItem
                    onClick={() => {
                      setDeleteType('single')
                      setShowDeleteDialog(true)
                    }}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <CalendarMinus className="h-4 w-4" />
                    Supprimer cette occurrence
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      setDeleteType('series')
                      setShowDeleteDialog(true)
                    }}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <CalendarX className="h-4 w-4" />
                    Supprimer toute la série
                  </ContextMenuItem>
                </>
              ) : (
                <ContextMenuItem
                  onClick={handleDeleteEvent}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </ContextMenuItem>
              )}
            </>
          ) : (
            <>
              {/* Task actions */}
              <ContextMenuItem onClick={onEdit} className="gap-2">
                <Edit className="h-4 w-4" />
                Modifier
              </ContextMenuItem>

              <ContextMenuSeparator />

              {/* Status changes */}
              {task?.statut !== 'Terminé' && (
                <ContextMenuItem
                  onClick={() => handleTaskStatusChange('Terminé')}
                  className="gap-2 text-green-600"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Marquer comme terminé
                </ContextMenuItem>
              )}
              {task?.statut !== 'En cours' && (
                <ContextMenuItem
                  onClick={() => handleTaskStatusChange('En cours')}
                  className="gap-2 text-blue-600"
                >
                  <PlayCircle className="h-4 w-4" />
                  Marquer en cours
                </ContextMenuItem>
              )}
              {task?.statut !== 'Bloqué' && (
                <ContextMenuItem
                  onClick={() => handleTaskStatusChange('Bloqué')}
                  className="gap-2 text-red-600"
                >
                  <AlertCircle className="h-4 w-4" />
                  Marquer comme bloqué
                </ContextMenuItem>
              )}
              {task?.statut !== 'A faire' && (
                <ContextMenuItem
                  onClick={() => handleTaskStatusChange('A faire')}
                  className="gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Marquer à faire
                </ContextMenuItem>
              )}

              <ContextMenuSeparator />

              <ContextMenuItem
                onClick={handleDeleteTask}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Delete confirmation dialog for recurring events */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteType === 'single'
                ? 'Supprimer cette occurrence ?'
                : 'Supprimer toute la série ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteType === 'single'
                ? "Cette occurrence sera masquée mais les autres occurrences de l'événement récurrent resteront visibles."
                : "L'événement récurrent et toutes ses occurrences seront définitivement supprimés."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.stopPropagation()
                confirmDeleteEvent()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate to multiple dates dialog */}
      {isEvent && event && (
        <DuplicateEventDialog
          event={event}
          open={showDuplicateDialog}
          onOpenChange={setShowDuplicateDialog}
        />
      )}
    </>
  )
}
