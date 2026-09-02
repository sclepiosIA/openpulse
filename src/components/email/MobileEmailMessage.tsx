import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { SwipeableListItem } from "@/components/mobile/SwipeableListItem";
import { EmailContentWithImages } from "./EmailContentWithImages";
import { EmailAvatar } from "./EmailAvatar";
import {
  Reply,
  Forward,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Download,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { sanitizeDisplayName } from "@/lib/emailUtils";
import { EmailMessage, EmailAttachment } from "@/types/email";

interface MobileEmailMessageProps {
  message: EmailMessage;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onReply: () => void;
  onForward: () => void;
  onDownloadAttachment?: (attachment: EmailAttachment) => void;
}

/**
 * Message email optimisé pour mobile avec swipe actions
 * Collapsible par défaut, expand pour voir le contenu
 */
export function MobileEmailMessage({
  message,
  isExpanded,
  onToggleExpand,
  onReply,
  onForward,
  onDownloadAttachment
}: MobileEmailMessageProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const displayName = sanitizeDisplayName(message.from_name || message.from_address);

  return (
    <SwipeableListItem
      leftActions={[
        {
          id: 'reply',
          label: 'Répondre',
          icon: <Reply className="h-4 w-4" />,
          color: 'primary',
          onAction: onReply
        }
      ]}
      rightActions={[
        {
          id: 'forward',
          label: 'Transférer',
          icon: <Forward className="h-4 w-4" />,
          color: 'success',
          onAction: onForward
        }
      ]}
    >
      <Card className="p-4 space-y-3">
        {/* Header message */}
        <div 
          className="flex items-start justify-between gap-2 cursor-pointer"
          onClick={onToggleExpand}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <EmailAvatar
              name={message.from_name}
              email={message.from_address}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(message.sent_date), { 
                  addSuffix: true, 
                  locale: fr 
                })}
              </p>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon"
            className="flex-shrink-0 h-8 w-8" aria-label="Précédent">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Corps du message (si expanded) */}
        {isExpanded && (
          <>
            {/* Destinataires (si utile) */}
            {message.to_addresses && message.to_addresses.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">À: </span>
                {Array.isArray(message.to_addresses) 
                  ? message.to_addresses.join(", ")
                  : message.to_addresses}
              </div>
            )}

            {/* Contenu */}
            <div className="prose prose-sm max-w-none text-sm">
              {message.body_html ? (
                <EmailContentWithImages 
                  htmlContent={message.body_html}
                  messageId={message.id}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans">
                  {message.body_text}
                </pre>
              )}
            </div>

            {/* Pièces jointes */}
            {message.has_attachments && message.attachments && message.attachments.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  {message.attachments.length} pièce{message.attachments.length > 1 ? 's' : ''} jointe{message.attachments.length > 1 ? 's' : ''}
                </p>
                {message.attachments.map((att) => (
                  <Button
                    key={att.id}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 h-auto py-2"
                    onClick={() => onDownloadAttachment?.(att)}
                  >
                    <Paperclip className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate flex-1 text-left text-xs">
                      {att.filename}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatFileSize(att.size_bytes)}
                    </span>
                    <Download className="h-3 w-3 flex-shrink-0" />
                  </Button>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
    </SwipeableListItem>
  );
}
