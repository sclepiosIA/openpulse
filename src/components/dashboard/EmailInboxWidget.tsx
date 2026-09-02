import React, { useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Mail, ArrowRight, Loader2, Inbox } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEmailThreads } from '@/hooks/email/useEmailThreads'
import { useEmailThreadActions } from '@/hooks/email/useEmailThreadActions'
import { useThreadsEnrichedData } from '@/hooks/email/useThreadsEnrichedData'
import { EmailInboxWidgetItem } from './EmailInboxWidgetItem'
import { useRealtimeEmailCompat } from '@/contexts/RealtimeEmailContext'

interface EmailInboxWidgetProps {
  maxItems?: number
}

export function EmailInboxWidget({ maxItems = 5 }: EmailInboxWidgetProps) {
  const navigate = useNavigate()
  const { threads, isLoading, invalidateThreads } = useEmailThreads({
    page: 1,
    itemsPerPage: 20,
    filters: {
      search: '',
      category: null,
      priority: null,
      unreadOnly: false,
      unprocessedOnly: false,
      dateFrom: null,
      dateTo: null,
      etablissementId: null,
      mailbox: 'inbox',
      groupeId: null,
      partenaireId: null,
    },
  })
  const {
    archiveThread,
    markAsRead,
    toggleStar,
    markAsProcessed,
    deleteThread,
    markAsSpam,
    updateTags,
  } = useEmailThreadActions()

  const recentThreads = (threads || []).slice(0, maxItems)
  const unreadCountLocal = recentThreads.filter((t: any) => t.unread_count > 0).length

  const { data: enrichedDataMap } = useThreadsEnrichedData(recentThreads)

  // Use centralized realtime context for invalidation (no duplicate channels)
  const { invalidateThreads: realtimeInvalidate } = useRealtimeEmailCompat(() => {
    invalidateThreads()
  })

  const handleArchive = useCallback(
    (threadId: string) => {
      archiveThread({ threadId, archived: true })
    },
    [archiveThread]
  )

  const handleDelete = useCallback(
    (threadId: string) => {
      deleteThread({ threadId })
    },
    [deleteThread]
  )

  const handleMarkAsRead = useCallback(
    (threadId: string, read: boolean) => {
      markAsRead({ threadId, read })
    },
    [markAsRead]
  )

  const handleToggleStar = useCallback(
    (threadId: string, isStarred: boolean) => {
      toggleStar({ threadId, starred: !isStarred })
    },
    [toggleStar]
  )

  const handleToggleProcessed = useCallback(
    (threadId: string, isProcessed: boolean) => {
      markAsProcessed({ threadId, processed: !isProcessed })
    },
    [markAsProcessed]
  )

  const handleMarkAsSpam = useCallback(
    (threadId: string) => {
      markAsSpam({ threadId, isSpam: true })
    },
    [markAsSpam]
  )

  const handleUpdateTags = useCallback(
    (threadId: string, tags: string[]) => {
      updateTags({ threadId, tags })
    },
    [updateTags]
  )

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-l-4 border-l-primary h-[340px] [.compact_&]:h-[280px] flex flex-col">
      <CardHeader className="py-2 px-3 shrink-0 [.compact_&]:py-1.5">
        <CardTitle className="flex items-center justify-between text-base [.compact_&]:text-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <span>Boîte de réception</span>
          </div>
          {unreadCountLocal > 0 && (
            <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs">
              {unreadCountLocal} non lu{unreadCountLocal > 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col px-2 pt-0 pb-2 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !recentThreads.length ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Aucun email récent</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full -mx-1 px-1">
              <div className="space-y-0.5 pb-1">
                {recentThreads.map((thread: any, index: number) => (
                  <EmailInboxWidgetItem
                    key={thread.id}
                    thread={thread}
                    enrichedData={enrichedDataMap?.get(thread.id)}
                    index={index}
                    onClick={() => navigate(`/emails?thread=${thread.id}`)}
                    onArchive={() => handleArchive(thread.id)}
                    onDelete={() => handleDelete(thread.id)}
                    onMarkAsRead={(read) => handleMarkAsRead(thread.id, read)}
                    onToggleStar={() => handleToggleStar(thread.id, thread.is_starred)}
                    onToggleProcessed={() => handleToggleProcessed(thread.id, thread.is_processed)}
                    onMarkAsSpam={() => handleMarkAsSpam(thread.id)}
                    onUpdateTags={(tags) => handleUpdateTags(thread.id, tags)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-1 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10 shrink-0 h-7"
          onClick={() => navigate('/emails')}
        >
          Voir tous les emails
          <ArrowRight className="h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  )
}
