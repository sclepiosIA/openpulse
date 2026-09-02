import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Building2,
  Hash,
  Lock,
  Users,
  Pin,
  Notebook,
  Megaphone,
  ChevronDown,
  MessageCircle,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { PulseConversation, PulsePresence } from '@/types/pulse'
import { useState, useMemo } from 'react'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { useAuth } from '@/components/AuthProvider'
import {
  isDMConversation,
  getDmCounterpart,
  getDmCounterpartDisplayName,
  extractOtherNameFromConversationName,
} from '@/lib/pulse/dmCounterpart'
import { getLastMessagePreview } from '@/lib/pulse/lastMessagePreview'
import { VirtualizedConversationList } from './VirtualizedConversationList'
import { IconCircle } from '@/components/ui/icon-circle'

// Threshold for using virtualization (total conversations across all groups)
const VIRTUALIZATION_THRESHOLD = 50

interface ConversationListProps {
  conversations: PulseConversation[]
  selectedId: string | null
  onSelect: (id: string) => void
  onlineUsers: PulsePresence[]
  globalOnlineUserIds?: Set<string>
}

// Generate a deterministic color based on string hash
function getAvatarColor(str: string): string {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-pink-500',
  ]

  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}

type ConversationGroup = {
  id: string
  label: string
  icon: React.ReactNode
  conversations: PulseConversation[]
  defaultOpen: boolean
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onlineUsers,
  globalOnlineUserIds,
}: ConversationListProps) {
  // Use PROFILE ID (not auth user ID) for stable DM identification
  // pulse_conversation_members.user_id contains profiles.id, not auth.users.id
  const { user } = useAuth()
  const { data: currentProfile, isLoading: isLoadingProfile } = useCurrentProfile()
  const myProfileId = currentProfile?.id
  const myFullName = currentProfile
    ? `${currentProfile.prenom || ''} ${currentProfile.nom || ''}`.trim()
    : null
  // Use auth email as most reliable fallback (available immediately)
  const myEmail = user?.email || currentProfile?.email || null

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    pinned: true,
    dms: true,
    teams: true,
    recent: true,
    personal: true,
  })

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getOnlineCount = (conversation: PulseConversation) => {
    if (!conversation.members) return 0
    return conversation.members.filter((m) =>
      onlineUsers.some((u) => u.user_id === m.user_id && u.status === 'active')
    ).length
  }

  // Grouper les conversations par type
  const groups = useMemo((): ConversationGroup[] => {
    const pinned: PulseConversation[] = []
    const dms: PulseConversation[] = []
    const teams: PulseConversation[] = []
    const recent: PulseConversation[] = []
    const personal: PulseConversation[] = []

    conversations.forEach((conv) => {
      const metadata = conv.metadata as Record<string, unknown> | null
      const type = metadata?.type as string | undefined
      const isPinned = metadata?.pinned === true

      // Accepter 'personal' ET 'personal_notes' comme notes personnelles
      if (type === 'personal_notes' || type === 'personal') {
        personal.push(conv)
      } else if (type === 'dm') {
        if (isPinned) {
          pinned.push(conv)
        } else {
          dms.push(conv)
        }
      } else if (type?.startsWith('team_')) {
        if (isPinned) {
          pinned.push(conv)
        } else {
          teams.push(conv)
        }
      } else if (isPinned) {
        pinned.push(conv)
      } else {
        recent.push(conv)
      }
    })

    // Trier les DMs par date de dernière activité
    dms.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

    const result: ConversationGroup[] = []

    if (pinned.length > 0) {
      result.push({
        id: 'pinned',
        label: 'Canaux',
        icon: <Pin className="h-3.5 w-3.5" />,
        conversations: pinned,
        defaultOpen: true,
      })
    }

    if (dms.length > 0) {
      result.push({
        id: 'dms',
        label: 'Messages directs',
        icon: <MessageCircle className="h-3.5 w-3.5" />,
        conversations: dms,
        defaultOpen: true,
      })
    }

    if (teams.length > 0) {
      result.push({
        id: 'teams',
        label: 'Équipes',
        icon: <Users className="h-3.5 w-3.5" />,
        conversations: teams,
        defaultOpen: true,
      })
    }

    if (recent.length > 0) {
      result.push({
        id: 'recent',
        label: 'Conversations',
        icon: <Hash className="h-3.5 w-3.5" />,
        conversations: recent,
        defaultOpen: true,
      })
    }

    if (personal.length > 0) {
      result.push({
        id: 'personal',
        label: 'Notes personnelles',
        icon: <Notebook className="h-3.5 w-3.5" />,
        conversations: personal,
        defaultOpen: false,
      })
    }

    return result
  }, [conversations])

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))
  }

  const renderConversationItem = (conversation: PulseConversation) => {
    const isSelected = selectedId === conversation.id
    const onlineCount = getOnlineCount(conversation)
    const memberCount = conversation.members?.length || 0
    const unreadCount = conversation.unread_count || 0
    const metadata = conversation.metadata as Record<string, unknown> | null
    const type = metadata?.type as string | undefined

    // Pour les DMs, obtenir l'interlocuteur via l'helper stable
    // IMPORTANT: Use profile ID, not auth user ID, with email as most reliable fallback
    const isDM = isDMConversation(conversation)
    const dmCounterpart = isDM
      ? getDmCounterpart(conversation, myProfileId, myFullName, myEmail)
      : null

    // Display name logic with improved fallbacks
    let displayName: string
    if (isDM) {
      if (dmCounterpart) {
        // Best case: we identified the counterpart
        displayName = getDmCounterpartDisplayName(dmCounterpart, conversation.name)
      } else if (myFullName && conversation.name?.includes(' & ')) {
        // Fallback: extract the other name from conversation name
        displayName = extractOtherNameFromConversationName(conversation.name, myFullName)
      } else if (myEmail && conversation.name?.includes(' & ')) {
        // Fallback with email: use conversation name as-is but it's better than nothing
        displayName = conversation.name || 'Message direct'
      } else if (isLoadingProfile) {
        // Still loading: use conversation name (not "...")
        displayName = conversation.name || 'Message direct'
      } else {
        displayName = conversation.name || 'Message direct'
      }
    } else {
      displayName = conversation.name
    }

    // Vérifier si l'interlocuteur est en ligne (pour DMs)
    // Priorité : globalOnlineUserIds (tous les utilisateurs) > onlineUsers (conversation sélectionnée)
    const isRecipientOnline =
      isDM &&
      dmCounterpart &&
      (globalOnlineUserIds?.has(dmCounterpart.id) ||
        onlineUsers.some((u) => u.user_id === dmCounterpart.id && u.status === 'active'))

    const isPinned = metadata?.pinned === true
    const customAvatarUrl = metadata?.avatar_url as string | undefined
    const colorClass = getAvatarColor(displayName)

    return (
      <button
        key={conversation.id}
        onClick={() => onSelect(conversation.id)}
        className={cn(
          'w-full px-3 py-3.5 flex items-start gap-3 text-left transition-all rounded-lg mx-1',
          'min-h-[64px]', // Touch target minimum
          'active:scale-[0.98] active:bg-accent/80', // Feedback visuel
          'hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isSelected && 'bg-accent shadow-sm',
          unreadCount > 0 && !isSelected && 'bg-blue-50/50 dark:bg-blue-950/20'
        )}
      >
        {/* Avatar / Icon - Enhanced */}
        <div className="relative flex-shrink-0">
          <Avatar
            className={cn(
              'h-11 w-11 transition-all duration-200',
              unreadCount > 0 && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
              isPinned && unreadCount === 0 && 'ring-1 ring-amber-400/50'
            )}
          >
            {/* Priority: DM counterpart avatar > Custom conversation avatar > Type-specific fallback */}
            {/* Priority: DM counterpart avatar > Custom avatar > Etablissement logo */}
            {isDM && dmCounterpart?.avatar_url ? (
              <AvatarImage
                src={dmCounterpart.avatar_url}
                alt={displayName}
                className="object-cover"
              />
            ) : customAvatarUrl ? (
              <AvatarImage src={customAvatarUrl} alt={conversation.name} className="object-cover" />
            ) : conversation.etablissement?.logo_url ? (
              <AvatarImage
                src={conversation.etablissement.logo_url}
                alt={conversation.etablissement.nom}
                className="object-contain p-0.5"
              />
            ) : null}

            {isDM && dmCounterpart ? (
              <AvatarFallback
                className={cn('bg-gradient-to-br text-white text-sm font-semibold', colorClass)}
              >
                {getInitials(displayName)}
              </AvatarFallback>
            ) : conversation.etablissement ? (
              <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground text-sm shadow-sm">
                <Building2 className="h-5 w-5" />
              </AvatarFallback>
            ) : type === 'personal_notes' || type === 'personal' ? (
              <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-500 text-white text-sm shadow-sm">
                <Notebook className="h-5 w-5" />
              </AvatarFallback>
            ) : type === 'team_annonces' ? (
              <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 text-white text-sm shadow-sm">
                <Megaphone className="h-5 w-5" />
              </AvatarFallback>
            ) : type?.startsWith('team_') ? (
              <AvatarFallback className="bg-gradient-to-br from-violet-400 to-violet-600 text-white text-sm font-semibold shadow-sm">
                {getInitials(conversation.name)}
              </AvatarFallback>
            ) : (
              <AvatarFallback
                className={cn('bg-gradient-to-br text-white text-sm font-semibold', colorClass)}
              >
                {getInitials(conversation.name)}
              </AvatarFallback>
            )}
          </Avatar>

          {/* Online/Offline indicator for DMs */}
          {isDM && dmCounterpart && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
              {isRecipientOnline ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-emerald-500 border-[1.5px] sm:border-2 border-card" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-gray-400 border-[1.5px] sm:border-2 border-card" />
              )}
            </span>
          )}

          {/* Online indicator for groups */}
          {!isDM && onlineCount > 0 && type !== 'personal_notes' && type !== 'personal' && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-emerald-500 border-[1.5px] sm:border-2 border-card" />
            </span>
          )}

          {/* Pinned indicator */}
          {isPinned && (
            <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
              <Pin className="h-2.5 w-2.5" />
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {!isDM && conversation.visibility === 'private' && type !== 'personal_notes' ? (
              <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            ) : !isDM && type !== 'personal_notes' ? (
              <Hash className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            ) : null}
            <span
              className={cn(
                'font-medium truncate text-sm',
                unreadCount > 0 && 'font-bold text-foreground'
              )}
            >
              {displayName}
            </span>
            {unreadCount > 0 && (
              <Badge className="ml-auto flex-shrink-0 h-5 min-w-5 text-xs justify-center bg-primary text-primary-foreground font-semibold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </div>

          {(() => {
            const preview = getLastMessagePreview(conversation, myProfileId, isDM)
            return preview ? (
              <p
                className={cn(
                  'text-xs truncate mt-0.5',
                  unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}
              >
                {preview}
              </p>
            ) : null
          })()}

          {conversation.etablissement && (
            <p className="text-xs text-muted-foreground/80 truncate mt-0.5">
              {conversation.etablissement.nom}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            {!isDM && type !== 'personal_notes' && (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{memberCount}</span>
              </div>
            )}
            {!isDM && onlineCount > 0 && type !== 'personal_notes' && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                • {onlineCount} en ligne
              </span>
            )}
            <span className="ml-auto text-muted-foreground/70">
              {formatDistanceToNow(new Date(conversation.updated_at), {
                addSuffix: false,
                locale: fr,
              })}
            </span>
          </div>
        </div>
      </button>
    )
  }

  // Calculate total conversations count
  const totalConversations = useMemo(
    () => groups.reduce((sum, g) => sum + g.conversations.length, 0),
    [groups]
  )

  // Use virtualization for large lists
  if (totalConversations > VIRTUALIZATION_THRESHOLD) {
    // Flatten all conversations for virtualized rendering
    const allConversations = groups.flatMap((g) => g.conversations)
    return (
      <VirtualizedConversationList
        conversations={allConversations}
        selectedId={selectedId}
        onSelect={onSelect}
        onlineUsers={onlineUsers}
        globalOnlineUserIds={globalOnlineUserIds}
      />
    )
  }

  if (groups.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p className="text-sm">Aucune conversation</p>
      </div>
    )
  }

  // Get icon component for each group
  const getGroupIcon = (groupId: string) => {
    switch (groupId) {
      case 'pinned':
        return Pin
      case 'dms':
        return MessageCircle
      case 'teams':
        return Users
      case 'recent':
        return Hash
      case 'personal':
        return Notebook
      default:
        return MessageCircle
    }
  }

  // Get accent color for each group
  const getGroupColor = (
    groupId: string
  ): 'primary' | 'accent' | 'success' | 'warning' | 'muted' => {
    switch (groupId) {
      case 'pinned':
        return 'warning'
      case 'dms':
        return 'primary'
      case 'teams':
        return 'accent'
      case 'recent':
        return 'muted'
      case 'personal':
        return 'warning'
      default:
        return 'primary'
    }
  }

  // Get border color for items
  const getItemBorderColor = (groupId: string) => {
    switch (groupId) {
      case 'pinned':
        return 'border-l-amber-500'
      case 'dms':
        return 'border-l-primary'
      case 'teams':
        return 'border-l-violet-500'
      case 'recent':
        return 'border-l-muted-foreground/30'
      case 'personal':
        return 'border-l-amber-400'
      default:
        return 'border-l-primary'
    }
  }

  return (
    <div className="py-2">
      {groups.map((group) => {
        const GroupIcon = getGroupIcon(group.id)
        const groupColor = getGroupColor(group.id)
        const itemBorderColor = getItemBorderColor(group.id)
        const hasUnread = group.conversations.some((c) => (c.unread_count || 0) > 0)

        return (
          <Collapsible
            key={group.id}
            open={openGroups[group.id] ?? group.defaultOpen}
            onOpenChange={() => toggleGroup(group.id)}
          >
            <CollapsibleTrigger className="group flex items-center gap-3 w-full px-4 py-2.5 text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider hover:text-muted-foreground transition-colors">
              <IconCircle
                icon={GroupIcon}
                variant="soft"
                color={groupColor}
                size="xs"
                className="transition-transform duration-200 group-hover:scale-110"
              />
              <span className="flex-1 text-left">{group.label}</span>
              {hasUnread && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
              <span className="text-xs font-normal opacity-70 tabular-nums">
                {group.conversations.length}
              </span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-200',
                  !(openGroups[group.id] ?? group.defaultOpen) && '-rotate-90'
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              {/* Timeline container with vertical line */}
              <div className="relative pl-4 ml-4">
                {/* Vertical timeline line */}
                <div
                  className={cn(
                    'absolute left-0 top-0 bottom-0 w-0.5 rounded-full',
                    group.id === 'dms' &&
                      'bg-gradient-to-b from-primary/40 via-primary/20 to-transparent',
                    group.id === 'teams' &&
                      'bg-gradient-to-b from-violet-500/40 via-violet-500/20 to-transparent',
                    group.id === 'pinned' &&
                      'bg-gradient-to-b from-amber-500/40 via-amber-500/20 to-transparent',
                    group.id === 'personal' &&
                      'bg-gradient-to-b from-amber-400/40 via-amber-400/20 to-transparent',
                    group.id === 'recent' &&
                      'bg-gradient-to-b from-muted-foreground/20 via-muted-foreground/10 to-transparent'
                  )}
                />

                {group.conversations.map((conversation, index) => {
                  const isSelected = selectedId === conversation.id
                  const unreadCount = conversation.unread_count || 0

                  return (
                    <div key={conversation.id} className="relative">
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          'absolute -left-[5px] top-5 w-2.5 h-2.5 rounded-full border-2 border-background transition-all',
                          unreadCount > 0 && 'ring-2 ring-primary/30',
                          isSelected
                            ? 'bg-primary scale-125'
                            : unreadCount > 0
                              ? 'bg-primary'
                              : 'bg-muted-foreground/30'
                        )}
                      >
                        {unreadCount > 0 && !isSelected && (
                          <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-50" />
                        )}
                      </div>

                      {/* Conversation item with accent border */}
                      <div className={cn('pl-4', itemBorderColor)}>
                        {renderConversationItemWithBorder(conversation, itemBorderColor)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )

  // Render conversation item with accent border
  function renderConversationItemWithBorder(conversation: PulseConversation, borderColor: string) {
    const isSelected = selectedId === conversation.id
    const onlineCount = getOnlineCount(conversation)
    const memberCount = conversation.members?.length || 0
    const unreadCount = conversation.unread_count || 0
    const metadata = conversation.metadata as Record<string, unknown> | null
    const type = metadata?.type as string | undefined

    const isDM = isDMConversation(conversation)
    const dmCounterpart = isDM
      ? getDmCounterpart(conversation, myProfileId, myFullName, myEmail)
      : null

    let displayName: string
    if (isDM) {
      if (dmCounterpart) {
        displayName = getDmCounterpartDisplayName(dmCounterpart, conversation.name)
      } else if (myFullName && conversation.name?.includes(' & ')) {
        displayName = extractOtherNameFromConversationName(conversation.name, myFullName)
      } else {
        displayName = conversation.name || 'Message direct'
      }
    } else {
      displayName = conversation.name
    }

    const isRecipientOnline =
      isDM &&
      dmCounterpart &&
      (globalOnlineUserIds?.has(dmCounterpart.id) ||
        onlineUsers.some((u) => u.user_id === dmCounterpart.id && u.status === 'active'))

    const isPinned = metadata?.pinned === true
    const customAvatarUrl = metadata?.avatar_url as string | undefined
    const colorClass = getAvatarColor(displayName)

    return (
      <button
        onClick={() => onSelect(conversation.id)}
        className={cn(
          'w-full px-3 py-3 flex items-start gap-3 text-left transition-all rounded-xl',
          'border-l-4 border-transparent',
          'min-h-[64px]',
          'active:scale-[0.98]',
          'hover:bg-card/60 hover:shadow-sm hover:backdrop-blur-sm',
          isSelected && cn('bg-card/80 shadow-md', borderColor),
          unreadCount > 0 &&
            !isSelected &&
            cn('bg-primary/5', borderColor.replace('border-l-', 'border-l-').replace('500', '300'))
        )}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Avatar
            className={cn(
              'h-10 w-10 transition-all duration-200',
              unreadCount > 0 && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
              isPinned && unreadCount === 0 && 'ring-1 ring-amber-400/50'
            )}
          >
            {isDM && dmCounterpart?.avatar_url ? (
              <AvatarImage
                src={dmCounterpart.avatar_url}
                alt={displayName}
                className="object-cover"
              />
            ) : customAvatarUrl ? (
              <AvatarImage src={customAvatarUrl} alt={conversation.name} className="object-cover" />
            ) : null}

            {isDM && dmCounterpart ? (
              <AvatarFallback
                className={cn('bg-gradient-to-br text-white text-sm font-semibold', colorClass)}
              >
                {getInitials(displayName)}
              </AvatarFallback>
            ) : conversation.etablissement ? (
              <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground text-sm shadow-sm">
                <Building2 className="h-5 w-5" />
              </AvatarFallback>
            ) : type === 'personal_notes' || type === 'personal' ? (
              <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-500 text-white text-sm shadow-sm">
                <Notebook className="h-5 w-5" />
              </AvatarFallback>
            ) : type === 'team_annonces' ? (
              <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 text-white text-sm shadow-sm">
                <Megaphone className="h-5 w-5" />
              </AvatarFallback>
            ) : type?.startsWith('team_') ? (
              <AvatarFallback className="bg-gradient-to-br from-violet-400 to-violet-600 text-white text-sm font-semibold shadow-sm">
                {getInitials(conversation.name)}
              </AvatarFallback>
            ) : (
              <AvatarFallback
                className={cn('bg-gradient-to-br text-white text-sm font-semibold', colorClass)}
              >
                {getInitials(conversation.name)}
              </AvatarFallback>
            )}
          </Avatar>

          {/* Online indicator */}
          {isDM && dmCounterpart && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
              {isRecipientOnline ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-background" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-400 border-2 border-background" />
              )}
            </span>
          )}

          {!isDM && onlineCount > 0 && type !== 'personal_notes' && type !== 'personal' && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-background" />
            </span>
          )}

          {isPinned && (
            <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
              <Pin className="h-2.5 w-2.5" />
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {!isDM && conversation.visibility === 'private' && type !== 'personal_notes' ? (
              <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            ) : !isDM && type !== 'personal_notes' ? (
              <Hash className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            ) : null}
            <span
              className={cn(
                'font-medium truncate text-sm',
                unreadCount > 0 && 'font-bold text-foreground'
              )}
            >
              {displayName}
            </span>
            {unreadCount > 0 && (
              <Badge className="ml-auto flex-shrink-0 h-5 min-w-5 text-xs justify-center bg-primary text-primary-foreground font-semibold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </div>

          {conversation.etablissement && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {conversation.etablissement.nom}
            </p>
          )}

          {(() => {
            const preview = getLastMessagePreview(conversation, myProfileId, isDM)
            return preview ? (
              <p
                className={cn(
                  'text-xs truncate mt-0.5',
                  unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}
              >
                {preview}
              </p>
            ) : null
          })()}

          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            {!isDM && type !== 'personal_notes' && (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{memberCount}</span>
              </div>
            )}
            {!isDM && onlineCount > 0 && type !== 'personal_notes' && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                • {onlineCount} en ligne
              </span>
            )}
            <span className="ml-auto text-muted-foreground/70">
              {formatDistanceToNow(new Date(conversation.updated_at), {
                addSuffix: false,
                locale: fr,
              })}
            </span>
          </div>
        </div>
      </button>
    )
  }
}
