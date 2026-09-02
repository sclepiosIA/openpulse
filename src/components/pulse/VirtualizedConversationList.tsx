import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Building2, Hash, Lock, Users, Pin, Notebook, Megaphone } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PulseConversation, PulsePresence } from '@/types/pulse'
import { useAuth } from '@/components/AuthProvider'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import {
  isDMConversation,
  getDmCounterpart,
  getDmCounterpartDisplayName,
  extractOtherNameFromConversationName,
} from '@/lib/pulse/dmCounterpart'
import { getLastMessagePreview } from '@/lib/pulse/lastMessagePreview'

interface VirtualizedConversationListProps {
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

const ITEM_HEIGHT = 88

export function VirtualizedConversationList({
  conversations,
  selectedId,
  onSelect,
  onlineUsers,
  globalOnlineUserIds,
}: VirtualizedConversationListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const { data: currentProfile, isLoading: isLoadingProfile } = useCurrentProfile()
  const myProfileId = currentProfile?.id
  const myFullName = currentProfile
    ? `${currentProfile.prenom || ''} ${currentProfile.nom || ''}`.trim()
    : null
  const myEmail = user?.email || currentProfile?.email || null

  const virtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
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

  if (conversations.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p className="text-sm">Aucune conversation</p>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto py-2">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const conversation = conversations[virtualRow.index]
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
            } else if (myEmail && conversation.name?.includes(' & ')) {
              displayName = conversation.name || 'Message direct'
            } else if (isLoadingProfile) {
              displayName = conversation.name || 'Message direct'
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
            <div
              key={conversation.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <button
                onClick={() => onSelect(conversation.id)}
                className={cn(
                  'w-full px-3 py-3.5 flex items-start gap-3 text-left transition-all rounded-lg mx-1',
                  'min-h-[64px]',
                  'active:scale-[0.98] active:bg-accent/80',
                  'hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isSelected && 'bg-accent shadow-sm',
                  unreadCount > 0 && !isSelected && 'bg-blue-50/50 dark:bg-blue-950/20'
                )}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <Avatar
                    className={cn(
                      'h-11 w-11 transition-all duration-200',
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
                      <AvatarImage
                        src={customAvatarUrl}
                        alt={conversation.name}
                        className="object-cover"
                      />
                    ) : null}

                    {isDM && dmCounterpart ? (
                      <AvatarFallback
                        className={cn(
                          'bg-gradient-to-br text-white text-sm font-semibold',
                          colorClass
                        )}
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
                        className={cn(
                          'bg-gradient-to-br text-white text-sm font-semibold',
                          colorClass
                        )}
                      >
                        {getInitials(conversation.name)}
                      </AvatarFallback>
                    )}
                  </Avatar>

                  {/* Online indicator for DMs */}
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
