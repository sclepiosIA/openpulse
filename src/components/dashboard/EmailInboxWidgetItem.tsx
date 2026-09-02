import React from 'react';
import { cn } from '@/lib/utils';
import { EntityAvatar } from '@/components/ui/EntityAvatar';
import { Badge } from '@/components/ui/badge';
import { Paperclip, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { EmailThreadHoverCardContent } from '@/components/email/EmailThreadHoverCard';
import { EmailContextMenuItems } from '@/components/email/EmailContextMenu';
import { getThreadMainSender, sanitizeDisplayName } from '@/lib/emailUtils';
import { isMarqueEmail } from '@/lib/internalEmailConfig';
import type { ThreadEnrichedData } from '@/hooks/email/useThreadsEnrichedData';

interface EmailInboxWidgetItemProps {
  thread: {
    id: string;
    subject?: string | null;
    ai_generated_title?: string | null;
    from_name?: string | null;
    from_email?: string | null;
    is_read?: boolean;
    is_starred?: boolean;
    is_processed?: boolean;
    has_attachments?: boolean;
    last_message_at?: string | null;
    unread_count?: number;
    category?: string | null;
    tags?: string[];
    etablissement?: { id?: string; nom: string } | null;
    groupe?: { id?: string; nom: string } | null;
    partenaire?: { id?: string; nom: string } | null;
    messages?: any[];
    participants?: any[];
    account?: { email_address?: string };
  };
  enrichedData?: ThreadEnrichedData;
  index?: number;
  onClick: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onMarkAsRead?: (read: boolean) => void;
  onToggleStar?: () => void;
  onToggleProcessed?: () => void;
  onMarkAsSpam?: () => void;
  onUpdateTags?: (tags: string[]) => void;
}

export function EmailInboxWidgetItem({ 
  thread, 
  enrichedData, 
  index = 0, 
  onClick,
  onArchive,
  onDelete,
  onMarkAsRead,
  onToggleStar,
  onToggleProcessed,
  onMarkAsSpam,
  onUpdateTags
}: EmailInboxWidgetItemProps) {
  const isUnread = thread.unread_count && thread.unread_count > 0;
  const isStarred = thread.is_starred || false;
  const isProcessed = thread.is_processed || false;
  const currentTags = thread.tags || [];
  
  // Extraction correcte de l'expéditeur via getThreadMainSender
  const mainSender = getThreadMainSender(thread, thread.account?.email_address || '');
  const senderName = sanitizeDisplayName(mainSender?.name) 
    || mainSender?.name 
    || mainSender?.email?.split('@')[0] 
    || 'Expéditeur inconnu';
  const senderEmail = mainSender?.email || '';
  
  const displayTitle = thread.ai_generated_title || thread.subject || 'Sans objet';
  
  // Entity info for badge and hover card
  const entityName = thread.etablissement?.nom || thread.groupe?.nom || thread.partenaire?.nom;
  const badgeText = entityName || thread.category;

  const handleOpenNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/emails?thread=${thread.id}`, '_blank');
  };
  
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>
          <HoverCard openDelay={400} closeDelay={100}>
            <HoverCardTrigger asChild>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={onClick}
                className={cn(
                  "flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all",
                  "hover:bg-accent/60 hover:scale-[1.01]",
                  isUnread 
                    ? "border-l-[3px] border-l-primary bg-primary/5" 
                    : isProcessed
                      ? "border-l-[3px] border-l-green-500 bg-green-50/30 dark:bg-green-950/20"
                      : "border-l-[3px] border-l-transparent hover:border-l-muted-foreground/20",
                )}
              >
                {/* Avatar with unread indicator */}
                <div className="relative shrink-0">
                  <EntityAvatar 
                    name={senderName}
                    email={senderEmail || undefined}
                    logoUrl={enrichedData?.entityLogoUrl || undefined}
                    internalProfileAvatarUrl={senderEmail && isMarqueEmail(senderEmail) ? enrichedData?.internalProfileAvatarUrl : undefined}
                    size="xs"
                    isUnread={!!isUnread}
                  />
                  {isUnread && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute h-full w-full rounded-full bg-primary opacity-50" />
                      <span className="relative rounded-full h-2.5 w-2.5 bg-primary ring-2 ring-background" />
                    </span>
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Row 1: Sender + Time + Status icons */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <span className={cn(
                        "text-sm truncate",
                        isUnread ? "font-semibold text-foreground" : "text-muted-foreground"
                      )}>
                        {senderName}
                      </span>
                      {isProcessed && (
                        <span className="shrink-0 text-green-600">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {thread.last_message_at 
                        ? formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: false, locale: fr })
                        : ''
                      }
                    </span>
                  </div>
                  
                  {/* Row 2: Subject + Badge */}
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "text-xs truncate flex-1",
                      isUnread ? "font-medium text-foreground/80" : "text-muted-foreground"
                    )}>
                      {displayTitle}
                    </span>
                    
                    {thread.has_attachments && (
                      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                    
                    {badgeText && (
                      <Badge 
                        variant="outline" 
                        className="h-4 px-1 text-[9px] font-medium shrink-0 bg-background/50"
                      >
                        {badgeText.length > 10 ? `${badgeText.slice(0, 10)}…` : badgeText}
                      </Badge>
                    )}
                  </div>
                </div>
              </motion.div>
            </HoverCardTrigger>
            
            <HoverCardContent 
              side="left" 
              align="start" 
              sideOffset={8}
              avoidCollisions={true}
              collisionPadding={16}
              className="w-80 sm:w-96 max-w-[min(92vw,30rem)]"
            >
              <EmailThreadHoverCardContent thread={thread} />
            </HoverCardContent>
          </HoverCard>
        </div>
      </ContextMenuTrigger>
      
      <ContextMenuContent className="w-56">
        {/* Open in new tab - specific to widget */}
        <ContextMenuItem onClick={handleOpenNewTab} className="gap-2">
          <ExternalLink className="h-4 w-4" />
          Ouvrir dans un nouvel onglet
        </ContextMenuItem>
        <ContextMenuSeparator />
        
        {/* Standard email context menu items */}
        <EmailContextMenuItems
          isUnread={!!isUnread}
          isStarred={isStarred}
          isProcessed={isProcessed}
          currentTags={currentTags}
          onToggleRead={() => onMarkAsRead?.(!isUnread)}
          onToggleStar={() => onToggleStar?.()}
          onToggleProcessed={() => onToggleProcessed?.()}
          onArchive={() => onArchive?.()}
          onDelete={() => onDelete?.()}
          onMarkAsSpam={() => onMarkAsSpam?.()}
          onUpdateTags={(tags) => onUpdateTags?.(tags)}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}