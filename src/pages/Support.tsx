import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Headphones, Plus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SupportKPIs } from '@/components/support/SupportKPIs'
import { SupportTicketList } from '@/components/support/SupportTicketList'
import { SupportTicketDetail } from '@/components/support/SupportTicketDetail'
import { CreateTicketDialog } from '@/components/support/CreateTicketDialog'
import { EmailSyncHealth } from '@/components/support/EmailSyncHealth'
import { SupportMobileHeader } from '@/components/support/SupportMobileHeader'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { useSupportTickets } from '@/hooks/support/useSupportTickets'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { CollapsibleKPISection, KPIToggleButton } from '@/components/shared/CollapsibleKPISection'
import { PageDataState } from '@/components/common/PageDataState'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'

export default function Support() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [showSyncHealth, setShowSyncHealth] = useState(false)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const isMobile = useIsMobile()
  const {
    data: tickets,
    isLoading: ticketsLoading,
    isError: ticketsError,
    error: ticketsErr,
    refetch: refetchTickets,
  } = useSupportTickets()

  // Pré-sélection via ?ticket=:id (depuis redirect /support/:id) — BUG-045
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const ticketParam = searchParams.get('ticket')
    const nextTicketId = ticketParam || null
    setSelectedTicketId((current) => (current === nextTicketId ? current : nextTicketId))
  }, [searchParams])

  // Stats for mobile header
  const stats = useMemo(
    () => ({
      total: tickets?.length || 0,
      open: tickets?.filter((t) => t.statut === 'ouvert' || t.statut === 'en_cours').length || 0,
      critical: tickets?.filter((t) => t.priorite === 'critique').length || 0,
    }),
    [tickets]
  )

  const handleSelectTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId)
    const next = new URLSearchParams(searchParams)
    next.set('ticket', ticketId)
    setSearchParams(next, { replace: true })
  }

  const handleClearSelectedTicket = () => {
    setSelectedTicketId(null)
    const next = new URLSearchParams(searchParams)
    next.delete('ticket')
    setSearchParams(next, { replace: true })
  }

  const handleCreateTicket = () => {
    setIsCreateDialogOpen(true)
  }

  return (
    <div className="min-h-dvh bg-gradient-page">
      {isMobile ? (
        <SupportMobileHeader
          stats={stats}
          onSearchClick={() => setShowGlobalSearch(true)}
          onCreateTicket={handleCreateTicket}
          onToggleSettings={() => setShowSyncHealth(!showSyncHealth)}
          kpiToggle={
            <KPIToggleButton
              storageKey="support-kpis-visible"
              label=""
              showIcon={true}
              className="h-8 w-8 p-0 bg-card/10 backdrop-blur-sm border border-white/20 text-white hover:bg-card/20 rounded-lg"
            />
          }
        />
      ) : (
        <ImmersivePageHeader
          title="Support Client"
          subtitle="Gestion des tickets et suivi des demandes"
          icon={Headphones}
          searchPlaceholder="Rechercher tickets..."
          onSearchClick={() => setShowGlobalSearch(true)}
          actions={
            <div className="flex items-center gap-2">
              <KPIToggleButton
                storageKey="support-kpis-visible"
                label="KPIs"
                showIcon={true}
                className="h-9 bg-card/10 backdrop-blur-sm border border-white/20 text-white hover:bg-card/20 rounded-lg"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSyncHealth(!showSyncHealth)}
                title="Paramètres de synchronisation"
                className="h-9 w-9 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white rounded-lg"
                aria-label="Paramètres"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleCreateTicket}
                size="sm"
                className="h-9 bg-card text-primary hover:bg-card/90 shadow-md hidden md:flex"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouveau ticket
              </Button>
            </div>
          }
        />
      )}

      {/* Global Search Dialog */}
      <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Email Sync Health Panel - Collapsible */}
        <Collapsible open={showSyncHealth} onOpenChange={setShowSyncHealth}>
          <CollapsibleContent className="animate-in slide-in-from-top-2 duration-200">
            <EmailSyncHealth />
          </CollapsibleContent>
        </Collapsible>

        <PageDataState
          isLoading={ticketsLoading && !tickets}
          isError={ticketsError}
          error={ticketsErr}
          onRetry={() => refetchTickets()}
        >
          {/* KPIs - Collapsible */}
          <CollapsibleKPISection storageKey="support-kpis-visible" defaultOpen={true}>
            <SupportKPIs />
          </CollapsibleKPISection>

          {/* Mobile: Tabs layout */}
          {isMobile ? (
            <Tabs
              defaultValue="list"
              value={selectedTicketId ? 'detail' : 'list'}
              className="flex-1"
            >
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="list" onClick={handleClearSelectedTicket}>
                  Liste
                </TabsTrigger>
                <TabsTrigger value="detail" disabled={!selectedTicketId}>
                  Détail
                </TabsTrigger>
              </TabsList>
              <TabsContent value="list" className="mt-4 h-[calc(100vh-22rem)]">
                <SupportTicketList
                  selectedTicketId={selectedTicketId}
                  onSelectTicket={handleSelectTicket}
                  onClearSelection={handleClearSelectedTicket}
                  onCreateTicket={handleCreateTicket}
                />
              </TabsContent>
              <TabsContent value="detail" className="mt-4 h-[calc(100vh-22rem)]">
                <SupportTicketDetail ticketId={selectedTicketId} />
              </TabsContent>
            </Tabs>
          ) : (
            /* Desktop: 2-column layout */
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-1 h-[calc(100vh-18rem)]">
              {/* Ticket list - 2/5 */}
              <div className="lg:col-span-2 h-full">
                <SupportTicketList
                  selectedTicketId={selectedTicketId}
                  onSelectTicket={handleSelectTicket}
                  onClearSelection={handleClearSelectedTicket}
                  onCreateTicket={handleCreateTicket}
                />
              </div>

              {/* Ticket detail - 3/5 */}
              <div className="lg:col-span-3 h-full">
                <SupportTicketDetail ticketId={selectedTicketId} />
              </div>
            </div>
          )}
        </PageDataState>

        {/* Create ticket dialog */}
        <CreateTicketDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
      </div>
    </div>
  )
}
