import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Menu, Calendar as CalendarIcon, PanelLeftClose, PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs } from '@/components/ui/tabs'
import { CalendarHeaderActions } from '@/components/calendrier/CalendarHeaderActions'
import { CalendarMiniNav } from '@/components/calendrier/CalendarMiniNav'
import {
  CalendarContentToggle,
  ContentFilters,
} from '@/components/calendrier/CalendarContentToggle'
import { TacheDocuments } from '@/components/tasks/TacheDocuments'
import { cn } from '@/lib/utils'
import type { SelectedTacheData } from '@/types/ui-states'

export type CalendarViewKey = 'timeline' | 'month' | 'day' | 'agenda' | 'planning'

interface ViewOption {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface CalendrierHeroProps {
  isMobile: boolean
  isStandaloneMobileApp: boolean
  taskCount: number
  eventCount: number
  absenceCount: number
  hasActiveFilters: boolean
  showFilters: boolean
  displayedTasks: any[]
  currentUserId?: string
  selectedCalendarIds: string[]
  contentFilters: ContentFilters
  establishmentTaskCount: number
  calendars: { id: string }[] | undefined
  onOpenMobileDrawer: () => void
  onCreateEvent: () => void
  onCreateTask: () => void
  onOpenSync: () => void
  onExport: () => void
  onToggleFilters: () => void
  onTaskClick: (t: any) => void
  onCalendarToggle: (id: string) => void
  onSelectAllCalendars: () => void
  onDeselectAllCalendars: () => void
  onToggleEstablishmentTasks: () => void
}

export function CalendrierHero(props: CalendrierHeroProps) {
  const { isMobile, isStandaloneMobileApp, taskCount, eventCount, absenceCount } = props
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-marque-grille',
        'flex-shrink-0',
        isMobile ? 'py-2 px-3' : 'py-3 px-4'
      )}
    >
      {!isMobile && (
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg
            className="absolute bottom-0 left-0 w-full h-12"
            viewBox="0 0 1200 60"
            preserveAspectRatio="none"
          >
            <path
              d="M0,30 C300,60 600,0 900,30 C1050,45 1150,15 1200,30 L1200,60 L0,60 Z"
              fill="white"
              fillOpacity="0.3"
            />
          </svg>
        </div>
      )}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isMobile && !isStandaloneMobileApp && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg bg-card/10 backdrop-blur-sm border border-white/20 text-white hover:bg-card/20 flex-shrink-0"
              onClick={props.onOpenMobileDrawer}
              aria-label="Menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          {!isMobile && (
            <div className="w-10 h-10 rounded-xl bg-card/10 backdrop-blur-sm border border-white/20 flex items-center justify-center flex-shrink-0">
              <CalendarIcon className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className={cn('font-bold text-white truncate', isMobile ? 'text-base' : 'text-lg')}>
              {isMobile ? '📅 Calendrier' : 'Calendrier'}
            </h1>
            {!isMobile && (
              <div className="flex items-center gap-2 text-[10px] text-white/70">
                <span className="tabular-nums">{taskCount} tâches</span>
                <span className="text-emerald-400 tabular-nums">{eventCount} évén.</span>
                <span className="text-amber-400 tabular-nums">{absenceCount} abs.</span>
              </div>
            )}
          </div>
        </div>
        <CalendarHeaderActions
          onCreateEvent={props.onCreateEvent}
          onCreateTask={props.onCreateTask}
          onOpenSync={props.onOpenSync}
          onExport={props.onExport}
          onToggleFilters={props.onToggleFilters}
          showFilters={props.showFilters}
          hasActiveFilters={props.hasActiveFilters}
          filteredTasks={props.displayedTasks}
          currentUserId={props.currentUserId}
          onTaskClick={props.onTaskClick}
          selectedCalendarIds={props.selectedCalendarIds}
          onCalendarToggle={props.onCalendarToggle}
          onSelectAllCalendars={props.onSelectAllCalendars}
          onDeselectAllCalendars={props.onDeselectAllCalendars}
          showEstablishmentTasks={props.contentFilters.showEstablishmentTasks}
          onToggleEstablishmentTasks={props.onToggleEstablishmentTasks}
          establishmentTaskCount={props.establishmentTaskCount}
        />
      </div>
    </div>
  )
}

interface CalendrierControlBarProps {
  isMobile: boolean
  showCalendarSidebar: boolean
  onToggleSidebar: () => void
  currentDate: Date
  onDateChange: (d: Date) => void
  activeView: CalendarViewKey
  onActiveViewChange: (v: CalendarViewKey) => void
  contentFilters: ContentFilters
  onContentFiltersChange: (f: ContentFilters) => void
  taskCount: number
  eventCount: number
  absenceCount: number
  establishmentTaskCount: number
  viewsDesktop: ViewOption[]
  viewsMobile: ViewOption[]
}

