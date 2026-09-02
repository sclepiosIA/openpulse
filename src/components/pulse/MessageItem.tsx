import { useState, memo, useCallback, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Check,
  Edit2,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Smile,
  Trash2,
  CheckSquare,
  ExternalLink,
  X,
  Loader2,
  Building2,
  User,
  Users,
  Calendar,
  Handshake,
  ListTodo,
  BarChart3,
} from 'lucide-react'
import { EntityPreviewHoverCard } from './EntityPreviewHoverCard'
import { MediaPreview, MediaGallery } from './MediaGallery'
import { TodoInlineCard } from './TodoInlineCard'
import { PollInlineCard } from './PollInlineCard'
import { TranscriptionSummaryCard, isTranscriptionSummary } from './TranscriptionSummaryCard'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { UserAvatarWithStatus } from './UserAvatarWithStatus'
import { useGlobalUserPresence } from '@/hooks/presence/useGlobalUserPresence'
import { linkify } from '@/lib/linkify'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { Badge } from '@/components/ui/badge'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import {
  useDeletePulseMessage,
  useUpdatePulseMessage,
  useAddPulseReaction,
} from '@/hooks/pulse/usePulseMessages'
import { ReactionPicker } from './ReactionPicker'
import { TaskLinkerModal } from './TaskLinkerModal'
import { MessageReadReceipt, type ReceiptStatus } from './MessageReadReceipt'
import { cn } from '@/lib/utils'
import type { PulseMessage } from '@/types/pulse'

// Entity link types and icons
const ENTITY_ICONS = {
  etablissement: Building2,
  tache: CheckSquare,
  contact: User,
  groupe: Users,
  evenement: Calendar,
  partenaire: Handshake,
  todo: ListTodo,
  poll: BarChart3,
} as const

const ENTITY_ROUTES = {
  etablissement: '/etablissements',
  tache: '/etablissements?tache=',
  contact: '/contacts',
  groupe: '/groupes',
  evenement: '/calendrier?event=',
  partenaire: '/partenaires',
  todo: '',
  poll: '',
} as const

// Extract todo IDs from content
function extractTodoIds(content: string): string[] {
  const regex = /#\[[^\]]+\]\(todo:([^)]+)\)/g
  const ids: string[] = []
  let match
  while ((match = regex.exec(content)) !== null) {
    ids.push(match[1])
  }
  return ids
}

// Extract poll IDs from content
function extractPollIds(content: string): string[] {
  const regex = /#\[[^\]]+\]\(poll:([^)]+)\)/g
  const ids: string[] = []
  let match
  while ((match = regex.exec(content)) !== null) {
    ids.push(match[1])
  }
  return ids
}

// Parse entity links in message content (skip todo/poll, they are rendered separately as inline cards)
// isOwnMessage is used to adapt styling for contrast on primary background
function parseEntityLinks(content: string, isOwnMessage: boolean = false): React.ReactNode[] {
  // Match pattern: #[Name](type:id)
  const regex = /#\[([^\]]+)\]\((\w+):([^)]+)\)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    const [fullMatch, name, type, id] = match
    const entityType = type as keyof typeof ENTITY_ICONS

    // For todo and poll: skip rendering entirely (inline cards handle them)
    // Only add text BEFORE the match, then skip the match itself
    if (entityType === 'todo' || entityType === 'poll') {
      if (match.index > lastIndex) {
        const textBefore = content.slice(lastIndex, match.index).trim()
        if (textBefore) {
          parts.push(...linkify(textBefore + ' '))
        }
      }
      lastIndex = regex.lastIndex
      continue
    }

    // For other entity types: add text before and render the link
    if (match.index > lastIndex) {
      parts.push(...linkify(content.slice(lastIndex, match.index)))
    }

    const Icon = ENTITY_ICONS[entityType] || CheckSquare
    const baseRoute = ENTITY_ROUTES[entityType] || '/'
    const url = ['tache', 'evenement'].includes(entityType)
      ? `${baseRoute}${id}`
      : `${baseRoute}/${id}`

    // Adapt styling based on message ownership for proper contrast
    const linkClassName = isOwnMessage
      ? 'inline-flex items-center gap-1 px-1.5 py-0.5 bg-card/20 text-white rounded-md hover:bg-card/30 transition-colors text-sm font-medium'
      : 'inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors text-sm font-medium'

    parts.push(
      <EntityPreviewHoverCard
        key={`${type}-${id}-${match.index}`}
        entityType={entityType}
        entityId={id}
      >
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon className="h-3 w-3" />
          {name}
          <ExternalLink className="h-2.5 w-2.5 opacity-60" />
        </a>
      </EntityPreviewHoverCard>
    )

    lastIndex = regex.lastIndex
  }

  // Add remaining text (trim trailing whitespace from todo/poll patterns)
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex).trim()
    if (remainingText) {
      parts.push(...linkify(remainingText))
    }
  }

  // If the message only contains todo/poll references, we render nothing here
  // (inline cards will render the actual UI).
  return parts.length > 0 ? parts : ['']
}

