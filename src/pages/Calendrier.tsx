import { useState, useMemo, useEffect, useCallback } from 'react'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { debug } from '@/lib/debug'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SelectedTacheData } from '@/types/ui-states'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'

import { useIsMobile } from '@/hooks/ui/use-mobile'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import { useTaches, useUpdateTache } from '@/hooks/tasks/useTaches'
import { useProfiles } from '@/hooks/profile/useProfiles'
import { useEtablissements } from '@/hooks/crm/useEtablissements'
import { useCategories } from '@/hooks/catalogue/useCategories'
import { useCalendarFilters } from '@/hooks/calendar/useCalendarFilters'
import { useCalendarKeyboard } from '@/hooks/calendar/useCalendarKeyboard'
import { useCalendarAbsences } from '@/hooks/calendar/useCalendarAbsences'
import { CalendarFilters } from '@/components/calendrier/CalendarFilters'

import { CalendarSidebar } from '@/components/calendrier/CalendarSidebar'

import { ContentFilters } from '@/components/calendrier/CalendarContentToggle'
import { CalendarUnifiedTimelineView } from '@/components/calendrier/CalendarUnifiedTimelineView'
import { CalendarAIInput } from '@/components/calendrier/CalendarAIInput'
import { CalendarUnifiedMonthView } from '@/components/calendrier/CalendarUnifiedMonthView'
import { CalendarUnifiedAgendaView } from '@/components/calendrier/CalendarUnifiedAgendaView'
import { CalendarMobileDayView } from '@/components/calendrier/CalendarMobileDayView'
import { EventFormDialog } from '@/components/calendrier/EventFormDialog'

import { useCalendars, useDefaultCalendar } from '@/hooks/calendar/useCalendars'
import { useMarqueTeamCalendars } from '@/hooks/bookings/useMarqueTeamCalendars'
import { useCalendarEvents } from '@/hooks/calendar/useCalendarEvents'
import { useCalendarRealtime } from '@/hooks/calendar/useCalendarRealtime'

import { GanttAlerts } from '@/components/etablissement-gantt/GanttAlerts'
import { CalendarSyncSettings } from '@/components/calendrier/CalendarSyncSettings'
import { TaskQuickAdd } from '@/components/calendrier/TaskQuickAdd'

import { exportToICS } from '@/lib/calendarUtils'
import { useMobileDrawer } from '@/contexts/MobileDrawerContext'
import { useLocation } from 'react-router-dom'
import {
  Calendar as CalendarIcon,
  List,
  Filter,
  Clock,
  CalendarDays,
  GanttChart,
} from 'lucide-react'
import { ImmersivePageBackground } from '@/components/layout/ImmersivePageBackground'
import { cn } from '@/lib/utils'
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from 'date-fns'

import { fetchIsAdminForAuthUser } from '@/services/auth/userRoles'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/hooks/shared/use-toast'

import { CalendarEmbeddedGantt } from '@/components/calendrier/CalendarEmbeddedGantt'
import type { CalendarEvent } from '@/types/calendar'
import {
  CalendrierHero,
  CalendrierControlBar,
  CalendrierTaskDetailsDialog,
  type CalendarViewKey,
} from '@/pages/calendrier/CalendrierPageSections'

// Vues disponibles selon le device
const CALENDAR_VIEWS_MOBILE = [
  { value: 'timeline', label: 'Semaine', icon: Clock },
  { value: 'month', label: 'Mois', icon: CalendarDays },
  { value: 'day', label: 'Jour', icon: CalendarIcon },
  { value: 'agenda', label: 'Agenda', icon: List },
]

const CALENDAR_VIEWS_DESKTOP = [
  { value: 'timeline', label: 'Timeline', icon: Clock },
  { value: 'month', label: 'Mois', icon: CalendarDays },
  { value: 'day', label: 'Jour', icon: CalendarIcon },
  { value: 'agenda', label: 'Agenda', icon: List },
  { value: 'planning', label: 'Gantt', icon: GanttChart },
]

