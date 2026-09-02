import { useRef, useEffect, useCallback, useState } from 'react'
import {
  ChevronLeft,
  Hash,
  Lock,
  MoreVertical,
  Phone,
  Search,
  Settings,
  Sparkles,
  ListTodo,
  MessageCircle,
  Archive,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  usePulseConversation,
  useArchivePulseConversation,
} from '@/hooks/pulse/usePulseConversations'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { useAuth } from '@/components/AuthProvider'
import { Avatar } from '@/components/ui/avatar'
import { UserAvatarWithStatus } from './UserAvatarWithStatus'

import { usePulseMessages, useSendPulseMessage } from '@/hooks/pulse/usePulseMessages'
import { usePulsePresence } from '@/hooks/pulse/usePulsePresence'
import { usePulseVisio } from '@/hooks/pulse/usePulseVisio'
import { usePulseMessageReceipts } from '@/hooks/pulse/usePulseMessageReceipts'
import { useQueryClient } from '@tanstack/react-query'
import { pulseUnreadKeys } from '@/hooks/pulse/usePulseUnreadCount'
import { MessageList } from './MessageList'
import { MessageEditor } from './MessageEditor'
import { TypingIndicator } from './TypingIndicator'
import { ConversationSettingsSheet } from './ConversationSettingsSheet'
import { StartVisioButton } from './StartVisioButton'
import { VisioOverlay } from '@/components/visio/VisioOverlay'
import { AudioCallOverlay } from './AudioCallOverlay'
import { SmartTasksDialog } from '@/components/email/SmartTasksDialog'
import { EtablissementContextBanner } from './EtablissementContextBanner'
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
import type { PulsePresence } from '@/types/pulse'
import { cn } from '@/lib/utils'
import {
  isDMConversation,
  getDmCounterpart,
  getDmCounterpartDisplayName,
  extractOtherNameFromConversationName,
} from '@/lib/pulse/dmCounterpart'

interface ConversationDetailProps {
  conversationId: string
  typingUsers: string[]
  onlineUsers: PulsePresence[]
  globalOnlineUserIds?: Set<string>
  onOpenMobileSidebar: () => void
  onOpenSearch?: () => void
  onToggleAI?: () => void
  showAIPanel?: boolean
  isMobileView?: boolean
}

