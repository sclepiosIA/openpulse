import { useState, useEffect, useRef, useMemo, type KeyboardEvent } from 'react'
import { debug } from '@/lib/debug'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MapPin, Bell, FileText, Plus } from 'lucide-react'
import { DuplicateEventDialog } from './DuplicateEventDialog'
import { EventDeleteRecurringDialog } from './EventDeleteRecurringDialog'
import { EventFormDateTimeSection } from './EventFormDateTimeSection'
import { CsrfToken } from '@/components/security/CsrfToken'
import {
  EventFormHero,
  EventFormDisplayAvailability,
  EventFormFooter,
} from './EventFormDialogSections'
import {
  format,
  parseISO,
  setHours,
  setMinutes,
  differenceInMinutes,
  differenceInDays,
} from 'date-fns'
import { useCalendars, useDefaultCalendar } from '@/hooks/calendar/useCalendars'
import {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useDeleteOccurrence,
} from '@/hooks/calendar/useCalendarEvents'
import {
  useAddMultipleReminders,
  useRemoveReminder,
  useEventReminders,
} from '@/hooks/calendar/useEventReminders'
import {
  useAddMultipleAttendees,
  useEventAttendees,
  useRemoveAttendee,
} from '@/hooks/calendar/useEventAttendees'
import { CalendarEvent, REMINDER_OPTIONS, SelectedAttendee } from '@/types/calendar'
import { useToast } from '@/hooks/shared/use-toast'
import { VideoConferenceSelector } from './VideoConferenceSelector'
import { AttendeesSelector } from './AttendeesSelector'
import { isOccurrenceId, parseOccurrenceId } from '@/lib/recurrenceUtils'
import { LocationAutocomplete } from './LocationAutocomplete'
import { LocationMapPreview } from './LocationMapPreview'
import { LocationNavButtons } from './LocationNavButtons'
import { parseLocation, encodeLocation } from '@/lib/locationEncoder'

interface EventFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event?: CalendarEvent | null
  defaultStartTime?: Date
  defaultEndTime?: Date
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2)
  const minutes = (i % 2) * 30
  return {
    value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    label: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  }
})

/**
 * All-day: on stocke start = jour à minuit UTC, end = (jourFin + 1) à minuit UTC
 * (convention "fin exclusive", conforme iCal). Ainsi la vue Mois détecte les
 * événements multi-jours via `end.getHours() === 0 && end > start`.
 */
function toAllDayStartIso(date: Date): string {
  return `${format(date, 'yyyy-MM-dd')}T00:00:00.000Z`
}

function toAllDayEndIso(date: Date): string {
  // end exclusif = jour de fin + 1 à minuit UTC
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  return `${format(next, 'yyyy-MM-dd')}T00:00:00.000Z`
}

