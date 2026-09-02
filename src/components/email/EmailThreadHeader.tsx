import { Badge } from "@/components/ui/badge";
import { sanitizeEmailSubject } from "@/lib/emailUtils";
import { EmailThreadTags } from "./EmailThreadTags";
import { EmailAvatar } from "./EmailAvatar";
import type { EmailThread } from "@/types/email";
import { useMemo } from "react";

export interface SenderInfo {
  from_name: string | null;
  from_address: string;
  to_addresses: Array<{ name?: string; email?: string }>;
  cc_addresses?: Array<{ name?: string; email?: string }> | null;
  bcc_addresses?: Array<{ name?: string; email?: string }> | null;
  sent_date: string;
}

interface EmailThreadHeaderProps {
  thread: EmailThread;
  isUpdatingTags: boolean;
  onUpdateTags: (tags: string[]) => void;
  messages?: Array<{
    from_name?: string | null;
    from_address: string;
  }>;
}

export function EmailThreadHeader({ thread, isUpdatingTags, onUpdateTags, messages }: EmailThreadHeaderProps) {
  // Extract unique participants for stacked avatars
  const participants = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    const seen = new Set<string>();
    const result: { name: string; email: string }[] = [];
    for (const m of messages) {
      const email = m.from_address?.toLowerCase();
      if (email && !seen.has(email)) {
        seen.add(email);
        result.push({ name: m.from_name || email.split('@')[0], email });
      }
    }
    return result;
  }, [messages]);

  return (
    <div className="mt-2 pt-2 border-t border-border/40">
      <h1 className="text-base lg:text-xl font-bold mb-1.5 break-words hyphens-auto leading-tight">
        {sanitizeEmailSubject(thread.ai_generated_title || thread.subject)}
      </h1>
      
      {/* Badges et Tags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {thread.category && <Badge className="text-xs">{thread.category}</Badge>}
        {thread.priority === "high" && <Badge variant="destructive" className="text-xs">Priorité haute</Badge>}
        {thread.is_archived && <Badge variant="secondary" className="text-xs">Archivé</Badge>}
        {thread.is_spam && <Badge variant="destructive" className="text-xs">Spam</Badge>}
        {thread.account?.email_address && (
          <Badge variant="outline" className="hidden sm:inline-flex text-xs">{thread.account.email_address}</Badge>
        )}
        
        {/* Tags intégrés aux badges - single line */}
        <EmailThreadTags 
          tags={thread.tags || []} 
          onUpdateTags={onUpdateTags}
          disabled={isUpdatingTags}
          maxVisible={3}
        />
      </div>

      {/* Participants stacked avatars fallback - only when no etablissement/partenaire */}
      {!thread.etablissement && !thread.partenaire && participants.length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <div className="flex -space-x-2">
            {participants.slice(0, 4).map((p) => (
              <EmailAvatar
                key={p.email}
                name={p.name}
                email={p.email}
                size="sm"
                className="ring-2 ring-background"
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground truncate">
            {participants.slice(0, 2).map(p => p.name).join(', ')}
            {participants.length > 2 && ` +${participants.length - 2} autre${participants.length > 3 ? 's' : ''}`}
          </span>
        </div>
      )}
    </div>
  );
}