export function ConversationDetail({
  conversationId,
  typingUsers,
  onlineUsers,
  globalOnlineUserIds,
  onOpenMobileSidebar,
  onOpenSearch,
  onToggleAI,
  showAIPanel,
  isMobileView = false,
}: ConversationDetailProps) {
  const [showSettingsSheet, setShowSettingsSheet] = useState(false)
  const [activeVisio, setActiveVisio] = useState<{ roomCode: string; roomName: string } | null>(
    null
  )
  const [activeAudioCall, setActiveAudioCall] = useState<{
    roomCode: string
    roomName: string
  } | null>(null)
  const [showSmartTasksDialog, setShowSmartTasksDialog] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const archiveConversation = useArchivePulseConversation()

  // Use PROFILE ID (not auth user ID) for stable DM counterpart identification
  // pulse_conversation_members.user_id contains profiles.id, not auth.users.id
  const { user } = useAuth()
  const { data: currentProfile, isLoading: isLoadingProfile } = useCurrentProfile()
  const myProfileId = currentProfile?.id
  const myFullName = currentProfile
    ? `${currentProfile.prenom || ''} ${currentProfile.nom || ''}`.trim()
    : null
  // Use auth email as most reliable fallback (available immediately)
  const myEmail = user?.email || currentProfile?.email || null

  const { isCreating: isCreatingAudioCall, createVisioLink } = usePulseVisio()

  const { data: conversation, isLoading: isLoadingConversation } =
    usePulseConversation(conversationId)
  const {
    data: messagesData,
    isLoading: isLoadingMessages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePulseMessages(conversationId)

  const { setTyping } = usePulsePresence(conversationId)
  const sendMessage = useSendPulseMessage()
  const { markAsRead } = usePulseMessageReceipts(conversationId)
  const queryClient = useQueryClient()

  // Handle visio link insertion
  const handleVisioLink = useCallback(
    (link: string, provider: 'marque_meet' | 'google_meet' | 'nextcloud_talk') => {
      const providerNames: Record<string, string> = {
        marque_meet: 'OpenPulse Meet',
        google_meet: 'Google Meet',
        nextcloud_talk: 'Nextcloud Talk',
      }
      const providerName = providerNames[provider] || provider

      // Construire le lien complet pour OpenPulse Meet
      const fullLink = provider === 'marque_meet' ? `${window.location.origin}${link}` : link

      // Envoyer le message dans le chat
      sendMessage.mutate({
        conversation_id: conversationId,
        content: `📹 Visio ${providerName} démarrée : ${fullLink}`,
      })

      // Pour OpenPulse Meet, ouvrir inline
      if (provider === 'marque_meet') {
        const roomCode = link.replace('/visio/', '')
        setActiveVisio({ roomCode, roomName: conversation?.name || 'Visio' })
      } else {
        // Pour les autres providers, ouvrir dans un nouvel onglet
        window.open(link, '_blank')
      }
    },
    [conversationId, sendMessage, conversation?.name]
  )

  // Handle joining a visio from a message
  const handleJoinVisio = useCallback(
    (roomCode: string) => {
      setActiveVisio({ roomCode, roomName: conversation?.name || 'Visio' })
    },
    [conversation?.name]
  )

  // Start audio call
  const handleStartAudioCall = useCallback(async () => {
    const result = await createVisioLink(
      'marque_meet',
      `Appel: ${conversation?.name}`,
      conversationId
    )
    if (result) {
      const roomCode = result.link.replace('/visio/', '')
      // Send message to chat
      sendMessage.mutate({
        conversation_id: conversationId,
        content: `📞 Appel vocal démarré : ${window.location.origin}${result.link}`,
      })
      setActiveAudioCall({ roomCode, roomName: conversation?.name || 'Appel' })
    }
  }, [createVisioLink, conversation?.name, conversationId, sendMessage])

  // Aplatir les pages de messages
  const messages = messagesData?.pages.flatMap((page) => page.messages).reverse() || []

  // Marquer les messages comme lus quand on ouvre la conversation - avec délai
  // L'utilisateur doit rester dans la conversation au moins 1 seconde
  useEffect(() => {
    if (!conversationId || messages.length === 0 || isLoadingMessages) return

    const timer = setTimeout(() => {
      markAsRead()
      // Invalider le compteur de badges
      queryClient.invalidateQueries({ queryKey: pulseUnreadKeys.total })
    }, 1000)

    return () => clearTimeout(timer)
  }, [conversationId, messages.length, isLoadingMessages, markAsRead, queryClient])

  // Scroll to bottom quand nouveaux messages
  const scrollToBottom = useCallback((instant = false) => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(
      '[data-radix-scroll-area-viewport]'
    )
    const doScroll = () => {
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: instant ? 'auto' : 'smooth',
        })
      } else {
        messagesEndRef.current?.scrollIntoView({
          behavior: instant ? 'auto' : 'smooth',
          block: 'end',
        })
      }
    }
    // Double rAF to ensure DOM is painted before measuring scrollHeight
    requestAnimationFrame(() => requestAnimationFrame(doScroll))
  }, [])

  // Track if user is near bottom to auto-scroll on new messages
  const isNearBottomRef = useRef(true)
  const prevMessageCountRef = useRef(0)
  const prevLastMessageIdRef = useRef<string | null>(null)
  const prevConversationIdRef = useRef<string | null>(null)
  // Own profile id ref — declared before any early return to keep hook order stable
  const ownProfileIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    // On conversation change: scroll to bottom instantly
    if (conversationId !== prevConversationIdRef.current) {
      prevConversationIdRef.current = conversationId
      prevMessageCountRef.current = messages.length
      prevLastMessageIdRef.current = messages[messages.length - 1]?.id ?? null
      scrollToBottom(true)
      return
    }

    const lastMessage = messages[messages.length - 1]
    const lastId = lastMessage?.id ?? null

    // New messages arrived (count grew or last id changed)
    if (
      messages.length > prevMessageCountRef.current ||
      (lastId && lastId !== prevLastMessageIdRef.current)
    ) {
      const isOwnLast =
        lastMessage && ownProfileIdRef.current
          ? lastMessage.user_id === ownProfileIdRef.current
          : false
      // Always scroll for own messages; otherwise only if near bottom
      if (isOwnLast || isNearBottomRef.current) {
        scrollToBottom()
      }
    }
    prevMessageCountRef.current = messages.length
    prevLastMessageIdRef.current = lastId
  }, [conversationId, messages, scrollToBottom])

  // Infinite scroll pour charger plus de messages + track if user is near bottom
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement
      // Load more when near top
      if (target.scrollTop < 100 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
      // Track if user is near bottom (within 150px)
      const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight
      isNearBottomRef.current = distanceFromBottom < 150
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  )

  const getOnlineCount = () => {
    if (!conversation?.members) return 0
    return conversation.members.filter((m) =>
      onlineUsers.some((u) => u.user_id === m.user_id && u.status === 'active')
    ).length
  }

  if (isLoadingConversation) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="h-14 md:h-16 border-b px-4 flex items-center gap-4">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`conversation-detail-loading-${i}`} className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-16 w-3/4 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Conversation introuvable
      </div>
    )
  }

  const onlineCount = getOnlineCount()
  const metadata = conversation.metadata as Record<string, unknown> | null
  const metadataType = metadata?.type
  const isPersonal = metadataType === 'personal' || metadataType === 'personal_notes'
  const fallbackProfileId = myEmail
    ? conversation.members?.find((member) => member.user?.email === myEmail)?.user_id
    : undefined
  const effectiveMyProfileId = myProfileId || fallbackProfileId
  ownProfileIdRef.current = effectiveMyProfileId

  // Use stable DM detection and counterpart extraction with PROFILE ID, full name, and email fallback
  const isDM = isDMConversation(conversation)
  const dmCounterpart = isDM
    ? getDmCounterpart(conversation, myProfileId, myFullName, myEmail)
    : null

  // Use global presence first (more reliable), fallback to local conversation presence
  const isRecipientOnline =
    isDM &&
    dmCounterpart &&
    (globalOnlineUserIds?.has(dmCounterpart.id) ||
      onlineUsers.some((u) => u.user_id === dmCounterpart.id && u.status === 'active'))

  // Stable display name using helper with improved fallback
  const displayName = isDM
    ? getDmCounterpartDisplayName(
        dmCounterpart,
        myFullName && conversation.name?.includes(' & ')
          ? extractOtherNameFromConversationName(conversation.name, myFullName)
          : conversation.name
      )
    : conversation.name

  const getInitials = (nom?: string, prenom?: string) => {
    if (!nom && !prenom) return '?'
    return `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase()
  }

  return (
    <div
      className={cn(
        'flex flex-col relative overflow-hidden',
        isMobileView ? 'h-[100dvh]' : 'h-full flex-1 min-h-0'
      )}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-page" />
      {/* Wave decoration - seulement desktop */}
      {!isMobileView && (
        <div className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden opacity-40 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 1440 60" preserveAspectRatio="none">
            <path
              d="M0,30 C320,50 420,10 720,35 C1020,55 1200,20 1440,40 L1440,60 L0,60 Z"
              fill="currentColor"
              className="text-primary/10"
            />
          </svg>
        </div>
      )}
      {/* Content layer */}
      <div
        className={cn(
          'relative z-10 flex flex-col overflow-hidden',
          isMobileView ? 'h-full' : 'h-full flex-1 min-h-0'
        )}
      >
        {/* Header - Premium Immersive sur mobile, glassmorphism sur desktop */}
        <header
          className={cn(
            'flex items-center gap-2 flex-shrink-0 min-w-0',
            isMobileView
              ? 'h-14 px-3 bg-marque-grille text-white'
              : 'h-14 md:h-16 md:px-4 md:gap-3 px-3 border-b border-primary/10 bg-card/70 backdrop-blur-md'
          )}
        >
          {/* Bouton retour mobile */}
          <Button
            variant="ghost"
            size="icon"
            className={cn('md:hidden flex-shrink-0', isMobileView && 'text-white hover:bg-card/10')}
            onClick={onOpenMobileSidebar}
            aria-label="Retour à la liste"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          {/* Avatar pour DM - using UserAvatarWithStatus for rich status */}
          {isDM && dmCounterpart && (
            <UserAvatarWithStatus
              user={{
                id: dmCounterpart.id,
                avatar_url: dmCounterpart.avatar_url,
                nom: dmCounterpart.nom || undefined,
                prenom: dmCounterpart.prenom || undefined,
              }}
              size={isMobileView ? 'sm' : 'md'}
              showStatus={true}
              status={isRecipientOnline ? 'active' : 'offline'}
            />
          )}

          {/* Info conversation */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {!isDM &&
                (conversation.visibility === 'private' ? (
                  <Lock
                    className={cn(
                      'h-4 w-4 flex-shrink-0',
                      isMobileView ? 'text-white/70' : 'text-muted-foreground'
                    )}
                  />
                ) : (
                  <Hash
                    className={cn(
                      'h-4 w-4 flex-shrink-0',
                      isMobileView ? 'text-white/70' : 'text-muted-foreground'
                    )}
                  />
                ))}
              {isDM && (
                <MessageCircle
                  className={cn(
                    'h-4 w-4 flex-shrink-0',
                    isMobileView ? 'text-white/70' : 'text-muted-foreground'
                  )}
                />
              )}
              <h2
                className={cn(
                  'font-semibold truncate text-sm md:text-base',
                  isMobileView && 'text-white'
                )}
              >
                {displayName}
              </h2>
            </div>
            <p
              className={cn(
                'text-xs md:text-sm truncate',
                isMobileView ? 'text-white/70' : 'text-muted-foreground'
              )}
            >
              {isPersonal ? (
                'Notes personnelles'
              ) : isDM ? (
                isRecipientOnline ? (
                  <span
                    className={
                      isMobileView ? 'text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'
                    }
                  >
                    En ligne
                  </span>
                ) : (
                  <span className={isMobileView ? 'text-white/50' : 'text-muted-foreground'}>
                    Hors ligne
                  </span>
                )
              ) : (
                <>
                  {conversation.members?.length || 0} membre
                  {(conversation.members?.length || 0) > 1 ? 's' : ''}
                  {onlineCount > 0 && (
                    <span
                      className={
                        isMobileView
                          ? 'text-emerald-300 ml-2'
                          : 'text-emerald-600 dark:text-emerald-400 ml-2'
                      }
                    >
                      • {onlineCount} en ligne
                    </span>
                  )}
                </>
              )}
            </p>
          </div>

          {/* Actions - glassmorphism blanc sur mobile bleu, coloré sur desktop */}
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0">
            {/* Search - glassmorphism primaire */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 md:h-8 md:w-8 backdrop-blur-sm shadow-sm transition-all',
                    isMobileView
                      ? 'bg-card/10 border border-white/20 hover:bg-card/20'
                      : 'hidden sm:flex bg-card/60 border border-primary/15 hover:bg-card/80 hover:border-primary/25'
                  )}
                  onClick={onOpenSearch}
                  aria-label="Rechercher dans la conversation"
                >
                  <Search className={cn('h-4 w-4', isMobileView ? 'text-white' : 'text-primary')} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6} className="z-[60]">
                Rechercher
              </TooltipContent>
            </Tooltip>

            {/* Audio call button - glassmorphism vert */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 md:h-8 md:w-8 backdrop-blur-sm shadow-sm transition-all',
                    isMobileView
                      ? 'bg-card/10 border border-white/20 hover:bg-card/20'
                      : 'bg-emerald-50/80 border border-emerald-200/50 hover:bg-emerald-100/90 hover:border-emerald-300/60'
                  )}
                  onClick={handleStartAudioCall}
                  disabled={isCreatingAudioCall}
                  aria-label="Démarrer un appel vocal"
                >
                  <Phone
                    className={cn('h-4 w-4', isMobileView ? 'text-white' : 'text-emerald-600')}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6} className="z-[60]">
                Appel vocal
              </TooltipContent>
            </Tooltip>

            {/* Visio button - glassmorphism bleu */}
            <StartVisioButton
              conversationId={conversationId}
              conversationName={conversation.name}
              onLinkCreated={handleVisioLink}
              isMobileView={isMobileView}
            />

            {/* IA button - glassmorphism violet - desktop only */}
            {!isMobileView && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-8 w-8 hidden md:flex backdrop-blur-sm shadow-sm transition-all',
                      showAIPanel
                        ? 'bg-violet-500 text-white border border-violet-400 hover:bg-violet-600'
                        : 'bg-violet-50/80 border border-violet-200/50 hover:bg-violet-100/90 hover:border-violet-300/60'
                    )}
                    onClick={onToggleAI}
                    aria-label="Basculer l'assistant IA"
                  >
                    <Sparkles
                      className={cn(
                        'h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4',
                        showAIPanel ? 'text-white' : 'text-violet-600'
                      )}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="z-[60]">
                  Assistant IA
                </TooltipContent>
              </Tooltip>
            )}

            {/* Settings button - glassmorphism neutre */}
            {!isPersonal && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-8 w-8 md:h-8 md:w-8 backdrop-blur-sm shadow-sm transition-all',
                      isMobileView
                        ? 'bg-card/10 border border-white/20 hover:bg-card/20'
                        : 'bg-card/60 border border-gray-200/50 hover:bg-card/80 hover:border-gray-300/60'
                    )}
                    onClick={() => setShowSettingsSheet(true)}
                    aria-label="Paramètres et membres"
                  >
                    <Settings
                      className={cn('h-4 w-4', isMobileView ? 'text-white' : 'text-foreground')}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="z-[60]">
                  Paramètres et membres
                </TooltipContent>
              </Tooltip>
            )}

            {/* Menu ... visible uniquement sur mobile pour accès IA et recherche */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 sm:h-8 sm:w-8 md:hidden"
                  aria-label="Plus d'options"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onOpenSearch} className="sm:hidden">
                  <Search className="h-4 w-4 mr-2" />
                  Rechercher
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleAI}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Assistant IA
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowSmartTasksDialog(true)}>
                  <ListTodo className="h-4 w-4 mr-2" />
                  Tâches intelligentes
                </DropdownMenuItem>
                {!isPersonal && !isDM && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowArchiveConfirm(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Clôturer la conversation
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Desktop menu for smart tasks */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hidden md:flex"
                  aria-label="Plus d'options"
                >
                  <MoreVertical className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowSmartTasksDialog(true)}>
                  <ListTodo className="h-4 w-4 mr-2" />
                  Tâches intelligentes
                </DropdownMenuItem>
                {!isPersonal && !isDM && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowArchiveConfirm(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Clôturer la conversation
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Bandeau contextuel établissement */}
        {conversation.etablissement_id && (
          <EtablissementContextBanner
            etablissementId={conversation.etablissement_id}
            etablissementNom={conversation.etablissement?.nom}
            etablissementLogoUrl={conversation.etablissement?.logo_url}
            isMobileView={isMobileView}
          />
        )}

        {/* Zone des messages - flex-1 avec min-h-0 pour le shrink correct */}
        <ScrollArea
          ref={scrollAreaRef}
          className="flex-1 min-h-0 overflow-hidden pulse-messages-area"
          onScrollCapture={handleScroll}
        >
          <div className={cn('min-h-full flex flex-col', isMobileView ? 'p-2' : 'p-3 md:p-4')}>
            {/* Loader pour les anciens messages */}
            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            )}

            {/* Liste des messages */}
            {isLoadingMessages ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={`conversation-message-skeleton-${i}`}
                    className="flex items-start gap-3"
                  >
                    <Skeleton
                      className={cn(
                        'rounded-full',
                        isMobileView ? 'h-7 w-7' : 'h-8 w-8 md:h-10 md:w-10'
                      )}
                    />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-16 w-3/4 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center py-12">
                  <Hash
                    className={cn(
                      'mx-auto mb-4 opacity-30',
                      isMobileView ? 'h-10 w-10' : 'h-12 w-12'
                    )}
                  />
                  <p className="font-medium">Démarrez la conversation</p>
                  <p className="text-sm mt-1">
                    {isPersonal ? 'Écrivez vos premières notes ici' : 'Envoyez le premier message'}
                  </p>
                </div>
              </div>
            ) : (
              <MessageList
                messages={messages}
                conversationId={conversationId}
                onJoinVisio={handleJoinVisio}
                isGroupChat={(conversation.members?.length || 0) > 2}
                totalRecipients={(conversation.members?.length || 1) - 1}
                currentProfileId={effectiveMyProfileId}
              />
            )}

            {/* Reference for scroll - typing indicator moved to input zone */}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Zone de saisie - fixed sur mobile pour gérer le clavier, sticky sur desktop */}
        <div
          className={cn(
            'border-t bg-card/95 backdrop-blur-md flex-shrink-0',
            isMobileView ? 'pb-[env(safe-area-inset-bottom)] z-50' : 'sticky bottom-0'
          )}
        >
          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className={cn('pt-2', isMobileView ? 'px-2' : 'px-3 md:px-4')}>
              <TypingIndicator typingUserIds={typingUsers} members={conversation.members || []} />
            </div>
          )}

          <div className={cn(isMobileView ? 'p-2' : 'p-3 md:p-4')}>
            <MessageEditor
              conversationId={conversationId}
              onTyping={setTyping}
              onMessageSent={scrollToBottom}
              placeholder={isPersonal ? 'Écrivez une note...' : 'Écrivez un message...'}
              compactMode={isMobileView}
            />
          </div>
        </div>
      </div>{' '}
      {/* End of content layer */}
      <ConversationSettingsSheet
        open={showSettingsSheet}
        onOpenChange={setShowSettingsSheet}
        conversation={conversation}
        onlineUsers={onlineUsers}
      />
      {/* Overlay Visio inline */}
      {activeVisio && (
        <VisioOverlay
          roomCode={activeVisio.roomCode}
          roomName={activeVisio.roomName}
          onClose={() => setActiveVisio(null)}
        />
      )}
      {/* Overlay Appel vocal */}
      {activeAudioCall && (
        <AudioCallOverlay
          roomCode={activeAudioCall.roomCode}
          roomName={activeAudioCall.roomName}
          onClose={() => setActiveAudioCall(null)}
        />
      )}
      {/* Smart Tasks Dialog */}
      <SmartTasksDialog
        open={showSmartTasksDialog}
        onOpenChange={setShowSmartTasksDialog}
        sourceType="pulse"
        sourceId={conversationId}
      />
      {/* Archive confirmation dialog */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer la conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir clôturer « {conversation.name} » ? La conversation sera
              archivée et n'apparaîtra plus dans la liste.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                archiveConversation.mutate(conversationId, {
                  onSuccess: () => onOpenMobileSidebar(),
                })
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clôturer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
