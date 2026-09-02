import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useEmailSenderLogo } from '@/hooks/email/useEmailSenderLogo'
import { useQuery } from '@tanstack/react-query'
import {
  Sparkles,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Target,
  Calendar,
  ExternalLink,
  AlertCircle,
  Link2,
  Handshake,
  Reply,
  ReplyAll,
  Forward,
  Copy,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { sanitizeEmailSubject, formatEmailAddress } from '@/lib/emailUtils'
import { getEtablissementStatusColor, getPartenaireStatusColor } from '@/config/emailStatusColors'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CollapsibleCCBanner } from './CollapsibleCCBanner'
import { EmailAvatar } from './EmailAvatar'
import { toast } from 'sonner'
import type { SenderInfo } from './EmailThreadHeader'
import { EmailThreadTags } from './EmailThreadTags'
import { sanitizeEmailSubject as sanitizeSubject } from '@/lib/emailUtils'
import { fetchActiveTachesForEtablissement } from '@/services/email/emailContextQueries'
interface UnifiedEmailContextCardProps {
  thread: {
    ai_summary?: string
    ai_detailed_summary?: string
    suggested_actions?: string[]
    etablissement?: {
      id: string
      nom: string
      ville?: string
      region?: string
      type?: string
      statut?: string
      logo_url?: string
      progression?: number | null
      engagement_score?: number | null
    }
    partenaire?: {
      id: string
      nom: string
      logo_url?: string | null
      type_partenaire?: string
      sous_type?: string
      ville?: string
      statut_relation?: string
      engagement_score?: number | null
      valeur_partenariat?: number | null
      prochaine_action?: string | null
      dernier_contact?: string | null
    }
  }
  className?: string
  compact?: boolean
  onAssign?: () => void
  /** Email de l'expéditeur du dernier message, utilisé pour résoudre le logo via domaine */
  senderEmail?: string
  /** Sender info for recipients display */
  senderInfo?: SenderInfo | null
  /** Reply callbacks */
  onReply?: () => void
  onReplyAll?: () => void
  onForward?: () => void
  /** Thread title/tags props */
  threadTitle?: string
  threadCategory?: string | null
  threadTags?: string[]
  threadPriority?: string | null
  isArchived?: boolean
  isSpam?: boolean
  accountEmail?: string
  isUpdatingTags?: boolean
  onUpdateTags?: (tags: string[]) => void
}

