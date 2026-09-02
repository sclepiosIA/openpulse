import { memo, useState, useCallback, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Paperclip,
  Building2,
  Users,
  Handshake,
  UserCog,
  CheckCircle2,
  CornerUpLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { sanitizeEmailSubject, sanitizeDisplayName } from '@/lib/emailUtils'
import { EntityAvatar } from '@/components/ui/EntityAvatar'
import { isMarqueEmail } from '@/lib/internalEmailConfig'
import { ThreadPointerMenu } from './ThreadPointerMenu'
import { SmartTasksDialog } from './SmartTasksDialog'
import { AssignThreadDialog } from './AssignThreadDialog'
import type { ThreadEnrichedData } from '@/hooks/email/useThreadsEnrichedData'
import type { EmailThread } from '@/types/email'
import type { Participant } from '@/hooks/email/useAssignThreadWithParticipants'

interface EmailListItemCompactProps {
  thread: EmailThread
  isSelected?: boolean
  enrichedData?: ThreadEnrichedData
  onClick?: () => void
  onHover?: (thread: EmailThread | null) => void
  // Multi-selection props
  isInSelectionMode?: boolean
  isChecked?: boolean
  onToggleSelect?: () => void
  // Visual indicator for emails pending removal (read but still displayed in "unread only" mode)
  isPendingRemoval?: boolean
  /** When true, hides read/processed indicators and shows recipient instead of sender */
  isSentMailbox?: boolean
  // Context menu action handlers
  actionHandlers?: {
    onToggleRead: (threadId: string, isUnread: boolean) => void
    onToggleStar: (threadId: string, isStarred: boolean) => void
    onToggleProcessed: (threadId: string, isProcessed: boolean) => void
    onArchive: (threadId: string) => void
    onDelete: (threadId: string) => void
    onMarkAsSpam: (threadId: string) => void
    onUpdateTags: (threadId: string, tags: string[]) => void
  }
  /** IDs à cibler par le menu contextuel (sélection multi si > 1). */
  contextThreadIds?: string[]
}

// Custom comparator for optimal memoization
const emailItemComparator = (
  prevProps: EmailListItemCompactProps,
  nextProps: EmailListItemCompactProps
) => {
  return (
    prevProps.thread.id === nextProps.thread.id &&
    prevProps.thread.last_message_date === nextProps.thread.last_message_date &&
    prevProps.thread.unread_count === nextProps.thread.unread_count &&
    prevProps.thread.is_processed === nextProps.thread.is_processed &&
    prevProps.thread.priority === nextProps.thread.priority &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isChecked === nextProps.isChecked &&
    prevProps.isInSelectionMode === nextProps.isInSelectionMode &&
    prevProps.isPendingRemoval === nextProps.isPendingRemoval &&
    prevProps.isSentMailbox === nextProps.isSentMailbox &&
    prevProps.enrichedData?.hasReply === nextProps.enrichedData?.hasReply &&
    prevProps.enrichedData?.entityLogoUrl === nextProps.enrichedData?.entityLogoUrl
  )
}

export const EmailListItemCompact = memo(function EmailListItemCompact({
  thread,
  isSelected = false,
  enrichedData,
  onClick,
  onHover,
  isInSelectionMode = false,
  isChecked = false,
  onToggleSelect,
  isPendingRemoval = false,
  isSentMailbox = false,
  actionHandlers,
  contextThreadIds,
}: EmailListItemCompactProps) {
  // State for pointer-based context menu
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [showSmartTasksDialog, setShowSmartTasksDialog] = useState(false)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  // In sent mailbox, force unread/processed to false (no sense for sent emails)
  const isUnread = isSentMailbox ? false : thread.unread_count > 0
  const isStarred = thread.priority === 'high'
  const isProcessed = isSentMailbox ? false : (thread.is_processed ?? false)

  // Extract all participants for the assign dialog
  type ThreadMessage = {
    from_address?: string | null
    from_name?: string | null
    to_addresses?: Array<string | { email?: string; name?: string | null }> | null
  }
  type ThreadParticipant = { email?: string; name?: string | null }
  type ExtendedThread = typeof thread & {
    messages?: ThreadMessage[]
    last_message?: Array<{ from_address?: string | null; from_name?: string | null }>
  }
  const extThread = thread as ExtendedThread

  const allParticipants = useMemo((): Participant[] => {
    const participantsSet = new Map<string, Participant>()

    // Add from messages if available
    const messages = extThread.messages || []
    for (const msg of messages) {
      if (msg.from_address) {
        const email = msg.from_address.toLowerCase()
        if (!participantsSet.has(email)) {
          participantsSet.set(email, { email, name: msg.from_name ?? undefined })
        }
      }

      // Add to_addresses
      const toAddresses: Array<string | { email?: string; name?: string | null }> = Array.isArray(
        msg.to_addresses
      )
        ? msg.to_addresses
        : []
      for (const addr of toAddresses) {
        const email = (typeof addr === 'string' ? addr : addr?.email || '').toLowerCase()
        if (email && !participantsSet.has(email)) {
          participantsSet.set(email, {
            email,
            name: typeof addr === 'object' ? (addr?.name ?? undefined) : undefined,
          })
        }
      }
    }

    // Fallback to thread.participants
    if (participantsSet.size === 0 && thread.participants) {
      const participants = Array.isArray(thread.participants)
        ? thread.participants
        : Object.values(thread.participants)

      for (const p of participants) {
        if (typeof p === 'string') {
          participantsSet.set(p.toLowerCase(), { email: p })
        } else if (p && typeof p === 'object' && 'email' in p) {
          const part = p as ThreadParticipant
          const email = (part.email as string).toLowerCase()
          participantsSet.set(email, { email, name: part.name ?? undefined })
        }
      }
    }

    // Filter out our own email account
    const accountEmail = thread.account?.email_address?.toLowerCase() || ''
    return Array.from(participantsSet.values()).filter(
      (p) => p.email.toLowerCase() !== accountEmail
    )
  }, [thread, extThread.messages])

  // Prefer the last INBOUND sender for inbox display (avoids showing our own reply as the sender).
  // Fallback chain: last inbound (denormalized) → last message (denormalized) → join → first participant.
  const lastMessage = extThread.last_message?.[0]
  const threadAny = thread as {
    last_message_from_email?: string | null
    last_message_from_name?: string | null
    last_inbound_from_email?: string | null
    last_inbound_from_name?: string | null
  }
  const threadLastInEmail = threadAny.last_inbound_from_email
  const threadLastInName = threadAny.last_inbound_from_name
  const threadLastFromEmail = threadAny.last_message_from_email
  const threadLastFromName = threadAny.last_message_from_name
  // In the sent mailbox we keep the global last-message sender (recipient is computed below).
  // Everywhere else (inbox/all) we prefer the last inbound sender.
  const senderEmail = isSentMailbox
    ? threadLastFromEmail || lastMessage?.from_address || undefined
    : threadLastInEmail || threadLastFromEmail || lastMessage?.from_address || undefined
  const senderName = isSentMailbox
    ? threadLastFromName || lastMessage?.from_name || senderEmail?.split('@')[0]
    : threadLastInName || threadLastFromName || lastMessage?.from_name || senderEmail?.split('@')[0]
  const accountEmail = thread.account?.email_address || ''
  const isLastMessageFromUser = senderEmail?.toLowerCase() === accountEmail.toLowerCase()

  // For sent mailbox: extract recipient from participants (first non-self participant)
  const recipientInfo = useMemo(() => {
    if (!isSentMailbox) return null
    const participants = thread.participants
    if (!participants) return null
    const pList = Array.isArray(participants) ? participants : Object.values(participants)
    for (const p of pList) {
      if (typeof p === 'string') {
        if (p.toLowerCase() !== accountEmail.toLowerCase()) {
          return { email: p, name: p.split('@')[0] }
        }
      } else if (p && typeof p === 'object' && 'email' in p) {
        const part = p as ThreadParticipant
        const pEmail = part.email as string
        if (pEmail.toLowerCase() !== accountEmail.toLowerCase()) {
          return { email: pEmail, name: part.name || pEmail.split('@')[0] }
        }
      }
    }
    return null
  }, [isSentMailbox, thread.participants, accountEmail])

  // Utiliser les données enrichies si disponibles (groupe trouvé via domaine)
  const groupeData =
    thread.groupe ||
    (enrichedData?.groupeFromDomain
      ? {
          id: enrichedData.groupeFromDomain.id,
          nom: enrichedData.groupeFromDomain.nom,
          type: enrichedData.groupeFromDomain.type,
        }
      : null)

  const classificationLabel = thread.etablissement?.nom || groupeData?.nom || thread.partenaire?.nom

  // Get first participant email for fallback
  const firstParticipant = thread.participants?.[0] as { email?: string } | string | undefined
  const fallbackEmail =
    typeof firstParticipant === 'string' ? firstParticipant : firstParticipant?.email

  // In sent mailbox, display recipient info; otherwise display sender
  const displayName = isSentMailbox
    ? recipientInfo?.name ||
      classificationLabel ||
      sanitizeDisplayName(fallbackEmail?.split('@')[0]) ||
      '?'
    : senderName || sanitizeDisplayName(fallbackEmail?.split('@')[0]) || '?'
  const displayEmail = isSentMailbox
    ? recipientInfo?.email || fallbackEmail
    : senderEmail || fallbackEmail

  // Determine entity type for badge (inclut groupeFromDomain)
  const entityType = thread.etablissement?.nom
    ? 'etablissement'
    : groupeData?.nom
      ? 'groupe'
      : thread.partenaire?.nom
        ? 'partenaire'
        : null

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  // Handle right-click - everything in onContextMenu for proper blocking
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // ALWAYS block browser context menu first
      e.preventDefault()
      e.stopPropagation()

      // Open our menu if we have action handlers
      if (actionHandlers) {
        setMenuPosition({ x: e.clientX, y: e.clientY })
        setMenuOpen(true)
      }

      return false // Extra blocking for some browsers
    },
    [actionHandlers]
  )

  const itemContent = (
    <div
      id={`thread-${thread.id}`}
      role="button"
      tabIndex={0}
      className={cn(
        'flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors',
        'hover:bg-accent/50',
        isUnread && 'bg-primary/5',
        isSelected && 'bg-accent border-l-2 border-l-primary',
        !isSelected && 'border-l-2 border-l-transparent',
        isChecked && 'bg-primary/10',
        // Visual indicator for emails pending removal (read but still displayed)
        isPendingRemoval && !isSelected && 'opacity-50 bg-muted/20'
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      onMouseEnter={() => onHover?.(thread)}
      onMouseLeave={() => onHover?.(null)}
      onContextMenu={handleContextMenu}
    >
      {/* Checkbox for multi-selection */}
      <div
        className={cn(
          'transition-all flex items-center justify-center',
          isInSelectionMode ? 'w-5 opacity-100' : 'w-0 opacity-0 overflow-hidden'
        )}
        onClick={handleCheckboxClick}
      >
        <Checkbox
          checked={isChecked}
          onCheckedChange={() => onToggleSelect?.()}
          className="h-4 w-4"
        />
      </div>

      {/* Avatar with entity logo or internal profile avatar */}
      <EntityAvatar
        name={displayName}
        email={displayEmail}
        logoUrl={enrichedData?.entityLogoUrl}
        internalProfileAvatarUrl={
          displayEmail && isMarqueEmail(displayEmail)
            ? enrichedData?.internalProfileAvatarUrl
            : undefined
        }
        isUnread={isUnread}
        size="sm"
        forceInternal={false}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Row 1: Sender + Date */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-sm',
              isUnread ? 'font-semibold text-foreground' : 'text-muted-foreground'
            )}
          >
            {isSentMailbox ? (
              <>→ {sanitizeDisplayName(displayName)}</>
            ) : isLastMessageFromUser ? (
              <>Vous → {sanitizeDisplayName(displayName)}</>
            ) : (
              sanitizeDisplayName(displayName)
            )}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {/* Indicateur répondu */}
            {enrichedData?.hasReply && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <CornerUpLeft className="h-3.5 w-3.5 text-blue-500" />
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={4}>
                  Répondu
                </TooltipContent>
              </Tooltip>
            )}

            {/* Indicateur traité */}
            {isProcessed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={4}>
                  Traité
                </TooltipContent>
              </Tooltip>
            )}

            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(thread.last_message_date), {
                addSuffix: false,
                locale: fr,
              })}
            </span>
          </div>
        </div>

        {/* Row 2: Subject */}
        <p
          className={cn(
            'truncate text-sm leading-tight',
            isUnread ? 'font-medium text-foreground' : 'text-foreground/70'
          )}
        >
          {sanitizeEmailSubject(thread.ai_generated_title || thread.subject)}
        </p>

        {/* Row 3: Account + Entity Type + Function + Badges */}
        <div className="flex items-center gap-1.5 overflow-hidden flex-wrap">
          {thread.priority === 'high' && (
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
            </span>
          )}

          {/* Account badge */}
          {accountEmail && (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[10px] shrink-0 max-w-[70px] truncate bg-muted/30"
            >
              {accountEmail.split('@')[0]}
            </Badge>
          )}

          {/* Entity type badge with tooltip - side="right" to not block list */}
          {entityType === 'etablissement' && thread.etablissement?.nom && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="h-4 px-1 text-[10px] shrink-0 bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
                    <Building2 className="h-2.5 w-2.5 mr-0.5" />
                    <span className="truncate max-w-[100px]">{thread.etablissement.nom}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="max-w-[250px]">
                  <p className="font-medium">{thread.etablissement.nom}</p>
                  {thread.etablissement.ville && (
                    <p className="text-xs text-muted-foreground">{thread.etablissement.ville}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {entityType === 'groupe' && groupeData?.nom && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="h-4 px-1 text-[10px] shrink-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Users className="h-2.5 w-2.5 mr-0.5" />
                    <span className="truncate max-w-[100px]">{groupeData.nom}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p className="font-medium">{groupeData.nom}</p>
                  {groupeData.type && (
                    <p className="text-xs text-muted-foreground">{groupeData.type}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {entityType === 'partenaire' && thread.partenaire?.nom && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="h-4 px-1 text-[10px] shrink-0 bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400">
                    <Handshake className="h-2.5 w-2.5 mr-0.5" />
                    <span className="truncate max-w-[100px]">{thread.partenaire.nom}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p className="font-medium">{thread.partenaire.nom}</p>
                  {thread.partenaire.type_partenaire && (
                    <p className="text-xs text-muted-foreground">
                      {thread.partenaire.type_partenaire}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Pour les threads internes: afficher l'entité externe concernée */}
          {enrichedData?.isInternalTeam && enrichedData?.externalEntityForInternal && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="h-4 px-1 text-[10px] shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                    {enrichedData.externalEntityForInternal.type === 'groupe' ? (
                      <Users className="h-2.5 w-2.5 mr-0.5" />
                    ) : enrichedData.externalEntityForInternal.type === 'partenaire' ? (
                      <Handshake className="h-2.5 w-2.5 mr-0.5" />
                    ) : (
                      <Building2 className="h-2.5 w-2.5 mr-0.5" />
                    )}
                    <span className="truncate max-w-[100px]">
                      {enrichedData.externalEntityForInternal.nom}
                    </span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p className="font-medium">
                    Discussion avec {enrichedData.externalEntityForInternal.nom}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Contact function badge (DPO, DIM, DSI, etc.) */}
          {enrichedData?.contact?.fonction && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[9px] shrink-0 border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400"
                  >
                    <UserCog className="h-2.5 w-2.5 mr-0.5" />
                    <span className="truncate max-w-[60px]">{enrichedData.contact.fonction}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p className="font-medium">{enrichedData.contact.fonction}</p>
                  {enrichedData.contact.nom && (
                    <p className="text-xs text-muted-foreground">
                      {enrichedData.contact.prenom} {enrichedData.contact.nom}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {thread.message_count > 1 && (
            <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0">
              {thread.message_count}
            </Badge>
          )}

          {(enrichedData?.imageCount ?? 0) > 0 && (
            <Paperclip className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
          )}
        </div>
      </div>
    </div>
  )

  // If no action handlers, render without context menu
  if (!actionHandlers) {
    return itemContent
  }

  // Render with pointer-based menu for right-click actions
  return (
    <>
      {itemContent}
      <ThreadPointerMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        position={menuPosition}
        isUnread={isUnread}
        isStarred={isStarred}
        isProcessed={isProcessed}
        currentTags={thread.tags || []}
        onToggleRead={() => actionHandlers.onToggleRead(thread.id, isUnread)}
        onToggleStar={() => actionHandlers.onToggleStar(thread.id, isStarred)}
        onToggleProcessed={() => actionHandlers.onToggleProcessed(thread.id, isProcessed)}
        onArchive={() => actionHandlers.onArchive(thread.id)}
        onDelete={() => actionHandlers.onDelete(thread.id)}
        onMarkAsSpam={() => actionHandlers.onMarkAsSpam(thread.id)}
        onUpdateTags={(tags: string[]) => actionHandlers.onUpdateTags(thread.id, tags)}
        onSmartTasks={() => setShowSmartTasksDialog(true)}
        onAssignThread={() => setShowAssignDialog(true)}
        contextThreadIds={
          contextThreadIds && contextThreadIds.length > 0 ? contextThreadIds : [thread.id]
        }
      />
      <SmartTasksDialog
        open={showSmartTasksDialog}
        onOpenChange={setShowSmartTasksDialog}
        sourceType="email"
        sourceId={thread.id}
        etablissementId={thread.etablissement_id}
        partenaireId={thread.partenaire_id}
      />
      <AssignThreadDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        threadId={thread.id}
        participants={allParticipants}
      />
    </>
  )
}, emailItemComparator)
