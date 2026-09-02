import { useState, useCallback } from 'react'
import { format, isToday, isYesterday, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MessageItem } from './MessageItem'
import { ThreadView } from './ThreadView'
import { usePulseMessageReceipts } from '@/hooks/pulse/usePulseMessageReceipts'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { VirtualizedMessageList } from './VirtualizedMessageList'
import type { PulseMessage } from '@/types/pulse'
import type { ReceiptStatus } from './MessageReadReceipt'

interface MessageListProps {
  messages: PulseMessage[]
  conversationId: string
  onJoinVisio?: (roomCode: string) => void
  isGroupChat?: boolean
  totalRecipients?: number
  currentProfileId?: string
}

// Threshold for using virtualization (messages count)
const VIRTUALIZATION_THRESHOLD = 50

function formatDateDivider(date: Date): string {
  if (isToday(date)) return "Aujourd'hui"
  if (isYesterday(date)) return 'Hier'
  return format(date, 'EEEE d MMMM yyyy', { locale: fr })
}

// Regex to detect OpenPulse Meet visio links in messages
const MARQUE_MEET_REGEX =
  /📹 Visio OpenPulse Meet démarrée : https?:\/\/[^\s]+\/visio\/([a-zA-Z0-9-]+)/

export function MessageList({
  messages,
  conversationId,
  onJoinVisio,
  isGroupChat = false,
  totalRecipients = 1,
  currentProfileId,
}: MessageListProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const { data: currentProfile } = useCurrentProfile()
  const ownProfileId = currentProfileId || currentProfile?.id

  // Fetch receipts for all messages in this conversation
  const { getMessageReceiptStatus, isGroupChat: hookIsGroupChat } =
    usePulseMessageReceipts(conversationId)

  // Use provided isGroupChat or fallback to hook detection
  const effectiveIsGroupChat = isGroupChat || hookIsGroupChat

  // Extract room code from a visio message
  const extractRoomCode = useCallback((content: string): string | null => {
    const match = content.match(MARQUE_MEET_REGEX)
    return match ? match[1] : null
  }, [])

  const selectedMessage = selectedThreadId ? messages.find((m) => m.id === selectedThreadId) : null

  // Use virtualization for large message lists
  if (messages.length > VIRTUALIZATION_THRESHOLD) {
    return (
      <>
        <VirtualizedMessageList
          messages={messages}
          conversationId={conversationId}
          onJoinVisio={onJoinVisio}
          isGroupChat={effectiveIsGroupChat}
          totalRecipients={totalRecipients}
          currentProfileId={ownProfileId}
        />

        {/* Thread View Modal */}
        {selectedMessage && (
          <ThreadView
            parentMessage={selectedMessage}
            conversationId={conversationId}
            open={!!selectedThreadId}
            onOpenChange={(open) => !open && setSelectedThreadId(null)}
          />
        )}
      </>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground py-12">
        <div className="text-center">
          <p className="text-lg font-medium">Aucun message</p>
          <p className="text-sm mt-1">Soyez le premier à envoyer un message !</p>
        </div>
      </div>
    )
  }

  // Group messages by date
  const messagesByDate: { date: Date; messages: PulseMessage[] }[] = []
  let currentGroup: { date: Date; messages: PulseMessage[] } | null = null

  messages.forEach((message) => {
    const messageDate = new Date(message.created_at)

    if (!currentGroup || !isSameDay(currentGroup.date, messageDate)) {
      currentGroup = { date: messageDate, messages: [] }
      messagesByDate.push(currentGroup)
    }

    currentGroup.messages.push(message)
  })

  return (
    <>
      <div className="space-y-4 flex-1">
        {messagesByDate.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* Date separator */}
            <div className="sticky top-0 z-10 flex items-center gap-4 py-4 bg-gradient-to-b from-background via-background to-transparent">
              <div className="flex-1 h-px bg-border/60" />
              <span className="text-xs font-semibold text-muted-foreground px-3 py-1 bg-muted/50 rounded-full backdrop-blur-sm">
                {formatDateDivider(group.date)}
              </span>
              <div className="flex-1 h-px bg-border/60" />
            </div>

            {/* Day's messages */}
            <div className="space-y-0.5">
              {group.messages.map((message, index) => {
                const prevMessage = index > 0 ? group.messages[index - 1] : null
                const showAvatar =
                  !prevMessage ||
                  prevMessage.user_id !== message.user_id ||
                  new Date(message.created_at).getTime() -
                    new Date(prevMessage.created_at).getTime() >
                    300000 // 5 minutes

                // Check if this is a visio message
                const roomCode = extractRoomCode(message.content)

                // Only show receipt for own messages
                const isOwnMessage = message.user_id === ownProfileId
                const receiptSummary = getMessageReceiptStatus(
                  message.id,
                  message.user_id,
                  isOwnMessage
                )
                const receiptStatus: ReceiptStatus | undefined = isOwnMessage
                  ? receiptSummary.status
                  : undefined
                const readByCount = receiptSummary.readCount

                return (
                  <div key={message.id}>
                    <MessageItem
                      message={message}
                      conversationId={conversationId}
                      showAvatar={showAvatar}
                      onOpenThread={() => setSelectedThreadId(message.id)}
                      receiptStatus={receiptStatus}
                      isGroupChat={effectiveIsGroupChat}
                      readByCount={readByCount}
                      totalRecipients={receiptSummary.totalRecipients}
                      currentProfileId={ownProfileId}
                    />

                    {/* Join visio button for OpenPulse Meet messages */}
                    {roomCode && onJoinVisio && (
                      <div className="ml-12 mt-2 mb-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onJoinVisio(roomCode)}
                          className="gap-2"
                        >
                          <Video className="h-4 w-4" />
                          Rejoindre la visio
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Thread View Modal */}
      {selectedMessage && (
        <ThreadView
          parentMessage={selectedMessage}
          conversationId={conversationId}
          open={!!selectedThreadId}
          onOpenChange={(open) => !open && setSelectedThreadId(null)}
        />
      )}
    </>
  )
}
