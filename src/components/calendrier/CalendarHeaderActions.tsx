import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Plus,
  CalendarPlus,
  ListPlus,
  MoreHorizontal,
  Wifi,
  Download,
  Filter,
  X,
  Keyboard,
  Upload,
  Search,
  SlidersHorizontal,
  Building2,
} from 'lucide-react'
import { Tag } from 'lucide-react'
import { CalendarNotifications } from './CalendarNotifications'
import { CalendarSidebar } from './CalendarSidebar'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CALENDAR_SHORTCUTS } from '@/hooks/calendar/useCalendarKeyboard'
import { FindAvailableSlot } from './FindAvailableSlot'
import { CalendarImportDialog } from './CalendarImportDialog'
import { CategoryManagerButton } from './CategoryManagerButton'
import { useIsMobile } from '@/hooks/ui/use-mobile'

interface CalendarHeaderActionsProps {
  onCreateEvent: () => void
  onCreateTask: () => void
  onOpenSync: () => void
  onExport: () => void
  onToggleFilters: () => void
  showFilters: boolean
  hasActiveFilters: boolean
  filteredTasks: any[]
  currentUserId?: string
  onTaskClick: (task: any) => void
  selectedCalendarIds: string[]
  onCalendarToggle: (id: string) => void
  onSelectAllCalendars: () => void
  onDeselectAllCalendars: () => void
  showEstablishmentTasks?: boolean
  onToggleEstablishmentTasks?: () => void
  establishmentTaskCount?: number
}

