import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { TodoSidebar } from './TodoSidebar'
import { TodoList } from './TodoList'
import { TodoQuickAdd } from './TodoQuickAdd'
import { TodoDetailPanel } from './TodoDetailPanel'
import { CreateTodoModal } from './modals/CreateTodoModal'
import { TodoMobileHeader } from './TodoMobileHeader'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Plus, CheckSquare } from 'lucide-react'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { UnifiedTodo, TodoFilter } from '@/hooks/tasks/useUnifiedTodos'
import { useUnifiedTodos } from '@/hooks/tasks/useUnifiedTodos'

interface TodoPageProps {
  isPWAMode?: boolean
}

export function TodoPage({ isPWAMode = false }: TodoPageProps) {
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filter, setFilter] = useState<TodoFilter>('all')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedEtablissementId, setSelectedEtablissementId] = useState<string | null>(null)
  const [selectedTodo, setSelectedTodo] = useState<UnifiedTodo | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [search, setSearch] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Get stats for header
  const { data: allTodos = [] } = useUnifiedTodos({
    filter: 'all',
    showDone: true,
  })

  const totalCount = allTodos.length
  const overdueCount = allTodos.filter(
    (t) => !t.is_done && t.due_date && new Date(t.due_date) < new Date()
  ).length
  const todayCount = allTodos.filter((t) => {
    if (t.is_done || !t.due_date) return false
    const due = new Date(t.due_date)
    const today = new Date()
    return due.toDateString() === today.toDateString()
  }).length

  // Auto-select task from URL param (e.g. /todos?task=uuid)
  const taskIdFromUrl = searchParams.get('task')
  useEffect(() => {
    if (taskIdFromUrl && allTodos.length > 0) {
      const found = allTodos.find((t) => t.id === taskIdFromUrl)
      if (found) {
        setSelectedTodo(found)
        // Clean up URL param after selecting
        searchParams.delete('task')
        setSearchParams(searchParams, { replace: true })
      }
    }
  }, [taskIdFromUrl, allTodos])

  const handleSelectFilter = (newFilter: TodoFilter) => {
    setFilter(newFilter)
    setSelectedProjectId(null)
    setSelectedEtablissementId(null)
    if (isMobile) setSidebarOpen(false)
  }

  const handleSelectProject = (projectId: string) => {
    setFilter('all')
    setSelectedProjectId(projectId)
    setSelectedEtablissementId(null)
    if (isMobile) setSidebarOpen(false)
  }

  const handleSelectEtablissement = (etablissementId: string) => {
    setFilter('all')
    setSelectedProjectId(null)
    setSelectedEtablissementId(etablissementId)
    if (isMobile) setSidebarOpen(false)
  }

  const sidebarContent = (
    <TodoSidebar
      selectedFilter={filter}
      selectedProjectId={selectedProjectId}
      selectedEtablissementId={selectedEtablissementId}
      onSelectFilter={handleSelectFilter}
      onSelectProject={handleSelectProject}
      onSelectEtablissement={handleSelectEtablissement}
      showDone={showDone}
      onShowDoneChange={setShowDone}
    />
  )

  const headerActions = (
    <Button
      onClick={() => setIsCreateModalOpen(true)}
      className="h-9 gap-2 bg-card text-primary hover:bg-card/90 rounded-lg shadow-md"
    >
      <Plus className="h-4 w-4" />
      {!isMobile && 'Ajouter'}
    </Button>
  )

  const handleSearchClick = () => {
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true })
    document.dispatchEvent(event)
  }

  return (
    <div className="flex flex-col h-full bg-gradient-page">
      {/* Header - different for mobile vs desktop */}
      {isMobile ? (
        <TodoMobileHeader
          stats={{ total: totalCount, overdue: overdueCount, today: todayCount }}
          onOpenFilters={() => setSidebarOpen(true)}
          onCreateTask={() => setIsCreateModalOpen(true)}
          onSearchClick={handleSearchClick}
          showGlobalNav={!isPWAMode}
        />
      ) : (
        <ImmersivePageHeader
          title="Tâches"
          subtitle="Gérez vos tâches et priorités"
          icon={CheckSquare}
          stats={[
            { label: 'total', value: totalCount, highlight: true },
            { label: 'retard', value: overdueCount },
            { label: "aujourd'hui", value: todayCount },
          ]}
          searchPlaceholder="Rechercher une tâche..."
          onSearchClick={handleSearchClick}
          actions={headerActions}
          variant="compact"
        />
      )}

      {/* Mobile Sidebar Sheet */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-72 p-0 bg-marque-papier">
            {sidebarContent}
          </SheetContent>
        </Sheet>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className="w-64 border-r border-primary/10 bg-marque-papier backdrop-blur-sm flex-shrink-0">
            {sidebarContent}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Quick Add - Desktop only */}
          {!isMobile && (
            <TodoQuickAdd projectId={selectedProjectId} etablissementId={selectedEtablissementId} />
          )}

          {/* Todo List */}
          <div className="flex-1 overflow-auto">
            <TodoList
              filter={filter}
              projectId={selectedProjectId || undefined}
              etablissementId={selectedEtablissementId || undefined}
              showDone={showDone}
              search={search}
              onSelectTodo={setSelectedTodo}
              selectedTodoId={selectedTodo?.id}
            />
          </div>
        </div>

        {/* Detail Panel (Desktop) */}
        {!isMobile && selectedTodo && (
          <div className="w-80 border-l border-primary/10 bg-marque-papier backdrop-blur-sm flex-shrink-0">
            <TodoDetailPanel todo={selectedTodo} onClose={() => setSelectedTodo(null)} />
          </div>
        )}

        {/* Detail Panel (Mobile) */}
        {isMobile && selectedTodo && (
          <Sheet open={!!selectedTodo} onOpenChange={(open) => !open && setSelectedTodo(null)}>
            <SheetContent side="bottom" className="h-[80vh] p-0">
              <TodoDetailPanel todo={selectedTodo} onClose={() => setSelectedTodo(null)} />
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Create Modal */}
      <CreateTodoModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        defaultProjectId={selectedProjectId}
        defaultEtablissementId={selectedEtablissementId}
      />
    </div>
  )
}