function formatDuration(start: Date, end: Date, allDay: boolean): string {
  if (end <= start) return '—'
  if (allDay) {
    const days = differenceInDays(end, start) + 1
    return days <= 1 ? '1 jour' : `${days} jours`
  }
  const totalMin = differenceInMinutes(end, start)
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (totalMin >= 24 * 60) {
    const d = Math.floor(totalMin / (24 * 60))
    const remH = Math.floor((totalMin % (24 * 60)) / 60)
    return remH ? `${d}j ${remH}h` : `${d}j`
  }
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

export function EventFormDialog({
  open,
  onOpenChange,
  event,
  defaultStartTime,
  defaultEndTime,
}: EventFormDialogProps) {
  const { toast } = useToast()
  const { data: calendarsData } = useCalendars()
  const { data: defaultCalendar } = useDefaultCalendar()
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const deleteEvent = useDeleteEvent()
  const deleteOccurrence = useDeleteOccurrence()
  const addReminders = useAddMultipleReminders()
  const removeReminder = useRemoveReminder()
  const { data: eventReminders } = useEventReminders(event?.id)
  const addAttendees = useAddMultipleAttendees()
  const removeAttendee = useRemoveAttendee()
  const { data: eventAttendees } = useEventAttendees(event?.id)

  const [title, setTitle] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [description, setDescription] = useState('')
  const [showDescription, setShowDescription] = useState(false)
  const [location, setLocation] = useState('')
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [calendarId, setCalendarId] = useState('')
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [startTime, setStartTime] = useState('09:00')
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [endTime, setEndTime] = useState('10:00')
  const [allDay, setAllDay] = useState(false)
  const [color, setColor] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [selectedReminders, setSelectedReminders] = useState<number[]>([])
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceRule, setRecurrenceRule] = useState('')
  const [attendees, setAttendees] = useState<SelectedAttendee[]>([])
  const [displayAsBanner, setDisplayAsBanner] = useState(false)
  const [availability, setAvailability] = useState<'busy' | 'free'>('busy')
  const [submitLocked, setSubmitLocked] = useState(false)

  // Snapshot of persisted values, used to compute change labels on save
  const initialSnapshotRef = useRef<{
    title: string
    description: string
    location: string
    videoUrl: string
    startIso: string
    endIso: string
    allDay: boolean
  } | null>(null)

  const titleInputRef = useRef<HTMLInputElement>(null)
  const isEditing = !!event

  const calendars = useMemo(() => {
    const base = calendarsData ?? []
    if (defaultCalendar && !base.some((calendar) => calendar.id === defaultCalendar.id)) {
      return [defaultCalendar, ...base]
    }
    return base
  }, [calendarsData, defaultCalendar])

  // Initialize form with event data or defaults
  useEffect(() => {
    if (!open) return

    if (event) {
      setTitle(event.title)
      setDescription(event.description || '')
      setShowDescription(!!event.description)
      const parsedLoc = parseLocation(event.location)
      setLocation(parsedLoc.address)
      setLocationCoords(parsedLoc.coords)
      setVideoUrl(event.video_conference_url || '')
      setCalendarId(event.calendar_id)
      setAllDay(event.all_day || false)
      setColor(event.color)
      setCategoryId(event.category_id ?? null)
      setIsRecurring(!!event.recurrence_rule)
      setRecurrenceRule(event.recurrence_rule || '')
      setDisplayAsBanner(!!event.display_as_banner)
      setAvailability(event.availability === 'free' ? 'free' : 'busy')

      const start = parseISO(event.start_time)
      const end = parseISO(event.end_time)
      // Pour un événement all-day, `end_time` est stocké en fin exclusive
      // (jour suivant à minuit). On affiche le dernier jour inclusif dans le form.
      let displayEnd = end
      if (event.all_day && end.getTime() > start.getTime()) {
        const isMidnight =
          end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0
        if (isMidnight) {
          displayEnd = new Date(end.getTime() - 24 * 60 * 60 * 1000)
        }
      }
      setStartDate(start)
      setEndDate(displayEnd)
      setStartTime(format(start, 'HH:mm'))
      setEndTime(format(displayEnd, 'HH:mm'))

      initialSnapshotRef.current = {
        title: event.title,
        description: event.description || '',
        location: event.location || '',
        videoUrl: event.video_conference_url || '',
        startIso: event.start_time,
        endIso: event.end_time,
        allDay: !!event.all_day,
      }
    } else {
      // Reset form
      setTitle('')
      setDescription('')
      setShowDescription(false)
      setLocation('')
      setLocationCoords(null)
      setVideoUrl('')
      setCalendarId('')
      setAllDay(false)
      setColor(null)
      setCategoryId(null)
      setIsRecurring(false)
      setRecurrenceRule('')
      setSelectedReminders([])
      setAttendees([])
      setDisplayAsBanner(false)
      setAvailability('busy')
      initialSnapshotRef.current = null

      if (defaultStartTime) {
        setStartDate(defaultStartTime)
        setStartTime(format(defaultStartTime, 'HH:mm'))
      } else {
        setStartDate(new Date())
        setStartTime('09:00')
      }

      if (defaultEndTime) {
        setEndDate(defaultEndTime)
        setEndTime(format(defaultEndTime, 'HH:mm'))
      } else {
        const startRef = defaultStartTime || new Date()
        const endDefault = new Date(startRef.getTime() + 60 * 60 * 1000)
        setEndDate(endDefault)
        setEndTime(format(endDefault, 'HH:mm'))
      }
    }
  }, [open, event, defaultStartTime, defaultEndTime])

  useEffect(() => {
    if (!open || isEditing) return
    const hasValidCalendar =
      !!calendarId && calendars.some((calendar) => calendar.id === calendarId)
    if (hasValidCalendar) return

    const fallbackCalendar =
      defaultCalendar || calendars.find((calendar) => calendar.is_default) || calendars[0]
    if (fallbackCalendar) {
      setCalendarId(fallbackCalendar.id)
    }
  }, [open, isEditing, calendarId, defaultCalendar, calendars])

  // Auto-focus title on opening (creation only)
  useEffect(() => {
    if (open && !isEditing) {
      const t = setTimeout(() => titleInputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open, isEditing])

  useEffect(() => {
    if (eventReminders) {
      setSelectedReminders(eventReminders.map((r) => r.minutes_before))
    }
  }, [eventReminders])

  useEffect(() => {
    if (eventAttendees) {
      setAttendees(
        eventAttendees.map((a) => ({
          email: a.email,
          displayName: a.display_name || a.email,
          userId: a.user_id || undefined,
          role: a.role === 'optional' ? 'optional' : 'required',
        }))
      )
    }
  }, [eventAttendees])

  const selectedCalendar = useMemo(
    () => calendars?.find((c) => c.id === calendarId),
    [calendars, calendarId]
  )

  const headerColor = color || selectedCalendar?.color || 'hsl(var(--primary))'

  const startDateTimePreview = useMemo(() => {
    const [h, m] = startTime.split(':').map(Number)
    return setMinutes(setHours(startDate, h || 0), m || 0)
  }, [startDate, startTime])

  const endDateTimePreview = useMemo(() => {
    const [h, m] = endTime.split(':').map(Number)
    return setMinutes(setHours(endDate, h || 0), m || 0)
  }, [endDate, endTime])

  const durationLabel = formatDuration(startDateTimePreview, endDateTimePreview, allDay)

  const handleSubmit = async () => {
    if (submitLocked || createEvent.isPending || updateEvent.isPending) return

    const effectiveCalendarId =
      calendarId ||
      defaultCalendar?.id ||
      calendars.find((calendar) => calendar.is_default)?.id ||
      calendars[0]?.id ||
      ''
    const effectiveCalendarExists = calendars.some(
      (calendar) => calendar.id === effectiveCalendarId
    )

    if (!title.trim() || !effectiveCalendarId || !effectiveCalendarExists) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir les champs obligatoires',
        variant: 'destructive',
      })
      return
    }

    if (!calendarId) {
      setCalendarId(effectiveCalendarId)
    }

    const [startH, startM] = startTime.split(':').map(Number)
    const [endH, endM] = endTime.split(':').map(Number)

    const startDateTime = setMinutes(setHours(startDate, startH), startM)
    const endDateTime = setMinutes(setHours(endDate, endH), endM)

    if (allDay) {
      // Journée entière : comparer les dates locales et stocker à midi UTC pour éviter les décalages J-1/J+1.
      const startDay = format(startDate, 'yyyy-MM-dd')
      const endDay = format(endDate, 'yyyy-MM-dd')
      if (endDay < startDay) {
        toast({
          title: 'Dates invalides',
          description: 'La date de fin doit être postérieure ou égale à la date de début.',
          variant: 'destructive',
        })
        return
      }
    } else if (endDateTime.getTime() <= startDateTime.getTime()) {
      toast({
        title: 'Dates invalides',
        description: 'La date/heure de fin doit être postérieure au début.',
        variant: 'destructive',
      })
      return
    }

    const persistedStartTime = allDay ? toAllDayStartIso(startDate) : startDateTime.toISOString()
    const persistedEndTime = allDay ? toAllDayEndIso(endDate) : endDateTime.toISOString()

    try {
      setSubmitLocked(true)
      if (isEditing && event) {
        const parsedOcc = parseOccurrenceId(event.id)
        const targetId = parsedOcc ? parsedOcc.parentId : event.id
        await updateEvent.mutateAsync({
          id: targetId,
          title: title.trim(),
          description: description || null,
          location: encodeLocation(location, locationCoords) || null,
          video_conference_url: videoUrl || null,
          start_time: persistedStartTime,
          end_time: persistedEndTime,
          all_day: allDay,
          color: color,
          category_id: categoryId,
          recurrence_rule: isRecurring ? recurrenceRule : null,
          display_as_banner: displayAsBanner,
          availability: availability,
        })

        // --- Sync attendees (add / remove diff) ---
        const currentByEmail = new Map<string, SelectedAttendee>(
          attendees.map((a) => [a.email.toLowerCase(), a])
        )
        const initialAttendees = eventAttendees ?? []
        const initialByEmail = new Map(initialAttendees.map((a) => [a.email.toLowerCase(), a]))

        const toAdd = attendees.filter((a) => !initialByEmail.has(a.email.toLowerCase()))
        const toRemove = initialAttendees.filter((a) => !currentByEmail.has(a.email.toLowerCase()))

        const addedUserIds: string[] = []
        if (toAdd.length > 0) {
          try {
            const added = await addAttendees.mutateAsync(
              toAdd.map((a) => ({
                event_id: targetId,
                email: a.email,
                display_name: a.displayName,
                user_id: a.userId || undefined,
                role: a.role,
              }))
            )
            for (const row of added) {
              if (row.user_id) addedUserIds.push(row.user_id)
            }
          } catch (err) {
            debug.warn('[EventFormDialog] Add attendees on update failed:', err)
          }
        }

        const removedUserIds: string[] = []
        for (const a of toRemove) {
          try {
            await removeAttendee.mutateAsync({ id: a.id, eventId: targetId })
            if (a.user_id) removedUserIds.push(a.user_id)
          } catch (err) {
            debug.warn('[EventFormDialog] Remove attendee failed:', err)
          }
        }

        // --- Compute changed fields for notification message ---
        const snap = initialSnapshotRef.current
        const changes: string[] = []
        if (snap) {
          if (snap.title !== title.trim()) changes.push('titre')
          if (snap.startIso !== persistedStartTime || snap.endIso !== persistedEndTime) {
            changes.push('date/horaire')
          }
          if ((snap.location || '') !== (encodeLocation(location, locationCoords) || '')) {
            changes.push('lieu')
          }
          if ((snap.videoUrl || '') !== (videoUrl || '')) changes.push('visio')
          if ((snap.description || '') !== (description || '')) changes.push('description')
          if (snap.allDay !== allDay) changes.push('journée entière')
        }

        // --- Notify existing attendees of the modification ---
        try {
          const { supabase } = await import('@/integrations/supabase/client')
          const keptUserIds = initialAttendees
            .filter((a) => currentByEmail.has(a.email.toLowerCase()) && a.user_id)
            .map((a) => a.user_id as string)
          if (changes.length > 0 && keptUserIds.length > 0) {
            await supabase.functions.invoke('notify-event-update', {
              body: {
                event_id: targetId,
                action: 'updated',
                changes,
                target_user_ids: keptUserIds,
              },
            })
          }
          if (addedUserIds.length > 0) {
            await supabase.functions.invoke('notify-event-update', {
              body: { event_id: targetId, action: 'invited', target_user_ids: addedUserIds },
            })
          }
          if (removedUserIds.length > 0) {
            await supabase.functions.invoke('notify-event-update', {
              body: { event_id: targetId, action: 'uninvited', target_user_ids: removedUserIds },
            })
          }
        } catch (notifyErr) {
          debug.warn('[EventFormDialog] notify-event-update failed:', notifyErr)
        }

        toast({ title: 'Événement modifié' })
      } else {
        const newEvent = await createEvent.mutateAsync({
          calendar_id: effectiveCalendarId,
          title: title.trim(),
          description: description || undefined,
          location: encodeLocation(location, locationCoords) || undefined,
          video_conference_url: videoUrl || undefined,
          start_time: persistedStartTime,
          end_time: persistedEndTime,
          all_day: allDay,
          color: color || undefined,
          category_id: categoryId,
          recurrence_rule: isRecurring ? recurrenceRule : undefined,
          display_as_banner: displayAsBanner,
          availability: availability,
        })

        if (selectedReminders.length > 0 && newEvent) {
          try {
            await addReminders.mutateAsync(
              selectedReminders.map((minutes) => ({
                event_id: newEvent.id,
                minutes_before: minutes,
              }))
            )
          } catch (reminderErr) {
            debug.warn('[EventFormDialog] Event created but reminders insert failed:', reminderErr)
          }
        }

        if (attendees.length > 0 && newEvent) {
          try {
            await addAttendees.mutateAsync(
              attendees.map((a) => ({
                event_id: newEvent.id,
                email: a.email,
                display_name: a.displayName,
                user_id: a.userId || undefined,
                role: a.role,
              }))
            )
          } catch (attendeeErr) {
            debug.warn(
              '[EventFormDialog] Batch attendees insert failed, inserting individually:',
              attendeeErr
            )
            for (const a of attendees) {
              try {
                const { error } = await (
                  await import('@/integrations/supabase/client')
                ).supabase
                  .from('event_attendees')
                  .upsert(
                    {
                      event_id: newEvent.id,
                      email: a.email,
                      display_name: a.displayName,
                      user_id: a.userId || null,
                      role: a.role,
                    },
                    { onConflict: 'event_id,email' }
                  )
                  .select()
                if (error) {
                  await (await import('@/integrations/supabase/client')).supabase
                    .from('event_attendees')
                    .upsert(
                      {
                        event_id: newEvent.id,
                        email: a.email,
                        display_name: a.displayName,
                        user_id: null,
                        role: a.role,
                      },
                      { onConflict: 'event_id,email' }
                    )
                }
              } catch {
                debug.warn(`[EventFormDialog] Failed to add attendee ${a.email}`)
              }
            }
          }
        }

        // Notify invited users (creation)
        if (attendees.length > 0 && newEvent) {
          const invitedUserIds = attendees.map((a) => a.userId).filter((id): id is string => !!id)
          if (invitedUserIds.length > 0) {
            try {
              const { supabase } = await import('@/integrations/supabase/client')
              await supabase.functions.invoke('notify-event-update', {
                body: { event_id: newEvent.id, action: 'invited', target_user_ids: invitedUserIds },
              })
            } catch (notifyErr) {
              debug.warn('[EventFormDialog] notify invited failed:', notifyErr)
            }
          }
        }

        toast({ title: 'Événement créé' })
      }

      onOpenChange(false)
    } catch (error) {
      debug.error('[EventFormDialog] Save failed:', error)
      const { sanitizeSupabaseError } = await import('@/lib/supabaseErrorSanitizer')
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    } finally {
      setSubmitLocked(false)
    }
  }

  const isRecurringOccurrence = event && isOccurrenceId(event.id)

  const handleDeleteClick = () => {
    if (!event) return
    if (isRecurringOccurrence) {
      setShowDeleteDialog(true)
    } else {
      handleDeleteSimple()
    }
  }

  const notifyDeletion = async (targetId: string) => {
    const targetUserIds = (eventAttendees ?? [])
      .map((a) => a.user_id)
      .filter((id): id is string => !!id)
    if (targetUserIds.length === 0) return
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      await supabase.functions.invoke('notify-event-update', {
        body: { event_id: targetId, action: 'deleted', target_user_ids: targetUserIds },
      })
    } catch (err) {
      debug.warn('[EventFormDialog] notify deletion failed:', err)
    }
  }

  const handleDeleteSimple = () => {
    if (!event) return
    const parsed = parseOccurrenceId(event.id)
    const idToDelete = parsed ? parsed.parentId : event.id
    // Close dialog immediately to avoid any transient re-render as "create"
    onOpenChange(false)
    // Notify before deletion so attendees are still loaded
    void notifyDeletion(idToDelete)
    // Fire-and-forget: hook's onSuccess/onError shows the toast
    deleteEvent.mutate(idToDelete)
  }

  const handleDeleteSingleOccurrence = () => {
    if (!event) return
    const parsed = parseOccurrenceId(event.id)
    if (!parsed) return
    setShowDeleteDialog(false)
    onOpenChange(false)
    void notifyDeletion(parsed.parentId)
    deleteOccurrence.mutate(parsed)
  }

  const handleDeleteAllOccurrences = () => {
    if (!event) return
    const parsed = parseOccurrenceId(event.id)
    if (!parsed) return
    setShowDeleteDialog(false)
    onOpenChange(false)
    void notifyDeletion(parsed.parentId)
    deleteEvent.mutate(parsed.parentId)
  }

  const toggleReminder = (minutes: number) => {
    setSelectedReminders((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes]
    )
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const isSaving = submitLocked || createEvent.isPending || updateEvent.isPending

  return (
    <TooltipProvider delayDuration={200}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[min(1200px,95vw)] w-[95vw] max-h-[92dvh] sm:max-h-[90vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col"
          aria-describedby="event-form-desc"
          onKeyDown={handleKeyDown}
        >
          {/* Top color band */}
          <div
            className="h-1.5 w-full flex-shrink-0 transition-colors"
            style={{ backgroundColor: headerColor }}
          />

          {/* Header */}
          <div className="px-4 sm:px-6 pt-4 pb-3 border-b flex-shrink-0 bg-gradient-to-br from-primary/[0.08] to-transparent">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base sm:text-lg font-semibold flex items-center gap-2 pr-8">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: headerColor }}
                  aria-hidden
                />
                {isEditing ? "Modifier l'événement" : 'Nouvel événement'}
              </DialogTitle>
              <DialogDescription id="event-form-desc" className="text-xs">
                {isEditing
                  ? 'Mettez à jour les détails et invités de cet événement.'
                  : 'Renseignez les informations de votre nouvel événement.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* CSRF marker — voir src/components/security/CsrfToken.tsx (audit 2026-06-20) */}
          <CsrfToken />

          {/* Scrollable content — native overflow for reliability */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <div className="px-4 sm:px-6 py-4 divide-y divide-border [&>*]:py-3.5 first:[&>*]:pt-0 last:[&>*]:pb-0">
              {/* Hero — Titre + Calendrier + Couleur */}
              <EventFormHero
                titleInputRef={titleInputRef}
                title={title}
                setTitle={setTitle}
                calendars={calendars}
                calendarId={calendarId}
                setCalendarId={setCalendarId}
                color={color}
                setColor={setColor}
                categoryId={categoryId}
                setCategoryId={setCategoryId}
              />

              {/* Date & Heure */}
              <EventFormDateTimeSection
                startDate={startDate}
                setStartDate={setStartDate}
                startTime={startTime}
                setStartTime={setStartTime}
                endDate={endDate}
                setEndDate={setEndDate}
                endTime={endTime}
                setEndTime={setEndTime}
                allDay={allDay}
                setAllDay={setAllDay}
                isRecurring={isRecurring}
                setIsRecurring={setIsRecurring}
                recurrenceRule={recurrenceRule}
                setRecurrenceRule={setRecurrenceRule}
                durationLabel={durationLabel}
                timeOptions={TIME_OPTIONS}
              />

              {/* Affichage & Disponibilité — cards */}
              <EventFormDisplayAvailability
                displayAsBanner={displayAsBanner}
                setDisplayAsBanner={setDisplayAsBanner}
                availability={availability}
                setAvailability={setAvailability}
              />

              {/* Lieu & Visio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    Lieu
                  </Label>
                  <LocationAutocomplete
                    value={{ address: location, coords: locationCoords }}
                    onChange={(v) => {
                      setLocation(v.address)
                      setLocationCoords(v.coords)
                    }}
                    placeholder="Rechercher une adresse…"
                  />
                  {locationCoords && (
                    <div className="space-y-2 pt-1">
                      <LocationMapPreview
                        lat={locationCoords.lat}
                        lng={locationCoords.lng}
                        label={location}
                      />
                      <LocationNavButtons
                        lat={locationCoords.lat}
                        lng={locationCoords.lng}
                        label={location}
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 [&_label]:text-xs [&_label]:text-muted-foreground [&_label]:font-normal [&_label_svg]:h-3.5 [&_label_svg]:w-3.5 [&_label_svg]:text-primary [&>div]:!space-y-1.5 [&_button]:h-9">
                  <VideoConferenceSelector
                    value={videoUrl}
                    onChange={setVideoUrl}
                    eventTitle={title}
                  />
                </div>
              </div>

              {/* Invités */}
              <div className="space-y-3">
                <AttendeesSelector value={attendees} onChange={setAttendees} />
              </div>

              {/* Description + Rappels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Description (collapsible) */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Description
                  </Label>
                  {showDescription || description ? (
                    <Textarea
                      placeholder="Ajouter une description..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="resize-none"
                      autoFocus={showDescription && !description}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowDescription(true)}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline w-fit"
                    >
                      <Plus className="h-3 w-3" />
                      Ajouter une description
                    </button>
                  )}
                </div>

                {/* Rappels */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Bell className="h-3.5 w-3.5 text-primary" />
                    Rappels
                    {selectedReminders.length > 0 && (
                      <span className="text-[10px] text-muted-foreground/70">
                        · {selectedReminders.length}
                      </span>
                    )}
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {REMINDER_OPTIONS.map((opt) => (
                      <Badge
                        key={opt.value}
                        variant={selectedReminders.includes(opt.value) ? 'default' : 'outline'}
                        className="cursor-pointer text-xs select-none"
                        onClick={() => toggleReminder(opt.value)}
                      >
                        {opt.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <EventFormFooter
            isEditing={isEditing}
            isSaving={isSaving}
            onDelete={handleDeleteClick}
            onDuplicate={() => setShowDuplicateDialog(true)}
            onCancel={() => onOpenChange(false)}
            onSubmit={handleSubmit}
          />
        </DialogContent>

        {/* Confirmation dialog for recurring event deletion */}
        <EventDeleteRecurringDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onDeleteSingle={handleDeleteSingleOccurrence}
          onDeleteAll={handleDeleteAllOccurrences}
        />

        {/* Duplicate to multiple dates dialog */}
        {isEditing && event && (
          <DuplicateEventDialog
            event={event}
            open={showDuplicateDialog}
            onOpenChange={setShowDuplicateDialog}
          />
        )}
      </Dialog>
    </TooltipProvider>
  )
}
