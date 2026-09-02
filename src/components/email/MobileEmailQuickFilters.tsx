import { cn } from "@/lib/utils";
import { MailOpen, AlertTriangle, SlidersHorizontal, CircleDashed, Inbox, Send, Trash2 } from "lucide-react";
import { EmailMailbox } from "@/hooks/email/useEmailFilters";

interface MobileEmailQuickFiltersProps {
  unreadOnly: boolean;
  onUnreadOnlyChange: (value: boolean) => void;
  unprocessedOnly: boolean;
  onUnprocessedOnlyChange: (value: boolean) => void;
  category: string | null;
  onCategoryChange: (value: string | null) => void;
  mailbox: EmailMailbox;
  onMailboxChange: (value: EmailMailbox) => void;
  unreadCount: number;
  unprocessedCount: number;
  totalCount: number;
  onOpenFilters: () => void;
  hasActiveFilters: boolean;
}

export function MobileEmailQuickFilters({
  unreadOnly,
  onUnreadOnlyChange,
  unprocessedOnly,
  onUnprocessedOnlyChange,
  category,
  onCategoryChange,
  mailbox,
  onMailboxChange,
  unreadCount,
  unprocessedCount,
  totalCount,
  onOpenFilters,
  hasActiveFilters,
}: MobileEmailQuickFiltersProps) {
  // Common chip style
  const chipBase = "shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5";
  const chipInactive = "bg-background border-border hover:bg-accent";
  const chipActive = "bg-primary text-primary-foreground border-primary";

  return (
    <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto no-scrollbar bg-background sticky top-0 z-30 border-b">
      {/* Inbox/Sent Toggle */}
      <button
        className={cn(chipBase, mailbox === 'inbox' ? chipActive : chipInactive)}
        onClick={() => onMailboxChange('inbox')}
      >
        <Inbox className="h-3.5 w-3.5" />
        Réception
      </button>

      <button
        className={cn(chipBase, mailbox === 'sent' ? chipActive : chipInactive)}
        onClick={() => onMailboxChange('sent')}
      >
        <Send className="h-3.5 w-3.5" />
        Envoyés
      </button>

      <button
        className={cn(chipBase, mailbox === 'trash' ? chipActive : chipInactive)}
        onClick={() => onMailboxChange('trash')}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Corbeille
      </button>

      {/* Separator */}
      <div className="h-4 w-px bg-border shrink-0" />

      {/* All Button */}
      <button
        className={cn(chipBase, !unreadOnly && !unprocessedOnly && !category ? chipActive : chipInactive)}
        onClick={() => {
          onUnreadOnlyChange(false);
          onUnprocessedOnlyChange(false);
          onCategoryChange(null);
        }}
      >
        Tous
        <span className={cn("text-[10px]", !unreadOnly && !unprocessedOnly && !category ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {totalCount}
        </span>
      </button>

      {/* Unread Chip */}
      <button
        className={cn(chipBase, unreadOnly ? chipActive : chipInactive)}
        onClick={() => {
          onUnreadOnlyChange(!unreadOnly);
          if (!unreadOnly) onUnprocessedOnlyChange(false);
        }}
      >
        <MailOpen className="h-3.5 w-3.5" />
        Non lus
        {unreadCount > 0 && (
          <span className={cn(
            "h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center",
            unreadOnly ? "bg-primary-foreground/20" : "bg-primary text-primary-foreground"
          )}>
            {unreadCount}
          </span>
        )}
      </button>

      {/* Unprocessed Chip */}
      <button
        className={cn(chipBase, unprocessedOnly ? chipActive : chipInactive)}
        onClick={() => {
          onUnprocessedOnlyChange(!unprocessedOnly);
          if (!unprocessedOnly) onUnreadOnlyChange(false);
        }}
      >
        <CircleDashed className="h-3.5 w-3.5" />
        Non traités
        {unprocessedCount > 0 && (
          <span className={cn(
            "h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center",
            unprocessedOnly ? "bg-primary-foreground/20" : "bg-primary text-primary-foreground"
          )}>
            {unprocessedCount}
          </span>
        )}
      </button>

      {/* Important Chip */}
      <button
        className={cn(
          chipBase,
          category === "high" 
            ? "bg-destructive text-destructive-foreground border-destructive" 
            : chipInactive
        )}
        onClick={() => onCategoryChange(category === "high" ? null : "high")}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Urgents
      </button>

      {/* Commercial Chip */}
      <button
        className={cn(
          chipBase,
          category === "Commercial" 
            ? "bg-blue-600 text-white border-blue-600" 
            : chipInactive
        )}
        onClick={() => onCategoryChange(category === "Commercial" ? null : "Commercial")}
      >
        Commercial
      </button>

      {/* Support Chip */}
      <button
        className={cn(
          chipBase,
          category === "Support" 
            ? "bg-emerald-600 text-white border-emerald-600" 
            : chipInactive
        )}
        onClick={() => onCategoryChange(category === "Support" ? null : "Support")}
      >
        Support
      </button>

      {/* More Filters Button */}
      <button
        className={cn(chipBase, hasActiveFilters ? chipActive : chipInactive, "relative")}
        onClick={onOpenFilters}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Plus
        {hasActiveFilters && !unreadOnly && !category && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
        )}
      </button>
    </div>
  );
}
