import { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { invokeSendEmail } from "@/services/email/emailSendTransport";
import { upsertEmailDraft, deleteEmailDraft } from "@/services/email/emailDrafts";
import { useAuth } from "@/hooks/shared/useAuth";
import type { EmailDraft } from "@/types/email";

interface DraftData {
  id?: string;
  account_id: string;
  to_addresses: string;
  cc_addresses: string | null;
  bcc_addresses: string | null;
  subject: string;
  body: string;
  user_id: string;
}

interface MobileEmailComposerProps {
  accountId: string;
  onCancel: () => void;
  onSent: () => void;
  initialDraft?: EmailDraft | null;
}

/**
 * Compositeur d'email optimisé pour mobile (fullscreen drawer)
 * Layout simplifié sans RichTextEditor
 */
export function MobileEmailComposer({
  accountId,
  onCancel,
  onSent,
  initialDraft
}: MobileEmailComposerProps) {
  const { user: authUser } = useAuth();
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  // Load draft if exists
  useEffect(() => {
    if (initialDraft) {
      setTo(initialDraft.to_addresses || "");
      setCc(initialDraft.cc_addresses || "");
      setBcc(initialDraft.bcc_addresses || "");
      setSubject(initialDraft.subject || "");
      setBody(initialDraft.body || "");
      if (initialDraft.cc_addresses) setShowCc(true);
      if (initialDraft.bcc_addresses) setShowBcc(true);
    }
  }, [initialDraft]);

  // Auto-save draft every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      if ((to || subject || body) && !sending) {
        saveDraft();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [to, subject, body, sending]);

  const saveDraft = async () => {
    if (!accountId) return;
    
    setSavingDraft(true);
    
    try {
      const userId = authUser?.id;
      if (!userId) return;

      const draftData: DraftData = {
        account_id: accountId,
        to_addresses: to,
        cc_addresses: cc || null,
        bcc_addresses: bcc || null,
        subject,
        body,
        user_id: userId,
      };

      // Only include id if updating existing draft
      if (initialDraft?.id) {
        draftData.id = initialDraft.id;
      }

      await upsertEmailDraft(draftData as unknown as Parameters<typeof upsertEmailDraft>[0]);
    } catch (error) {
      debug.error("Error saving draft:", error);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleAttachFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      setAttachments(prev => [...prev, ...files]);
    };
    input.click();
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error("Veuillez saisir un destinataire");
      return;
    }

    if (!subject.trim()) {
      toast.error("Veuillez saisir un objet");
      return;
    }

    setSending(true);

    try {
      // Convert plain text body to HTML for send-email edge function
      const htmlBody = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      
      const data = await invokeSendEmail({
        account_id: accountId,
        user_id: authUser?.id,
        to,
        cc: cc || undefined,
        subject,
        html_body: htmlBody,
      });

      // Handle partial success: SMTP sent but DB storage failed
      if (data?.smtp_sent && data?.db_stored === false) {
        toast.warning("Email envoyé mais non enregistré dans vos envoyés");
        onSent();
        return;
      }

      // Delete draft if exists
      if (initialDraft?.id) {
        await deleteEmailDraft(initialDraft.id);
      }

      toast.success("Email envoyé");
      onSent();
    } catch (error) {
      debug.error("Error sending email:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur lors de l'envoi";
      toast.error(errorMessage);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Champs destinataires */}
      <div className="p-4 space-y-3 border-b">
        <Input 
          placeholder="À" 
          value={to} 
          onChange={(e) => setTo(e.target.value)}
          className="border-0 border-b rounded-none px-0 focus-visible:ring-0"
        />
        
        {showCc && (
          <Input 
            placeholder="Cc" 
            value={cc} 
            onChange={(e) => setCc(e.target.value)}
            className="border-0 border-b rounded-none px-0 focus-visible:ring-0"
          />
        )}
        
        {showBcc && (
          <Input 
            placeholder="Bcc" 
            value={bcc} 
            onChange={(e) => setBcc(e.target.value)}
            className="border-0 border-b rounded-none px-0 focus-visible:ring-0"
          />
        )}
        
        <div className="flex gap-2">
          {!showCc && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowCc(true)}
              className="h-7 text-xs"
            >
              Cc
            </Button>
          )}
          {!showBcc && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowBcc(true)}
              className="h-7 text-xs"
            >
              Bcc
            </Button>
          )}
        </div>
        
        <Input 
          placeholder="Objet" 
          value={subject} 
          onChange={(e) => setSubject(e.target.value)}
          className="border-0 border-b rounded-none px-0 focus-visible:ring-0"
        />
      </div>
      
      {/* Corps du message */}
      <div className="flex-1 overflow-y-auto p-4">
        <Textarea
          placeholder="Votre message..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[300px] border-0 focus-visible:ring-0 text-base resize-none"
        />
      </div>
      
      {/* Pièces jointes */}
      {attachments.length > 0 && (
        <div className="p-4 border-t space-y-2 max-h-32 overflow-y-auto">
          {attachments.map((file, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted p-2 rounded">
              <Paperclip className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 truncate text-sm">{file.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => removeAttachment(i)} aria-label="Fermer">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      
      {/* Footer actions sticky */}
      <div className="p-4 border-t bg-background flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleAttachFile}
            className="h-9 w-9" aria-label="Joindre un fichier">
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex gap-2">
          {savingDraft && (
            <span className="text-xs text-muted-foreground self-center">
              Brouillon sauvegardé
            </span>
          )}
          
          <Button 
            variant="outline" 
            onClick={saveDraft}
            disabled={savingDraft}
            className="h-9"
          >
            Brouillon
          </Button>
          
          <Button 
            onClick={handleSend} 
            disabled={sending || !to.trim() || !subject.trim()}
            className="h-9"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Envoyer
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
