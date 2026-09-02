import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X } from "lucide-react";
import { invokeEdge } from "@/services/edgeFunctions";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { RichTextEditor } from "./RichTextEditor";
import { EmailAIAssistant } from "./EmailAIAssistant";
import { TemplateSelector } from "./TemplateSelector";
import { useEmailSignature } from "@/hooks/email/useEmailSignature";
import { EmailRecipientInput } from "./EmailRecipientInput";
import { EmailSendProgress } from "./EmailSendProgress";
import { debug } from "@/lib/debug";
import { useQueryClient } from "@tanstack/react-query";
import { buildQuotedBody } from "@/lib/emailQuotedBody";

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

interface EmailReplyAllProps {
  threadId: string;
  accountId: string;
  toAddresses: string[];
  ccAddresses?: string[];
  subject: string;
  onCancel: () => void;
  onSent: () => void;
  threadParticipants?: ThreadParticipant[];
  threadMessages?: ThreadMessage[];
  lastMessageId?: string;
  allMessageIds?: string[];
}

export function EmailReplyAll({
  threadId,
  accountId,
  toAddresses,
  ccAddresses = [],
  subject,
  onCancel,
  onSent,
  threadParticipants = [],
  threadMessages = [],
  lastMessageId,
  allMessageIds = [],
}: EmailReplyAllProps) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(true);
  const [isAIAnimating, setIsAIAnimating] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [toList, setToList] = useState<string[]>(toAddresses);
  const [ccList, setCcList] = useState<string[]>(ccAddresses);
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
      toast.error("Le message ne peut pas être vide");
      return;
    }

    if (toList.length === 0) {
      toast.error("Vous devez avoir au moins un destinataire");
      return;
    }

    // Validation du compte email
    if (!accountId || accountId === 'all') {
      toast.error("Impossible de déterminer le compte email à utiliser");
      return;
    }

    setSending(true);
    try {
      const finalBody = signature 
        ? (isHtmlMode ? `${body}<br><br>${signature}` : `${body}\n\n${signature}`)
        : body;

      const icsToSend = icsAttachmentRef.current || icsAttachment;
      debug.log('[EmailReplyAll] Sending with ICS:', icsToSend ? 'YES' : 'NO');

      // Build quoted body from thread messages
      const quotedBody = buildQuotedBody(threadMessages);
      const fullBody = quotedBody 
        ? (isHtmlMode 
            ? `${finalBody}<br><br><div style="border-left:2px solid #ccc;padding-left:8px;color:#555;">${quotedBody.replace(/\n/g, '<br>')}</div>`
            : `${finalBody}\n\n${quotedBody}`)
        : finalBody;

      const data = await invokeEdge<any>('send-email-reply', {
          thread_id: threadId,
          account_id: accountId,
          to: toList,
          cc: ccList.length > 0 ? ccList : undefined,
          subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
          body: fullBody,
          ics_content: icsToSend,
          in_reply_to: lastMessageId || undefined,
          references: allMessageIds.length > 0 ? allMessageIds : undefined,
        });
      // Check for warning in response (email sent but not stored)
      if (data?.warning) {
        toast.warning(`Email envoyé avec avertissement: ${data.warning}`);
      } else {
        toast.success("Email envoyé avec succès");
      }
      
      // Invalidate enriched data cache to show "Replied" indicator immediately
      queryClient.invalidateQueries({ queryKey: ['threads-enriched-data'] });
      // Also dispatch event for other components
      window.dispatchEvent(new CustomEvent('email-thread-updated', { detail: { threadId } }));
      
      onSent();
    } catch (error: unknown) {
      debug.error('Error sending reply:', error);
      toast.error("Erreur lors de l'envoi de l'email: " + sanitizeSupabaseError(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="p-4 space-y-4 animate-in slide-in-from-bottom bg-gradient-to-br from-white to-slate-50/50 border-slate-200/50 shadow-lg rounded-xl">
      {sending && <EmailSendProgress isSending={sending} />}
      
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <EmailRecipientInput
            label="À:"
            value={toList}
            onChange={setToList}
            placeholder="Ajouter un destinataire..."
            disabled={sending}
          />
          <EmailRecipientInput
            label="CC:"
            value={ccList}
            onChange={setCcList}
            placeholder="Ajouter en copie..."
            disabled={sending}
          />
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onCancel}
          className="h-8 w-8 rounded-lg bg-slate-100/80 hover:bg-slate-200/80 text-muted-foreground" aria-label="Fermer">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsHtmlMode(!isHtmlMode)}
          className="h-8 px-3 bg-slate-100/80 hover:bg-slate-200/80 text-foreground border border-slate-200/50 rounded-lg text-xs font-medium"
        >
          {isHtmlMode ? "Mode Texte" : "Mode HTML"}
        </Button>
        <EmailAIAssistant
          text={body}
          onTextUpdate={setBody}
          threadParticipants={threadParticipants}
          threadSubject={subject}
          threadMessages={threadMessages}
          onAnimationStateChange={(animating, processing) => {
            setIsAIAnimating(animating);
            setIsAIProcessing(processing);
          }}
          onIcsGenerated={handleIcsGenerated}
        />
      </div>

      <TemplateSelector onInsert={(content) => setBody(content)} currentSubject={subject} currentBody={body} />

      {isHtmlMode ? (
        <RichTextEditor
          content={body}
          onChange={setBody}
          placeholder="Composez votre réponse ici..."
          disabled={isAIAnimating || isAIProcessing}
        />
      ) : (
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Composez votre réponse ici..."
          className="min-h-[200px] resize-none"
          disabled={isAIAnimating || isAIProcessing}
        />
      )}

      <div className="flex gap-2 justify-end pt-2">
        <Button 
          variant="ghost" 
          onClick={onCancel}
          className="h-9 px-4 bg-slate-100/80 hover:bg-slate-200/80 text-foreground border border-slate-200/50 rounded-xl"
        >
          Annuler
        </Button>
        <Button 
          onClick={handleSend} 
          disabled={sending}
          className="h-9 px-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md rounded-xl font-medium"
        >
          {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Envoyer à tous
        </Button>
      </div>
    </Card>
  );
}
