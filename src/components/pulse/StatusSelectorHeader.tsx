import { useState, useEffect, useCallback, useRef } from 'react'
import { Check, ChevronDown, Calendar, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { type PresenceStatus, PRESENCE_STATUS_CONFIG } from '@/types/pulse'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { useCalendarPresence } from '@/hooks/calendar/useCalendarPresence'
import { fetchLatestPresence, upsertGlobalPresence } from '@/services/pulse/presenceService'
interface UserPresenceState {
  status: PresenceStatus
  customStatus: string | null
  customStatusEmoji: string | null
  calendarEventTitle: string | null
  isAutomatic: boolean
}

const MANUAL_STATUSES: PresenceStatus[] = ['active', 'away', 'busy', 'dnd']

const EXPIRATION_OPTIONS = [
  { value: 0, label: 'Ne pas effacer' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 heure' },
  { value: 240, label: '4 heures' },
  { value: 480, label: "Aujourd'hui" },
]

/**
 * Version du StatusSelector adaptée pour le header bleu foncé de Pulse
 * Utilise des styles blanc/transparent au lieu des couleurs par défaut
 */
export function StatusSelectorHeader() {
  const { data: currentProfile } = useCurrentProfile()
  const [presenceState, setPresenceState] = useState<UserPresenceState>({
    status: 'active',
    customStatus: null,
    customStatusEmoji: null,
    calendarEventTitle: null,
    isAutomatic: false,
  })
  const [showCustomDialog, setShowCustomDialog] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<PresenceStatus>('active')
  const [customText, setCustomText] = useState('')
  const [expiresIn, setExpiresIn] = useState<number>(0)
  const calendarUpdateVersionRef = useRef(0)

  // Charger l'état de présence initial sans écraser une transition calendrier plus récente.
  useEffect(() => {
    const profileId = currentProfile?.id
    if (!profileId) return

    let cancelled = false
    const calendarVersionAtStart = calendarUpdateVersionRef.current
    const loadPresence = async () => {
      const data = await fetchLatestPresence(profileId)
      if (data && !cancelled && calendarUpdateVersionRef.current === calendarVersionAtStart) {
        setPresenceState({
          status: data.status as PresenceStatus,
          customStatus: data.custom_status,
          customStatusEmoji: data.custom_status_emoji,
          calendarEventTitle: null,
          isAutomatic: data.auto_status || false,
        })
      }
    }

    void loadPresence()
    return () => {
      cancelled = true
    }
  }, [currentProfile?.id])

  // Gestion automatique du statut via calendrier
  const handleCalendarStatusChange = useCallback(
    (status: PresenceStatus, isAutomatic: boolean, event?: { title: string } | null) => {
      calendarUpdateVersionRef.current += 1
      setPresenceState((prev) => ({
        ...prev,
        status,
        isAutomatic,
        calendarEventTitle: event?.title || null,
      }))

      if (currentProfile?.id) {
        void upsertGlobalPresence({
          userId: currentProfile.id,
          status,
          customStatus: isAutomatic ? event?.title || 'En réunion' : null,
          autoStatus: isAutomatic,
        })
      }
    },
    [currentProfile?.id]
  )

  useCalendarPresence({
    enabled: true,
    onStatusChange: handleCalendarStatusChange,
  })

  // Changer le statut manuellement
  const handleStatusChange = async (
    status: PresenceStatus,
    customText?: string,
    expiresInMinutes?: number
  ) => {
    if (!currentProfile?.id) return

    const expiresAt =
      expiresInMinutes && expiresInMinutes > 0
        ? new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString()
        : null

    setPresenceState({
      status,
      customStatus: customText || null,
      customStatusEmoji: null,
      calendarEventTitle: null,
      isAutomatic: false,
    })

    await upsertGlobalPresence({
      userId: currentProfile.id,
      status,
      customStatus: customText || null,
      statusExpiresAt: expiresAt,
      autoStatus: false,
    })
  }

  const handleQuickStatusChange = (status: PresenceStatus) => {
    handleStatusChange(status)
  }

  const handleCustomStatusSubmit = () => {
    handleStatusChange(selectedStatus, customText || undefined, expiresIn || undefined)
    setShowCustomDialog(false)
    setCustomText('')
    setExpiresIn(0)
  }

  const openCustomDialog = (status: PresenceStatus) => {
    setSelectedStatus(status)
    setShowCustomDialog(true)
  }

  const currentConfig = PRESENCE_STATUS_CONFIG[presenceState.status]

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 px-2.5 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', currentConfig.bgColor)}
              />
              <span className="text-xs font-medium truncate max-w-[80px] hidden sm:inline">
                {presenceState.isAutomatic && presenceState.status === 'in_meeting'
                  ? presenceState.calendarEventTitle || currentConfig.label
                  : presenceState.customStatus || currentConfig.label}
              </span>
              {presenceState.isAutomatic && (
                <Calendar className="h-3 w-3 text-white/60 flex-shrink-0 hidden sm:block" />
              )}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-white/70 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* Statuts rapides */}
          {MANUAL_STATUSES.map((status) => {
            const config = PRESENCE_STATUS_CONFIG[status]
            const isSelected = presenceState.status === status && !presenceState.isAutomatic

            return (
              <DropdownMenuItem
                key={status}
                onClick={() => handleQuickStatusChange(status)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', config.bgColor)} />
                  <div>
                    <span className="font-medium">{config.label}</span>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                </div>
                {isSelected && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            )
          })}

          <DropdownMenuSeparator />

          {/* Statut en réunion (si automatique) */}
          {presenceState.status === 'in_meeting' && presenceState.isAutomatic && (
            <>
              <DropdownMenuItem disabled className="flex items-center gap-2 opacity-75">
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    PRESENCE_STATUS_CONFIG.in_meeting.bgColor
                  )}
                />
                <div>
                  <span className="font-medium">En réunion (auto)</span>
                  {presenceState.calendarEventTitle && (
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {presenceState.calendarEventTitle}
                    </p>
                  )}
                </div>
                <Calendar className="h-4 w-4 ml-auto" />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Définir un statut personnalisé */}
          <DropdownMenuItem
            onClick={() =>
              openCustomDialog(
                presenceState.status === 'in_meeting' ? 'active' : presenceState.status
              )
            }
          >
            <Clock className="h-4 w-4 mr-2" />
            Définir un statut personnalisé
          </DropdownMenuItem>

          {/* Effacer le statut personnalisé */}
          {presenceState.customStatus && (
            <DropdownMenuItem
              onClick={() => handleStatusChange('active')}
              className="text-muted-foreground"
            >
              Effacer le statut
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog pour statut personnalisé */}
      <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Définir votre statut</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Sélection du statut */}
            <div className="space-y-2">
              <Label>Statut</Label>
              <div className="flex flex-wrap gap-2">
                {MANUAL_STATUSES.map((status) => {
                  const config = PRESENCE_STATUS_CONFIG[status]
                  const isSelected = selectedStatus === status

                  return (
                    <button
                      key={status}
                      onClick={() => setSelectedStatus(status)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent bg-muted hover:bg-muted/80'
                      )}
                    >
                      <span className={cn('h-2.5 w-2.5 rounded-full', config.bgColor)} />
                      <span className="text-sm font-medium">{config.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Message personnalisé */}
            <div className="space-y-2">
              <Label htmlFor="custom-status">Message (optionnel)</Label>
              <Input
                id="custom-status"
                placeholder="Ex: En pause déjeuner, De retour à 14h..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                maxLength={50}
              />
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <Label>Effacer après</Label>
              <Select
                value={expiresIn.toString()}
                onValueChange={(val) => setExpiresIn(parseInt(val))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCustomStatusSubmit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
