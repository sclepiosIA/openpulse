import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { debug } from '@/lib/debug'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  Upload,
  FileUp,
  Link,
  Calendar,
  AlertTriangle,
  Check,
  X,
  RefreshCw,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCalendars } from '@/hooks/calendar/useCalendars'
import { useToast } from '@/hooks/shared/use-toast'
import {
  fetchExistingEventKeys,
  importIcsEvents,
  createCalendarSubscription,
  syncCalendarSubscription,
} from '@/services/calendrier/calendarImport'
import { cn } from '@/lib/utils'
import { format, parseISO, isAfter } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuth } from '@/components/AuthProvider'

interface CalendarImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ParsedEvent {
  uid: string
  summary: string
  dtstart: string
  dtend?: string
  location?: string
  description?: string
  isDuplicate?: boolean
}

export function CalendarImportDialog({ open, onOpenChange }: CalendarImportDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: calendars } = useCalendars()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'file' | 'subscription'>('file')

  // File import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('')
  const [futureOnly, setFutureOnly] = useState(true)
  const [parsedEvents, setParsedEvents] = useState<ParsedEvent[]>([])
  const [isParsingFile, setIsParsingFile] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [duplicateCount, setDuplicateCount] = useState(0)

  // Subscription state
  const [subscriptionUrl, setSubscriptionUrl] = useState('')
  const [subscriptionName, setSubscriptionName] = useState('')
  const [subscriptionCalendarId, setSubscriptionCalendarId] = useState<string>('')
  const [syncFrequency, setSyncFrequency] = useState<'hourly' | 'daily'>('daily')
  const [isSubscribing, setIsSubscribing] = useState(false)

  // Set default calendar when calendars load
  if (calendars?.length && !selectedCalendarId) {
    const defaultCal = calendars.find((c) => c.is_default) || calendars[0]
    setSelectedCalendarId(defaultCal.id)
    setSubscriptionCalendarId(defaultCal.id)
  }

  const handleFileSelect = useCallback(
    async (file: File) => {
      setSelectedFile(file)
      setIsParsingFile(true)
      setParsedEvents([])
      setDuplicateCount(0)

      try {
        const content = await file.text()

        // Parse ICS on client side for preview
        const events = parseICSClient(content)

        // Filter future events if needed
        const now = new Date()
        let filteredEvents = futureOnly
          ? events.filter((e) => {
              try {
                return isAfter(parseISO(e.dtstart), now)
              } catch {
                return true
              }
            })
          : events

        // Check for duplicates if calendar is selected
        if (selectedCalendarId) {
          const existingSet = await fetchExistingEventKeys(selectedCalendarId)

          let dupes = 0
          filteredEvents = filteredEvents.map((event) => {
            const key = `${event.summary}|${event.dtstart}`
            const isDuplicate = existingSet.has(key)
            if (isDuplicate) dupes++
            return { ...event, isDuplicate }
          })
          setDuplicateCount(dupes)
        }

        setParsedEvents(filteredEvents)
      } catch (error) {
        debug.error('Error parsing ICS:', error)
        toast({
          title: 'Erreur de lecture',
          description: 'Impossible de lire le fichier ICS',
          variant: 'destructive',
        })
      } finally {
        setIsParsingFile(false)
      }
    },
    [futureOnly, selectedCalendarId, toast]
  )

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && file.name.endsWith('.ics')) {
        handleFileSelect(file)
      } else {
        toast({
          title: 'Format invalide',
          description: 'Veuillez sélectionner un fichier .ics',
          variant: 'destructive',
        })
      }
    },
    [handleFileSelect, toast]
  )

  const handleImport = async () => {
    if (!selectedFile || !selectedCalendarId) return

    setIsImporting(true)
    try {
      const content = await selectedFile.text()

      const data = await importIcsEvents({
        icsContent: content,
        calendarId: selectedCalendarId,
        minDate: futureOnly ? new Date().toISOString() : undefined,
      })

      const imported = Number(data?.imported ?? 0)
      const skipped = Number(data?.skipped ?? 0)

      if (imported === 0) {
        toast({
          title: 'Aucun événement importé',
          description:
            skipped > 0
              ? `${skipped} événement(s) déjà présent(s) dans ce calendrier — rien de nouveau à importer.`
              : 'Le fichier ICS ne contenait aucun événement à venir. Décochez "Événements futurs uniquement" pour inclure les événements passés.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Import réussi',
          description: `${imported} événement(s) importé(s)${skipped ? `, ${skipped} ignoré(s)` : ''}`,
        })
        // Ensure the calendar view reflects the new events without a hard refresh
        await queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      }

      onOpenChange(false)
      resetState()
    } catch (error) {
      debug.error('Import error:', error)
      toast({
        title: "Erreur d'import",
        description: "Une erreur est survenue lors de l'import",
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleSubscribe = async () => {
    if (!subscriptionUrl || !subscriptionName || !subscriptionCalendarId) return

    setIsSubscribing(true)
    try {
      if (!user) throw new Error('Non authentifié')

      // Create subscription record
      await createCalendarSubscription({
        userId: user.id,
        calendarId: subscriptionCalendarId,
        name: subscriptionName,
        url: subscriptionUrl,
        syncFrequency,
      })

      // Trigger initial sync
      const { error: syncError } = await syncCalendarSubscription({
        subscriptionUrl,
        calendarId: subscriptionCalendarId,
      })

      if (syncError) {
        debug.warn('Initial sync failed:', syncError)
      }

      toast({
        title: 'Abonnement créé',
        description: `Le calendrier "${subscriptionName}" sera synchronisé ${syncFrequency === 'hourly' ? 'toutes les heures' : 'quotidiennement'}`,
      })

      onOpenChange(false)
      resetState()
    } catch (error) {
      debug.error('Subscription error:', error)
      toast({
        title: "Erreur d'abonnement",
        description: "Impossible de créer l'abonnement",
        variant: 'destructive',
      })
    } finally {
      setIsSubscribing(false)
    }
  }

  const resetState = () => {
    setSelectedFile(null)
    setParsedEvents([])
    setDuplicateCount(0)
    setSubscriptionUrl('')
    setSubscriptionName('')
    setSyncFrequency('daily')
  }

  const importableCount = parsedEvents.filter((e) => !e.isDuplicate).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Importer un calendrier
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'file' | 'subscription')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file" className="gap-2">
              <FileUp className="h-4 w-4" />
              Import fichier
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2">
              <Link className="h-4 w-4" />
              Abonnement URL
            </TabsTrigger>
          </TabsList>

          {/* File Import Tab */}
          <TabsContent value="file" className="space-y-4 mt-4">
            {/* Drop zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                'hover:border-primary hover:bg-primary/5',
                selectedFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
              )}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <Check className="h-5 w-5 text-primary" />
                  <span className="font-medium">{selectedFile.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setSelectedFile(null)
                      setParsedEvents([])
                    }}
                    aria-label="Fermer"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Glissez un fichier .ics ici ou</p>
                  <label>
                    <input
                      type="file"
                      accept=".ics"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileSelect(file)
                      }}
                    />
                    <Button variant="outline" size="sm" asChild>
                      <span className="cursor-pointer">Parcourir...</span>
                    </Button>
                  </label>
                </div>
              )}
            </div>

            {/* Calendar selection */}
            <div className="space-y-2">
              <Label>Calendrier cible</Label>
              <Select value={selectedCalendarId} onValueChange={setSelectedCalendarId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un calendrier" />
                </SelectTrigger>
                <SelectContent>
                  {calendars?.map((cal) => (
                    <SelectItem key={cal.id} value={cal.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cal.color }}
                        />
                        {cal.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Future only checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="future-only"
                checked={futureOnly}
                onCheckedChange={(checked) => {
                  setFutureOnly(checked as boolean)
                  if (selectedFile) handleFileSelect(selectedFile)
                }}
              />
              <Label htmlFor="future-only" className="text-sm font-normal cursor-pointer">
                N'importer que les événements futurs
              </Label>
            </div>

            {/* Events preview */}
            {isParsingFile && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {parsedEvents.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">
                    Prévisualisation ({parsedEvents.length} événement
                    {parsedEvents.length > 1 ? 's' : ''})
                  </Label>
                  {duplicateCount > 0 && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {duplicateCount} doublon{duplicateCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <ScrollArea className="h-[200px] border rounded-md">
                  <div className="p-2 space-y-1">
                    {parsedEvents.slice(0, 50).map((event, idx) => (
                      <div
                        key={event.uid || idx}
                        className={cn(
                          'text-sm p-2 rounded flex items-center gap-2',
                          event.isDuplicate
                            ? 'bg-muted/50 text-muted-foreground line-through'
                            : 'bg-muted/30'
                        )}
                      >
                        <span className="truncate flex-1 min-w-0">{event.summary}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {formatEventDate(event.dtstart)}
                        </span>
                      </div>
                    ))}
                    {parsedEvents.length > 50 && (
                      <div className="text-xs text-muted-foreground text-center py-2">
                        ... et {parsedEvents.length - 50} autres
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Import button */}
            <div className="flex justify-end gap-2 pt-2 flex-shrink-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleImport}
                disabled={
                  !selectedFile || !selectedCalendarId || importableCount === 0 || isImporting
                }
                className="min-w-[120px]"
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Importer {importableCount > 0 ? importableCount : ''}
              </Button>
            </div>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>URL du calendrier (iCal)</Label>
              <Input
                placeholder="https://calendar.google.com/calendar/ical/..."
                value={subscriptionUrl}
                onChange={(e) => setSubscriptionUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                URL iCal publique (Google Calendar, Outlook, Apple Calendar, etc.)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Nom de l'abonnement</Label>
              <Input
                placeholder="Mon agenda externe"
                value={subscriptionName}
                onChange={(e) => setSubscriptionName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Calendrier cible</Label>
              <Select value={subscriptionCalendarId} onValueChange={setSubscriptionCalendarId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un calendrier" />
                </SelectTrigger>
                <SelectContent>
                  {calendars?.map((cal) => (
                    <SelectItem key={cal.id} value={cal.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cal.color }}
                        />
                        {cal.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fréquence de synchronisation</Label>
              <Select
                value={syncFrequency}
                onValueChange={(v) => setSyncFrequency(v as 'hourly' | 'daily')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Toutes les heures
                    </div>
                  </SelectItem>
                  <SelectItem value="daily">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Une fois par jour
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSubscribe}
                disabled={
                  !subscriptionUrl || !subscriptionName || !subscriptionCalendarId || isSubscribing
                }
              >
                {isSubscribing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link className="h-4 w-4 mr-2" />
                )}
                S'abonner
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// Client-side ICS parser for preview
function parseICSClient(content: string): ParsedEvent[] {
  const events: ParsedEvent[] = []
  const lines = content.split(/\r?\n/)
  let currentEvent: Partial<ParsedEvent> | null = null
  const currentKey = ''
  const currentValue = ''

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Handle line continuations
    while (
      i + 1 < lines.length &&
      (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))
    ) {
      i++
      line += lines[i].substring(1)
    }

    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {}
    } else if (line.startsWith('END:VEVENT') && currentEvent) {
      if (currentEvent.summary && currentEvent.dtstart) {
        events.push(currentEvent as ParsedEvent)
      }
      currentEvent = null
    } else if (currentEvent) {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const keyPart = line.substring(0, colonIndex)
        const value = line.substring(colonIndex + 1)
        const key = keyPart.split(';')[0]

        switch (key) {
          case 'UID':
            currentEvent.uid = value
            break
          case 'SUMMARY':
            currentEvent.summary = decodeICSValue(value)
            break
          case 'DTSTART':
            currentEvent.dtstart = parseICSDate(value)
            break
          case 'DTEND':
            currentEvent.dtend = parseICSDate(value)
            break
          case 'LOCATION':
            currentEvent.location = decodeICSValue(value)
            break
          case 'DESCRIPTION':
            currentEvent.description = decodeICSValue(value)
            break
        }
      }
    }
  }

  return events
}

function parseICSDate(value: string): string {
  // Handle YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS or YYYYMMDD
  const clean = value.replace(/[^0-9TZ]/g, '')

  if (clean.length >= 15) {
    // YYYYMMDDTHHMMSS(Z)
    const year = clean.substring(0, 4)
    const month = clean.substring(4, 6)
    const day = clean.substring(6, 8)
    const hour = clean.substring(9, 11)
    const minute = clean.substring(11, 13)
    const second = clean.substring(13, 15)
    const isUTC = clean.endsWith('Z')
    return `${year}-${month}-${day}T${hour}:${minute}:${second}${isUTC ? 'Z' : ''}`
  } else if (clean.length >= 8) {
    // YYYYMMDD (all-day)
    const year = clean.substring(0, 4)
    const month = clean.substring(4, 6)
    const day = clean.substring(6, 8)
    return `${year}-${month}-${day}T00:00:00`
  }

  return value
}

function decodeICSValue(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

function formatEventDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    return format(date, 'd MMM HH:mm', { locale: fr })
  } catch {
    return dateStr
  }
}