export default function Calendrier() {
  const { toast } = useToast()
  usePageTitle('Calendrier')
  const isMobile = useIsMobile()
  const { user: authUserData } = useAuth()

  // Live updates: any create/update/delete on events, attendees, reminders
  // triggers a debounced React Query invalidation across all open tabs.
  useCalendarRealtime()

  // Unified view: 'timeline' | 'month' | 'day' | 'agenda' | 'planning'
  const [activeView, setActiveView] = useState<CalendarViewKey>('timeline')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [selectedTache, setSelectedTache] = useState<SelectedTacheData | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showSyncSettings, setShowSyncSettings] = useState(false)

  // Content filters (unified toggle)
  const [contentFilters, setContentFilters] = useState<ContentFilters>(() => {
    const saved = localStorage.getItem('calendar-content-filters')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return {
          showTasks: true,
          showEvents: true,
          showAbsences: true,
          showEstablishmentTasks: true,
          selectedCategories: [],
        }
      }
    }
    return {
      showTasks: true,
      showEvents: true,
      showAbsences: true,
      showEstablishmentTasks: true,
      selectedCategories: [],
    }
  })

  // Persist content filters
  useEffect(() => {
    localStorage.setItem('calendar-content-filters', JSON.stringify(contentFilters))
  }, [contentFilters])

  // Calendar sidebar states with localStorage persistence
  const [showCalendarSidebar, setShowCalendarSidebar] = useState(() => {
    const saved = localStorage.getItem('calendar-sidebar-visible')
    return saved !== null ? JSON.parse(saved) : true
  })

  // Persist sidebar visibility
  useEffect(() => {
    localStorage.setItem('calendar-sidebar-visible', JSON.stringify(showCalendarSidebar))
  }, [showCalendarSidebar])
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([])
  const [eventFormOpen, setEventFormOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | undefined>()
  const [eventFormDefaultDate, setEventFormDefaultDate] = useState<Date | undefined>()
  const [eventFormDefaultEndDate, setEventFormDefaultEndDate] = useState<Date | undefined>()

  // Calendar hooks
  const { data: calendars } = useCalendars()
  const { data: defaultCalendar } = useDefaultCalendar()
  const { data: marqueCalendars } = useMarqueTeamCalendars()

  // Get current auth user ID for colleague event detection
  const authUserId = authUserData?.id
  // Set selected calendars when calendars load
  useEffect(() => {
    if (calendars && selectedCalendarIds.length === 0) {
      const visibleCalendarIds = calendars.filter((c) => c.is_visible).map((c) => c.id)
      setSelectedCalendarIds(visibleCalendarIds)
    }
  }, [calendars])

  // Fetch events for the visible range
  const eventsDateRange = useMemo(() => {
    // Get a wider range for all views
    const start = startOfMonth(subMonths(currentDate, 1))
    const end = endOfMonth(addMonths(currentDate, 1))
    return { start, end }
  }, [currentDate])

  const { data: calendarEvents } = useCalendarEvents({
    calendarIds: selectedCalendarIds,
    startDate: eventsDateRange.start,
    endDate: eventsDateRange.end,
  })

  // Fetch absences for the visible range
  const { absences: calendarAbsences, totalCount: absenceCount } = useCalendarAbsences(
    format(eventsDateRange.start, 'yyyy-MM-dd'),
    format(eventsDateRange.end, 'yyyy-MM-dd')
  )

  // Data hooks
  const { data: allTaches, isLoading: tachesLoading } = useTaches()
  const { data: profiles } = useProfiles()
  const { data: etablissements } = useEtablissements()
  const { data: categories } = useCategories()
  const updateTache = useUpdateTache()

  // Get current user and admin status
  const currentUserId = useMemo(() => {
    if (!authUserData) return undefined
    return profiles?.find((p) => p.user_id === authUserData.id)?.id
  }, [profiles, authUserData])

  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    if (!authUserData?.id) return
    fetchIsAdminForAuthUser(authUserData.id).then(setIsAdmin)
  }, [authUserData?.id])

  // Filters - pass etablissements for phase filtering
  const { filters, updateFilters, resetFilters, filterTasks, hasActiveFilters } =
    useCalendarFilters(
      currentUserId,
      etablissements?.map((e) => ({ id: e.id, statut: e.statut }))
    )
  const filteredTasks = useMemo(() => filterTasks(allTaches || []), [allTaches, filterTasks])

  // Filter out establishment tasks if toggle is off, and apply category filter
  const displayedTasks = useMemo(() => {
    let tasks = filteredTasks

    // Filter by establishment
    if (!contentFilters.showEstablishmentTasks) {
      tasks = tasks.filter((t) => !t.etablissement_id)
    }

    // Filter by selected categories
    if (contentFilters.selectedCategories && contentFilters.selectedCategories.length > 0) {
      tasks = tasks.filter(
        (t) => t.categorie_id && contentFilters.selectedCategories!.includes(t.categorie_id)
      )
    }

    return tasks
  }, [filteredTasks, contentFilters.showEstablishmentTasks, contentFilters.selectedCategories])

  // Count establishment tasks for the toggle UI
  const establishmentTaskCount = useMemo(
    () => filteredTasks.filter((t) => t.etablissement_id).length,
    [filteredTasks]
  )

  // Event handlers
  const handleCreateEvent = (dateOrStart?: Date, end?: Date) => {
    setSelectedEvent(undefined)
    setEventFormDefaultDate(dateOrStart)
    setEventFormDefaultEndDate(end)
    setEventFormOpen(true)
  }

  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setEventFormDefaultDate(undefined)
    setEventFormOpen(true)
  }

  const handleToggleCalendar = (calendarId: string) => {
    setSelectedCalendarIds((prev) =>
      prev.includes(calendarId) ? prev.filter((id) => id !== calendarId) : [...prev, calendarId]
    )
  }

  // Task handlers
  const handleTaskClick = (task: any) => {
    setSelectedTache(task)
    setDetailsOpen(true)
  }

  const handleStatusChange = async (tacheId: string, newStatus: string) => {
    try {
      await updateTache.mutateAsync({
        id: tacheId,
        data: {
          statut: newStatus as 'A faire' | 'En cours' | 'Bloqué' | 'Terminé',
          ...(newStatus === 'Terminé' && {
            date_realisation: format(new Date(), 'yyyy-MM-dd'),
            archive: true,
          }),
        },
      })
      toast({
        title: 'Statut mis à jour',
        description:
          newStatus === 'Terminé'
            ? 'La tâche a été terminée et archivée'
            : 'Le statut de la tâche a été modifié avec succès',
      })
      if (newStatus === 'Terminé') {
        setDetailsOpen(false)
      }
    } catch (error) {
      debug.error('Erreur lors de la mise à jour du statut:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le statut',
        variant: 'destructive',
      })
    }
  }

  // Counts for toggle display
  const taskCount = displayedTasks.length
  const eventCount = calendarEvents?.length || 0

  // Task form state for quick create
  const [taskFormOpen, setTaskFormOpen] = useState(false)

  // Navigation handlers for keyboard shortcuts
  const handlePreviousPeriod = useCallback(() => {
    if (activeView === 'month') {
      setCurrentDate((prev) => subMonths(prev, 1))
    } else {
      setCurrentDate((prev) => subWeeks(prev, 1))
    }
  }, [activeView])

  const handleNextPeriod = useCallback(() => {
    if (activeView === 'month') {
      setCurrentDate((prev) => addMonths(prev, 1))
    } else {
      setCurrentDate((prev) => addWeeks(prev, 1))
    }
  }, [activeView])

  const handleToday = useCallback(() => {
    setCurrentDate(new Date())
  }, [])

  const handleToggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev)
  }, [])

  const handleExport = useCallback(() => {
    exportToICS(displayedTasks, 'Calendrier')
    toast({ title: 'Export réussi', description: 'Le fichier ICS a été téléchargé' })
  }, [displayedTasks, toast])

  // Keyboard shortcuts
  useCalendarKeyboard({
    onNewEvent: () => handleCreateEvent(new Date()),
    onNewTask: () => setTaskFormOpen(true),
    onToggleFilters: handleToggleFilters,
    onPreviousPeriod: handlePreviousPeriod,
    onNextPeriod: handleNextPeriod,
    onToday: handleToday,
    enabled: !detailsOpen && !eventFormOpen && !taskFormOpen,
  })

  // Detect if we're on standalone mobile app route
  const location = useLocation()
  const isStandaloneMobileApp = location.pathname.startsWith('/m/')

  // Mobile drawer for hamburger menu
  const { setOpen: setMobileDrawerOpen } = useMobileDrawer()

  return (
    <ImmersivePageBackground>
      <div className="w-full max-w-full overflow-x-hidden flex flex-col min-h-dvh">
        <CalendrierHero
          isMobile={isMobile}
          isStandaloneMobileApp={isStandaloneMobileApp}
          taskCount={taskCount}
          eventCount={eventCount}
          absenceCount={absenceCount}
          hasActiveFilters={hasActiveFilters}
          showFilters={showFilters}
          displayedTasks={displayedTasks}
          currentUserId={currentUserId}
          selectedCalendarIds={selectedCalendarIds}
          contentFilters={contentFilters}
          establishmentTaskCount={establishmentTaskCount}
          calendars={calendars}
          onOpenMobileDrawer={() => setMobileDrawerOpen(true)}
          onCreateEvent={() => handleCreateEvent(new Date())}
          onCreateTask={() => setTaskFormOpen(true)}
          onOpenSync={() => setShowSyncSettings(true)}
          onExport={handleExport}
          onToggleFilters={handleToggleFilters}
          onTaskClick={handleTaskClick}
          onCalendarToggle={handleToggleCalendar}
          onSelectAllCalendars={() =>
            calendars && setSelectedCalendarIds(calendars.map((c) => c.id))
          }
          onDeselectAllCalendars={() => setSelectedCalendarIds([])}
          onToggleEstablishmentTasks={() =>
            setContentFilters((prev) => ({
              ...prev,
              showEstablishmentTasks: !prev.showEstablishmentTasks,
            }))
          }
        />

        <CalendrierControlBar
          isMobile={isMobile}
          showCalendarSidebar={showCalendarSidebar}
          onToggleSidebar={() => setShowCalendarSidebar(!showCalendarSidebar)}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          activeView={activeView}
          onActiveViewChange={(v) => setActiveView(v)}
          contentFilters={contentFilters}
          onContentFiltersChange={setContentFilters}
          taskCount={taskCount}
          eventCount={eventCount}
          absenceCount={absenceCount}
          establishmentTaskCount={establishmentTaskCount}
          viewsDesktop={CALENDAR_VIEWS_DESKTOP}
          viewsMobile={CALENDAR_VIEWS_MOBILE}
        />

        {/* Main content area */}
        <div className="flex-1 px-2 sm:px-3 lg:px-4 space-y-2 sm:space-y-3 overflow-x-hidden py-2 sm:py-3">
          {/* AI Event Creation Input */}
          {calendars && calendars.length > 0 && (
            <CalendarAIInput
              calendars={calendars}
              onEventsCreated={() => {
                // Events refetch is handled by React Query invalidation
              }}
            />
          )}

          {/* Alerts */}
          <GanttAlerts tasks={displayedTasks} onTaskClick={handleTaskClick} />

          {/* Filters Panel */}
          {showFilters && (
            <Card className="border-l-4 border-l-primary bg-background/95 backdrop-blur-sm shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" />
                    Filtres des tâches
                  </CardTitle>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={resetFilters}>
                      Réinitialiser
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <CalendarFilters
                  filters={filters}
                  onFiltersChange={updateFilters}
                  onReset={resetFilters}
                  hasActiveFilters={hasActiveFilters}
                />
              </CardContent>
            </Card>
          )}

          {/* Main Content with Sidebar */}
          <div className="flex gap-4">
            {/* Calendar Sidebar (desktop only) - with transition */}
            <div
              className={cn(
                'hidden lg:block flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden',
                showCalendarSidebar ? 'w-64' : 'w-0'
              )}
            >
              {showCalendarSidebar && (
                <CalendarSidebar
                  selectedCalendarIds={selectedCalendarIds}
                  onCalendarToggle={handleToggleCalendar}
                  onSelectAll={() =>
                    calendars && setSelectedCalendarIds(calendars.map((c) => c.id))
                  }
                  onDeselectAll={() => setSelectedCalendarIds([])}
                  showEstablishmentTasks={contentFilters.showEstablishmentTasks}
                  onToggleEstablishmentTasks={() =>
                    setContentFilters((prev) => ({
                      ...prev,
                      showEstablishmentTasks: !prev.showEstablishmentTasks,
                    }))
                  }
                  establishmentTaskCount={establishmentTaskCount}
                />
              )}
            </div>

            {/* Views Tabs - Simplified to 4 main views */}
            <div className="flex-1 min-w-0">
              <Tabs
                value={activeView}
                onValueChange={(v) => setActiveView(v as CalendarViewKey)}
                className="space-y-2"
              >
                {/* View selector tabs are in the sticky toolbar above - no duplication here */}

                {/* Timeline View (7 days) - same for all devices */}
                <TabsContent value="timeline" className="space-y-4 m-0 animate-fade-in">
                  <CalendarUnifiedTimelineView
                    tasks={displayedTasks}
                    events={calendarEvents || []}
                    absences={calendarAbsences}
                    currentDate={currentDate}
                    onDateChange={setCurrentDate}
                    onTaskClick={handleTaskClick}
                    onEventClick={handleEditEvent}
                    onCreateEvent={handleCreateEvent}
                    contentFilters={contentFilters}
                    currentAuthUserId={authUserId}
                  />
                </TabsContent>

                {/* Month View - same for all devices */}
                <TabsContent value="month" className="space-y-4 m-0 animate-fade-in">
                  <CalendarUnifiedMonthView
                    tasks={displayedTasks}
                    events={calendarEvents || []}
                    absences={calendarAbsences}
                    currentMonth={currentDate}
                    onMonthChange={setCurrentDate}
                    onTaskClick={handleTaskClick}
                    onEventClick={handleEditEvent}
                    onCreateEvent={(date) => handleCreateEvent(date)}
                    contentFilters={contentFilters}
                    currentAuthUserId={authUserId}
                  />
                </TabsContent>

                {/* Day View - new view replacing Gantt on mobile */}
                <TabsContent value="day" className="space-y-4 m-0 animate-fade-in">
                  <CalendarMobileDayView
                    tasks={displayedTasks}
                    events={calendarEvents || []}
                    absences={calendarAbsences}
                    selectedDate={currentDate}
                    onDateChange={setCurrentDate}
                    onTaskClick={handleTaskClick}
                    onEventClick={handleEditEvent}
                    contentFilters={contentFilters}
                    currentAuthUserId={authUserId}
                  />
                </TabsContent>

                {/* Agenda View */}
                <TabsContent value="agenda" className="space-y-4 m-0 animate-fade-in">
                  <CalendarUnifiedAgendaView
                    tasks={displayedTasks}
                    events={calendarEvents || []}
                    absences={calendarAbsences}
                    onTaskClick={handleTaskClick}
                    onEventClick={handleEditEvent}
                    contentFilters={contentFilters}
                  />
                </TabsContent>

                {/* Planning/Gantt - Embedded Gantt View */}
                <TabsContent value="planning" className="m-0 animate-fade-in">
                  <CalendarEmbeddedGantt contentFilters={contentFilters} />
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <CalendrierTaskDetailsDialog
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            selectedTache={selectedTache}
            onStatusChange={handleStatusChange}
            isPending={updateTache.isPending}
          />

          {/* Event Form Dialog */}
          <EventFormDialog
            open={eventFormOpen}
            onOpenChange={(open) => {
              setEventFormOpen(open)
              if (!open) {
                setSelectedEvent(undefined)
                setEventFormDefaultDate(undefined)
                setEventFormDefaultEndDate(undefined)
              }
            }}
            event={selectedEvent}
            defaultStartTime={eventFormDefaultDate}
            defaultEndTime={eventFormDefaultEndDate}
          />

          {/* Task Form Dialog for quick task creation */}
          <Dialog open={taskFormOpen} onOpenChange={setTaskFormOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nouvelle tâche</DialogTitle>
              </DialogHeader>
              <div className="pt-2">
                <TaskQuickAdd
                  defaultDate={currentDate}
                  alwaysOpen
                  onSuccess={() => {
                    setTaskFormOpen(false)
                    toast({ title: 'Tâche créée', description: 'La tâche a été créée avec succès' })
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>

          {/* Sync Settings Dialog */}
          <Dialog open={showSyncSettings} onOpenChange={setShowSyncSettings}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Synchronisation du calendrier</DialogTitle>
              </DialogHeader>
              <CalendarSyncSettings
                isOpen={showSyncSettings}
                onClose={() => setShowSyncSettings(false)}
                isAdmin={isAdmin}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </ImmersivePageBackground>
  )
}
