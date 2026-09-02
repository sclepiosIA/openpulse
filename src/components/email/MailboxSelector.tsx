import { cn } from "@/lib/utils";
import { Inbox, Send, Mail } from "lucide-react";
import { EmailMailbox } from "@/hooks/email/useEmailFilters";

interface MailboxSelectorProps {
  value: EmailMailbox;
  onChange: (value: EmailMailbox) => void;
  inboxCount?: number;
  sentCount?: number;
  className?: string;
}

export function MailboxSelector({
  value,
  onChange,
  inboxCount = 0,
  sentCount = 0,
  className,
}: MailboxSelectorProps) {
  const chipBase = "h-7 px-3 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 border";
  const chipInactive = "bg-background border-border hover:bg-accent text-muted-foreground";
  const chipActive = "bg-primary text-primary-foreground border-primary";

  return (
    <div className={cn("flex items-center gap-1 p-0.5 rounded-lg bg-muted/30", className)}>
      {/* Inbox */}
      <button
        className={cn(chipBase, value === 'inbox' ? chipActive : chipInactive)}
        onClick={() => onChange('inbox')}
        title="Boîte de réception"
      >
        <Inbox className="h-3.5 w-3.5" />
        <span>Réception</span>
        {inboxCount > 0 && value !== 'inbox' && (
          <span className="ml-1 text-[10px] opacity-70">({inboxCount})</span>
        )}
      </button>

      {/* Sent */}
      <button
        className={cn(chipBase, value === 'sent' ? chipActive : chipInactive)}
        onClick={() => onChange('sent')}
        title="Messages envoyés"
      >
        <Send className="h-3.5 w-3.5" />
        <span>Envoyés</span>
        {sentCount > 0 && value !== 'sent' && (
          <span className="ml-1 text-[10px] opacity-70">({sentCount})</span>
        )}
      </button>

      {/* All */}
      <button
        className={cn(chipBase, value === 'all' ? chipActive : chipInactive)}
        onClick={() => onChange('all')}
        title="Tous les emails"
      >
        <Mail className="h-3.5 w-3.5" />
        <span>Tous</span>
      </button>
    </div>
  );
}
