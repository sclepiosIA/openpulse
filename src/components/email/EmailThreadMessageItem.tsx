import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Reply,
  ReplyAll,
  Forward,
  Paperclip,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { EmailAvatar } from "./EmailAvatar";
import { MobileMessageItem } from "./MobileMessageItem";
import { CollapsibleCCBanner } from "./CollapsibleCCBanner";
import { EmailContentWithImages } from "./EmailContentWithImages";
import { EmailInlineImageGallery } from "./EmailInlineImageGallery";
import { EmailAttachmentViewer } from "./EmailAttachmentViewer";
import { EmailVisioInvitationCard } from "./EmailVisioInvitationCard";
import { EmailCalendarInvitationCard } from "./EmailCalendarInvitationCard";
import { formatEmailAddress } from "@/lib/emailUtils";

interface EmailThreadMessageItemProps {
  message: any;
  index: number;
  isExpanded: boolean;
  isMobile: boolean;
  threadId: string;
  threadSubject: string;
  onExpand: (id: string) => void;
  onCollapse: (id: string) => void;
  onReplySingle: (messageId: string) => void;
  onReplyAll: (messageId: string) => void;
  onForward: (messageId: string) => void;
}

export function EmailThreadMessageItem({
  message,
  index,
  isExpanded,
  isMobile,
  threadId,
  threadSubject,
  onExpand,
  onCollapse,
  onReplySingle,
  onReplyAll,
  onForward,
}: EmailThreadMessageItemProps) {
  const isInternal = message.from_address?.toLowerCase().includes("@marque");

  const getTextPreview = () => {
    const text = message.body_text || "";
    const strippedHtml = message.body_html
      ? message.body_html
          .replace(/<img[^>]*>/gi, "[Image] ")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "";
    const content = text || strippedHtml;
    return content.length > 150 ? content.substring(0, 150) + "..." : content;
  };

  if (isMobile && !isExpanded) {
    return (
      <MobileMessageItem
        message={message}
        isExpanded={isExpanded}
        isExternal={!isInternal}
        onClick={() => onExpand(message.id)}
      />
    );
  }

  return (
    <div id={`message-${message.id}`} className="scroll-mt-20">
      {!isExpanded ? (
        <div
          className="group flex items-center gap-3 py-2 px-3 hover:bg-accent/50 rounded-md transition-all cursor-pointer border-b border-border/30 last:border-b-0"
          onClick={() => onExpand(message.id)}
        >
          <EmailAvatar
            name={message.from_name}
            email={message.from_address}
            size="sm"
            className="flex-shrink-0 h-7 w-7"
          />
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="font-medium text-sm truncate min-w-[80px]">
              {message.from_name || message.from_address.split("@")[0]}
            </span>
            <span className="text-xs text-muted-foreground truncate flex-1 hidden sm:block">
              {getTextPreview()?.slice(0, 100)}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {message.has_attachments && (
                <Paperclip className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(message.sent_date), {
                  addSuffix: true,
                  locale: fr,
                })}
              </span>
            </div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
      ) : (
        <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="p-6 space-y-4">
            {index > 0 && (
              <>
                <div className="flex items-start gap-4">
                  <EmailAvatar
                    name={message.from_name}
                    email={message.from_address}
                    size="lg"
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-base leading-tight">
                          {formatEmailAddress(message.from_name, message.from_address)}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">
                          À: {(() => {
                            const addrs = message.to_addresses || [];
                            if (addrs.length === 0) return "";
                            const first = addrs[0].name || addrs[0].email?.split("@")[0] || "Inconnu";
                            if (addrs.length === 1) return first;
                            return `${first} +${addrs.length - 1} autres`;
                          })()}
                        </p>
                      </div>
                      <time className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(message.sent_date).toLocaleString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    {message.cc_addresses && message.cc_addresses.length > 0 && (
                      <CollapsibleCCBanner
                        ccAddresses={message.cc_addresses}
                        bccAddresses={message.bcc_addresses}
                        className="mt-2"
                      />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => onCollapse(message.id)}
                    aria-label="Précédent"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                </div>
                <Separator />
              </>
            )}

            {message.has_attachments && (
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs gap-1">
                  <Paperclip className="h-3 w-3" />
                  {message.attachments_count || 1} pièce{(message.attachments_count || 1) > 1 ? "s" : ""} jointe{(message.attachments_count || 1) > 1 ? "s" : ""}
                </Badge>
              </div>
            )}

            {index > 0 && (
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onReplySingle(message.id); }} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Répondre" aria-label="Répondre">
                  <Reply className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onReplyAll(message.id); }} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Répondre à tous" aria-label="Répondre à tous">
                  <ReplyAll className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onForward(message.id); }} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Transférer" aria-label="Transférer">
                  <Forward className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <EmailVisioInvitationCard
              messageId={message.id}
              threadId={threadId}
              bodyHtml={message.body_html}
              bodyText={message.body_text}
              subject={threadSubject}
              fromAddress={message.from_address}
              fromName={message.from_name}
            />

            <EmailCalendarInvitationCard
              messageId={message.id}
              threadId={threadId}
              bodyHtml={message.body_html}
              bodyText={message.body_text}
              subject={message.subject ?? threadSubject}
              fromAddress={message.from_address}
              fromName={message.from_name}
            />

            <div className="prose prose-sm max-w-none dark:prose-invert">
              <EmailContentWithImages
                htmlContent={message.body_html}
                textContent={message.body_text}
                messageId={message.id}
              />
            </div>

            {message.has_attachments && (
              <EmailInlineImageGallery messageId={message.id} />
            )}

            {message.has_attachments && (
              <>
                <Separator />
                <EmailAttachmentViewer messageId={message.id} />
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
