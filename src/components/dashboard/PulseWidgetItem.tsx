import React, { memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, Sparkles, Loader2, Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { PulseConversation } from '@/types/pulse'
import { isDMConversation, extractOtherNameFromConversationName } from '@/lib/pulse/dmCounterpart'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { PulseWidgetMessagePreview } from './PulseWidgetMessagePreview'
import { PulseMarkdownRenderer } from '@/components/pulse/PulseMarkdownRenderer'

interface LastMessage {
  id: string
  content: string
  created_at: string
  user?: {
    nom: string
    prenom: string
    avatar_url?: string | null
  } | null
}

interface PulseWidgetItemProps {
  conversation: PulseConversation & { last_message?: LastMessage | LastMessage[] | null }
  unreadCount: number
  index: number
  currentUserId: string
  summary?: string
  isLoadingSummary?: boolean
  onGenerateSummary?: (id: string) => void
  onClick: () => void
}

function truncate(text: string | undefined | null, maxLength: number): string {
  if (!text) return ''
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

export const PulseWidgetItem = memo(
  function PulseWidgetItem({
    conversation,
    unreadCount,
    index,
    currentUserId,
    summary,
    isLoadingSummary,
    onGenerateSummary,
    onClick,
  }: PulseWidgetItemProps) {
    // Couleur selon le type de conversation (memoized)
    const typeConfig = useMemo(
      () =>
        conversation.etablissement_id
          ? { border: 'border-l-blue-500', bg: 'bg-blue-50/30', icon: 'text-blue-500' }
          : conversation.visibility === 'public'
            ? { border: 'border-l-emerald-500', bg: 'bg-emerald-50/30', icon: 'text-emerald-500' }
            : { border: 'border-l-violet-500', bg: 'bg-violet-50/30', icon: 'text-violet-500' },
      [conversation.etablissement_id, conversation.visibility]
    )

    // Dernier message - handle both single object and array
    const lastMessageData = Array.isArray(conversation.last_message)
      ? conversation.last_message[0]
      : conversation.last_message
    const lastMessagePreview = truncate(lastMessageData?.content, 50)
    const lastMessageAuthor = lastMessageData?.user ? `${lastMessageData.user.prenom}` : null

    // Trouver l'interlocuteur (le premier membre qui n'est PAS l'utilisateur courant)
    const interlocutor = conversation.members?.find((m) => m.user_id !== currentUserId)?.user

    // Afficher l'interlocuteur, sinon fallback vers l'auteur du dernier message
    const displayUser = interlocutor || lastMessageData?.user
    const displayName = displayUser
      ? `${displayUser.prenom || ''} ${displayUser.nom || ''}`.trim()
      : null

    // Pour les DMs, n'afficher que le nom du destinataire (pas "Moi & Autre")
    const { data: currentProfile } = useCurrentProfile()
    const myFullName = currentProfile
      ? `${currentProfile.prenom || ''} ${currentProfile.nom || ''}`.trim()
      : ''
    const isDM = isDMConversation(conversation)
    const conversationTitle = isDM
      ? displayName ||
        (myFullName && conversation.name
          ? extractOtherNameFromConversationName(conversation.name, myFullName)
          : conversation.name) ||
        'Message direct'
      : conversation.name || 'Conversation'

    return (
      <HoverCard openDelay={400}>
        <HoverCardTrigger asChild>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              'p-2.5 rounded-lg border-l-[3px] cursor-pointer transition-all',
              'hover:scale-[1.01] hover:shadow-sm',
              typeConfig.border,
              unreadCount > 0 ? typeConfig.bg : 'hover:bg-accent/50'
            )}
            onClick={onClick}
          >
            {/* Header: avatar interlocuteur + nom + badge + timestamp */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Avatar de l'interlocuteur */}
                {displayUser ? (
                  <UserAvatar
                    avatarUrl={displayUser.avatar_url}
                    name={displayName || 'Utilisateur'}
                    size="sm"
                    className="shrink-0"
                  />
                ) : (
                  <div
                    className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0',
                      conversation.etablissement_id
                        ? 'bg-blue-100 text-blue-700'
                        : conversation.visibility === 'public'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-violet-100 text-violet-700'
                    )}
                  >
                    {conversation.name?.substring(0, 2).toUpperCase() || 'PU'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-sm truncate',
                      unreadCount > 0 ? 'font-semibold' : 'font-medium'
                    )}
                  >
                    {conversationTitle}
                  </p>
                  {!isDM && displayName && (
                    <p className="text-[10px] text-muted-foreground truncate">{displayName}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                    {unreadCount}
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {lastMessageData?.created_at
                    ? formatDistanceToNow(new Date(lastMessageData.created_at), {
                        addSuffix: false,
                        locale: fr,
                      })
                    : ''}
                </span>
              </div>
            </div>

            {/* Résumé IA prioritaire, sinon dernier message avec bouton IA inline */}
            {summary ? (
              <div className="flex items-start gap-1.5">
                <Sparkles className="h-3 w-3 text-violet-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-violet-700 line-clamp-2">{summary}</p>
              </div>
            ) : lastMessageData?.content ? (
              <div className="flex items-start gap-1.5">
                <MessageCircle className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground line-clamp-2 flex-1">
                  {lastMessageAuthor && (
                    <span className="font-medium text-foreground/70">{lastMessageAuthor}: </span>
                  )}
                  <PulseWidgetMessagePreview content={lastMessageData.content} maxLength={60} />
                </p>
                {onGenerateSummary && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onGenerateSummary(conversation.id)
                    }}
                    className="ml-auto shrink-0 p-1 rounded hover:bg-violet-100 transition-colors"
                    disabled={isLoadingSummary}
                    title="Générer un résumé IA"
                  >
                    {isLoadingSummary ? (
                      <Loader2 className="h-3 w-3 animate-spin text-violet-500" />
                    ) : (
                      <Sparkles className="h-3 w-3 text-violet-400 hover:text-violet-600" />
                    )}
                  </button>
                )}
              </div>
            ) : null}
          </motion.div>
        </HoverCardTrigger>

        <HoverCardContent side="right" align="start" className="w-80">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium',
                  conversation.etablissement_id
                    ? 'bg-blue-100 text-blue-700'
                    : conversation.visibility === 'public'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-violet-100 text-violet-700'
                )}
              >
                {conversationTitle?.substring(0, 2).toUpperCase() || 'PU'}
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{conversationTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {conversation.members?.length || 0} membre
                  {(conversation.members?.length || 0) > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Établissement lié */}
            {conversation.etablissement && (
              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded-lg">
                <Building2 className="h-3.5 w-3.5" />
                <span>{conversation.etablissement.nom}</span>
              </div>
            )}

            {/* Description */}
            {conversation.description && (
              <p className="text-sm text-muted-foreground">{conversation.description}</p>
            )}

            {/* Dernier message complet avec rendu Markdown */}
            {lastMessageData && (
              <div className="p-2.5 bg-muted/50 rounded-lg">
                <p className="font-medium text-xs mb-1.5 text-muted-foreground">
                  {lastMessageData.user
                    ? `${lastMessageData.user.prenom} ${lastMessageData.user.nom}`
                    : 'Membre'}
                </p>
                <div className="text-foreground">
                  <PulseMarkdownRenderer content={lastMessageData.content} />
                </div>
              </div>
            )}

            {/* Résumé IA ou bouton */}
            {summary ? (
              <div className="p-2.5 bg-violet-50 rounded-lg text-sm border-l-2 border-violet-400">
                <p className="font-medium text-xs text-violet-600 mb-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Résumé IA
                </p>
                <p className="text-violet-900">{summary}</p>
              </div>
            ) : (
              onGenerateSummary && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    onGenerateSummary(conversation.id)
                  }}
                  disabled={isLoadingSummary}
                >
                  {isLoadingSummary ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1.5" />
                  )}
                  Générer un résumé
                </Button>
              )
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    )
  },
  (prevProps, nextProps) => {
    // Custom comparator for optimal memoization
    return (
      prevProps.conversation.id === nextProps.conversation.id &&
      prevProps.conversation.updated_at === nextProps.conversation.updated_at &&
      prevProps.unreadCount === nextProps.unreadCount &&
      prevProps.summary === nextProps.summary &&
      prevProps.isLoadingSummary === nextProps.isLoadingSummary &&
      prevProps.index === nextProps.index &&
      prevProps.currentUserId === nextProps.currentUserId
    )
  }
)
