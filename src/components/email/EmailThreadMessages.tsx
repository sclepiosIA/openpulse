import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RefreshCw, Paperclip, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { EmailContentWithImages } from "./EmailContentWithImages";
import { BilingualEmailContent } from "./BilingualEmailContent";
import { EmailAttachmentViewer } from "./EmailAttachmentViewer";
import { EmailInlineImageGallery } from "./EmailInlineImageGallery";
import { EmailVisioInvitationCard } from "./EmailVisioInvitationCard";
import { EmailCalendarInvitationCard } from "./EmailCalendarInvitationCard";
import { EntityAvatar } from "@/components/ui/EntityAvatar";
import { sanitizeDisplayName } from "@/lib/emailUtils";

interface EmailThreadMessagesProps {
  messages: any[];
  currentMessageIndex: number;
  expandedMessages: Set<string>;
  refetchingContent: string | null;
  onToggleMessage: (messageId: string) => void;
  onRefetchContent: (messageId: string) => void;
  onNavigateNext: () => void;
  onNavigatePrevious: () => void;
}

export function EmailThreadMessages({
  messages,
  currentMessageIndex,
  expandedMessages,
  refetchingContent,
  onToggleMessage,
  onRefetchContent,
  onNavigateNext,
  onNavigatePrevious
}: EmailThreadMessagesProps) {

  return (
    <div className="space-y-4">
      {/* Message Navigation */}
      {messages.length > 1 && (
        <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">
            Message {currentMessageIndex + 1} sur {messages.length}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigatePrevious}
              disabled={currentMessageIndex === 0}
              title="Message précédent (p)"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateNext}
              disabled={currentMessageIndex >= messages.length - 1}
              title="Message suivant (n)"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Messages List */}
      <Accordion type="multiple" value={Array.from(expandedMessages)} className="space-y-3">
        {messages.map((message: any) => {
          const isEmpty = !message.body_html && !message.body_text;

          return (
            <AccordionItem
              key={message.id}
              value={message.id}
              id={`message-${message.id}`}
              className="border rounded-lg"
            >
              <AccordionTrigger
                onClick={() => onToggleMessage(message.id)}
                className="px-4 hover:no-underline group"
              >
                <div className="flex items-start gap-3 w-full pr-4">
                  <EntityAvatar
                    name={sanitizeDisplayName(message.from_name) || message.from_address}
                    email={message.from_address}
                    size="sm"
                  />
                  
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {sanitizeDisplayName(message.from_name) || message.from_address}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(message.sent_date), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      À: {Array.isArray(message.to_addresses) 
                        ? message.to_addresses.map((addr: any) => 
                            typeof addr === 'string' ? addr : addr.address
                          ).join(", ")
                        : "Non spécifié"}
                    </div>
                    {message.has_attachments && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        <Paperclip className="h-3 w-3 mr-1" />
                        Pièces jointes
                      </Badge>
                    )}
                    {message._wasEncoded && (
                      <Badge variant="secondary" className="mt-1 text-xs ml-2">
                        Encodage corrigé
                      </Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-4 pb-4">
                {isEmpty ? (
                  <div className="bg-muted/30 rounded-lg p-4 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Le contenu de ce message n'a pas pu être récupéré lors de la synchronisation initiale.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRefetchContent(message.id)}
                      disabled={refetchingContent === message.id}
                    >
                      {refetchingContent === message.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Récupération...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Récupérer le contenu
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Carte visio si lien détecté */}
                    <EmailVisioInvitationCard
                      messageId={message.id}
                      threadId={message.thread_id}
                      bodyHtml={message.body_html}
                      bodyText={message.body_text}
                      subject={message.subject}
                      fromAddress={message.from_address}
                    />
                    
                    {/* Carte calendrier si invitation détectée (sans visio) */}
                    <EmailCalendarInvitationCard
                      messageId={message.id}
                      threadId={message.thread_id}
                      bodyHtml={message.body_html}
                      bodyText={message.body_text}
                      subject={message.subject}
                      fromAddress={message.from_address}
                    />
                    
                    {message.has_attachments && (
                      <EmailInlineImageGallery messageId={message.id} className="mb-4" />
                    )}
                    
                    {/* Bilingual display for non-French emails */}
                    {message.detected_language && message.detected_language !== 'fr' ? (
                      <BilingualEmailContent
                        originalHtml={message.body_html}
                        originalText={message.body_text}
                        translationText={message.french_translation}
                        detectedLanguage={message.detected_language}
                        messageId={message.id}
                      />
                    ) : (
                      <EmailContentWithImages
                        htmlContent={message.body_html}
                        textContent={message.body_text}
                        messageId={message.id}
                      />
                    )}
                    
                    {message.has_attachments && (
                      <div className="mt-4">
                        <EmailAttachmentViewer messageId={message.id} />
                      </div>
                    )}
                  </>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
