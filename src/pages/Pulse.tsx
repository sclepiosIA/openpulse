import { useState, useEffect, useTransition } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageCircle, Plus, Search, Shield, Menu, AlertTriangle, Settings } from 'lucide-react'
import { motion } from 'framer-motion'
import { useMediaQuery } from '@/hooks/shared/useMediaQuery'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { usePulseConversations } from '@/hooks/pulse/usePulseConversations'
import { usePulseMessagesRealtime } from '@/hooks/pulse/usePulseMessages'
import { usePulsePresence } from '@/hooks/pulse/usePulsePresence'
import { useGlobalUserPresence } from '@/hooks/presence/useGlobalUserPresence'
import { useUserRole } from '@/hooks/shared/useUserRole'
import { ConversationList } from '@/components/pulse/ConversationList'
import { ConversationDetail } from '@/components/pulse/ConversationDetail'
import { CreateConversationDialog } from '@/components/pulse/CreateConversationDialog'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { AIChatPanel } from '@/components/pulse/AIChatPanel'
import { AuditLogViewer } from '@/components/pulse/AuditLogViewer'
import { PulsePreferencesDialog } from '@/components/pulse/PulsePreferencesDialog'
import { applyPulseTheme } from '@/lib/pulsePreferences'
import { StatusSelectorHeader } from '@/components/pulse/StatusSelectorHeader'
import { PulseAzureStatusBadge } from '@/components/pulse/PulseAzureStatusBadge'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

import { useMobileDrawer } from '@/contexts/MobileDrawerContext'

