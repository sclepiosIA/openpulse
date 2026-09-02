import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, ArrowLeft, Maximize2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { usePulseTotalUnread, usePulseUnreadCount } from '@/hooks/pulse/usePulseUnreadCount'
import { usePulseConversations } from '@/hooks/pulse/usePulseConversations'
import { usePulseMessages } from '@/hooks/pulse/usePulseMessages'
import { usePulseMessagesRealtime } from '@/hooks/pulse/usePulseMessages'
import { usePulseNewMessageNotifier } from '@/hooks/pulse/usePulseNewMessageNotifier'
import { usePulseMessageReceipts } from '@/hooks/pulse/usePulseMessageReceipts'
import { MessageReadReceipt } from './MessageReadReceipt'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { PulseConversation, PulseMessage } from '@/types/pulse'
import { isDMConversation, extractOtherNameFromConversationName } from '@/lib/pulse/dmCounterpart'
import { getLastMessagePreview, getNormalizedLastMessage } from '@/lib/pulse/lastMessagePreview'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { MessageEditor } from './MessageEditor'
import { linkify } from '@/lib/linkify'

type PulseReceiptHelpers = ReturnType<typeof usePulseMessageReceipts>

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getDMOtherMember(conv: PulseConversation, myProfileId: string | undefined) {
  if (!isDMConversation(conv) || !conv.members || !myProfileId) return null
  const other = conv.members.find((m) => m.user_id !== myProfileId)
  return other?.user || null
}

function getConvDisplayName(conv: PulseConversation, myFullName: string): string {
  if (isDMConversation(conv) && myFullName && conv.name?.includes(' & ')) {
    return extractOtherNameFromConversationName(conv.name, myFullName)
  }
  return conv.name || 'Conversation'
}