export function CalendrierControlBar(props: CalendrierControlBarProps) {
  const { isMobile, activeView, onActiveViewChange } = props
  return (
    <div className="sticky top-0 z-10 px-2 py-1.5 bg-gradient-to-r from-white/80 via-white/90 to-white/80 backdrop-blur-md border-b border-primary/10 flex-shrink-0">
      <div className={cn('flex items-center gap-2', isMobile ? 'flex-col' : 'justify-between')}>
        <div className={cn('flex items-center gap-2 w-full', isMobile ? 'justify-between' : '')}>
          {!isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onToggleSidebar}
              className="hidden lg:flex h-7 w-7 p-0 rounded-lg"
              title={
                props.showCalendarSidebar
                  ? 'Masquer le panneau latéral'
                  : 'Afficher le panneau latéral'
              }
              aria-label={
                props.showCalendarSidebar
                  ? 'Masquer le panneau latéral'
                  : 'Afficher le panneau latéral'
              }
              aria-pressed={props.showCalendarSidebar}
            >
              {props.showCalendarSidebar ? (
                <PanelLeftClose className="h-3.5 w-3.5" />
              ) : (
                <PanelLeft className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          <CalendarMiniNav
            currentDate={props.currentDate}
            onDateChange={props.onDateChange}
            view={activeView}
          />
          {!isMobile && (
            <CalendarContentToggle
              filters={props.contentFilters}
              onChange={props.onContentFiltersChange}
              taskCount={props.taskCount}
              eventCount={props.eventCount}
              absenceCount={props.absenceCount}
              establishmentTaskCount={props.establishmentTaskCount}
            />
          )}
          {!isMobile && (
            <div
              className="ml-auto flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5"
              role="group"
              aria-label="Choisir la vue du calendrier"
            >
              {props.viewsDesktop.map((view) => (
                <Button
                  key={view.value}
                  variant={activeView === view.value ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onActiveViewChange(view.value as CalendarViewKey)}
                  aria-label={`Vue ${view.label}`}
                  aria-pressed={activeView === view.value}
                  title={`Vue ${view.label}`}
                  className={cn(
                    'h-7 px-2 text-xs gap-1 transition-all rounded-md',
                    activeView === view.value && 'shadow-sm'
                  )}
                >
                  <view.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden md:inline">{view.label}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
        {isMobile && (
          <div className="flex items-center justify-between w-full gap-1">
            <CalendarContentToggle
              filters={props.contentFilters}
              onChange={props.onContentFiltersChange}
              taskCount={props.taskCount}
              eventCount={props.eventCount}
              absenceCount={props.absenceCount}
              establishmentTaskCount={props.establishmentTaskCount}
            />
            <div
              className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5"
              role="group"
              aria-label="Choisir la vue du calendrier"
            >
              {props.viewsMobile.map((view) => (
                <Button
                  key={view.value}
                  variant={activeView === view.value ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => onActiveViewChange(view.value as CalendarViewKey)}
                  aria-label={`Vue ${view.label ?? view.value}`}
                  aria-pressed={activeView === view.value}
                  title={`Vue ${view.label ?? view.value}`}
                  className={cn(
                    'h-6 w-6 transition-all rounded-md',
                    activeView === view.value && 'shadow-sm'
                  )}
                >
                  <view.icon className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface TaskDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedTache: SelectedTacheData | null
  onStatusChange: (tacheId: string, status: string) => void
  isPending: boolean
}

const getStatutColor = (statut: string) => {
  switch (statut) {
    case 'Terminé':
      return 'bg-green-500'
    case 'En cours':
      return 'bg-blue-500'
    case 'Bloqué':
      return 'bg-red-500'
    default:
      return 'bg-muted'
  }
}

export function CalendrierTaskDetailsDialog({
  open,
  onOpenChange,
  selectedTache,
  onStatusChange,
  isPending,
}: TaskDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${getStatutColor(selectedTache?.statut || 'A faire')}`}
            />
            {selectedTache?.titre || 'Détails de la tâche'}
          </DialogTitle>
        </DialogHeader>
        {selectedTache && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Statut:</span>
                <Badge className="ml-2" variant="outline">
                  {selectedTache.statut}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Priorité:</span>
                <span className="ml-2">{selectedTache.priorite || 'Moyenne'}</span>
              </div>
              {selectedTache.echeance && (
                <div>
                  <span className="text-muted-foreground">Échéance:</span>
                  <span className="ml-2">
                    {format(parseISO(selectedTache.echeance), 'dd MMMM yyyy', { locale: fr })}
                  </span>
                </div>
              )}
              {(selectedTache as { etablissements?: { nom?: string } })?.etablissements?.nom && (
                <div>
                  <span className="text-muted-foreground">Établissement:</span>
                  <span className="ml-2">
                    {(selectedTache as { etablissements?: { nom?: string } }).etablissements?.nom}
                  </span>
                </div>
              )}
            </div>
            {selectedTache.description && (
              <div>
                <span className="text-muted-foreground text-sm">Description:</span>
                <p className="mt-1">{selectedTache.description}</p>
              </div>
            )}
            <Separator />
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2">Changer le statut:</span>
              {['A faire', 'En cours', 'Bloqué', 'Terminé'].map((status) => (
                <Button
                  key={status}
                  variant={selectedTache.statut === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onStatusChange(selectedTache.id, status)}
                  disabled={isPending}
                >
                  {status}
                </Button>
              ))}
            </div>
            <TacheDocuments tacheId={selectedTache.id} tacheTitre={selectedTache.titre} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
