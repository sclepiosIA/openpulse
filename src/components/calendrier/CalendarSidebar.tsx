import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Plus,
  ChevronDown,
  Calendar as CalendarIcon,
  Users,
  Building2,
  UserMinus,
  Eye,
  EyeOff,
  Trash2,
  MoreHorizontal,
  CheckSquare,
  Link,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { useCalendars, useCreateCalendar, useDeleteCalendar } from '@/hooks/calendar/useCalendars'
import { useTeamCalendars } from '@/hooks/hr/useTeamCalendars'
import { useMarqueTeamCalendars } from '@/hooks/bookings/useMarqueTeamCalendars'
import { Calendar, CALENDAR_COLORS } from '@/types/calendar'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/shared/use-toast'
import { AvailabilityQuickAdd } from './AvailabilityQuickAdd'
import {
  useCalendarSubscriptions,
  useSyncCalendarSubscription,
  useDeleteCalendarSubscription,
  useToggleSubscriptionActive,
} from '@/hooks/calendar/useCalendarSubscriptions'

interface CalendarSidebarProps {
  selectedCalendarIds: string[]
  onCalendarToggle: (calendarId: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  showEstablishmentTasks?: boolean
  onToggleEstablishmentTasks?: () => void
  establishmentTaskCount?: number
}

const CALENDAR_TYPE_ICONS: Record<string, React.ElementType> = {
  personal: CalendarIcon,
  team: Users,
  establishment: Building2,
  absences: UserMinus,
  shared: Users,
}

const CALENDAR_TYPE_LABELS: Record<string, string> = {
  personal: 'Personnels',
  team: 'Équipe',
  establishment: 'Établissements',
  absences: 'Absences',
  shared: 'Partagés',
}

export function CalendarSidebar({
  selectedCalendarIds,
  onCalendarToggle,
  onSelectAll,
  onDeselectAll,
  showEstablishmentTasks = true,
  onToggleEstablishmentTasks,
  establishmentTaskCount = 0,
}: CalendarSidebarProps) {
  const { toast } = useToast()
  const { data: calendars, isLoading } = useCalendars()
  const { data: teamCalendars } = useTeamCalendars()
  const { data: marqueCalendars } = useMarqueTeamCalendars()
  const { data: subscriptions } = useCalendarSubscriptions()
  const createCalendar = useCreateCalendar()
  const deleteCalendar = useDeleteCalendar()
  const syncSubscription = useSyncCalendarSubscription()
  const deleteSubscription = useDeleteCalendarSubscription()
  const toggleSubscriptionActive = useToggleSubscriptionActive()

  const [calendarToDelete, setCalendarToDelete] = useState<Calendar | null>(null)
  const [syncingSubscriptionId, setSyncingSubscriptionId] = useState<string | null>(null)

  const [expandedTypes, setExpandedTypes] = useState<string[]>([
    'personal',
    'team',
    'tasks',
    'subscriptions',
    'marque',
  ])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newCalendarName, setNewCalendarName] = useState('')
  const [newCalendarColor, setNewCalendarColor] = useState(CALENDAR_COLORS[0])
  const [newCalendarType, setNewCalendarType] = useState<Calendar['type']>('personal')

  // Group calendars by type
  const groupedCalendars =
    calendars?.reduce(
      (acc, calendar) => {
        const type = calendar.type || 'personal'
        if (!acc[type]) acc[type] = []
        acc[type].push(calendar)
        return acc
      },
      {} as Record<string, Calendar[]>
    ) || {}

