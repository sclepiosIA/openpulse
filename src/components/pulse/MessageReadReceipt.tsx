import { memo } from 'react'
import { cn } from '@/lib/utils'

export type ReceiptStatus = 'sending' | 'sent' | 'delivered' | 'read'

interface MessageReadReceiptProps {
  status: ReceiptStatus
  readByCount?: number
  totalRecipients?: number
  isGroupChat?: boolean
  className?: string
}

export const MessageReadReceipt = memo(function MessageReadReceipt({
  status,
  readByCount = 0,
  totalRecipients = 1,
  isGroupChat = false,
  className,
}: MessageReadReceiptProps) {
  let label: string | null = null
  let color = 'text-muted-foreground'

  switch (status) {
    case 'sending':
      label = 'Envoi…'
      color = 'text-muted-foreground/60'
      break
    case 'sent':
      label = 'Envoyé'
      break
    case 'delivered':
      label = isGroupChat ? `Reçu par ${readByCount}/${totalRecipients}` : 'Reçu'
      break
    case 'read':
      label = isGroupChat ? `Lu par ${readByCount}/${totalRecipients}` : 'Lu'
      color = 'text-blue-500'
      break
    default:
      return null
  }

  return (
    <span
      className={cn(
        'inline-flex items-center ml-1 text-[10px] font-medium whitespace-nowrap',
        color,
        className
      )}
    >
      {label}
    </span>
  )
})
