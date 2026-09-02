import { memo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Archive,
  ChevronRight,
  Mail,
  MailOpen,
  Trash2,
  UserPlus,
  MoreVertical,
  CheckCircle2,
  Circle,
  Star,
  StarOff,
  Ban,
  Reply,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeEmailSubject, sanitizeDisplayName, getThreadMainSender } from "@/lib/emailUtils";
import { EmailAvatar } from "./EmailAvatar";

import { SwipeableListItem } from "@/components/mobile/SwipeableListItem";
import { useLongPress } from "@/hooks/shared/useLongPress";
import { AssignInterlocutorDialog } from "./AssignInterlocutorDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { EmailThread } from "@/types/email";
import type { ThreadEnrichedData } from "@/hooks/email/useThreadsEnrichedData";

interface MobileEmailListItemProps {
  thread: EmailThread;
  enrichedData?: ThreadEnrichedData;
  selected?: boolean;
  isNew?: boolean;
  onSelect?: (selected: boolean) => void;
  onClick?: () => void;
  onToggleRead?: (threadId: string) => void;
  onArchive?: (threadId: string) => void;
  onDelete?: (threadId: string) => void;
  onEnterMultiSelect?: (threadId: string) => void;
  onMarkAsProcessed?: (threadId: string, processed: boolean) => void;
  onMarkAsSpam?: (threadId: string) => void;
  onToggleStar?: (threadId: string, isStarred: boolean) => void;
}

/**
 * Version mobile optimisée de EmailListItem
 * Design moderne avec avatar coloré et layout aéré
 */