export function CalendarHeaderActions({
  onCreateEvent,
  onCreateTask,
  onOpenSync,
  onExport,
  onToggleFilters,
  showFilters,
  hasActiveFilters,
  filteredTasks,
  currentUserId,
  onTaskClick,
  selectedCalendarIds,
  onCalendarToggle,
  onSelectAllCalendars,
  onDeselectAllCalendars,
  showEstablishmentTasks,
  onToggleEstablishmentTasks,
  establishmentTaskCount = 0,
}: CalendarHeaderActionsProps) {
  const isMobile = useIsMobile()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [findSlotOpen, setFindSlotOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [calendarsOpen, setCalendarsOpen] = useState(false)

  // A11y : fermer la modale des raccourcis via Escape
  useEffect(() => {
    if (!shortcutsOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShortcutsOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [shortcutsOpen])

  return (
    <div className="flex items-center gap-1">
      {/* Primary action: Create dropdown - Compact on mobile */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="h-8 w-8 sm:h-9 sm:w-auto gap-1.5 px-0 sm:px-3 rounded-lg sm:rounded-xl bg-primary hover:bg-primary/90"
            aria-label="Créer un évènement ou une tâche"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Créer</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onCreateEvent} className="gap-2">
            <CalendarPlus className="h-4 w-4" />
            Événement
            <span className="ml-auto text-xs text-muted-foreground">N</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCreateTask} className="gap-2">
            <ListPlus className="h-4 w-4" />
            Tâche
            <span className="ml-auto text-xs text-muted-foreground">T</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notifications - Always visible */}
      <CalendarNotifications
        tasks={filteredTasks}
        currentUserId={currentUserId}
        onTaskClick={onTaskClick}
      />

      {/* Find available slot - Desktop only */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFindSlotOpen(true)}
              className="hidden md:flex h-9 gap-1 px-2 rounded-xl bg-card/50 backdrop-blur-sm border-primary/10 hover:bg-card/70 hover:border-primary/20 transition-all"
            >
              <Search className="h-3.5 w-3.5 text-primary" />
              <span className="hidden lg:inline text-xs">Créneau</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Trouver un créneau disponible</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <FindAvailableSlot
        open={findSlotOpen}
        onOpenChange={setFindSlotOpen}
        onSelectSlot={(_start, _end) => {
          onCreateEvent()
          setFindSlotOpen(false)
        }}
      />

      {/* Import ICS button - Desktop only */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="hidden md:flex h-9 gap-1 px-2 rounded-xl bg-card/50 backdrop-blur-sm border-primary/10 hover:bg-card/70 hover:border-primary/20 transition-all"
            >
              <Upload className="h-3.5 w-3.5 text-primary" />
              <span className="hidden lg:inline text-xs">Import</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Importer un fichier ICS ou s'abonner</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <CalendarImportDialog open={importOpen} onOpenChange={setImportOpen} />

      {/* Category manager - Desktop */}
      <CategoryManagerButton />

      {/* Filters button - Desktop only, mobile uses menu */}
      {!isMobile && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showFilters ? 'default' : 'outline'}
                size="sm"
                onClick={onToggleFilters}
                className="relative h-9 w-9 p-0 rounded-xl"
                aria-label={showFilters ? 'Fermer les filtres' : 'Ouvrir les filtres'}
                aria-pressed={showFilters}
              >
                {showFilters ? <X className="h-3.5 w-3.5" /> : <Filter className="h-3.5 w-3.5" />}
                {hasActiveFilters && !showFilters && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-3.5 w-3.5 p-0 flex items-center justify-center text-[9px]"
                  >
                    !
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{showFilters ? 'Fermer les filtres' : 'Ouvrir les filtres'} (F)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Secondary actions menu - Contains all overflow actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Plus d'options"
            title="Plus d'options"
            className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-lg sm:rounded-xl bg-card/10 sm:bg-card/50 backdrop-blur-sm border border-white/20 sm:border-primary/10 hover:bg-card/20 sm:hover:bg-card/70 transition-all"
          >
            <MoreHorizontal className="h-4 w-4 text-white sm:text-primary" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Affichage</DropdownMenuLabel>
            {/* Calendars management */}
            <DropdownMenuItem onClick={() => setCalendarsOpen(true)} className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Gérer les calendriers
            </DropdownMenuItem>
            {/* Filters - Mobile only */}
            <DropdownMenuItem onClick={onToggleFilters} className="gap-2 md:hidden">
              <Filter className="h-4 w-4" />
              {showFilters ? 'Masquer les filtres' : 'Afficher les filtres'}
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-auto h-4 px-1 text-[10px]">
                  !
                </Badge>
              )}
            </DropdownMenuItem>
            {/* Establishment tasks toggle */}
            {onToggleEstablishmentTasks && (
              <div className="flex items-center justify-between px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="etab-tasks" className="text-sm cursor-pointer">
                    Tâches étab.
                  </Label>
                  {establishmentTaskCount > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                      {establishmentTaskCount}
                    </Badge>
                  )}
                </div>
                <Switch
                  id="etab-tasks"
                  checked={showEstablishmentTasks}
                  onCheckedChange={onToggleEstablishmentTasks}
                />
              </div>
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {/* Find slot - Mobile only */}
            <DropdownMenuItem onClick={() => setFindSlotOpen(true)} className="gap-2 md:hidden">
              <Search className="h-4 w-4" />
              Trouver un créneau
            </DropdownMenuItem>
            {/* Import - Mobile only */}
            <DropdownMenuItem onClick={() => setImportOpen(true)} className="gap-2 md:hidden">
              <Upload className="h-4 w-4" />
              Importer ICS
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenSync} className="gap-2">
              <Wifi className="h-4 w-4" />
              Synchronisation
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport} className="gap-2">
              <Download className="h-4 w-4" />
              Exporter (ICS)
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel>Aide</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setShortcutsOpen(true)} className="gap-2">
              <Keyboard className="h-4 w-4" />
              Raccourcis clavier
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Calendars Sheet - Triggered from menu */}
      <Sheet open={calendarsOpen} onOpenChange={setCalendarsOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Calendriers</SheetTitle>
          </SheetHeader>
          <div className="p-2">
            <CalendarSidebar
              selectedCalendarIds={selectedCalendarIds}
              onCalendarToggle={onCalendarToggle}
              onSelectAll={onSelectAllCalendars}
              onDeselectAll={onDeselectAllCalendars}
              showEstablishmentTasks={showEstablishmentTasks}
              onToggleEstablishmentTasks={onToggleEstablishmentTasks}
              establishmentTaskCount={establishmentTaskCount}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Keyboard shortcuts dialog */}
      {shortcutsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            className="bg-background border rounded-lg shadow-lg p-4 w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                Raccourcis clavier
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShortcutsOpen(false)}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {CALENDAR_SHORTCUTS.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{shortcut.description}</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded">{shortcut.key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
