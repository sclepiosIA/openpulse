import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { invokeEdge } from "@/services/edgeFunctions";
import { Send, Loader2, X, Type, Code } from "lucide-react";
import { EmailAIAssistant } from "./EmailAIAssistant";
import { TemplateSelector } from "./TemplateSelector";
import { RichTextEditor } from "./RichTextEditor";
import { Textarea } from "@/components/ui/textarea";
import { useEmailSignature } from "@/hooks/email/useEmailSignature";
import { EmailSendProgress } from "./EmailSendProgress";
import { debug } from "@/lib/debug";
import { useQueryClient } from "@tanstack/react-query";
import { buildQuotedBody } from "@/lib/emailQuotedBody";
import { sanitizeEmailHtml } from "@/lib/emailUtils";

interface ThreadParticipant {
  email: string;
  name?: string;
}

interface ThreadMessage {
  from_name?: string;
  from_address: string;
  body_text?: string;
  sent_date: string;
}

interface EmailReplyProps {
  threadId: string;
  accountId: string;
  toAddress: string;
  subject: string;
  onCancel: () => void;
  onSent: () => void;
  threadParticipants?: ThreadParticipant[];
  threadMessages?: ThreadMessage[];
  lastMessageId?: string;
  allMessageIds?: string[];
}

export function EmailReply({ 
  threadId, 
  accountId, 
  toAddress, 
  subject, 
  onCancel, 
  onSent,
  threadParticipants = [],
  threadMessages = [],
  lastMessageId,
  allMessageIds = [],
}: EmailReplyProps) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(true);
  const { toast } = useToast();
  const [isAIAnimating, setIsAIAnimating] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [icsAttachment, setIcsAttachment] = useState<string | undefined>();
  const icsAttachmentRef = useRef<string | undefined>();
  const { signature } = useEmailSignature();
  const queryClient = useQueryClient();

  const handleIcsGenerated = (ics: string) => {
    icsAttachmentRef.current = ics;
    setIcsAttachment(ics);
  };

  const handleSend = async () => {
    if (!body.trim()) {
      toast({
        title: "Erreur",
        description: "Le message ne peut pas être vide",
        variant: "destructive",
      });
      return;
    }

    // Validation du compte email
    if (!accountId || accountId === 'all') {
      toast({
        title: "Erreur",
        description: "Impossible de déterminer le compte email à utiliser",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      // Add signature to body if it exists (signature is already decoded HTML)
      const bodyWithSignature = signature 
        ? isHtmlMode 
          ? `${body}<br><br>--<br>${signature}`
          : `${body}\n\n--\n${signature.replace(/<[^>]*>/g, '')}` // Strip HTML for plain text
        : body;

      const icsToSend = icsAttachmentRef.current || icsAttachment;
      debug.log('[EmailReply] Sending with ICS:', icsToSend ? 'YES' : 'NO');

      // Build quoted body from thread messages
      const quotedBody = buildQuotedBody(threadMessages);
      const fullBody = quotedBody 
        ? (isHtmlMode 
            ? `${bodyWithSignature}<br><br><div style="border-left:2px solid #ccc;padding-left:8px;color:#555;">${quotedBody.replace(/\n/g, '<br>')}</div>`
            : `${bodyWithSignature}\n\n${quotedBody}`)
        : bodyWithSignature;

      const data = await invokeEdge<any>("send-email-reply", {
          thread_id: threadId,
          account_id: accountId,
          to: toAddress,
          subject: `Re: ${subject}`,
          body: fullBody,
          ics_content: icsToSend,
          in_reply_to: lastMessageId || undefined,
          references: allMessageIds.length > 0 ? allMessageIds : undefined,
        });

      // Handle partial success: SMTP sent but DB storage failed (edge function returns 500)
      if (data?.smtp_sent && data?.db_stored === false) {
        toast({
          title: "Email envoyé partiellement",
          description: "L'email a été envoyé mais n'apparaîtra pas dans vos envoyés.",
          variant: "destructive",
        });
        // Still invalidate caches and close - email was actually sent
        queryClient.invalidateQueries({ queryKey: ['threads-enriched-data'] });
        window.dispatchEvent(new CustomEvent('email-thread-updated', { detail: { threadId } }));
        setBody("");
        onSent();
        return;
      }
      // Check for warning in response (email sent but not stored)
      if (data?.warning) {
        toast({
          title: "Email envoyé avec avertissement",
          description: data.warning,
          variant: "default",
        });
      } else {
        toast({
          title: "Email envoyé",
          description: "Votre réponse a été envoyée avec succès",
        });
      }

      // Invalidate enriched data cache to show "Replied" indicator immediately
      queryClient.invalidateQueries({ queryKey: ['threads-enriched-data'] });
      // Also dispatch event for other components
      window.dispatchEvent(new CustomEvent('email-thread-updated', { detail: { threadId } }));

      setBody("");
      onSent();
    } catch (error: unknown) {
      debug.error("Send error:", error);
      toast({
        title: "Erreur d'envoi",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Répondre à {toAddress}</h3>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={sending} aria-label="Annuler la réponse" title="Annuler">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {sending && <EmailSendProgress isSending={sending} />}
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Sujet: Re: {subject}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsHtmlMode(!isHtmlMode)}
            title={isHtmlMode ? "Mode texte" : "Mode HTML"}
          >
            {isHtmlMode ? (
              <><Code className="h-4 w-4 mr-2" /> Texte</>
            ) : (
              <><Type className="h-4 w-4 mr-2" /> HTML</>
            )}
          </Button>
        </div>

        <EmailAIAssistant 
          text={body} 
          onTextUpdate={setBody}
          threadParticipants={threadParticipants}
          threadSubject={subject}
          threadMessages={threadMessages}
          onAnimationStateChange={(isAnimating, isProcessing) => {
            setIsAIAnimating(isAnimating);
            setIsAIProcessing(isProcessing);
          }}
          onIcsGenerated={handleIcsGenerated}
        />

        <TemplateSelector onInsert={(content) => setBody(content)} currentSubject={subject} currentBody={body} />
        
        <div>
          {isHtmlMode ? (
            <RichTextEditor
              content={body}
              onChange={setBody}
              placeholder="Écrivez votre réponse..."
              disabled={sending}
              isAnimating={isAIAnimating}
              isProcessing={isAIProcessing}
            />
          ) : (
            <Textarea
              placeholder="Écrivez votre réponse..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="resize-none font-mono text-sm"
              disabled={sending}
            />
          )}
        </div>

        {/* Signature preview */}
        {signature && (
          <div className="border-t pt-2 space-y-1">
            <p className="text-xs text-muted-foreground">✉️ Signature :</p>
            <div className="email-signature-wrapper rounded border p-2 bg-muted/30 overflow-auto max-h-[150px]">
              {/* safe: sanitizeEmailHtml strips dangerous tags/attrs via DOMPurify */}
              <div dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(signature) }} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={sending}>
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Envoyer
          </Button>
        </div>
      </div>
    </Card>
  );
}
