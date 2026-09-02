import { useState } from "react";
import { debug } from "@/lib/debug";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { invokeEdge } from "@/services/edgeFunctions";
import { buildQuotedBody } from "@/lib/emailQuotedBody";

interface ThreadMessage {
  from_name?: string;
  from_address: string;
  body_text?: string;
  sent_date: string;
}

interface MobileEmailReplyProps {
  threadId: string;
  accountId?: string;
  toAddress: string;
  replyAll?: boolean;
  onCancel: () => void;
  onSent: () => void;
  lastMessageId?: string;
  allMessageIds?: string[];
  threadMessages?: ThreadMessage[];
}

/**
 * Composant de réponse rapide optimisé pour mobile (drawer)
 * Layout simplifié avec textarea et boutons d'action
 */
export function MobileEmailReply({
  threadId,
  accountId,
  toAddress,
  replyAll = false,
  onCancel,
  onSent,
  lastMessageId,
  allMessageIds = [],
  threadMessages = [],
}: MobileEmailReplyProps) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!body.trim()) {
      toast.error("Le message ne peut pas être vide");
      return;
    }

    if (!accountId || accountId === 'all') {
      toast.error("Impossible de déterminer le compte email à utiliser");
      return;
    }

    setSending(true);

    try {
      // Build quoted body from thread messages
      const quotedBody = buildQuotedBody(threadMessages);
      const fullBody = quotedBody ? `${body}\n\n${quotedBody}` : body;

      const data = await invokeEdge<any>('send-email-reply', {
          account_id: accountId,
          thread_id: threadId,
          to: toAddress,
          subject: `Re: Thread`,
          body: fullBody,
          in_reply_to: lastMessageId || undefined,
          references: allMessageIds.length > 0 ? allMessageIds : undefined,
        });
      // Handle partial success: SMTP sent but DB storage failed (edge function returns 500)
      if (data?.smtp_sent && data?.db_stored === false) {
        toast.warning("Email envoyé mais non enregistré dans vos envoyés");
        onSent();
        return;
      }
      // Check for warning in response (email sent but not stored)
      if (data?.warning) {
        toast.warning(`Réponse envoyée avec avertissement: ${data.warning}`);
      } else {
        toast.success("Réponse envoyée");
      }
      onSent();
    } catch (error: unknown) {
      debug.error("Error sending reply:", error);
      toast.error(sanitizeSupabaseError(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Destinataire (readonly) */}
      <div className="p-4 border-b bg-muted/30">
        <Label className="text-xs text-muted-foreground">À</Label>
        <p className="text-sm font-medium mt-1">{toAddress}</p>
        {replyAll && (
          <p className="text-xs text-muted-foreground mt-1">
            + tous les destinataires
          </p>
        )}
      </div>

      {/* Corps du message */}
      <div className="flex-1 p-4">
        <Textarea
          placeholder="Votre réponse..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[200px] resize-none border-0 focus-visible:ring-0 text-base"
          autoFocus
        />
      </div>

      {/* Actions footer sticky */}
      <div className="p-4 border-t bg-background flex items-center justify-between gap-2">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={sending}
          className="flex-1"
        >
          Annuler
        </Button>
        
        <Button
          onClick={handleSend}
          disabled={sending || !body.trim()}
          className="flex-1"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Envoi...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Envoyer
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