  const toggleTypeExpanded = (type: string) => {
    setExpandedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const handleCreateCalendar = async () => {
    if (!newCalendarName.trim()) return

    try {
      await createCalendar.mutateAsync({
        name: newCalendarName.trim(),
        color: newCalendarColor,
        type: newCalendarType,
      })

      toast({
        title: 'Calendrier créé',
        description: `"${newCalendarName}" a été créé avec succès`,
      })
      setCreateDialogOpen(false)
      setNewCalendarName('')
      setNewCalendarColor(CALENDAR_COLORS[0])
      setNewCalendarType('personal')
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le calendrier',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteCalendar = async () => {
    if (!calendarToDelete) return

    try {
      await deleteCalendar.mutateAsync(calendarToDelete.id)
      toast({
        title: 'Calendrier supprimé',
        description: `"${calendarToDelete.name}" a été supprimé`,
      })
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le calendrier',
        variant: 'destructive',
      })
    } finally {
      setCalendarToDelete(null)
    }
  }

  const allSelected = calendars?.length === selectedCalendarIds.length

  return (
    <>
      <AlertDialog
        open={!!calendarToDelete}
        onOpenChange={(open) => !open && setCalendarToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le calendrier ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le calendrier "{calendarToDelete?.name}" et tous ses
              événements seront supprimés définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCalendar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clean Calendar Sidebar */}
      <div className="flex flex-col h-full bg-card/95 backdrop-blur-sm rounded-xl border border-border/60 shadow-sm overflow-hidden">
        {/* Create Button */}
        <div className="p-4">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full gap-2 h-10 rounded-lg shadow-sm">
                <Plus className="h-5 w-5" />
                <span>Créer</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau calendrier</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="calendar-name">Nom</Label>
                  <Input
                    id="calendar-name"
                    value={newCalendarName}
                    onChange={(e) => setNewCalendarName(e.target.value)}
                    placeholder="Mon calendrier"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calendar-type">Type</Label>
                  <Select
                    value={newCalendarType}
                    onValueChange={(v) => setNewCalendarType(v as Calendar['type'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Personnel</SelectItem>
                      <SelectItem value="team">Équipe</SelectItem>
                      <SelectItem value="establishment">Établissement</SelectItem>
                      <SelectItem value="absences">Absences</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Couleur</Label>
                  <div className="flex flex-wrap gap-2">
                    {CALENDAR_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Couleur ${color}`}
                        aria-pressed={newCalendarColor === color}
                        title={color}
                        className={cn(
                          'w-6 h-6 rounded transition-all',
                          newCalendarColor === color && 'ring-2 ring-offset-2 ring-primary'
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewCalendarColor(color)}
                      />
                    ))}
                  </div>
                </div>
                <Button
                  onClick={handleCreateCalendar}
                  className="w-full"
                  disabled={!newCalendarName.trim()}
                >
                  Créer le calendrier
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Quick Actions */}
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={allSelected ? onDeselectAll : onSelectAll}
          >
            {allSelected ? (
              <>
                <EyeOff className="h-3 w-3 mr-1" />
                Masquer
              </>
            ) : (
              <>
                <Eye className="h-3 w-3 mr-1" />
                Tout
              </>
            )}
          </Button>
          <AvailabilityQuickAdd />
        </div>

        {/* Calendars List */}
        <ScrollArea className="flex-1">
          <div className="px-3 space-y-1">
            {/* Empty state */}
            {(!calendars || calendars.length === 0) && !isLoading && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarIcon className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">Aucun calendrier</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateDialogOpen(true)}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Créer un calendrier
                </Button>
              </div>
            )}

            {Object.entries(CALENDAR_TYPE_LABELS).map(([type, label]) => {
              const typeCalendars = groupedCalendars[type] || []
              if (typeCalendars.length === 0) return null

              const Icon = CALENDAR_TYPE_ICONS[type] || CalendarIcon
              const isExpanded = expandedTypes.includes(type)
              const selectedCount = typeCalendars.filter((c) =>
                selectedCalendarIds.includes(c.id)
              ).length

              return (
                <Collapsible
                  key={type}
                  open={isExpanded}
                  onOpenChange={() => toggleTypeExpanded(type)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between h-9 px-2 text-sm font-semibold hover:bg-card/60 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'w-6 h-6 rounded-lg flex items-center justify-center transition-all',
                            type === 'personal' && 'bg-primary/15 text-primary',
                            type === 'team' && 'bg-violet-500/15 text-violet-600',
                            type === 'establishment' && 'bg-amber-500/15 text-amber-600',
                            type === 'absences' && 'bg-rose-500/15 text-rose-600',
                            type === 'shared' && 'bg-cyan-500/15 text-cyan-600'
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span>{label}</span>
                        {selectedCount > 0 && (
                          <Badge
                            variant="secondary"
                            className="h-5 text-xs bg-primary/10 text-primary"
                          >
                            {selectedCount}
                          </Badge>
                        )}
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-muted-foreground transition-transform duration-200',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-2 space-y-0.5">
                    {typeCalendars.map((calendar) => {
                      const isSelected = selectedCalendarIds.includes(calendar.id)

                      return (
                        <div
                          key={calendar.id}
                          className="group flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => onCalendarToggle(calendar.id)}
                        >
                          {/* Color dot */}
                          <div
                            className={cn(
                              'w-3 h-3 rounded-full border-2 transition-all flex-shrink-0',
                              isSelected
                                ? 'border-transparent'
                                : 'border-muted-foreground/30 bg-transparent'
                            )}
                            style={{
                              backgroundColor: isSelected ? calendar.color : 'transparent',
                              borderColor: isSelected ? calendar.color : undefined,
                            }}
                          />

                          {/* Checkbox */}
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onCalendarToggle(calendar.id)}
                            // Le nom du calendrier vit dans un <span> frère, non relié :
                            // sans libellé propre, axe remonte `button-name` (critical).
                            aria-label={`Afficher le calendrier ${calendar.name}`}
                            className="h-4 w-4 rounded border-muted-foreground/30 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                            onClick={(e) => e.stopPropagation()}
                          />

                          <span
                            className={cn(
                              'text-sm truncate flex-1',
                              isSelected ? 'font-medium text-foreground' : 'text-muted-foreground'
                            )}
                          >
                            {calendar.name}
                          </span>

                          {calendar.is_default && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-muted/50">
                              Défaut
                            </Badge>
                          )}
                          {!calendar.is_default && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  aria-label="Plus d'options"
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setCalendarToDelete(calendar)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      )
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )
            })}

            {/* Virtual Tasks Calendar Section */}
            {onToggleEstablishmentTasks && (
              <Collapsible
                open={expandedTypes.includes('tasks')}
                onOpenChange={() => toggleTypeExpanded('tasks')}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between h-8 px-2 text-sm font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-muted-foreground" />
                      <span>Tâches</span>
                      {establishmentTaskCount > 0 && (
                        <Badge variant="secondary" className="h-5 text-xs">
                          {establishmentTaskCount}
                        </Badge>
                      )}
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        expandedTypes.includes('tasks') && 'rotate-180'
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-2 space-y-0.5">
                  <div
                    className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={onToggleEstablishmentTasks}
                  >
                    <div
                      className={cn(
                        'w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center transition-all',
                        showEstablishmentTasks
                          ? 'border-transparent bg-gray-500'
                          : 'border-muted-foreground/40'
                      )}
                    >
                      {showEstablishmentTasks && (
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          fill="currentColor"
                          viewBox="0 0 12 12"
                        >
                          <path
                            d="M10 3L4.5 8.5 2 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm truncate flex-1">Tâches établissements</span>
                    {establishmentTaskCount > 0 && (
                      <Badge variant="outline" className="text-[10px] h-4">
                        {establishmentTaskCount}
                      </Badge>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* OpenPulse - Calendriers d'équipe */}
            {marqueCalendars && marqueCalendars.length > 0 && (
              <Collapsible
                open={expandedTypes.includes('marque')}
                onOpenChange={() => toggleTypeExpanded('marque')}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between h-9 px-2 text-sm font-semibold hover:bg-card/60 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-emerald-500/15 text-emerald-600">
                        <Users className="h-3.5 w-3.5" />
                      </div>
                      <span>OpenPulse</span>
                      <Badge
                        variant="secondary"
                        className="h-5 text-xs bg-emerald-500/10 text-emerald-600"
                      >
                        {marqueCalendars.filter((c) => selectedCalendarIds.includes(c.id)).length}
                      </Badge>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform duration-200',
                        expandedTypes.includes('marque') && 'rotate-180'
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-2 space-y-0.5">
                  {marqueCalendars.map((teamCal) => {
                    const isSelected = selectedCalendarIds.includes(teamCal.id)
                    const initials = `${teamCal.owner_profile.prenom?.[0] || ''}${teamCal.owner_profile.nom?.[0] || ''}`
                    return (
                      <div
                        key={teamCal.id}
                        className="group flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => onCalendarToggle(teamCal.id)}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px] bg-emerald-100 text-emerald-700">
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onCalendarToggle(teamCal.id)}
                          aria-label={`Afficher le calendrier de ${teamCal.owner_profile.prenom} ${teamCal.owner_profile.nom}`}
                          className="h-4 w-4 rounded border-muted-foreground/30 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
                          onClick={(e) => e.stopPropagation()}
                        />

                        <span
                          className={cn(
                            'text-sm truncate flex-1',
                            isSelected ? 'font-medium text-foreground' : 'text-muted-foreground'
                          )}
                        >
                          {teamCal.owner_profile.prenom} {teamCal.owner_profile.nom}
                        </span>

                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: teamCal.color }}
                        />
                      </div>
                    )
                  })}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* External Subscriptions */}
            {subscriptions && subscriptions.length > 0 && (
              <Collapsible
                open={expandedTypes.includes('subscriptions')}
                onOpenChange={() => toggleTypeExpanded('subscriptions')}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between h-8 px-2 text-sm font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <Link className="h-4 w-4 text-muted-foreground" />
                      <span>Abonnements</span>
                      <Badge variant="secondary" className="h-5 text-xs">
                        {subscriptions.length}
                      </Badge>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        expandedTypes.includes('subscriptions') && 'rotate-180'
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-2 space-y-0.5">
                  {subscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="group flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50"
                    >
                      <div
                        className={cn(
                          'w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center transition-all cursor-pointer',
                          sub.is_active
                            ? 'border-transparent'
                            : 'border-muted-foreground/40 opacity-50'
                        )}
                        style={{
                          backgroundColor: sub.is_active ? sub.color || '#6B7280' : 'transparent',
                        }}
                        onClick={() =>
                          toggleSubscriptionActive.mutate({ id: sub.id, is_active: !sub.is_active })
                        }
                      >
                        {sub.is_active && (
                          <svg
                            className="w-2.5 h-2.5 text-white"
                            fill="currentColor"
                            viewBox="0 0 12 12"
                          >
                            <path
                              d="M10 3L4.5 8.5 2 6"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                      <span
                        className={cn('text-sm truncate flex-1', !sub.is_active && 'opacity-50')}
                      >
                        {sub.name}
                      </span>

                      {/* Sync button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100"
                        onClick={async () => {
                          setSyncingSubscriptionId(sub.id)
                          try {
                            await syncSubscription.mutateAsync(sub)
                            toast({ title: 'Synchronisation terminée' })
                          } catch {
                            toast({ title: 'Erreur de synchronisation', variant: 'destructive' })
                          } finally {
                            setSyncingSubscriptionId(null)
                          }
                        }}
                        disabled={syncingSubscriptionId === sub.id}
                        aria-label="Chargement"
                      >
                        {syncingSubscriptionId === sub.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>

                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                        onClick={() => deleteSubscription.mutate(sub.id)}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>

                      {sub.last_sync_status && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px] h-4',
                            sub.last_sync_status.startsWith('error') &&
                              'text-destructive border-destructive'
                          )}
                        >
                          {sub.last_sync_status.startsWith('success')
                            ? '✓'
                            : sub.last_sync_status.startsWith('error')
                              ? '!'
                              : '~'}
                        </Badge>
                      )}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  )
}