function PulseFloatingChatInner() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Hide on Pulse pages
  const isPulsePage = location.pathname.startsWith('/pulse') || location.pathname.startsWith('/m/')

  const totalUnread = usePulseTotalUnread()
  const { data: unreadData } = usePulseUnreadCount()
  const { hasNewMessage, clearPulse } = usePulseNewMessageNotifier()
  const { data: conversations, isLoading: loadingConversations } = usePulseConversations()
  const { data: messagesData } = usePulseMessages(selectedConversationId || undefined)
  usePulseMessagesRealtime(selectedConversationId || undefined)
  const { markAsRead, getMessageReceiptStatus, isGroupChat } = usePulseMessageReceipts(
    selectedConversationId || undefined
  )
  const lastMarkedRef = useRef<string | null>(null)

  const { data: currentProfile } = useCurrentProfile()
  const myProfileId = currentProfile?.id
  const myFullName = currentProfile
    ? `${currentProfile.prenom || ''} ${currentProfile.nom || ''}`.trim()
    : ''

  const allMessages = messagesData?.pages?.flatMap((p) => p.messages) || []
  const sortedMessages = [...allMessages].reverse()

  const selectedConversation = conversations?.find((c) => c.id === selectedConversationId)

  const sortedConversations = [...(conversations || [])].sort((a, b) => {
    const aUnread = unreadData?.byConversation[a.id] || 0
    const bUnread = unreadData?.byConversation[b.id] || 0
    if (aUnread > 0 && bUnread === 0) return -1
    if (bUnread > 0 && aUnread === 0) return 1
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })

  useEffect(() => {
    if (selectedConversationId && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [sortedMessages.length, selectedConversationId])

  useEffect(() => {
    if (!isOpen || !selectedConversationId) return
    if (!messagesData?.pages?.length) return
    if (lastMarkedRef.current === selectedConversationId) return
    lastMarkedRef.current = selectedConversationId
    markAsRead()
  }, [isOpen, selectedConversationId, messagesData, markAsRead])

  useEffect(() => {
    if (!selectedConversationId) {
      lastMarkedRef.current = null
    }
  }, [selectedConversationId])

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) clearPulse()
      return !prev
    })
    if (isOpen) {
      setSelectedConversationId(null)
    }
  }, [isOpen, clearPulse])

  const handleSelectConversation = useCallback((id: string) => {
    setSelectedConversationId(id)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedConversationId(null)
  }, [])

  const handleOpenFullscreen = useCallback(() => {
    if (selectedConversationId) {
      navigate(`/pulse?conversation=${selectedConversationId}`)
    } else {
      navigate('/pulse')
    }
    setIsOpen(false)
  }, [navigate, selectedConversationId])

  if (isPulsePage) return null

  return (
    <>
      {/* Floating bubble */}
      <motion.button
        onClick={handleToggle}
        className={cn(
          'fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-colors',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          'md:bottom-6 md:right-6 bottom-20 right-4'
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={
          hasNewMessage && !isOpen
            ? {
                scale: [1, 1.15, 1],
                transition: { duration: 0.6, repeat: 3 },
              }
            : {}
        }
        aria-label={
          isOpen
            ? 'Fermer Pulse'
            : `Ouvrir Pulse${totalUnread > 0 ? ` (${totalUnread} non lus)` : ''}`
        }
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!isOpen && totalUnread > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center rounded-full text-xs px-1"
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </Badge>
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'fixed z-40 bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden',
              'md:bottom-24 md:right-6 md:w-[440px] md:h-[620px]',
              'bottom-36 right-4 w-[calc(100vw-2rem)] max-w-[440px] h-[min(620px,72vh)]'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                {selectedConversationId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleBack}
                    aria-label="Retour"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <MessageCircle className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm truncate">
                  {selectedConversation
                    ? getConvDisplayName(selectedConversation, myFullName)
                    : 'Pulse'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleOpenFullscreen}
                  title="Ouvrir en plein écran"
                  aria-label="Agrandir"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleToggle}
                  aria-label="Fermer"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Content */}
            {!selectedConversationId ? (
              <ConversationListView
                conversations={sortedConversations}
                loading={loadingConversations}
                unreadByConversation={unreadData?.byConversation || {}}
                onSelect={handleSelectConversation}
                myFullName={myFullName}
                myProfileId={myProfileId}
              />
            ) : (
              <ConversationDetailView
                conversationId={selectedConversationId}
                messages={sortedMessages}
                myProfileId={myProfileId}
                messagesEndRef={messagesEndRef}
                getMessageReceiptStatus={getMessageReceiptStatus}
                isGroupChat={isGroupChat}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// --- Sub-components ---

interface ConversationListViewProps {
  conversations: PulseConversation[]
  loading: boolean
  unreadByConversation: Record<string, number>
  onSelect: (id: string) => void
  myFullName: string
  myProfileId: string | undefined
}

const ConversationListView = memo(function ConversationListView({
  conversations,
  loading,
  unreadByConversation,
  onSelect,
  myFullName,
  myProfileId,
}: ConversationListViewProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-center">
        <p className="text-sm text-muted-foreground">Aucune conversation</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="py-1">
        {conversations.map((conv) => {
          const unread = unreadByConversation[conv.id] || 0
          const lastMsg = getNormalizedLastMessage(conv)
          const convDisplayName = getConvDisplayName(conv, myFullName)
          const preview = getLastMessagePreview(conv, myProfileId, isDMConversation(conv))
          const dmOther = getDMOtherMember(conv, myProfileId)
          const avatarUrl = dmOther?.avatar_url || conv.etablissement?.logo_url || undefined
          const initials = getInitials(convDisplayName)
          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left',
                unread > 0 && 'bg-accent/20'
              )}
            >
              <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={convDisplayName} />}
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn('text-sm truncate', unread > 0 ? 'font-semibold' : 'font-medium')}
                  >
                    {convDisplayName}
                  </span>
                  {lastMsg?.created_at && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {format(new Date(lastMsg.created_at), 'HH:mm', { locale: fr })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground truncate">
                    {preview || 'Pas de message'}
                  </p>
                  {unread > 0 && (
                    <Badge
                      variant="destructive"
                      className="h-4 min-w-4 flex items-center justify-center rounded-full text-[10px] px-1 flex-shrink-0"
                    >
                      {unread}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </ScrollArea>
  )
})

interface ConversationDetailViewProps {
  conversationId: string
  messages: PulseMessage[]
  myProfileId: string | undefined
  messagesEndRef: React.RefObject<HTMLDivElement>
  getMessageReceiptStatus: PulseReceiptHelpers['getMessageReceiptStatus']
  isGroupChat: boolean
}

const ConversationDetailView = memo(function ConversationDetailView({
  conversationId,
  messages,
  myProfileId,
  messagesEndRef,
  getMessageReceiptStatus,
  isGroupChat,
}: ConversationDetailViewProps) {
  return (
    <>
      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Aucun message</p>
          )}
          {messages.map((msg) => {
            const isOwn = !!(myProfileId && msg.user_id === myProfileId)
            const receiptSummary = getMessageReceiptStatus(msg.id, msg.user_id, isOwn)
            const receiptStatus = isOwn ? receiptSummary.status : undefined
            return (
              <div
                key={msg.id}
                className={cn('flex gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}
              >
                <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                  {msg.user?.avatar_url && (
                    <AvatarImage
                      src={msg.user.avatar_url}
                      alt={`${msg.user.prenom} ${msg.user.nom}`}
                    />
                  )}
                  <AvatarFallback
                    className={cn('text-[10px]', isOwn ? 'bg-primary/10 text-primary' : 'bg-muted')}
                  >
                    {msg.user
                      ? `${msg.user.prenom?.[0] || ''}${msg.user.nom?.[0] || ''}`.toUpperCase()
                      : '?'}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    'min-w-0 flex flex-col max-w-[78%]',
                    isOwn ? 'items-end' : 'items-start'
                  )}
                >
                  <div className={cn('flex items-baseline gap-2', isOwn && 'flex-row-reverse')}>
                    <span className="text-[11px] font-medium truncate text-muted-foreground">
                      {isOwn ? 'Vous' : msg.user ? `${msg.user.prenom} ${msg.user.nom}` : 'Inconnu'}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 inline-flex items-center gap-0.5">
                      {format(new Date(msg.created_at), 'HH:mm', { locale: fr })}
                      {receiptStatus && (
                        <MessageReadReceipt
                          status={receiptStatus}
                          isGroupChat={isGroupChat}
                          readByCount={receiptSummary.readCount}
                          totalRecipients={receiptSummary.totalRecipients}
                          className="ml-0"
                        />
                      )}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'mt-0.5 px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap shadow-sm',
                      isOwn
                        ? 'pulse-own-bubble rounded-tr-sm'
                        : 'bg-muted text-foreground rounded-tl-sm'
                    )}
                  >
                    {linkify(msg.content)}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Rich message editor (emoji, mentions, attachments, IA, dictation…) */}
      <div className="border-t bg-background">
        <MessageEditor
          conversationId={conversationId}
          onTyping={() => {}}
          placeholder="Écrire un message…"
          compactMode
        />
      </div>
    </>
  )
})

export const PulseFloatingChat = memo(PulseFloatingChatInner)
export default PulseFloatingChat