export const MobileEmailListItem = memo(function MobileEmailListItem({
  thread,
  enrichedData,
  selected = false,
  isNew = false,
  onSelect,
  onClick,
  onToggleRead,
  onArchive,
  onDelete,
  onEnterMultiSelect,
  onMarkAsProcessed,
  onMarkAsSpam,
  onToggleStar,
}: MobileEmailListItemProps) {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  
  const isUnread = thread.unread_count > 0;
  const isProcessed = thread.is_processed === true;
  const isStarred = thread.priority === "high"; // Use priority as star indicator
  const hasReply = enrichedData?.hasReply || false;
  const mainSender = getThreadMainSender(thread, thread.account?.email_address || "");
  const isLastMessageFromUser = mainSender?.isCurrentUser || false;

  // Long press for multi-select
  const longPress = useLongPress({
    onLongPress: () => {
      onEnterMultiSelect?.(thread.id);
    },
    delay: 500,
    haptic: true,
  });

  const handleToggleRead = () => onToggleRead?.(thread.id);
  const handleArchive = () => onArchive?.(thread.id);
  const handleDelete = () => onDelete?.(thread.id);
  const handleToggleProcessed = () => onMarkAsProcessed?.(thread.id, !isProcessed);
  const handleMarkAsSpam = () => onMarkAsSpam?.(thread.id);
  const handleToggleStar = () => onToggleStar?.(thread.id, isStarred);

  // Display name
  const senderDisplay = isLastMessageFromUser
    ? `Vous → ${sanitizeDisplayName(mainSender?.name)?.split(" ")[0] || "?"}`
    : sanitizeDisplayName(mainSender?.name) || mainSender?.email?.split("@")[0] || "Inconnu";

  return (
    <>
      <SwipeableListItem
        leftActions={[
          {
            id: "toggle-read",
            label: isUnread ? "Marquer lu" : "Marquer non lu",
            icon: isUnread ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />,
            color: "primary",
            onAction: handleToggleRead,
          },
        ]}
        rightActions={[
          {
            id: "archive",
            label: "Archiver",
            icon: <Archive className="h-4 w-4" />,
            color: "warning",
            onAction: handleArchive,
          },
          {
            id: "delete",
            label: "Supprimer",
            icon: <Trash2 className="h-4 w-4" />,
            color: "destructive",
            onAction: handleDelete,
          },
        ]}
      >
        <div
          {...longPress.handlers}
          className={cn(
            "flex items-start gap-3 px-4 py-3 active:bg-accent/30 transition-colors",
            selected && "bg-accent",
            isUnread && "bg-primary/5",
            // Fond vert léger pour emails traités (si pas non lu)
            isProcessed && !isUnread && "bg-green-50/60 dark:bg-green-950/20",
            isNew && "animate-in fade-in slide-in-from-top-2 duration-300"
          )}
          onClick={onClick}
          role="article"
          aria-label={`Email de ${senderDisplay}: ${sanitizeEmailSubject(thread.subject)}`}
          
      data-selected={selected || undefined}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick?.();
            }
          }}
        >
          {/* Unread Indicator + Avatar container */}
          <div className="relative">
            {/* Pulsing unread dot */}
            {isUnread && (
              <span className="absolute -left-2 top-1/2 -translate-y-1/2 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
            )}
            
            {/* Checkbox (visible only in multi-select mode if provided) */}
            {onSelect ? (
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selected}
                  onCheckedChange={onSelect}
                  aria-label="Sélectionner cet email"
                  className="h-10 w-10"
                />
              </div>
            ) : (
              /* Avatar - Larger on mobile, with forceInternal for team members */
              <EmailAvatar
                name={mainSender?.name}
                email={mainSender?.email}
                isUnread={isUnread}
                size="lg"
                forceInternal={enrichedData?.isInternalTeam}
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            {/* Row 1: Sender + Time + Indicators */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span
                  className={cn(
                    "truncate text-sm",
                    isUnread ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                  )}
                >
                  {senderDisplay}
                </span>
                {/* Processed indicator */}
                {isProcessed && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                )}
                {/* Replied indicator */}
                {hasReply && (
                  <Reply className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                )}
                {/* Starred indicator */}
                {isStarred && (
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className={cn(
                  "text-xs",
                  isUnread ? "text-primary font-medium" : "text-muted-foreground"
                )}>
                  {formatDistanceToNow(new Date(thread.last_message_date), {
                    addSuffix: false,
                    locale: fr,
                  })}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </div>
            </div>

            {/* Row 2: Subject */}
            <p
              className={cn(
                "truncate text-sm leading-snug",
                isUnread ? "font-semibold text-foreground" : "text-foreground/80"
              )}
            >
              {sanitizeEmailSubject(thread.ai_generated_title || thread.subject)}
            </p>

            {/* Row 3: Preview */}
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {thread.ai_summary || "Aucun aperçu disponible"}
            </p>

            {/* Row 4: Badges - Ultra Simplified (max 2) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Priority indicator - always show if urgent */}
              {thread.priority === "high" && (
                <Badge variant="destructive" className="h-5 text-[10px] px-1.5">
                  Urgent
                </Badge>
              )}

              {/* Show either category OR entity (not both to avoid clutter) */}
              {thread.etablissement?.nom || thread.groupe?.nom || thread.partenaire?.nom ? (
                <Badge variant="secondary" className="h-5 text-[10px] px-1.5 truncate max-w-[140px]">
                  {thread.etablissement?.nom || thread.groupe?.nom || thread.partenaire?.nom}
                </Badge>
              ) : thread.category && thread.category !== "Non classé" ? (
                <Badge variant="outline" className="h-5 text-[10px] px-1.5">
                  {thread.category}
                </Badge>
              ) : null}

              {/* Message count - compact */}
              {thread.message_count > 1 && (
                <span className="text-[10px] text-muted-foreground">
                  ({thread.message_count})
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions Button */}
          <div onClick={(e) => e.stopPropagation()} className="self-start pt-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Plus d'options">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 bg-background border shadow-lg z-50">
                {/* Marquer traité/non traité */}
                <DropdownMenuItem onSelect={handleToggleProcessed}>
                  {isProcessed ? (
                    <>
                      <Circle className="h-4 w-4 mr-2" />
                      Marquer non traité
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                      Marquer traité
                    </>
                  )}
                </DropdownMenuItem>
                
                {/* Marquer lu/non lu */}
                <DropdownMenuItem onSelect={handleToggleRead}>
                  {isUnread ? <MailOpen className="h-4 w-4 mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  {isUnread ? "Marquer lu" : "Marquer non lu"}
                </DropdownMenuItem>
                
                {/* Favoris */}
                <DropdownMenuItem onSelect={handleToggleStar}>
                  {isStarred ? (
                    <>
                      <StarOff className="h-4 w-4 mr-2" />
                      Retirer des favoris
                    </>
                  ) : (
                    <>
                      <Star className="h-4 w-4 mr-2 text-amber-500" />
                      Ajouter aux favoris
                    </>
                  )}
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                {/* Archiver */}
                <DropdownMenuItem onSelect={handleArchive}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archiver
                </DropdownMenuItem>
                
                {/* Attribuer */}
                <DropdownMenuItem onSelect={() => setAssignDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Attribuer
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                {/* Supprimer */}
                <DropdownMenuItem onSelect={handleDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
                
                {/* Spam */}
                <DropdownMenuItem onSelect={handleMarkAsSpam} className="text-destructive">
                  <Ban className="h-4 w-4 mr-2" />
                  Signaler spam
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SwipeableListItem>

      {/* Assign Interlocutor Dialog - EN DEHORS du conteneur cliquable */}
      <AssignInterlocutorDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        threadId={thread.id}
        senderEmail={mainSender?.email || ""}
        senderName={mainSender?.name || null}
        onAssigned={() => {
          // Ne pas archiver - le refresh est géré via invalidateQueries dans useAssignInterlocutor
        }}
      />
    </>
  );
});
