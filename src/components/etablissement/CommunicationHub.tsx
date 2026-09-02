import { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { supabase } from '@/lib/supabaseBrowser'
import {
  Mail,
  Clock,
  Settings,
  Search,
  Filter,
  RefreshCw,
  Globe,
  TrendingUp,
  Sparkles,
  Inbox,
  Calendar,
  List,
  ChevronRight,
  User,
  AlertCircle,
} from 'lucide-react'
import { formatDistanceToNow, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { EmailThread } from '@/components/email/EmailThread'
import { EmailDomainManager } from '@/components/email/EmailDomainManager'
import { EmailTimeline } from '@/components/email/EmailTimeline'
import { AISuggestionsPanel } from '@/components/etablissement/AISuggestionsPanel'
import { fixMalformedEncoding, sanitizeEmailSubject } from '@/lib/emailUtils'
import { getCategoryColor } from '@/config/emailStatusColors'

interface CommunicationHubProps {
  etablissementId: string
  etablissementNom: string
}

type ViewMode = 'list' | 'timeline'
type CategoryFilter = 'all' | 'commercial' | 'support' | 'technique' | 'administratif' | 'interne'
type PeriodFilter = '7d' | '30d' | '90d' | 'all'

const ITEMS_PER_PAGE = 20

export function CommunicationHub({ etablissementId, etablissementNom }: CommunicationHubProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('30d')
  const [showDomainManager, setShowDomainManager] = useState(false)

  const parentRef = useRef<HTMLDivElement>(null)

  // Fetch threads with infinite scroll
  const {
    data: threadsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      'communication-hub-threads',
      etablissementId,
      categoryFilter,
      periodFilter,
      searchQuery,
    ],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('email_threads')
        .select('*, user_email_accounts!inner(email_address)', { count: 'exact' })
        .eq('etablissement_id', etablissementId)
        .order('last_message_date', { ascending: false })
        .range(pageParam * ITEMS_PER_PAGE, (pageParam + 1) * ITEMS_PER_PAGE - 1)

      // Category filter
      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter)
      }

      // Period filter
      if (periodFilter !== 'all') {
        const daysMap = { '7d': 7, '30d': 30, '90d': 90 }
        const startDate = subDays(new Date(), daysMap[periodFilter]).toISOString()
        query = query.gte('last_message_date', startDate)
      }

      // Search filter
      if (searchQuery.trim()) {
        query = query.ilike('subject', `%${searchQuery}%`)
      }

      const { data, error, count } = await query

      if (error) throw error
      return { data: data || [], total: count || 0, nextPage: pageParam + 1 }
    },
    getNextPageParam: (lastPage) => {
      const totalFetched = lastPage.nextPage * ITEMS_PER_PAGE
      return totalFetched < lastPage.total ? lastPage.nextPage : undefined
    },
    initialPageParam: 0,
    staleTime: 2 * 60 * 1000, // 2 minutes - prevent refetches on tab navigation
  })

  const threads = threadsData?.pages.flatMap((p) => p.data) || []
  const totalCount = threadsData?.pages[0]?.total || 0

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ['communication-hub-stats', etablissementId],
    queryFn: async () => {
      const { data: domains } = await supabase
        .from('email_domain_mappings')
        .select('id')
        .eq('etablissement_id', etablissementId)

      const { data: etab } = await supabase
        .from('etablissements')
        .select('engagement_score, derniers_echanges_resume, derniers_echanges_updated_at')
        .eq('id', etablissementId)
        .maybeSingle()

      const unreadCount = threads.reduce((acc, t) => acc + (t.unread_count || 0), 0)

      return {
        totalThreads: totalCount,
        activeDomains: domains?.length || 0,
        engagementScore: etab?.engagement_score || 0,
        unreadCount,
        aiSummary: etab?.derniers_echanges_resume,
        summaryUpdatedAt: etab?.derniers_echanges_updated_at,
      }
    },
    enabled: threads.length > 0 || totalCount > 0,
  })

  // Virtualizer for list
  const virtualizer = useVirtualizer({
    count: threads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 5,
  })

  // Load more on scroll
  const handleScroll = useCallback(() => {
    if (!parentRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current
    if (scrollHeight - scrollTop - clientHeight < 200 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (selectedThreadId) {
    return <EmailThread threadId={selectedThreadId} onBack={() => setSelectedThreadId(null)} />
  }

  return (
    <div className="space-y-4">
      {/* Compact Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <div>
              <p className="text-lg font-bold">{totalCount}</p>
              <p className="text-xs text-muted-foreground">Conversations</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-amber-500" />
            <div>
              <p className="text-lg font-bold">{stats?.unreadCount || 0}</p>
              <p className="text-xs text-muted-foreground">Non lus</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-green-500" />
            <div>
              <p className="text-lg font-bold">{stats?.activeDomains || 0}</p>
              <p className="text-xs text-muted-foreground">Domaines</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <div>
              <p className="text-lg font-bold">{stats?.engagementScore || 0}</p>
              <p className="text-xs text-muted-foreground">Engagement</p>
            </div>
          </div>
        </Card>
      </div>

      {/* AI Summary (collapsible) */}
      {stats?.aiSummary && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm line-clamp-2">{fixMalformedEncoding(stats.aiSummary)}</p>
                {stats.summaryUpdatedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Mis à jour{' '}
                    {formatDistanceToNow(new Date(stats.summaryUpdatedAt), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Suggestions Panel (compact) */}
      <AISuggestionsPanel etablissementId={etablissementId} filterType="operational" />

      {/* Filters & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans les conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}
          >
            <SelectTrigger className="w-[140px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="technique">Technique</SelectItem>
              <SelectItem value="administratif">Administratif</SelectItem>
              <SelectItem value="interne">Interne</SelectItem>
            </SelectContent>
          </Select>

          <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
            <SelectTrigger className="w-[120px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 jours</SelectItem>
              <SelectItem value="30d">30 jours</SelectItem>
              <SelectItem value="90d">90 jours</SelectItem>
              <SelectItem value="all">Tout</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              className="rounded-r-none"
              aria-label="Liste"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('timeline')}
              className="rounded-l-none"
              aria-label="Horloge"
            >
              <Clock className="w-4 h-4" />
            </Button>
          </div>

          <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Actualiser">
            <RefreshCw className="w-4 h-4" />
          </Button>

          <Sheet open={showDomainManager} onOpenChange={setShowDomainManager}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Paramètres">
                <Settings className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Gestion des domaines</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <EmailDomainManager etablissementId={etablissementId} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'list' ? (
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Conversations ({totalCount})</CardTitle>
              {hasNextPage && (
                <Badge variant="outline" className="text-xs">
                  {threads.length} chargés
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Aucune conversation trouvée</p>
                {(searchQuery || categoryFilter !== 'all') && (
                  <Button
                    variant="link"
                    onClick={() => {
                      setSearchQuery('')
                      setCategoryFilter('all')
                    }}
                  >
                    Réinitialiser les filtres
                  </Button>
                )}
              </div>
            ) : (
              <div
                ref={parentRef}
                className="max-h-[600px] overflow-y-auto"
                onScroll={handleScroll}
              >
                <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                  {virtualizer.getVirtualItems().map((virtualItem) => {
                    const thread = threads[virtualItem.index]
                    return (
                      <div
                        key={virtualItem.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: virtualItem.size,
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        <EmailListItem
                          thread={thread}
                          onClick={() => setSelectedThreadId(thread.id)}
                        />
                      </div>
                    )
                  })}
                </div>
                {isFetchingNextPage && (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmailTimeline
          etablissementId={etablissementId}
          etablissementNom={etablissementNom}
          onThreadSelect={setSelectedThreadId}
        />
      )}
    </div>
  )
}

// Email List Item Component
function EmailListItem({ thread, onClick }: { thread: any; onClick: () => void }) {
  const categoryColor = getCategoryColor(thread.category)

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 border-b cursor-pointer transition-colors hover:bg-accent/50',
        thread.unread_count > 0 && 'bg-primary/5'
      )}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4
            className={cn(
              'text-sm truncate',
              thread.unread_count > 0 ? 'font-semibold' : 'font-medium'
            )}
          >
            {thread.ai_generated_title || sanitizeEmailSubject(thread.subject)}
          </h4>
          {thread.unread_count > 0 && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0">
              {thread.unread_count}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {thread.category && (
            <Badge variant="outline" className={cn('text-xs px-1.5 py-0', categoryColor)}>
              {thread.category}
            </Badge>
          )}
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {thread.user_email_accounts?.email_address}
          </span>
          <span>•</span>
          <span>{thread.message_count} msg</span>
          {thread.priority === 'haute' && (
            <>
              <span>•</span>
              <AlertCircle className="w-3 h-3 text-red-500" />
            </>
          )}
        </div>

        {thread.ai_summary && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {sanitizeEmailSubject(thread.ai_summary)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(thread.last_message_date), { addSuffix: true, locale: fr })}
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  )
}
