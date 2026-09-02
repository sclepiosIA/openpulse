import { memo, useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Paperclip,
  Building2,
  Users,
  Handshake,
  CheckCircle2,
  Reply,
  UserCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  sanitizeEmailSubject,
  sanitizeDisplayName,
  getThreadMainSender,
  formatContactRole,
} from '@/lib/emailUtils'
import { isMarqueEmail } from '@/lib/internalEmailConfig'
import { EntityAvatar } from '@/components/ui/EntityAvatar'
import { GroupeBadge } from '@/components/ui/groupe-badge'
import { EmailQuickActions } from './EmailQuickActions'
import { ThreadFolderBadges } from './folders/ThreadFolderBadges'
import { EmailThreadHoverCardContent } from './EmailThreadHoverCard'
import { AssignInterlocutorDialog } from './AssignInterlocutorDialog'
import { EmailContextMenuItems } from './EmailContextMenu'
import { toast } from 'sonner'
import type { ThreadEnrichedData } from '@/hooks/email/useThreadsEnrichedData'
import type { EmailThread } from '@/types/email'
import { updateThreadPriority } from '@/services/email/emailThreadMutations'

// Interface pour les actions passées en props (évite de créer des hooks dans chaque item)
export interface EmailThreadActionHandlers {
  onMarkAsProcessed: (threadId: string, processed: boolean) => void
  onMarkAsRead: (threadId: string, read: boolean) => void
  onMarkAsSpam: (threadId: string) => void
  onUpdateTags: (threadId: string, tags: string[]) => void
  onArchive: (threadId: string) => void
  onDeleteThread: (threadId: string) => void
}

interface EmailListItemModernProps {
  thread: EmailThread
  selected?: boolean
  isNew?: boolean
  enrichedData?: ThreadEnrichedData
  actionHandlers?: EmailThreadActionHandlers
  /** IDs à appliquer aux actions du menu contextuel (ex: sélection multiple). */
  contextThreadIds?: string[]
  onSelect?: (selected: boolean) => void
  onClick?: () => void
  onArchive?: () => void
  onDelete?: () => void
}

// Couleurs vives et contrastées pour les catégories
const CATEGORY_COLORS: Record<string, string> = {
  Commercial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-blue-300',
  Support:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300',
  Technique:
    'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300 border-violet-300',
  Administratif:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-300',
  Contractuel: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-rose-300',
  Formation: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300 border-cyan-300',
  Configuration:
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 border-indigo-300',
  Relation: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300 border-pink-300',
}

