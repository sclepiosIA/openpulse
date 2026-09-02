import { Mail, MailOpen, Paperclip, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { sanitizeEmailSubject, sanitizeDisplayName, getThreadMainSender } from "@/lib/emailUtils";
import { cn } from "@/lib/utils";
import type { ThreadEnrichedData } from "@/hooks/email/useThreadsEnrichedData";
import type { EmailThread } from "@/types/email";

interface EmailListItemMobileProps {
  thread: EmailThread;
  selected?: boolean;
  isNew?: boolean;
  enrichedData?: ThreadEnrichedData;
  onSelect?: (selected: boolean) => void;
  onClick?: () => void;
}

export function EmailListItemMobile({ 
  thread, 
  selected = false, 
  isNew = false, 
  enrichedData,
  onSelect, 
  onClick 
}: EmailListItemMobileProps) {
  const isUnread = thread.unread_count > 0;
  const mainSender = getThreadMainSender(thread, thread.account?.email_address || '');
  const isLastMessageFromUser = mainSender?.isCurrentUser || false;
  const contact = enrichedData?.contact || null;
  
  // Compter les pièces jointes
  const hasAttachments = thread.messages?.some(m => m.has_attachments) || false;
  const hasCc = thread.messages?.[0]?.cc_addresses && thread.messages[0].cc_addresses.length > 0;
  
  return (
    <div
      role="article"
      aria-label={`Email de ${mainSender?.name || mainSender?.email}, ${isUnread ? 'non lu' : 'lu'}`}
      
      data-selected={selected || undefined}
      tabIndex={0}
      className={cn(
        "flex flex-col gap-2 px-4 py-4 border-b transition-colors cursor-pointer",
        "min-h-[72px]", // Touch target minimum
        "active:bg-accent/70 active:scale-[0.99]",
        "hover:bg-accent/50",
        selected && "bg-accent",
        // Fond bleu bien visible pour les non lus
        isUnread && "bg-blue-50 dark:bg-blue-950/40 border-l-4 border-l-primary",
        !isUnread && "border-l-4 border-l-transparent",
        isNew && "animate-in fade-in"
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Ligne 1: Checkbox, Expéditeur, Date */}
      <div className="flex items-center gap-2">
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={onSelect}
            className="data-[state=checked]:bg-primary"
          />
        </div>
        
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {isUnread ? (
            <Mail className="h-4 w-4 text-primary shrink-0" />
          ) : (
            <MailOpen className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className={cn(
            "truncate text-sm flex-1",
            isUnread ? "font-bold text-foreground" : "text-foreground/70"
          )}>
            {isLastMessageFromUser ? (
              <span className="text-muted-foreground">
                Vous → {sanitizeDisplayName(mainSender?.name) || mainSender?.email?.split('@')[0]}
              </span>
            ) : (
              sanitizeDisplayName(mainSender?.name) || mainSender?.email?.split('@')[0] || "Inconnu"
            )}
          </span>
        </div>
        
        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {formatDistanceToNow(new Date(thread.last_message_date), {
            addSuffix: false,
            locale: fr,
          })}
        </span>
      </div>
      
      {/* Ligne 2: Sujet */}
      <div className="flex items-start gap-2">
        <span className={cn(
          "text-sm line-clamp-2 flex-1",
          isUnread ? "font-semibold text-foreground" : "text-muted-foreground"
        )}>
          {sanitizeEmailSubject(thread.ai_generated_title || thread.subject)}
        </span>
        
        {/* Badges inline */}
        <div className="flex items-center gap-1 shrink-0">
          {thread.priority === "high" && (
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          )}
          {hasAttachments && (
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {hasCc && (
            <Users className="h-3.5 w-3.5 text-blue-500" />
          )}
          {thread.message_count > 1 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
              {thread.message_count}
            </Badge>
          )}
        </div>
      </div>
      
      {/* Ligne 3: Badges (catégorie, établissement, résumé) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {thread.category && (
          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
            {thread.category}
          </Badge>
        )}
        {thread.etablissement?.nom && (
          <Badge variant="outline" className="text-xs max-w-[140px] truncate">
            {thread.etablissement.nom}
          </Badge>
        )}
        {thread.groupe?.nom && !thread.etablissement?.nom && (
          <Badge variant="outline" className="text-xs max-w-[140px] truncate border-orange-500/50 text-orange-700 dark:text-orange-400">
            {thread.groupe.nom}
          </Badge>
        )}
        {contact?.type_contact && (
          <Badge variant="outline" className="text-xs border-green-500/50 text-green-700 dark:text-green-400">
            {contact.type_contact}
          </Badge>
        )}
      </div>
      
      {/* Ligne 4: Résumé AI (optionnel, tronqué) */}
      {thread.ai_summary && (
        <p className="text-xs text-muted-foreground line-clamp-1">
          {thread.ai_summary}
        </p>
      )}
    </div>
  );
}
