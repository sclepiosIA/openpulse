import { useRef, useMemo, useCallback, useEffect, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { format, isToday, isYesterday, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MessageItem } from './MessageItem'
import { usePulseMessageReceipts } from '@/hooks/pulse/usePulseMessageReceipts'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import type { PulseMessage } from '@/types/pulse'
import type { ReceiptStatus } from './MessageReadReceipt'

interface VirtualizedMessageListProps {
  messages: PulseMessage[]
  conversationId: string
  onJoinVisio?: (roomCode: string) => void
  isGroupChat?: boolean
  totalRecipients?: number
  currentProfileId?: string
}

function formatDateDivider(date: Date): string {
  if (isToday(date)) return "Aujourd'hui"
  if (isYesterday(date)) return 'Hier'
  return format(date, 'EEEE d MMMM yyyy', { locale: fr })
}

// Regex to detect OpenPulse Meet visio links in messages
const MARQUE_MEET_REGEX =
  /📹 Visio OpenPulse Meet démarrée : https?:\/\/[^\s]+\/visio\/([a-zA-Z0-9-]+)/

type VirtualItem =
  | { type: 'divider'; date: Date; key: string }
  | { type: 'message'; message: PulseMessage; showAvatar: boolean; key: string }

// Memoized MessageItem wrapper to prevent unnecessary re-renders
interface MemoizedMessageItemProps {
  message: PulseMessage
  conversationId: string
  showAvatar: boolean
  receiptStatus: ReceiptStatus | undefined
  isGroupChat: boolean
  readByCount: number
  totalRecipients: number
  currentProfileId?: string
  roomCode: string | null
  onJoinVisio?: (roomCode: string) => void
}

const MemoizedMessageItem = memo(
  function MemoizedMessageItem({
    message,
    conversationId,
    showAvatar,
    receiptStatus,
    isGroupChat,
    readByCount,
    totalRecipients,
    currentProfileId,
    roomCode,
    onJoinVisio,
  }: MemoizedMessageItemProps) {
    return (
      <>
        <MessageItem
          message={message}
          conversationId={conversationId}
          showAvatar={showAvatar}
          onOpenThread={() => {}} // ThreadView is handled separately
          receiptStatus={receiptStatus}
          isGroupChat={isGroupChat}
          readByCount={readByCount}
          totalRecipients={totalRecipients}
          currentProfileId={currentProfileId}
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
      </>
    )
  },
  (prevProps, nextProps) => {
    // Custom comparison to avoid re-renders on unchanged props
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.created_at === nextProps.message.created_at &&
      prevProps.showAvatar === nextProps.showAvatar &&
      prevProps.receiptStatus === nextProps.receiptStatus &&
      prevProps.readByCount === nextProps.readByCount &&
      prevProps.isGroupChat === nextProps.isGroupChat &&
      prevProps.totalRecipients === nextProps.totalRecipients &&
      prevProps.currentProfileId === nextProps.currentProfileId &&
      prevProps.roomCode === nextProps.roomCode
    )
  }
)

export function VirtualizedMessageList({
  messages,
  conversationId,
  onJoinVisio,
  isGroupChat = false,
  totalRecipients = 1,
  currentProfileId,
}: VirtualizedMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const { data: currentProfile } = useCurrentProfile()
  const ownProfileId = currentProfileId || currentProfile?.id

  const { getMessageReceiptStatus, isGroupChat: hookIsGroupChat } =
    usePulseMessageReceipts(conversationId)

  const effectiveIsGroupChat = isGroupChat || hookIsGroupChat

  const extractRoomCode = useCallback((content: string): string | null => {
    const match = content.match(MARQUE_MEET_REGEX)
    return match ? match[1] : null
  }, [])

  // Flatten messages with date dividers into a single array for virtualization
  const virtualItems = useMemo((): VirtualItem[] => {
    if (messages.length === 0) return []

    const items: VirtualItem[] = []
    let lastDate: Date | null = null
    let lastUserId: string | null = null
    let lastMessageTime: number = 0

    messages.forEach((message) => {
      const messageDate = new Date(message.created_at)

      // Add date divider if needed
      if (!lastDate || !isSameDay(lastDate, messageDate)) {
        items.push({
          type: 'divider',
          date: messageDate,
          key: `divider-${messageDate.toISOString().split('T')[0]}`,
        })
        lastDate = messageDate
        lastUserId = null // Reset for new day
        lastMessageTime = 0
      }

      // Determine if avatar should be shown
      const showAvatar =
        !lastUserId ||
        lastUserId !== message.user_id ||
        messageDate.getTime() - lastMessageTime > 300000 // 5 minutes

      items.push({
        type: 'message',
        message,
        showAvatar,
        key: `msg-${message.id}`,
      })

      lastUserId = message.user_id
      lastMessageTime = messageDate.getTime()
    })

    return items
  }, [messages])

  const virtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = virtualItems[index]
      if (item.type === 'divider') return 48 // Date divider height
      // Message height depends on avatar presence
      return item.showAvatar ? 80 : 40
    },
    overscan: 10,
  })

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (virtualItems.length > 0 && parentRef.current) {
      virtualizer.scrollToIndex(virtualItems.length - 1, { align: 'end' })
    }
  }, [messages.length]) // Only trigger on message count change

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

  return (
    <div ref={parentRef} className="flex-1 overflow-auto px-2" style={{ contain: 'strict' }}>
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = virtualItems[virtualRow.index]

          if (item.type === 'divider') {
            return (
              <div
                key={item.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="sticky top-0 z-10 flex items-center gap-4 py-3 bg-gradient-to-b from-background via-background to-transparent">
                  <div className="flex-1 h-px bg-border/60" />
                  <span className="text-xs font-semibold text-muted-foreground px-3 py-1 bg-muted/50 rounded-full backdrop-blur-sm">
                    {formatDateDivider(item.date)}
                  </span>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
              </div>
            )
          }

          const { message, showAvatar } = item
          const roomCode = extractRoomCode(message.content)
          const isOwnMessage = message.user_id === ownProfileId
          const receiptSummary = getMessageReceiptStatus(message.id, message.user_id, isOwnMessage)
          const receiptStatus: ReceiptStatus | undefined = isOwnMessage
            ? receiptSummary.status
            : undefined
          const readByCount = receiptSummary.readCount

          return (
            <div
              key={item.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                minHeight: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <MemoizedMessageItem
                message={message}
                conversationId={conversationId}
                showAvatar={showAvatar}
                receiptStatus={receiptStatus}
                isGroupChat={effectiveIsGroupChat}
                readByCount={readByCount}
                totalRecipients={receiptSummary.totalRecipients}
                currentProfileId={ownProfileId}
                roomCode={roomCode}
                onJoinVisio={onJoinVisio}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