export const EmailListItemModern = memo(function EmailListItemModern({
  thread,
  selected = false,
  isNew = false,
  enrichedData,
  actionHandlers,
  contextThreadIds,
  onSelect,
  onClick,
  onArchive,
  onDelete,
}: EmailListItemModernProps) {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [hoverCardOpen, setHoverCardOpen] = useState(false)

  const isUnread = thread.unread_count > 0
  const isProcessed = thread.is_processed === true
  const hasReply = thread.hasReply === true || enrichedData?.hasReply === true
  const mainSender = getThreadMainSender(thread, thread.account?.email_address || '')
  const isLastMessageFromUser = mainSender?.isCurrentUser || false
  const isStarred = thread.priority === 'high'

  // Actions handlers - utilisent les actionHandlers passés en props ou des no-op
  const handleArchive = useCallback(() => {
    actionHandlers?.onArchive(thread.id)
    onArchive?.()
  }, [thread.id, onArchive, actionHandlers])

  const handleToggleRead = useCallback(() => {
    actionHandlers?.onMarkAsRead(thread.id, isUnread)
  }, [thread.id, isUnread, actionHandlers])

  const handleToggleStar = useCallback(async () => {
    try {
      await updateThreadPriority(thread.id, isStarred ? null : 'high')
    } catch (e) {
      toast.error('Erreur')
    }
  }, [thread.id, isStarred])

  const handleDelete = useCallback(() => {
    actionHandlers?.onDeleteThread(thread.id)
    onDelete?.()
  }, [thread.id, onDelete, actionHandlers])

  const handleToggleProcessed = useCallback(() => {
    actionHandlers?.onMarkAsProcessed(thread.id, !isProcessed)
  }, [thread.id, isProcessed, actionHandlers])

  const handleMarkAsSpam = useCallback(() => {
    actionHandlers?.onMarkAsSpam(thread.id)
  }, [thread.id, actionHandlers])

  const handleUpdateTags = useCallback(
    (tags: string[]) => {
      actionHandlers?.onUpdateTags(thread.id, tags)
    },
    [thread.id, actionHandlers]
  )

  // Get establishment/classification display
  // Include internal team detection from enriched data (handles Gmail addresses mapped to internal team)
  const isInternal = thread.category?.includes('Interne') || enrichedData?.isInternalTeam

  // Groupe (direct ou via domaine)
  const groupeData = thread.groupe || enrichedData?.groupeFromDomain

  // Contact role formatted
  const formattedContactRole = formatContactRole(enrichedData?.contactRole || null)

  // Count total tags for display
  const tagsCount = thread.tags?.length || 0

  // Build status summary for thread-level tooltip
  const statusParts: string[] = []
  if (isUnread) statusParts.push('Non lu')
  if (isProcessed) statusParts.push('Traité')
  if (hasReply) statusParts.push('Répondu')
  if (isStarred) statusParts.push('Priorité haute')
  if (enrichedData && enrichedData.imageCount > 0) {
    statusParts.push(`${enrichedData.imageCount} pièce(s) jointe(s)`)
  }

  const itemContent = (
    <div
      role="article"
      aria-label={`Email de ${mainSender?.name || mainSender?.email}, sujet: ${thread.subject}`}
      data-selected={selected || undefined}
      tabIndex={0}
      className={cn(
        'group relative flex items-center gap-3 px-4 py-2 cursor-pointer transition-all duration-200',
        'h-[72px] min-h-[72px] max-h-[72px] overflow-hidden',
        'hover:bg-accent/50',
        // Fond vert clair pour les emails traités
        isProcessed && !isUnread && 'bg-green-50/60 dark:bg-green-950/20',
        // Fond bleu TRÈS VISIBLE pour les non lus (priorité sur traité)
        isUnread &&
          'bg-blue-100/90 dark:bg-blue-900/60 shadow-sm ring-1 ring-blue-200/50 dark:ring-blue-700/30',
        // Bordure gauche ÉPAISSE et colorée
        isUnread
          ? 'border-l-[5px] border-l-blue-500'
          : isProcessed
            ? 'border-l-4 border-l-green-500'
            : 'border-l-4 border-l-transparent',
        selected && 'bg-accent',
        isNew && 'animate-in fade-in slide-in-from-top-2 duration-300'
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      {/* Left Zone: Checkbox + Avatar aligned */}
      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          className="data-[state=checked]:bg-primary"
        />
        <EntityAvatar
          name={mainSender?.name || mainSender?.email || '?'}
          logoUrl={enrichedData?.entityLogoUrl}
          internalProfileAvatarUrl={
            mainSender?.email && isMarqueEmail(mainSender.email)
              ? enrichedData?.internalProfileAvatarUrl
              : undefined
          }
          email={mainSender?.email}
          isUnread={isUnread}
          size="sm"
        />
      </div>

      {/* Center Zone: Compact Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Row 1: Sender + Date + Status indicators */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {/* Indicateur non lu (point bleu animé PLUS GRAND avec glow) */}
            {isUnread && (
              <span className="relative flex h-3.5 w-3.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]"></span>
              </span>
            )}
            <span
              className={cn(
                'truncate text-sm',
                isUnread ? 'font-bold text-foreground' : 'text-foreground/70'
              )}
            >
              {isLastMessageFromUser ? (
                <span>Vous → {sanitizeDisplayName(mainSender?.name) || mainSender?.name}</span>
              ) : (
                sanitizeDisplayName(mainSender?.name) || mainSender?.name || mainSender?.email
              )}
            </span>
            {thread.message_count > 1 && (
              <Badge variant="outline" className="h-4 px-1 text-[10px] shrink-0">
                {thread.message_count}
              </Badge>
            )}
            {/* Indicateurs de statut - sans tooltip individuel, aria-label pour accessibilité */}
            {hasReply && (
              <Reply className="h-3.5 w-3.5 text-blue-500 shrink-0" aria-label="Répondu" />
            )}
            {isProcessed && (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" aria-label="Traité" />
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {formatDistanceToNow(new Date(thread.last_message_date), {
              addSuffix: false,
              locale: fr,
            })}
          </span>
        </div>

        {/* Row 2: Subject */}
        <p
          className={cn(
            'truncate text-sm leading-tight',
            isUnread ? 'font-semibold text-foreground' : 'text-muted-foreground'
          )}
        >
          {sanitizeEmailSubject(thread.ai_generated_title || thread.subject)}
        </p>

        {/* Row 3: Badges on single line */}
        <div className="flex items-center gap-1.5 overflow-hidden">
          {/* Priority dot */}
          {thread.priority === 'high' && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}

          {/* Pour les threads internes OpenPulse */}
          {isInternal && (
            <div className="flex items-center gap-1.5">
              <Badge className="h-5 text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 shrink-0 px-1.5">
                <span className="font-medium">OpenPulse</span>
                {enrichedData?.internalRole?.title && (
                  <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                    • {enrichedData.internalRole.title}
                  </span>
                )}
              </Badge>
              {/* Entité externe concernée pour les threads internes */}
              {enrichedData?.externalEntityForInternal && (
                <Badge variant="outline" className="h-5 text-[10px] shrink-0 px-1.5">
                  {enrichedData.externalEntityForInternal.type === 'groupe' ? (
                    <Users className="h-3 w-3 mr-1" />
                  ) : enrichedData.externalEntityForInternal.type === 'partenaire' ? (
                    <Handshake className="h-3 w-3 mr-1" />
                  ) : (
                    <Building2 className="h-3 w-3 mr-1" />
                  )}
                  <span className="truncate max-w-[100px]">
                    {enrichedData.externalEntityForInternal.nom}
                  </span>
                </Badge>
              )}
            </div>
          )}

          {/* Pour les threads externes: badges groupe/établissement/partenaire */}
          {!isInternal && (
            <>
              {/* Badge Groupe (direct ou via domaine) */}
              {groupeData && (
                <GroupeBadge
                  type={
                    (groupeData.type as 'GHT' | 'Groupe Cliniques' | 'Consortium' | 'Autre') ||
                    'Autre'
                  }
                  nom={groupeData.nom}
                  className="h-5 text-[10px] shrink-0"
                  showIcon={true}
                />
              )}

              {/* Badge Établissement */}
              {thread.etablissement?.nom && (
                <Badge
                  variant="outline"
                  className="h-5 text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border-blue-200 shrink-0 px-1.5"
                >
                  <Building2 className="h-3 w-3 mr-1" />
                  <span className="truncate max-w-[100px]">{thread.etablissement.nom}</span>
                </Badge>
              )}

              {/* Badge Partenaire */}
              {thread.partenaire?.nom && (
                <Badge
                  variant="outline"
                  className="h-5 text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 shrink-0 px-1.5"
                >
                  <Handshake className="h-3 w-3 mr-1" />
                  <span className="truncate max-w-[100px]">{thread.partenaire.nom}</span>
                </Badge>
              )}

              {/* Badge Rôle du contact */}
              {formattedContactRole && (
                <Badge variant="secondary" className="h-5 text-[10px] shrink-0 px-1.5">
                  <UserCircle className="h-3 w-3 mr-1" />
                  {formattedContactRole}
                </Badge>
              )}
            </>
          )}

          {/* Dossiers personnalisés */}
          <ThreadFolderBadges threadId={thread.id} max={2} />

          {/* Category badge - compact */}
          {thread.category && thread.category !== 'Non classé' && !isInternal && (
            <Badge
              variant="outline"
              className={cn(
                'h-5 text-[10px] font-medium shrink-0 border px-1.5',
                CATEGORY_COLORS[thread.category] || 'bg-muted'
              )}
            >
              {thread.category}
            </Badge>
          )}

          {/* Attachments */}
          {(enrichedData?.imageCount ?? 0) > 0 && (
            <Paperclip
              className="h-3 w-3 text-muted-foreground shrink-0"
              aria-label="Pièces jointes"
            />
          )}
        </div>
      </div>

      {/* Right Zone: Quick Actions (hover only on desktop) */}
      <div className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2">
        <EmailQuickActions
          threadId={thread.id}
          isUnread={isUnread}
          isStarred={isStarred}
          onArchive={handleArchive}
          onToggleRead={handleToggleRead}
          onToggleStar={handleToggleStar}
          onDelete={handleDelete}
          onAssignInterlocutor={() => setAssignDialogOpen(true)}
        />
      </div>
    </div>
  )

  return (
    <>
      {/* 
        Fix Mac trackpad: ContextMenuTrigger wraps a div that manually prevents 
        native context menu. HoverCard is controlled to avoid conflicts.
      */}
      <ContextMenu>
        <HoverCard
          open={hoverCardOpen}
          onOpenChange={setHoverCardOpen}
          openDelay={400}
          closeDelay={100}
        >
          <ContextMenuTrigger asChild>
            <div
              className="block w-full"
              onContextMenu={(e) => {
                // Force prevent native browser context menu (Mac trackpad fix)
                e.preventDefault()
                e.stopPropagation()
                // Close hover card when context menu opens
                setHoverCardOpen(false)
              }}
              onMouseEnter={() => setHoverCardOpen(true)}
              onMouseLeave={() => setHoverCardOpen(false)}
            >
              <HoverCardTrigger asChild>{itemContent}</HoverCardTrigger>
            </div>
          </ContextMenuTrigger>
          <HoverCardContent
            side="top"
            align="end"
            sideOffset={8}
            avoidCollisions={true}
            collisionPadding={24}
            className="w-80 sm:w-96 max-w-[min(92vw,30rem)]"
            onPointerDownOutside={() => setHoverCardOpen(false)}
          >
            <EmailThreadHoverCardContent thread={thread} />
          </HoverCardContent>
        </HoverCard>
        <ContextMenuContent className="w-56">
          <EmailContextMenuItems
            isUnread={isUnread}
            isStarred={isStarred}
            isProcessed={isProcessed}
            currentTags={thread.tags || []}
            contextThreadIds={
              contextThreadIds && contextThreadIds.length > 0 ? contextThreadIds : [thread.id]
            }
            onToggleRead={handleToggleRead}
            onToggleStar={handleToggleStar}
            onToggleProcessed={handleToggleProcessed}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onMarkAsSpam={handleMarkAsSpam}
            onUpdateTags={handleUpdateTags}
          />
        </ContextMenuContent>
      </ContextMenu>

      {/* Assign Interlocutor Dialog - EN DEHORS du conteneur cliquable */}
      <AssignInterlocutorDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        threadId={thread.id}
        senderEmail={mainSender?.email || ''}
        senderName={mainSender?.name || null}
        onAssigned={onArchive}
      />
    </>
  )
})
