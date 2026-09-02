import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { usePulseConversations } from '@/hooks/pulse/usePulseConversations'
import { usePulseMessagesRealtime } from '@/hooks/pulse/usePulseMessages'
import { usePulsePresence } from '@/hooks/pulse/usePulsePresence'
import { useGlobalUserPresence } from '@/hooks/presence/useGlobalUserPresence'
import { ConversationList } from '@/components/pulse/ConversationList'
import { ConversationDetail } from '@/components/pulse/ConversationDetail'
import { CreateConversationDialog } from '@/components/pulse/CreateConversationDialog'
import { SearchDialog } from '@/components/pulse/SearchDialog'
import { AppInstallPrompt } from '@/components/pwa/AppInstallPrompt'
import { PulseMobileHeader } from '@/components/pulse/PulseMobileHeader'
import { cn } from '@/lib/utils'

export default function MobilePulseApp() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSearchDialog, setShowSearchDialog] = useState(false)

  const selectedConversationId = searchParams.get('conversation')

  const { data: conversations, isLoading } = usePulseConversations()

  // Activer le realtime pour la conversation sélectionnée
  usePulseMessagesRealtime(selectedConversationId || undefined)

  // Gérer la présence
  const { typingUsers, onlineUsers } = usePulsePresence(selectedConversationId || undefined)

  // Présence globale pour afficher le statut en ligne sur toutes les conversations
  const { onlineUserIds: globalOnlineUserIds } = useGlobalUserPresence()

  const handleSelectConversation = (conversationId: string) => {
    setSearchParams({ conversation: conversationId })
  }

  const handleBack = () => {
    setSearchParams({})
  }

  const handleSearchResultClick = (messageId: string, conversationId: string) => {
    setSearchParams({ conversation: conversationId, message: messageId })
    setShowSearchDialog(false)
  }

  // Show conversation list or detail
  const showDetail = !!selectedConversationId

  return (
    <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">
      {/* Show header only when viewing conversation list */}
      {!showDetail && (
        <PulseMobileHeader
          conversationsCount={conversations?.length || 0}
          onlineCount={globalOnlineUserIds?.size || 0}
          onSearch={() => setShowSearchDialog(true)}
          onCreate={() => setShowCreateDialog(true)}
          showGlobalNav={false}
        />
      )}

      {/* Main content area */}
      {showDetail && selectedConversationId ? (
        <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-200">
          <ConversationDetail
            conversationId={selectedConversationId}
            typingUsers={typingUsers}
            onlineUsers={onlineUsers}
            globalOnlineUserIds={globalOnlineUserIds}
            onOpenMobileSidebar={handleBack}
            onOpenSearch={() => setShowSearchDialog(true)}
            onToggleAI={() => {}}
            showAIPanel={false}
            isMobileView={true}
          />
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`pulse-skel-${i}`} className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations && conversations.length > 0 ? (
            <ConversationList
              conversations={conversations}
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
      )}

      {/* Dialogs */}
      <CreateConversationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={(conversationId) => {
          handleSelectConversation(conversationId)
          setShowCreateDialog(false)
        }}
      />

      <SearchDialog
        open={showSearchDialog}
        onOpenChange={setShowSearchDialog}
        conversationId={selectedConversationId || undefined}
        onResultClick={handleSearchResultClick}
      />

      {/* PWA Install Prompt */}
      <AppInstallPrompt
        appName="OpenPulse Pulse"
        appIcon="/icons/app-pulse-192.png"
        themeColor="#9065D0"
      />
    </div>
  )
}