interface MessageItemProps {
  message: PulseMessage
  conversationId: string
  showAvatar: boolean
  onOpenThread: () => void
  receiptStatus?: ReceiptStatus
  isGroupChat?: boolean
  readByCount?: number
  totalRecipients?: number
  currentProfileId?: string
}

const QUICK_REACTIONS = ['👍', '❤️', '😄', '🎉', '🤔', '👀']

export const MessageItem = memo(function MessageItem({
  message,
  conversationId,
  showAvatar,
  onOpenThread,
  receiptStatus,
  isGroupChat = false,
  readByCount = 0,
  totalRecipients = 1,
  currentProfileId,
}: MessageItemProps) {
  const { data: currentProfile } = useCurrentProfile()
  const [showActions, setShowActions] = useState(false)
  const { isUserOnline, getUserStatus } = useGlobalUserPresence()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [showTaskLinker, setShowTaskLinker] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  const deleteMessage = useDeletePulseMessage()
  const updateMessage = useUpdatePulseMessage()
  const addReaction = useAddPulseReaction()

  // Use profileId for comparison (not auth user id)
  const ownProfileId = currentProfileId || currentProfile?.id
  const isOwnMessage = message.user_id === ownProfileId
  const isSystemMessage =
    message.message_type === 'system' || message.message_type === 'task_update'

  // Detect external visitor messages (from formation pulse chat)
  const metadata = (message.metadata ?? {}) as {
    is_external_message?: boolean
    sender_name?: string
    sender_fonction?: string | null
    page_context?: string | null
  }
  const isExternalMessage = metadata.is_external_message === true
  const externalSenderName = isExternalMessage ? metadata.sender_name || 'Visiteur externe' : null
  const externalSenderFonction = isExternalMessage ? metadata.sender_fonction || null : null
  const externalPageContext = isExternalMessage ? metadata.page_context || null : null

  const getAvatarColor = (str: string): string => {
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

  const getInitials = (nom?: string, prenom?: string) => {
    if (!nom && !prenom) return '?'
    return `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase()
  }

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus()
      editTextareaRef.current.selectionStart = editTextareaRef.current.value.length
    }
  }, [isEditing])

  const handleStartEdit = useCallback(() => {
    setEditContent(message.content)
    setIsEditing(true)
  }, [message.content])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditContent(message.content)
  }, [message.content])

  const handleSaveEdit = useCallback(() => {
    if (!editContent.trim() || editContent.trim() === message.content) {
      handleCancelEdit()
      return
    }

    updateMessage.mutate(
      {
        messageId: message.id,
        content: editContent.trim(),
      },
      {
        onSuccess: () => {
          setIsEditing(false)
        },
      }
    )
  }, [editContent, message.id, message.content, updateMessage, handleCancelEdit])

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSaveEdit()
      }
      if (e.key === 'Escape') {
        handleCancelEdit()
      }
    },
    [handleSaveEdit, handleCancelEdit]
  )

  const handleDelete = useCallback(() => {
    deleteMessage.mutate(
      { messageId: message.id, conversationId },
      {
        onSuccess: () => {
          setShowDeleteDialog(false)
        },
      }
    )
  }, [deleteMessage, message.id, conversationId])

  const handleReaction = useCallback(
    (emoji: string) => {
      addReaction.mutate({ messageId: message.id, emoji })
      setShowReactionPicker(false)
    },
    [addReaction, message.id]
  )

  const handleLinkTask = useCallback(() => {
    setShowTaskLinker(true)
  }, [])

  const handleCreateTask = useCallback(() => {
    setShowTaskLinker(true)
  }, [])

  // System message
  if (isSystemMessage) {
    // Check if this is a transcription summary - render as rich card
    if (isTranscriptionSummary(message)) {
      return (
        <div className="px-4 py-2 flex justify-center">
          <TranscriptionSummaryCard message={message} />
        </div>
      )
    }

    // Regular system message
    return (
      <div className="flex items-center justify-center py-2">
        <div className="text-sm text-muted-foreground bg-muted/50 px-4 py-1.5 rounded-full">
          {message.content}
        </div>
      </div>
    )
  }

  // Group reactions by emoji
  const reactionGroups =
    message.reactions?.reduce(
      (acc, reaction) => {
        if (!acc[reaction.emoji]) {
          acc[reaction.emoji] = { count: 0, users: [], hasOwn: false }
        }
        acc[reaction.emoji].count++
        acc[reaction.emoji].users.push(reaction.user?.prenom || reaction.user?.nom || 'Membre')
        if (reaction.user_id === currentProfile?.id) {
          acc[reaction.emoji].hasOwn = true
        }
        return acc
      },
      {} as Record<string, { count: number; users: string[]; hasOwn: boolean }>
    ) || {}

  return (
    <>
      <div
        data-pulse-msg-row
        className={cn(
          'group relative flex gap-2 md:gap-3 px-2 rounded-lg transition-colors pulse-msg-row',
          isOwnMessage ? 'flex-row-reverse' : 'flex-row',
          showAvatar ? 'mt-3' : 'mt-0.5'
        )}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => {
          if (!dropdownOpen) {
            setShowActions(false)
          }
        }}
      >
        {/* Avatar or space */}
        <div className="w-8 flex-shrink-0">
          {showAvatar &&
            (() => {
              if (isExternalMessage) {
                // External messages keep simple avatar (no presence)
                return (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      {externalSenderName!
                        .split(' ')
                        .map((w: string) => w[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )
              }

              const userPresence = getUserStatus(message.user_id)
              const presenceStatus =
                userPresence?.status || (isUserOnline(message.user_id) ? 'active' : 'offline')

              return (
                <UserAvatarWithStatus
                  user={{
                    id: message.user_id,
                    avatar_url: message.user?.avatar_url,
                    nom: message.user?.nom,
                    prenom: message.user?.prenom,
                  }}
                  size="sm"
                  showStatus={true}
                  status={presenceStatus}
                />
              )
            })()}
        </div>

        {/* Content */}
        <div
          className={cn(
            'flex-1 min-w-0 max-w-[85%] md:max-w-[80%]',
            isOwnMessage && 'flex flex-col items-end'
          )}
        >
          {/* Header with name and time */}
          {showAvatar && (
            <div
              className={cn(
                'flex items-baseline gap-2 mb-0.5 min-w-0',
                isOwnMessage && 'flex-row-reverse'
              )}
            >
              <span className="font-semibold text-sm flex items-center gap-1.5 truncate min-w-0">
                <span className="truncate">
                  {isExternalMessage
                    ? externalSenderName
                    : [message.user?.prenom, message.user?.nom].filter(Boolean).join(' ') ||
                      'Membre'}
                </span>
                {isExternalMessage && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800 flex-shrink-0"
                  >
                    Externe
                  </Badge>
                )}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0 whitespace-nowrap">
                {format(new Date(message.created_at), 'HH:mm', { locale: fr })}
                {isOwnMessage && receiptStatus && (
                  <MessageReadReceipt
                    status={receiptStatus}
                    isGroupChat={isGroupChat}
                    readByCount={readByCount}
                    totalRecipients={totalRecipients}
                  />
                )}
              </span>
              {message.edit_count > 0 && (
                <span className="text-xs text-muted-foreground italic flex-shrink-0">
                  (modifié)
                </span>
              )}
              {isExternalMessage && (externalSenderFonction || externalPageContext) && (
                <span className="text-[11px] text-muted-foreground w-full block">
                  {[
                    externalSenderFonction,
                    externalPageContext === 'resurgences'
                      ? 'Formation Résurgences'
                      : externalPageContext === 'hospital-manager'
                        ? 'Formation Hôpital Manager'
                        : null,
                  ]
                    .filter(Boolean)
                    .join(' — ')}
                </span>
              )}
            </div>
          )}

          {/* Message content or edit form */}
          {isEditing ? (
            <div className="space-y-2 w-full">
              <Textarea
                ref={editTextareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="min-h-[60px] text-sm"
                placeholder="Modifier le message..."
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={updateMessage.isPending || !editContent.trim()}
                >
                  {updateMessage.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Check className="h-3 w-3 mr-1" />
                  )}
                  Enregistrer
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                  <X className="h-3 w-3 mr-1" />
                  Annuler
                </Button>
                <span className="text-xs text-muted-foreground ml-auto hidden sm:block">
                  Échap pour annuler, Entrée pour enregistrer
                </span>
              </div>
            </div>
          ) : (
            <>
              <div
                data-pulse-bubble
                className={cn(
                  'whitespace-pre-wrap break-words px-3 py-2 pulse-msg-bubble max-w-full',
                  isOwnMessage
                    ? 'pulse-own-bubble pulse-bubble-own'
                    : 'bg-muted pulse-bubble-other',
                  isOwnMessage ? 'inline-block' : 'inline-block'
                )}
              >
                {parseEntityLinks(message.content, isOwnMessage)}
              </div>
              {isOwnMessage && !showAvatar && receiptStatus && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 mt-0.5 pr-1">
                  {format(new Date(message.created_at), 'HH:mm', { locale: fr })}
                  <MessageReadReceipt
                    status={receiptStatus}
                    isGroupChat={isGroupChat}
                    readByCount={readByCount}
                    totalRecipients={totalRecipients}
                  />
                </span>
              )}
            </>
          )}

          {/* Inline Todo Lists */}
          {!isEditing &&
            extractTodoIds(message.content).map((todoId) => (
              <TodoInlineCard key={todoId} todoId={todoId} />
            ))}

          {/* Inline Polls */}
          {!isEditing &&
            extractPollIds(message.content).map((pollId) => (
              <PollInlineCard key={pollId} pollId={pollId} />
            ))}

          {/* Pièces jointes (images + fichiers) */}
          {!isEditing && message.media && message.media.length > 0 && (
            <div
              className={cn(
                'mt-2 grid gap-2 max-w-full',
                message.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'
              )}
            >
              {message.media.map((item, idx) => (
                <MediaPreview
                  key={item.id}
                  item={item}
                  onClick={() => setGalleryIndex(idx)}
                  className={
                    item.file_type === 'image'
                      ? 'aspect-square max-w-[220px]'
                      : 'w-full max-w-[320px]'
                  }
                />
              ))}
            </div>
          )}
          {galleryIndex !== null && message.media && (
            <MediaGallery
              media={message.media}
              initialIndex={galleryIndex}
              onClose={() => setGalleryIndex(null)}
            />
          )}

          {/* Task links */}
          {!isEditing && message.task_links && message.task_links.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {message.task_links.map((link) => (
                <Badge
                  key={link.id}
                  variant="outline"
                  className="gap-1 cursor-pointer hover:bg-accent text-xs"
                >
                  <CheckSquare className="h-3 w-3" />
                  <span className="truncate max-w-[150px]">{link.task?.titre}</span>
                  <ExternalLink className="h-3 w-3 ml-0.5" />
                </Badge>
              ))}
            </div>
          )}

          {/* Reactions */}
          {!isEditing && Object.keys(reactionGroups).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(reactionGroups).map(([emoji, data]) => (
                <TooltipProvider key={emoji}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleReaction(emoji)}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm',
                          'border transition-colors',
                          data.hasOwn
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-muted border-transparent hover:border-border'
                        )}
                      >
                        <span>{emoji}</span>
                        <span className="text-xs font-medium">{data.count}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {data.users.slice(0, 5).join(', ')}
                      {data.users.length > 5 && ` et ${data.users.length - 5} autres`}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
              {/* Button to add reaction */}
              <Popover open={showReactionPicker} onOpenChange={setShowReactionPicker}>
                <PopoverTrigger asChild>
                  <button
                    className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted/50 hover:bg-muted transition-colors"
                    aria-label="Ajouter une réaction"
                  >
                    <Smile className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <ReactionPicker onSelect={handleReaction} />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Reply count (thread) */}
          {!isEditing && message.reply_count > 0 && (
            <button
              onClick={onOpenThread}
              className="flex items-center gap-1 mt-2 text-sm text-primary hover:underline"
            >
              <MessageSquare className="h-4 w-4" />
              {message.reply_count} réponse{message.reply_count > 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Hover actions */}
        {showActions && !isEditing && (
          <TooltipProvider delayDuration={0}>
            <div className="absolute right-1 md:right-2 top-0 -translate-y-1/2 flex items-center gap-0.5 bg-card border rounded-lg shadow-sm p-0.5 z-10">
              {/* Quick reactions - hidden on mobile */}
              <div className="hidden md:flex items-center gap-0.5">
                {QUICK_REACTIONS.slice(0, 3).map((emoji) => (
                  <Button
                    key={emoji}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleReaction(emoji)}
                    aria-label={`Réagir avec ${emoji}`}
                  >
                    <span className="text-sm">{emoji}</span>
                  </Button>
                ))}
              </div>

              {/* Reaction button - visible on mobile */}
              <Popover open={showReactionPicker} onOpenChange={setShowReactionPicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 md:hidden"
                    aria-label="Réactions"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <ReactionPicker onSelect={handleReaction} />
                </PopoverContent>
              </Popover>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onOpenThread}
                    aria-label="Répondre dans un fil"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Répondre</TooltipContent>
              </Tooltip>

              <DropdownMenu
                open={dropdownOpen}
                onOpenChange={(open) => {
                  setDropdownOpen(open)
                  if (!open) {
                    setTimeout(() => setShowActions(false), 100)
                  }
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Plus d'actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[9999]">
                  <DropdownMenuItem onClick={onOpenThread}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Répondre dans un fil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLinkTask}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Lier à une tâche
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCreateTask}>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Créer une tâche
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {isOwnMessage && (
                    <DropdownMenuItem onClick={handleStartEdit}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Modifier
                    </DropdownMenuItem>
                  )}
                  {isOwnMessage && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TooltipProvider>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce message ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le message disparaîtra uniquement pour vous. Les autres membres pourront toujours le
              voir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMessage.isPending}
            >
              {deleteMessage.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task Linker Modal */}
      <TaskLinkerModal
        open={showTaskLinker}
        onOpenChange={setShowTaskLinker}
        message={message}
        conversationId={conversationId}
      />
    </>
  )
})
