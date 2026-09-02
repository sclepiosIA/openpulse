/**
 * JarvisHistorySheet - Historique des actions Jarvis - Premium Immersive
 *
 * V11.0: Full-text search in conversation history
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  History,
  Mail,
  CheckSquare,
  Building2,
  Calendar,
  Ticket,
  Check,
  X,
  Clock,
  Filter,
  TrendingUp,
  Sparkles,
  Search,
  MessageSquare,
  User,
  Bot,
  XCircle,
  ArrowRight,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuth } from '@/hooks/shared/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisConversationSearch } from '@/hooks/jarvis/useJarvisConversationSearch'
import { supabase } from '@/integrations/supabase/client'
interface JarvisHistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoadConversation?: (conversationId: string) => void
}

interface HistoryItem {
  id: string
  action_type: string
  trigger_type: string
  confidence_score: number
  was_modified: boolean
  was_approved: boolean
  execution_time_ms: number
  kb_articles_count: number
  kb_base_types: string[]
  created_at: string
}

interface PendingAction {
  id: string
  trigger_type: string
  status: string
  proposed_action: {
    type: string
    preview_text: string
    confidence_score: number
  }
  created_at: string
  expires_at: string
}

const ACTION_ICONS = {
  send_email: Mail,
  create_task: CheckSquare,
  update_status: Building2,
  schedule_meeting: Calendar,
  close_ticket: Ticket,
}

const ACTION_COLORS = {
  send_email: 'text-sky-600 dark:text-sky-400 bg-gradient-to-br from-sky-500/15 to-sky-500/5',
  create_task:
    'text-emerald-600 dark:text-emerald-400 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5',
  update_status:
    'text-purple-600 dark:text-purple-400 bg-gradient-to-br from-purple-500/15 to-purple-500/5',
  schedule_meeting:
    'text-pink-600 dark:text-pink-400 bg-gradient-to-br from-pink-500/15 to-pink-500/5',
  close_ticket:
    'text-amber-600 dark:text-amber-400 bg-gradient-to-br from-amber-500/15 to-amber-500/5',
}

const STATUS_CONFIG = {
  pending: {
    label: 'En attente',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  approved: {
    label: 'Approuvé',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  executed: { label: 'Exécuté', color: 'bg-primary/10 text-primary border-primary/20' },
  rejected: { label: 'Rejeté', color: 'bg-muted text-muted-foreground border-border' },
  expired: { label: 'Expiré', color: 'bg-muted/50 text-muted-foreground/70 border-border/50' },
  error: { label: 'Erreur', color: 'bg-destructive/10 text-destructive border-destructive/20' },
}

export function JarvisHistorySheet({
  open,
  onOpenChange,
  onLoadConversation,
}: JarvisHistorySheetProps) {
  const { user } = useAuth()
  const [filter, setFilter] = useState<string>('all')
  const [tab, setTab] = useState('search')

  // Full-text search hook
  const {
    searchTerm,
    setSearchTerm,
    results: searchResults,
    isSearching,
    hasSearched,
    clearSearch,
    highlightMatch,
  } = useJarvisConversationSearch({ enabled: open })

  // Récupérer l'historique des actions
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['jarvis-history', user?.id, filter],
    queryFn: async () => {
      if (!user?.id) return []

      let query = supabase
        .from('jarvis_action_history')
        .select(
          'id, action_type, trigger_type, confidence_score, was_modified, was_approved, execution_time_ms, kb_articles_count, kb_base_types, created_at'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (filter !== 'all') {
        query = query.eq('action_type', filter)
      }

      const { data, error } = await query
      if (error) throw error
      return data as HistoryItem[]
    },
    enabled: !!user?.id && open,
  })

  // Récupérer les actions passées (executed, rejected, expired)
  const { data: pastActions, isLoading: pastLoading } = useQuery({
    queryKey: ['jarvis-past-actions', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('jarvis_pending_actions')
        .select('id, trigger_type, status, proposed_action, created_at, expires_at')
        .eq('user_id', user.id)
        .in('status', ['executed', 'rejected', 'expired', 'error'])
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error
      return data as PendingAction[]
    },
    enabled: !!user?.id && open,
  })

  // Calcul des stats
  const stats = history?.reduce(
    (acc, item) => {
      acc.total++
      if (item.was_approved) acc.approved++
      acc.avgConfidence += item.confidence_score || 0
      acc.avgTime += item.execution_time_ms || 0
      return acc
    },
    { total: 0, approved: 0, avgConfidence: 0, avgTime: 0 }
  )

  if (stats && stats.total > 0) {
    stats.avgConfidence = stats.avgConfidence / stats.total
    stats.avgTime = stats.avgTime / stats.total
  }

  // Group search results by conversation
  const groupedSearchResults = searchResults.reduce(
    (acc, result) => {
      if (!acc[result.conversation_id]) {
        acc[result.conversation_id] = {
          title: result.conversation_title,
          messages: [],
        }
      }
      acc[result.conversation_id].messages.push(result)
      return acc
    },
    {} as Record<string, { title: string; messages: typeof searchResults }>
  )

  const handleOpenConversation = (conversationId: string) => {
    if (onLoadConversation) {
      onLoadConversation(conversationId)
      onOpenChange(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col border-l-primary/10 z-[10000]">
        {/* Premium Header */}
        <div className="relative overflow-hidden bg-marque-grille px-5 py-5">
          <motion.div
            className="absolute rounded-full blur-2xl opacity-20"
            style={{
              width: 80,
              height: 80,
              background: 'hsl(197 64% 60% / 0.3)',
              right: '10%',
              top: '20%',
            }}
            animate={{ y: [0, -8, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          <SheetHeader className="space-y-1.5 relative">
            <SheetTitle className="flex items-center gap-3 text-white">
              <div className="p-2 rounded-xl bg-card/10 backdrop-blur-sm border border-white/20">
                <History className="h-5 w-5" />
              </div>
              Historique Jarvis
            </SheetTitle>
            <SheetDescription className="text-white/70">
              Recherchez et consultez vos conversations passées
            </SheetDescription>
          </SheetHeader>

          <svg
            className="absolute bottom-0 left-0 right-0 w-full h-3"
            viewBox="0 0 1440 20"
            preserveAspectRatio="none"
          >
            <path
              d="M0,10 C240,17 480,3 720,10 C960,17 1200,3 1440,10 L1440,20 L0,20 Z"
              fill="hsl(var(--background))"
            />
          </svg>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-4 grid w-auto grid-cols-3 bg-muted/50">
            <TabsTrigger
              value="search"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Search className="h-3.5 w-3.5" />
              Recherche
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <History className="h-3.5 w-3.5" />
              Actions
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Stats
            </TabsTrigger>
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search" className="flex-1 mt-0 flex flex-col">
            {/* Search Input */}
            <div className="p-4 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher dans les conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-9 bg-muted/30 border-border/50"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={clearSearch}
                    aria-label="Fermer"
                  >
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
              {hasSearched && (
                <p className="text-xs text-muted-foreground mt-2">
                  {isSearching ? (
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3 animate-pulse" />
                      Recherche en cours...
                    </span>
                  ) : (
                    `${searchResults.length} résultat${searchResults.length > 1 ? 's' : ''} trouvé${searchResults.length > 1 ? 's' : ''}`
                  )}
                </p>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {!hasSearched ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-muted/50 ring-1 ring-border/50 mb-3">
                      <MessageSquare className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                      Tapez au moins 2 caractères pour rechercher
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Recherche dans tous vos messages avec Jarvis
                    </p>
                  </div>
                ) : isSearching ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-3">
                      <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                    </div>
                    <p className="text-sm text-muted-foreground">Recherche en cours...</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-muted/50 ring-1 ring-border/50 mb-3">
                      <Search className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">Aucun résultat pour "{searchTerm}"</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Essayez d'autres termes de recherche
                    </p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {Object.entries(groupedSearchResults).map(
                      ([conversationId, { title, messages }], groupIndex) => (
                        <motion.div
                          key={conversationId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ delay: groupIndex * 0.05 }}
                          className="border border-border/50 rounded-xl overflow-hidden bg-card/50 hover:border-primary/30 transition-all"
                        >
                          {/* Conversation Header */}
                          <button
                            onClick={() => handleOpenConversation(conversationId)}
                            className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <MessageSquare className="h-4 w-4 text-primary shrink-0" />
                              <span className="text-sm font-medium truncate">
                                {title || 'Conversation sans titre'}
                              </span>
                              <Badge variant="secondary" className="text-[10px] shrink-0">
                                {messages.length} match{messages.length > 1 ? 'es' : ''}
                              </Badge>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </button>

                          {/* Matching Messages */}
                          <div className="divide-y divide-border/30">
                            {messages.slice(0, 3).map((result, msgIndex) => (
                              <div
                                key={`${result.conversation_id}-${msgIndex}`}
                                className="p-3 hover:bg-muted/20 transition-colors"
                              >
                                <div className="flex items-start gap-2">
                                  <div
                                    className={cn(
                                      'p-1.5 rounded-lg shrink-0',
                                      result.message_role === 'user'
                                        ? 'bg-primary/10'
                                        : 'bg-emerald-500/10'
                                    )}
                                  >
                                    {result.message_role === 'user' ? (
                                      <User className="h-3 w-3 text-primary" />
                                    ) : (
                                      <Bot className="h-3 w-3 text-emerald-600" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-foreground/90 line-clamp-2">
                                      {highlightMatch(result.message_content, searchTerm).map(
                                        (part, i) => (
                                          <span
                                            key={`history-highlight-${result.conversation_id}-${result.message_created_at}-${i}`}
                                            className={cn(
                                              part.highlight &&
                                                'bg-yellow-500/30 text-yellow-900 dark:text-yellow-100 px-0.5 rounded'
                                            )}
                                          >
                                            {part.text}
                                          </span>
                                        )
                                      )}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {format(
                                        new Date(result.message_created_at),
                                        'dd MMM yyyy, HH:mm',
                                        { locale: fr }
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {messages.length > 3 && (
                              <div className="p-2 text-center">
                                <span className="text-xs text-muted-foreground">
                                  +{messages.length - 3} autres résultats dans cette conversation
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )
                    )}
                  </AnimatePresence>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="flex-1 mt-0 flex flex-col">
            {/* Filtre */}
            <div className="p-4 border-b border-border/50">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full bg-muted/30 border-border/50">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filtrer par type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les actions</SelectItem>
                  <SelectItem value="send_email">📧 Emails envoyés</SelectItem>
                  <SelectItem value="create_task">✅ Tâches créées</SelectItem>
                  <SelectItem value="update_status">🔄 Statuts mis à jour</SelectItem>
                  <SelectItem value="schedule_meeting">📅 Réunions planifiées</SelectItem>
                  <SelectItem value="close_ticket">🎫 Tickets clôturés</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {historyLoading || pastLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-3">
                      <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                    </div>
                    <p className="text-sm text-muted-foreground">Chargement...</p>
                  </div>
                ) : pastActions && pastActions.length > 0 ? (
                  pastActions.map((action, index) => {
                    const Icon =
                      ACTION_ICONS[action.proposed_action?.type as keyof typeof ACTION_ICONS] ||
                      CheckSquare
                    const statusConfig =
                      STATUS_CONFIG[action.status as keyof typeof STATUS_CONFIG] ||
                      STATUS_CONFIG.pending
                    const colorClass =
                      ACTION_COLORS[action.proposed_action?.type as keyof typeof ACTION_COLORS] ||
                      'bg-muted'

                    return (
                      <motion.div
                        key={action.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="flex items-start gap-3 p-3.5 rounded-xl border border-border/50 hover:border-primary/20 bg-card/50 hover:bg-card transition-all hover:shadow-md"
                      >
                        <div
                          className={cn(
                            'p-2.5 rounded-xl shrink-0 ring-1 ring-border/30',
                            colorClass
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm font-medium truncate">
                              {action.proposed_action?.preview_text || 'Action'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge
                              variant="outline"
                              className={cn('text-[10px] border', statusConfig.color)}
                            >
                              {statusConfig.label}
                            </Badge>
                            <span>•</span>
                            <span>
                              {formatDistanceToNow(new Date(action.created_at), {
                                locale: fr,
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {action.status === 'executed' ? (
                            <div className="p-1.5 rounded-lg bg-emerald-500/10">
                              <Check className="h-4 w-4 text-emerald-500" />
                            </div>
                          ) : action.status === 'rejected' ? (
                            <div className="p-1.5 rounded-lg bg-muted">
                              <X className="h-4 w-4 text-muted-foreground" />
                            </div>
                          ) : (
                            <div className="p-1.5 rounded-lg bg-muted/50">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )
                  })
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-muted/50 ring-1 ring-border/50 mb-3">
                      <History className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">Aucune action dans l'historique</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="stats" className="flex-1 p-4 overflow-auto">
            <div className="space-y-6">
              {/* Stats cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: 'Actions totales',
                    value: stats?.total || 0,
                    color: 'from-primary/15 to-primary/5',
                    textColor: 'text-primary',
                  },
                  {
                    label: "Taux d'approbation",
                    value: `${stats?.total ? Math.round((stats.approved / stats.total) * 100) : 0}%`,
                    color: 'from-emerald-500/15 to-emerald-500/5',
                    textColor: 'text-emerald-600 dark:text-emerald-400',
                  },
                  {
                    label: 'Confiance moyenne',
                    value: `${stats?.avgConfidence ? Math.round(stats.avgConfidence * 100) : 0}%`,
                    color: 'from-purple-500/15 to-purple-500/5',
                    textColor: 'text-purple-600 dark:text-purple-400',
                  },
                  {
                    label: 'Temps moyen',
                    value: `${stats?.avgTime ? Math.round(stats.avgTime) : 0}ms`,
                    color: 'from-sky-500/15 to-sky-500/5',
                    textColor: 'text-sky-600 dark:text-sky-400',
                  },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={cn(
                      'p-4 rounded-xl border border-border/50 bg-gradient-to-br',
                      stat.color
                    )}
                  >
                    <div className={cn('text-2xl font-bold', stat.textColor)}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </motion.div>
                ))}
              </div>

              <Separator className="bg-border/50" />

              {/* Actions par type */}
              <div>
                <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Actions par type
                </h4>
                <div className="space-y-3">
                  {Object.entries(ACTION_ICONS).map(([type, Icon]) => {
                    const count = history?.filter((h) => h.action_type === type).length || 0
                    const percent = stats?.total ? (count / stats.total) * 100 : 0
                    const colorClass = ACTION_COLORS[type as keyof typeof ACTION_COLORS]

                    return (
                      <div key={type} className="flex items-center gap-3">
                        <div className={cn('p-1.5 rounded-lg', colorClass)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right font-medium">
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