export function UnifiedEmailContextCard({
  thread,
  className,
  compact = false,
  onAssign,
  senderEmail,
  senderInfo,
  onReply,
  onReplyAll,
  onForward,
  threadTitle,
  threadCategory,
  threadTags,
  threadPriority,
  isArchived,
  isSpam,
  accountEmail,
  isUpdatingTags,
  onUpdateTags,
}: UnifiedEmailContextCardProps) {
  const navigate = useNavigate()
  const [showFullSummary, setShowFullSummary] = useState(false)

  // Résolution logo via domaine email comme fallback
  const { data: senderLogo } = useEmailSenderLogo(senderEmail)

  const { etablissement, partenaire } = thread
  const summary = sanitizeEmailSubject(thread.ai_summary || '')
  const detailedSummary = thread.ai_detailed_summary || ''
  const hasDetailedSummary = detailedSummary.length > 0
  const isExpandable = hasDetailedSummary || summary.length > 150

  // Lazy load taches for etablissement (separate query to avoid deep nesting in thread fetch)
  const { data: etabTaches } = useQuery({
    queryKey: ['etab-taches-context', etablissement?.id],
    queryFn: async () => {
      return await fetchActiveTachesForEtablissement(etablissement!.id, { limit: 10 })
    },
    enabled: !!etablissement?.id,
    staleTime: 5 * 60 * 1000,
  })

  const activeTasks = etabTaches?.length || 0
  const nextTask = etabTaches?.find((t) => t.statut === 'A faire')

  // Engagement color based on score
  const getEngagementColor = (score: number | null | undefined) => {
    if (!score) return 'text-muted-foreground'
    if (score >= 70) return 'text-green-600 dark:text-green-400'
    if (score >= 40) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }

  // Don't render if nothing to show
  if (!thread.ai_summary && !etablissement && !partenaire) return null

  // Determine card style based on context type
  const isPartenaireContext = !etablissement && partenaire
  const cardClassName = isPartenaireContext
    ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 overflow-hidden'
    : 'bg-primary/5 dark:bg-primary/5 border-primary/20 overflow-hidden'

  return (
    <Card className={cn(cardClassName, className)}>
      {/* Establishment Section */}
      {etablissement ? (
        <div className={cn('border-b border-primary/10', compact ? 'px-0 py-2' : 'p-3')}>
          <div className="flex items-center gap-2.5">
            {/* Logo: direct logo_url → senderLogo fallback → initiales */}
            {etablissement.logo_url || senderLogo?.logoUrl ? (
              <img
                src={etablissement.logo_url || senderLogo?.logoUrl || ''}
                alt={etablissement.nom}
                className="w-8 h-8 rounded-lg object-contain bg-card border shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                {etablissement.nom.substring(0, 2).toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0 flex items-center gap-2">
              <p className="font-bold text-base truncate leading-tight">{etablissement.nom}</p>
              {etablissement.ville && (
                <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                  {etablissement.ville}
                </span>
              )}
              {etablissement.statut && (
                <Badge
                  className={cn(
                    'text-[10px] h-4 px-1 shrink-0',
                    getEtablissementStatusColor(etablissement.statut)
                  )}
                >
                  {etablissement.statut}
                </Badge>
              )}
              {/* Inline progression */}
              {etablissement.progression !== null && etablissement.progression !== undefined && (
                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  <Progress value={etablissement.progression} className="h-1.5 w-16" />
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {etablissement.progression}%
                  </span>
                </div>
              )}
              {/* Engagement */}
              {etablissement.engagement_score !== null &&
                etablissement.engagement_score !== undefined && (
                  <div className="hidden sm:flex items-center gap-0.5 shrink-0">
                    <TrendingUp
                      className={cn('h-3 w-3', getEngagementColor(etablissement.engagement_score))}
                    />
                    <span
                      className={cn(
                        'text-[10px] font-medium',
                        getEngagementColor(etablissement.engagement_score)
                      )}
                    >
                      {etablissement.engagement_score}
                    </span>
                  </div>
                )}
              {/* Active tasks */}
              <div className="hidden sm:flex items-center gap-0.5 shrink-0">
                <Target className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{activeTasks}</span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/etablissements/${etablissement.id}`)}
              className="h-6 px-2 text-[10px] shrink-0"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Fiche
            </Button>
          </div>
        </div>
      ) : partenaire ? (
        /* Partenaire Section */
        <div
          className={cn(
            'border-b border-purple-200 dark:border-purple-800',
            compact ? 'px-0 py-2' : 'p-3'
          )}
        >
          <div className="flex items-start gap-2.5">
            {partenaire.logo_url ? (
              <img
                src={partenaire.logo_url}
                alt={partenaire.nom}
                className="w-8 h-8 rounded-lg object-contain bg-card border shrink-0 mt-0.5"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement
                  if (fallback) fallback.style.display = 'flex'
                }}
              />
            ) : null}
            <div
              className={cn(
                'w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 items-center justify-center shrink-0 mt-0.5',
                partenaire.logo_url ? 'hidden' : 'flex'
              )}
            >
              <Handshake className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-base truncate leading-tight">{partenaire.nom}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/partenaires/${partenaire.id}`)}
                  className="h-6 px-2 text-[10px] shrink-0"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Fiche
                </Button>
              </div>

              {/* Type + Badges */}
              <div className="flex items-center flex-wrap gap-1 mt-0.5">
                {partenaire.type_partenaire && (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-4 px-1 border-purple-300 dark:border-purple-700"
                  >
                    {partenaire.type_partenaire}
                  </Badge>
                )}
                {partenaire.sous_type && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    {partenaire.sous_type}
                  </Badge>
                )}
                {partenaire.statut_relation && (
                  <Badge
                    className={cn(
                      'text-[10px] h-4 px-1',
                      getPartenaireStatusColor(partenaire.statut_relation)
                    )}
                  >
                    {partenaire.statut_relation}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="flex items-center gap-3 mt-2 text-xs">
            {/* Engagement */}
            {partenaire.engagement_score !== null && partenaire.engagement_score !== undefined && (
              <div className="flex items-center gap-1 shrink-0">
                <TrendingUp
                  className={cn('h-3 w-3', getEngagementColor(partenaire.engagement_score))}
                />
                <span
                  className={cn('font-medium', getEngagementColor(partenaire.engagement_score))}
                >
                  {partenaire.engagement_score}/100
                </span>
              </div>
            )}

            {/* Valeur partenariat */}
            {partenaire.valeur_partenariat && (
              <span className="text-muted-foreground">
                {partenaire.valeur_partenariat.toLocaleString('fr-FR')} €
              </span>
            )}
          </div>
        </div>
      ) : onAssign && thread.ai_summary ? (
        /* Classification Placeholder */
        <div className="p-3 border-b border-primary/10">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Aucun établissement associé</span>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onAssign}>
            <Link2 className="h-3 w-3 mr-1" />
            Associer
          </Button>
        </div>
      ) : null}

      {/* Sender Info / Recipients - below establishment */}
      {senderInfo && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              {/* De: */}
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground font-medium">De:</span>
                <button
                  className="font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                  onClick={() => {
                    navigator.clipboard.writeText(senderInfo.from_address)
                    toast.success('Adresse copiée !', {
                      description: senderInfo.from_address,
                      duration: 2000,
                    })
                  }}
                  title={senderInfo.from_address}
                >
                  {formatEmailAddress(senderInfo.from_name, senderInfo.from_address)}
                </button>
              </span>

              {/* À: */}
              {senderInfo.to_addresses && senderInfo.to_addresses.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground font-medium">À:</span>
                  {senderInfo.to_addresses.length === 1 ? (
                    <button
                      className="font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                      onClick={() => {
                        const email = senderInfo.to_addresses[0].email || ''
                        navigator.clipboard.writeText(email)
                        toast.success('Adresse copiée !', { description: email, duration: 2000 })
                      }}
                      title={senderInfo.to_addresses[0].email}
                    >
                      {senderInfo.to_addresses[0].name ||
                        senderInfo.to_addresses[0].email?.split('@')[0] ||
                        'Inconnu'}
                    </button>
                  ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="font-medium text-foreground hover:text-primary transition-colors cursor-pointer">
                          {senderInfo.to_addresses[0].name ||
                            senderInfo.to_addresses[0].email?.split('@')[0] ||
                            'Inconnu'}
                          {senderInfo.to_addresses.length > 1 && (
                            <span className="text-muted-foreground ml-0.5">
                              +{senderInfo.to_addresses.length - 1} autres
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-3" align="start">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs text-muted-foreground font-medium mb-1">
                            Destinataires ({senderInfo.to_addresses.length})
                          </span>
                          {senderInfo.to_addresses.map((addr, i) => (
                            <button
                              key={`addr-${addr.email ?? i}`}
                              className="group inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-muted/50 hover:bg-muted border border-border/50 hover:border-border transition-all duration-150 cursor-pointer"
                              onClick={() => {
                                const email = addr.email || ''
                                navigator.clipboard.writeText(email)
                                toast.success('Adresse copiée !', {
                                  description: email,
                                  duration: 2000,
                                })
                              }}
                            >
                              <EmailAvatar
                                name={addr.name}
                                email={addr.email}
                                size="sm"
                                className="h-4 w-4 text-[8px]"
                              />
                              <span className="max-w-[150px] truncate text-foreground/80">
                                {addr.name || addr.email?.split('@')[0]}
                              </span>
                              <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </span>
              )}

              {/* CC */}
              {senderInfo.cc_addresses && senderInfo.cc_addresses.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-0.5">
                      <span className="text-border">|</span>
                      <span className="ml-1 font-medium">CC: {senderInfo.cc_addresses.length}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3" align="start">
                    <CollapsibleCCBanner
                      ccAddresses={
                        senderInfo.cc_addresses as Parameters<
                          typeof CollapsibleCCBanner
                        >[0]['ccAddresses']
                      }
                      bccAddresses={
                        senderInfo.bcc_addresses as Parameters<
                          typeof CollapsibleCCBanner
                        >[0]['bccAddresses']
                      }
                      className="border-0 pl-0"
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Date */}
            <time className="text-muted-foreground whitespace-nowrap shrink-0">
              {new Date(senderInfo.sent_date).toLocaleString('fr-FR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </div>
        </div>
      )}

      {/* Thread Title & Tags - between recipients and AI summary */}
      {threadTitle && (
        <div className="px-3 py-2 border-b border-border/30">
          <h2 className="text-sm font-semibold break-words hyphens-auto leading-tight mb-1">
            {sanitizeSubject(threadTitle)}
          </h2>
          <div className="flex items-center gap-1 flex-wrap">
            {threadCategory && <Badge className="text-[10px] h-4 px-1">{threadCategory}</Badge>}
            {threadPriority === 'high' && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1">
                Priorité haute
              </Badge>
            )}
            {isArchived && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                Archivé
              </Badge>
            )}
            {isSpam && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1">
                Spam
              </Badge>
            )}
            {accountEmail && (
              <Badge variant="outline" className="hidden sm:inline-flex text-[10px] h-4 px-1">
                {accountEmail}
              </Badge>
            )}
            {onUpdateTags && (
              <EmailThreadTags
                tags={threadTags || []}
                onUpdateTags={onUpdateTags}
                disabled={isUpdatingTags}
                maxVisible={3}
              />
            )}
          </div>
        </div>
      )}

      {/* AI Summary Section */}
      {
        <div className="p-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center ring-1',
                  isPartenaireContext
                    ? 'bg-purple-100 dark:bg-purple-900/40 ring-purple-200 dark:ring-purple-700'
                    : 'bg-primary/10 ring-primary/20'
                )}
              >
                <Sparkles
                  className={cn(
                    'h-3 w-3',
                    isPartenaireContext ? 'text-purple-600 dark:text-purple-400' : 'text-primary'
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-wide',
                  isPartenaireContext ? 'text-purple-600 dark:text-purple-400' : 'text-primary'
                )}
              >
                Résumé IA
              </span>
            </div>
            <div className="flex items-center gap-1">
              {/* Reply buttons - same row as Résumé IA */}
              {onReply && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={onReply}
                  title="Répondre"
                  aria-label="Répondre"
                >
                  <Reply className="h-3.5 w-3.5" />
                </Button>
              )}
              {onReplyAll && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={onReplyAll}
                  title="Répondre à tous"
                  aria-label="Répondre à tous"
                >
                  <ReplyAll className="h-3.5 w-3.5" />
                </Button>
              )}
              {onForward && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={onForward}
                  title="Transférer"
                  aria-label="Transférer"
                >
                  <Forward className="h-3.5 w-3.5" />
                </Button>
              )}
              {isExpandable && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] text-muted-foreground hover:text-foreground px-1"
                  onClick={() => setShowFullSummary(!showFullSummary)}
                >
                  {showFullSummary ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Short summary - always visible when exists */}
          {thread.ai_summary && (
            <p
              className={cn(
                'text-sm leading-relaxed text-foreground',
                !showFullSummary && !hasDetailedSummary && summary.length > 150 && 'line-clamp-2'
              )}
            >
              {summary}
            </p>
          )}

          {/* Detailed summary - shown on expand */}
          {thread.ai_summary && showFullSummary && hasDetailedSummary && (
            <div
              className={cn(
                'mt-2 p-2.5 rounded-md text-sm leading-relaxed whitespace-pre-line',
                isPartenaireContext
                  ? 'bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-800/50'
                  : 'bg-muted/40 border border-border/50'
              )}
            >
              {detailedSummary}
            </div>
          )}

          {/* Suggested actions */}
          {thread.suggested_actions && thread.suggested_actions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {thread.suggested_actions.slice(0, 2).map((action: string, idx: number) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-6 text-[10px] bg-background/50 transition-colors px-2',
                    isPartenaireContext
                      ? 'hover:bg-purple-50 dark:hover:bg-purple-950/30 border-purple-200 hover:border-purple-300 dark:border-purple-700'
                      : 'hover:bg-primary/5 border-primary/20 hover:border-primary/40'
                  )}
                >
                  <Lightbulb className="h-2.5 w-2.5 mr-1 text-warning" />
                  <span className="truncate max-w-[120px]">{action}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      }

      {/* Footer: Next task (etablissement) or prochaine action (partenaire) */}
      {etablissement && nextTask && (
        <div className="flex items-center gap-2 text-xs bg-muted/30 px-3 py-2 border-t border-primary/10">
          <span className="text-muted-foreground shrink-0">📌</span>
          <span className="font-medium truncate flex-1">{nextTask.titre}</span>
          {nextTask.echeance && (
            <span className="text-muted-foreground shrink-0 flex items-center gap-0.5">
              <Calendar className="h-2.5 w-2.5" />
              {new Date(nextTask.echeance).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
          )}
        </div>
      )}

      {!etablissement && partenaire?.prochaine_action && (
        <div className="flex items-center gap-2 text-xs bg-purple-100/50 dark:bg-purple-950/30 px-3 py-2 border-t border-purple-200 dark:border-purple-800">
          <Target className="h-3 w-3 text-purple-600 dark:text-purple-400 shrink-0" />
          <span className="font-medium truncate flex-1">{partenaire.prochaine_action}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] shrink-0"
            onClick={() => navigate(`/partenaires/${partenaire.id}`)}
          >
            Voir
          </Button>
        </div>
      )}
    </Card>
  )
}
