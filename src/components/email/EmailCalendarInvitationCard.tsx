import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Clock,
  Users,
  CalendarPlus,
  Download,
  Check,
  X,
  Loader2,
  MapPin,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/shared/use-toast'
import { useAcceptVisioToCalendar } from '@/hooks/bookings/useAcceptVisioToCalendar'
import { downloadEventICS } from '@/lib/calendarUtils'
import { useMessageAttachments } from '@/hooks/email/useThreadImages'
import { parseICSClient } from '@/lib/icsParserClient'
import { debug } from '@/lib/debug'
import {
  detectCalendarInvitation,
  hasVisioLink,
  extractDateFromEmail,
  extractAttendees,
  extractLocation,
  cleanSubjectForDisplay,
} from './calendarInvitationParser'
import { fetchSiblingMessagesForInvitation } from '@/services/email/emailContextQueries'

interface EmailCalendarInvitationCardProps {
  messageId: string
  threadId?: string
  bodyHtml?: string | null
  bodyText?: string | null
  subject?: string
  fromAddress?: string
  fromName?: string
}

export function EmailCalendarInvitationCard({
  messageId,
  threadId,
  bodyHtml,
  bodyText,
  subject,
  fromAddress,
  fromName,
}: EmailCalendarInvitationCardProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [isIgnored, setIsIgnored] = useState(false)
  const [manualStartTime, setManualStartTime] = useState<string>('')
  const [manualDuration, setManualDuration] = useState<number>(60)
  const [icsDateInfo, setIcsDateInfo] = useState<{
    start: Date
    end?: Date
    summary?: string
    location?: string
  } | null>(null)
  const [icsLoading, setIcsLoading] = useState(false)
  const [threadFallbackDate, setThreadFallbackDate] = useState<{ start: Date; end?: Date } | null>(
    null
  )
  const { toast } = useToast()

  const acceptVisio = useAcceptVisioToCalendar()
  const { attachments } = useMessageAttachments(messageId)

  // Ne pas afficher si c'est une visio (EmailVisioInvitationCard s'en charge)
  const isVisio = hasVisioLink(bodyHtml, bodyText)
  const isCalendarInvite = detectCalendarInvitation(subject, bodyHtml, bodyText)

  // Regex date from current message
  const regexDateInfo = useMemo(
    () => extractDateFromEmail(subject, bodyText, bodyHtml),
    [subject, bodyText, bodyHtml]
  )

  // ICS parsing from attachments (same pattern as EmailVisioInvitationCard)
  useEffect(() => {
    const icsAttachment = attachments.find(
      (att) =>
        att.mime_type === 'text/calendar' ||
        att.mime_type === 'application/ics' ||
        att.filename?.toLowerCase().endsWith('.ics')
    )

    if (icsAttachment?.url && !icsDateInfo && !icsLoading) {
      setIcsLoading(true)
      fetch(icsAttachment.url)
        .then((res) => res.text())
        .then((content) => {
          debug.log(
            '[EmailCalendarInvitationCard] Parsing ICS from attachment:',
            icsAttachment.filename
          )
          const events = parseICSClient(content)
          if (events.length > 0 && events[0].dtstart) {
            const event = events[0]
            setIcsDateInfo({
              start: new Date(event.dtstart),
              end: event.dtend ? new Date(event.dtend) : undefined,
              summary: event.summary,
              location: event.location,
            })
          }
        })
        .catch((err) => {
          debug.error('[EmailCalendarInvitationCard] Error parsing ICS:', err)
        })
        .finally(() => {
          setIcsLoading(false)
        })
    }
  }, [attachments, icsDateInfo, icsLoading])

  // Thread fallback: if no ICS and no regex date, search other messages in the thread
  useEffect(() => {
    if (icsDateInfo || regexDateInfo || threadFallbackDate || !threadId) return

    const fetchThreadMessages = async () => {
      const messages = await fetchSiblingMessagesForInvitation(threadId, messageId, { limit: 10 })
      if (!messages.length) return

      for (const msg of messages) {
        const found = extractDateFromEmail(msg.subject, msg.body_text, msg.body_html)
        if (found) {
          setThreadFallbackDate(found)
          return
        }
      }
    }

    fetchThreadMessages()
  }, [icsDateInfo, regexDateInfo, threadFallbackDate, threadId, messageId])

  // Priority: ICS > regex body > thread fallback
  const dateInfo: { start: Date; end?: Date; allDay?: boolean } | null = icsDateInfo
    ? { start: icsDateInfo.start, end: icsDateInfo.end, allDay: false }
    : regexDateInfo || threadFallbackDate || null

  const attendees = extractAttendees(bodyText)
  const location = icsDateInfo?.location || extractLocation(bodyText, bodyHtml)

  // Determine if we have an ICS attachment
  const hasIcsAttachment = attachments.some(
    (att) =>
      att.mime_type === 'text/calendar' ||
      att.mime_type === 'application/ics' ||
      att.filename?.toLowerCase().endsWith('.ics')
  )

  // GUARD: Don't show if visio, not a calendar invite, ignored,
  // OR if body is empty and no ICS and no date found (false positive)
  const htmlStripped = (bodyHtml || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()
  const textStripped = (bodyText || '').trim()
  const isBodyEmpty = !htmlStripped && !textStripped
  const hasNoDateInfo = !dateInfo && !icsLoading

  if (isVisio || !isCalendarInvite || isIgnored) return null
  if (isBodyEmpty && !hasIcsAttachment && hasNoDateInfo) return null

  const hasAutoDate = !!dateInfo
  const startTime = dateInfo?.start || (manualStartTime ? new Date(manualStartTime) : null)
  const endTime =
    dateInfo?.end || (startTime ? new Date(startTime.getTime() + manualDuration * 60 * 1000) : null)
  const isAllDay = dateInfo?.allDay || false

  const canAccept = startTime && endTime && startTime > new Date(Date.now() - 24 * 60 * 60 * 1000)

  const handleAccept = async () => {
    if (!startTime || !endTime) {
      toast({
        title: 'Date requise',
        description: "Veuillez saisir la date de l'événement",
        variant: 'destructive',
      })
      return
    }

    await acceptVisio.mutateAsync({
      messageId,
      threadId,
      subject: subject || 'Événement calendrier',
      visioLink: '', // Pas de lien visio
      visioProvider: 'Présentiel',
      startTime,
      endTime,
      attendees,
      fromAddress,
    })
    setShowDialog(false)
  }

  const handleDownloadICS = () => {
    if (!startTime || !endTime) {
      toast({
        title: 'Date requise',
        description: "Sélectionnez d'abord une date pour télécharger le fichier .ics",
        variant: 'destructive',
      })
      return
    }

    downloadEventICS({
      id: messageId,
      title: subject || 'Événement calendrier',
      description: `${location ? `Lieu: ${location}\n\n` : ''}Participants:\n${attendees.map((a) => `• ${a.email}`).join('\n')}\n\nOrganisateur: ${fromName || fromAddress || 'Non spécifié'}`,
      start: startTime,
      end: endTime,
      location: location || undefined,
      organizer: fromAddress ? { name: fromName || fromAddress, email: fromAddress } : undefined,
      attendees,
    })

    toast({
      title: 'Fichier .ics téléchargé',
      description: 'Importez-le dans votre calendrier préféré',
    })
  }

  const handleIgnore = () => {
    setIsIgnored(true)
    toast({
      title: 'Invitation ignorée',
      description: 'Cette invitation ne sera plus affichée',
    })
  }

  return (
    <>
      <Card className="border-2 border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-blue-500/10 mb-4 shadow-sm">
        <CardContent className="py-4">
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-blue-500 shadow-sm">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">Invitation calendrier</span>
                    {isAllDay && (
                      <Badge variant="secondary" className="text-xs">
                        Journée entière
                      </Badge>
                    )}
                  </div>
                  {dateInfo && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <Calendar className="h-3.5 w-3.5 inline mr-1" />
                      {isAllDay
                        ? format(dateInfo.start, 'EEEE d MMMM yyyy', { locale: fr })
                        : format(dateInfo.start, 'EEEE d MMMM à HH:mm', { locale: fr })}
                      {!isAllDay && dateInfo.end && (
                        <span className="ml-2">
                          <Clock className="h-3.5 w-3.5 inline mr-1" />
                          {Math.round(
                            (dateInfo.end.getTime() - dateInfo.start.getTime()) / 60000
                          )}{' '}
                          min
                        </span>
                      )}
                    </p>
                  )}
                  {location && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <MapPin className="h-3.5 w-3.5 inline mr-1" />
                      {location}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Participants */}
            {attendees.length > 0 && (
              <div className="flex items-center gap-2 bg-background/50 rounded-lg px-3 py-2">
                <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  {attendees.length} participant{attendees.length > 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-2" onClick={() => setShowDialog(true)}>
                <CalendarPlus className="h-4 w-4" />
                Ajouter à mon agenda
              </Button>

              <Button variant="outline" size="sm" onClick={handleIgnore} className="gap-2">
                <X className="h-4 w-4" />
                Ignorer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter à votre agenda</DialogTitle>
            <DialogDescription>{cleanSubjectForDisplay(subject)}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Date info */}
            {hasAutoDate ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Date détectée:</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="font-medium">
                    {isAllDay
                      ? format(dateInfo!.start, 'EEEE d MMMM yyyy', { locale: fr })
                      : format(dateInfo!.start, 'EEEE d MMMM yyyy à HH:mm', { locale: fr })}
                  </p>
                  {!isAllDay && dateInfo?.end && (
                    <p className="text-sm text-muted-foreground">
                      jusqu'à {format(dateInfo.end, 'HH:mm', { locale: fr })}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Date et heure de début
                </label>
                <input
                  type="datetime-local"
                  value={manualStartTime}
                  onChange={(e) => setManualStartTime(e.target.value)}
                  className="w-full p-2 rounded-md border bg-background"
                />

                <label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Durée (minutes)
                </label>
                <select
                  value={manualDuration}
                  onChange={(e) => setManualDuration(parseInt(e.target.value))}
                  className="w-full p-2 rounded-md border bg-background"
                >
                  <option value={30}>30 min</option>
                  <option value={60}>1 heure</option>
                  <option value={90}>1h30</option>
                  <option value={120}>2 heures</option>
                  <option value={180}>3 heures</option>
                </select>
              </div>
            )}

            {/* Location */}
            {location && (
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{location}</span>
              </div>
            )}

            {/* Participants */}
            {attendees.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Participants ({attendees.length})
                </div>
                <div className="text-sm text-muted-foreground max-h-24 overflow-y-auto">
                  {attendees.map((a, i) => (
                    <div key={`att-${a.email ?? i}`} className="truncate">
                      {a.email}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadICS}
              className="gap-2 w-full sm:w-auto"
              disabled={!canAccept}
            >
              <Download className="h-4 w-4" />
              Fichier .ics
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!canAccept || acceptVisio.isPending}
              className="gap-2 w-full sm:w-auto"
            >
              {acceptVisio.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ajout...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Ajouter au calendrier
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
