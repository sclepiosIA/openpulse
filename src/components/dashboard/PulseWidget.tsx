import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageCircle, ArrowRight, Loader2, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePulseConversations } from '@/hooks/pulse/usePulseConversations'
import { usePulseUnreadCount } from '@/hooks/pulse/usePulseUnreadCount'
import { usePulseWidgetSummaries } from '@/hooks/pulse/usePulseWidgetSummaries'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { PulseWidgetItem } from './PulseWidgetItem'

interface PulseWidgetProps {
  maxItems?: number
}

export function PulseWidget({ maxItems = 6 }: PulseWidgetProps) {
  const navigate = useNavigate()

  // Batch related queries - they all depend on currentProfile
  const { data: currentProfile } = useCurrentProfile()
  const { data: conversations, isLoading } = usePulseConversations()
  const { data: unreadData } = usePulseUnreadCount()
  const { getSummary, isLoading: isSummaryLoading, generateSummary } = usePulseWidgetSummaries()

  // Memoize sliced conversations to prevent re-renders
  const displayedConversations = React.useMemo(
    () => conversations?.slice(0, maxItems) || [],
    [conversations, maxItems]
  )
  const totalUnread = unreadData?.total || 0

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-l-4 border-l-violet-500 h-[340px] flex flex-col">
      <CardHeader className="py-2 px-3 shrink-0">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-500/10">
              <MessageCircle className="h-4 w-4 text-violet-500" />
            </div>
            <span>Pulse</span>
          </div>
          {totalUnread > 0 && (
            <Badge variant="destructive" className="text-xs animate-pulse">
              {totalUnread} non lu{totalUnread > 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col px-2 pt-0 pb-2 overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !displayedConversations.length ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm">
            <Users className="h-8 w-8 mb-2 opacity-50" />
            <p>Aucune conversation</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full -mx-1 px-1">
              <div className="space-y-1.5 pr-2">
                {displayedConversations.map((conv, index) => {
                  const unreadCount = unreadData?.byConversation?.[conv.id] || 0

                  return (
                    <PulseWidgetItem
                      key={conv.id}
                      conversation={conv}
                      unreadCount={unreadCount}
                      index={index}
                      currentUserId={currentProfile?.id || ''}
                      summary={getSummary(conv.id)}
                      isLoadingSummary={isSummaryLoading(conv.id)}
                      onGenerateSummary={generateSummary}
                      onClick={() => navigate(`/pulse?conversation=${conv.id}`)}
                    />
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 w-full mt-2 text-xs gap-1"
          onClick={() => navigate('/pulse')}
        >
          Ouvrir Pulse
          <ArrowRight className="h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  )
}
