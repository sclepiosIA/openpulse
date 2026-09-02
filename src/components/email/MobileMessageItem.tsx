import { Badge } from '@/components/ui/badge'
import { Paperclip, ChevronDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { sanitizeDisplayName } from '@/lib/emailUtils'
import { EmailAvatar } from './EmailAvatar'

interface MobileMessageItemProps {
  message: any
  isExpanded: boolean
  onClick: () => void
  isExternal?: boolean
}

export function MobileMessageItem({
  message,
  isExpanded,
  onClick,
  isExternal = true,
}: MobileMessageItemProps) {
  // Normaliser le nom (Prénom Nom au lieu de MAJUSCULES)
  const formatName = (name: string | null, email: string) => {
    if (!name) return email.split('@')[0]

    // Si tout en majuscules, convertir en Title Case
    if (name === name.toUpperCase()) {
      return name
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }
    return sanitizeDisplayName(name)
  }

  const displayName = formatName(message.from_name, message.from_address) || 'Inconnu'

  // Extraire un aperçu du contenu
  const getPreview = () => {
    const text = message.body_text || ''
    const strippedHtml = message.body_html
      ? message.body_html
          .replace(/<img[^>]*>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : ''
    const content = text || strippedHtml
    return content.length > 80 ? content.substring(0, 80) + '...' : content
  }

  return (
    <div
      className={`flex items-start gap-3 py-3 px-3 cursor-pointer transition-colors ${
        isExpanded ? 'bg-accent/30' : 'hover:bg-accent/20'
      }`}
      onClick={onClick}
    >
      {/* Avatar avec EmailAvatar */}
      <div className="relative flex-shrink-0">
        <EmailAvatar name={displayName} email={message.from_address} size="md" />
        {!isExternal && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-background" />
        )}
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="font-medium text-sm truncate">{displayName}</span>
          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
            {formatDistanceToNow(new Date(message.sent_date), {
              addSuffix: false,
              locale: fr,
            })}
          </span>
        </div>

        {/* Preview du contenu */}
        <p className="text-xs text-muted-foreground line-clamp-1">{getPreview()}</p>

        {/* Indicateurs */}
        <div className="flex items-center gap-2 mt-1">
          {message.has_attachments && (
            <Badge variant="outline" className="h-5 text-xs gap-1 px-1.5">
              <Paperclip className="h-3 w-3" />
              {message.attachments_count || 1}
            </Badge>
          )}
        </div>
      </div>

      {/* Chevron */}
      <ChevronDown
        className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${
          isExpanded ? 'rotate-180' : ''
        }`}
      />
    </div>
  )
}