export default function Pulse() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const selectedConversationId = searchParams.get('conversation')

  // Appliquer le thème utilisateur (bulles + fond) au montage
  useEffect(() => {
    applyPulseTheme()
  }, [])

  // Détecter si on est en dessous de lg (< 1024px) pour le Sheet mobile
  const isBelowLg = useMediaQuery('(max-width: 1023px)')
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(
    () => isBelowLg && !selectedConversationId
  )
  const { setOpen: setMobileDrawerOpen } = useMobileDrawer()

  const { isAdmin } = useUserRole()

  const {
    data: conversations,
    isLoading: isLoadingConversations,
    isError: isErrorConversations,
    refetch: refetchConversations,
  } = usePulseConversations()

  // Activer le realtime pour la conversation sélectionnée
  usePulseMessagesRealtime(selectedConversationId || undefined)

  // Gérer la présence (conversation sélectionnée)
  const { typingUsers, onlineUsers } = usePulsePresence(selectedConversationId || undefined)

  // Présence globale pour afficher le statut en ligne sur toutes les conversations
  const { onlineUserIds: globalOnlineUserIds } = useGlobalUserPresence()

  // useTransition pour marquer le changement de conversation comme non-urgent
  const [isPending, startTransition] = useTransition()

  const handleSelectConversation = (conversationId: string) => {
    startTransition(() => {
      setSearchParams({ conversation: conversationId })
    })
    setIsMobileSidebarOpen(false)
  }

  const handleSearchResultClick = (messageId: string, conversationId: string) => {
    setSearchParams({ conversation: conversationId, message: messageId })
    setShowGlobalSearch(false)
  }

  const filteredConversations = conversations?.filter(
    (conv) =>
      conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Desktop uniquement: sélectionner la première conversation si aucune n'est sélectionnée
  useEffect(() => {
    if (!isBelowLg && !selectedConversationId && conversations && conversations.length > 0) {
      setSearchParams({ conversation: conversations[0].id })
    }
  }, [conversations, selectedConversationId, setSearchParams, isBelowLg])

  // Mobile: ouvrir la liste par défaut si aucune conversation n'est sélectionnée
  useEffect(() => {
    if (isBelowLg) {
      setIsMobileSidebarOpen(!selectedConversationId)
      return
    }
    setIsMobileSidebarOpen(false)
  }, [isBelowLg, selectedConversationId])

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si on est dans un champ de saisie
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'k':
            e.preventDefault()
            setShowGlobalSearch(true)
            break
          case 'n':
            e.preventDefault()
            setShowCreateDialog(true)
            break
        }
      }

      if (e.key === 'Escape') {
        setShowGlobalSearch(false)
        setShowCreateDialog(false)
        setShowAIPanel(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="pulse-page h-full flex flex-col overflow-hidden">
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        {/* Header Compact - plus petit sur mobile */}
        <div
          className={cn(
            'relative overflow-hidden bg-marque-grille border-b border-white/10 flex-shrink-0',
            'py-2 px-3 sm:py-3 sm:px-4 md:px-6'
          )}
        >
          {/* Wave pattern - seulement desktop ET quand aucune conversation n'est sélectionnée (libère CPU) */}
          {!isBelowLg && !selectedConversationId && (
            <div className="absolute inset-0 overflow-hidden opacity-20">
              <svg
                className="absolute bottom-0 left-0 w-full h-12"
                viewBox="0 0 1440 48"
                preserveAspectRatio="none"
              >
                <motion.path
                  fill="currentColor"
                  className="text-white"
                  initial={{
                    d: 'M0,24 C240,40 480,8 720,28 C960,48 1200,16 1440,32 L1440,48 L0,48 Z',
                  }}
                  animate={{
                    d: [
                      'M0,24 C240,40 480,8 720,28 C960,48 1200,16 1440,32 L1440,48 L0,48 Z',
                      'M0,32 C240,16 480,40 720,20 C960,8 1200,36 1440,24 L1440,48 L0,48 Z',
                      'M0,24 C240,40 480,8 720,28 C960,48 1200,16 1440,32 L1440,48 L0,48 Z',
                    ],
                  }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                />
              </svg>
            </div>
          )}
          {/* Static wave quand une conversation est sélectionnée */}
          {!isBelowLg && selectedConversationId && (
            <div className="absolute inset-0 overflow-hidden opacity-20">
              <svg
                className="absolute bottom-0 left-0 w-full h-12"
                viewBox="0 0 1440 48"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,24 C240,40 480,8 720,28 C960,48 1200,16 1440,32 L1440,48 L0,48 Z"
                  fill="currentColor"
                  className="text-white"
                />
              </svg>
            </div>
          )}

          {/* Glow orbs - seulement desktop ET quand aucune conversation sélectionnée */}
          {!isBelowLg && !selectedConversationId && (
            <>
              <motion.div
                className="absolute top-0 right-[15%] w-24 h-24 rounded-full bg-emerald-400/15 blur-3xl"
                animate={{ y: [-8, 8, -8], opacity: [0.15, 0.25, 0.15] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute -bottom-4 left-[30%] w-20 h-20 rounded-full bg-cyan-400/10 blur-2xl"
                animate={{ x: [-6, 6, -6] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              />
            </>
          )}
          {/* Static orbs quand une conversation est sélectionnée */}
          {!isBelowLg && selectedConversationId && (
            <>
              <div className="absolute top-0 right-[15%] w-24 h-24 rounded-full bg-emerald-400/20 blur-3xl" />
              <div className="absolute -bottom-4 left-[30%] w-20 h-20 rounded-full bg-cyan-400/10 blur-2xl" />
            </>
          )}

          <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-3">
            {/* Gauche : Hamburger + Icône + Titre + Stats */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Hamburger menu (mobile) */}
              <Button
                size="icon"
                variant="ghost"
                className="md:hidden h-9 w-9 rounded-xl bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white flex-shrink-0"
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-4 w-4" />
              </Button>

              {/* Icône Pulse */}
              <motion.div
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-card/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg flex-shrink-0"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </motion.div>

              {/* Titre + Stats compacts */}
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-white truncate">Pulse</h1>
                <div className="flex items-center gap-2 text-white/70 text-[10px] sm:text-xs">
                  <span className="tabular-nums">{conversations?.length || 0}</span>
                  {(globalOnlineUserIds?.size || 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
                      </span>
                      <span className="text-emerald-400 tabular-nums">
                        {globalOnlineUserIds.size}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Droite : Recherche + Status + Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {/* Champ de recherche desktop */}
              <button
                onClick={() => setShowGlobalSearch(true)}
                className="hidden md:flex items-center gap-2 px-3 h-8 bg-card/10 backdrop-blur-sm border border-white/20 rounded-lg text-white/70 hover:bg-card/20 hover:text-white transition-all min-w-[140px] lg:min-w-[200px]"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="text-xs">Rechercher...</span>
                <kbd className="hidden lg:inline ml-auto text-[9px] bg-card/20 px-1 py-0.5 rounded font-mono">
                  ⌘K
                </kbd>
              </button>

              {/* Mobile search button */}
              <Button
                size="icon"
                variant="ghost"
                className="md:hidden h-8 w-8 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white"
                onClick={() => setShowGlobalSearch(true)}
                aria-label="Rechercher"
              >
                <Search className="h-3.5 w-3.5" />
              </Button>

              {/* Backend Azure — visible seulement si VITE_PULSE_BACKEND=azure|hybrid */}
              <PulseAzureStatusBadge />

              {/* Status Selector */}
              <StatusSelectorHeader />

              {isAdmin && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="hidden sm:flex h-8 w-8 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white"
                  onClick={() => setShowAuditLog(true)}
                  aria-label="Journal d'audit"
                  title="Journal d'audit"
                >
                  <Shield className="h-3.5 w-3.5" />
                </Button>
              )}

              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white"
                onClick={() => setShowPreferences(true)}
                aria-label="Préférences Pulse"
                title="Préférences"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>

              <Button
                size="sm"
                className="h-8 gap-1 bg-card text-primary hover:bg-card/90 shadow-lg font-medium text-xs px-2 sm:px-3"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Nouvelle</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Contenu principal - Vue conditionnelle mobile/desktop */}
        {isBelowLg ? (
          // MOBILE: Vue exclusive - soit liste plein écran, soit conversation plein écran
          selectedConversationId ? (
            <div className="flex-1 flex flex-col min-h-0">
              <ConversationDetail
                conversationId={selectedConversationId}
                typingUsers={typingUsers}
                onlineUsers={onlineUsers}
                globalOnlineUserIds={globalOnlineUserIds}
                onOpenMobileSidebar={() => setSearchParams({})}
                onOpenSearch={() => setShowGlobalSearch(true)}
                onToggleAI={() => setShowAIPanel(!showAIPanel)}
                showAIPanel={showAIPanel}
                isMobileView={true}
              />
            </div>
          ) : (
            // Liste des conversations plein écran
            <div className="flex-1 flex flex-col min-h-0 bg-marque-papier">
              {/* Barre de recherche locale */}
              <div className="p-3 border-b border-primary/10 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                  <Input
                    placeholder="Filtrer les conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 bg-card/60 border-0 focus:bg-card/80 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              {/* Liste des conversations */}
              <ScrollArea className="flex-1">
                {isLoadingConversations ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={`pulse-mb-skel-${i}`} className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : isErrorConversations ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-destructive/60" />
                    <p className="font-medium">Erreur de chargement</p>
                    <p className="text-sm mt-1">Impossible de charger les conversations</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => refetchConversations()}
                    >
                      Réessayer
                    </Button>
                  </div>
                ) : filteredConversations && filteredConversations.length > 0 ? (
                  <ConversationList
                    conversations={filteredConversations}
                    selectedId={selectedConversationId}
                    onSelect={handleSelectConversation}
                    onlineUsers={onlineUsers}
                    globalOnlineUserIds={globalOnlineUserIds}
                  />
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="font-medium text-lg">Aucune conversation</p>
                    <p className="text-sm mt-2">Créez une nouvelle conversation pour commencer</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setShowCreateDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Créer une conversation
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </div>
          )
        ) : (
          // DESKTOP: Layout classique avec sidebar + detail côte à côte
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Sidebar - Conversations */}
            <aside className="w-80 lg:w-96 flex flex-col bg-marque-papier backdrop-blur-xl border-r border-primary/10 overflow-hidden">
              {/* Sidebar header - filtre local */}
              <div className="p-3 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                  <Input
                    placeholder="Filtrer les conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 bg-card/40 border-0 focus:bg-card/60 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              {/* Liste des conversations */}
              <ScrollArea className="flex-1">
                {isLoadingConversations ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={`pulse-dk-skel-${i}`} className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : isErrorConversations ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-destructive/60" />
                    <p className="font-medium text-sm">Erreur de chargement</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => refetchConversations()}
                    >
                      Réessayer
                    </Button>
                  </div>
                ) : filteredConversations && filteredConversations.length > 0 ? (
                  <ConversationList
                    conversations={filteredConversations}
                    selectedId={selectedConversationId}
                    onSelect={handleSelectConversation}
                    onlineUsers={onlineUsers}
                    globalOnlineUserIds={globalOnlineUserIds}
                  />
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">Aucune conversation</p>
                    <p className="text-sm mt-1">Créez une nouvelle conversation pour commencer</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setShowCreateDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Créer une conversation
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </aside>

            {/* Zone principale - Conversation sélectionnée */}
            {/* Conteneur de mise en page : l'application rend déjà son propre
                <main id="main-content"> (App.tsx). Un second <main> dans le
                document est du HTML invalide et rendait `locator('main')`
                ambigu dans les tests. */}
            <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
                {selectedConversationId ? (
                  <ConversationDetail
                    conversationId={selectedConversationId}
                    typingUsers={typingUsers}
                    onlineUsers={onlineUsers}
                    globalOnlineUserIds={globalOnlineUserIds}
                    onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
                    onOpenSearch={() => setShowGlobalSearch(true)}
                    onToggleAI={() => setShowAIPanel(!showAIPanel)}
                    showAIPanel={showAIPanel}
                    isMobileView={false}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-medium">Sélectionnez une conversation</p>
                      <p className="text-sm mt-1">
                        Ou créez-en une nouvelle pour commencer à discuter
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Panel IA - Desktop */}
              {showAIPanel && selectedConversationId && (
                <aside className="hidden lg:block w-80 xl:w-96 border-l">
                  <AIChatPanel
                    conversationId={selectedConversationId}
                    onClose={() => setShowAIPanel(false)}
                  />
                </aside>
              )}
            </div>
          </div>
        )}

        {/* Panel IA - Mobile Sheet */}
        <Sheet
          open={isBelowLg && showAIPanel && !!selectedConversationId}
          onOpenChange={(open) => !open && setShowAIPanel(false)}
        >
          <SheetContent side="right" className="w-[85vw] sm:w-96 p-0">
            <SheetTitle className="sr-only">Assistant Pulse IA</SheetTitle>
            <SheetDescription className="sr-only">
              Assistant IA pour analyser la conversation
            </SheetDescription>
            {selectedConversationId && (
              <AIChatPanel
                conversationId={selectedConversationId}
                onClose={() => setShowAIPanel(false)}
              />
            )}
          </SheetContent>
        </Sheet>

        {/* Dialogs */}
        <CreateConversationDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={(conversationId) => {
            handleSelectConversation(conversationId)
            setShowCreateDialog(false)
          }}
        />

        <GlobalSearchDialog
          open={showGlobalSearch}
          setOpen={setShowGlobalSearch}
          hideTrigger={true}
        />

        {isAdmin && (
          <AuditLogViewer
            open={showAuditLog}
            onOpenChange={setShowAuditLog}
            conversationId={selectedConversationId || undefined}
          />
        )}

        <PulsePreferencesDialog open={showPreferences} onOpenChange={setShowPreferences} />
      </div>
    </div>
  )
}
