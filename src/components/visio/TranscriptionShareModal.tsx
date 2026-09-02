import { useState, useEffect } from 'react';
import { debug } from '@/lib/debug';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Mail, FileText, X } from 'lucide-react';
import {
  fetchTranscriptionParticipants,
  fetchTranscriptionSessionStatus,
  sendTranscriptionEmail,
} from '@/services/visio/transcriptionSharing';
import { toast } from 'sonner';

interface Participant {
  id: string;
  displayName: string;
  email?: string;
}

interface TranscriptionShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  onClose: () => void;
}

export function TranscriptionShareModal({
  open,
  onOpenChange,
  sessionId,
  onClose,
}: TranscriptionShareModalProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [customEmail, setCustomEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'processing' | 'ready' | 'error'>('processing');

  // Fetch session participants and poll for status
  useEffect(() => {
    if (!open || !sessionId) return;

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const fetchParticipants = async () => {
      try {
        const mappedParticipants = await fetchTranscriptionParticipants(sessionId);

        if (isMounted) {
          setParticipants(mappedParticipants);

          // Pre-select participants with emails
          const emailsToSelect = new Set<string>();
          mappedParticipants.forEach((p) => {
            if (p.email) emailsToSelect.add(p.email);
          });
          setSelectedEmails(emailsToSelect);
        }
      } catch (err) {
        debug.error('Error fetching participants:', err);
      }
    };

    const pollSessionStatus = async () => {
      try {
        const session = await fetchTranscriptionSessionStatus(sessionId);

        if (!session) {
          debug.warn('[TranscriptionShareModal] Session not found:', sessionId);
          if (isMounted) setSessionStatus('error');
          return false;
        }


        // Debug log only in development (stripped in production by Vite)

        // Session is ready when archived with a summary
        if (session.status === 'archived' && session.summary) {
          if (isMounted) {
            setSessionStatus('ready');
            toast.success('Résumé généré !');
          }
          return true; // Stop polling
        }

        // Still processing
        if (session.status === 'processing' || session.status === 'ended') {
          if (isMounted) setSessionStatus('processing');
          return false; // Continue polling
        }

        // Archived without summary (fallback)
        if (session.status === 'archived') {
          if (isMounted) setSessionStatus('ready');
          return true;
        }

        return false;
      } catch (err) {
        debug.error('[TranscriptionShareModal] Error polling session:', err);
        return false;
      }
    };

    const startPolling = async () => {
      setIsLoading(true);
      
      // Fetch participants immediately
      await fetchParticipants();
      
      // Check initial status
      const isReady = await pollSessionStatus();
      
      if (isMounted) setIsLoading(false);

      if (!isReady && isMounted) {
        // Start polling every 2 seconds
        pollInterval = setInterval(async () => {
          const ready = await pollSessionStatus();
          if (ready && pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }, 2000);

        // Timeout after 90 seconds (GPT-5 can be slow)
        timeoutHandle = setTimeout(() => {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          if (isMounted) {
            setSessionStatus('error');
            toast.error('Délai de génération dépassé. Réessayez plus tard.');
          }
        }, 90000);
      }
    };

    startPolling();

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
  }, [open, sessionId]);

  const toggleEmail = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  const addCustomEmail = () => {
    const email = customEmail.trim().toLowerCase();
    if (!email) return;

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Adresse email invalide');
      return;
    }

    if (selectedEmails.has(email)) {
      toast.info('Cette adresse est déjà sélectionnée');
      return;
    }

    // Add as a new participant
    setParticipants((prev) => [
      ...prev,
      { id: `custom-${Date.now()}`, displayName: email, email },
    ]);
    setSelectedEmails((prev) => new Set([...prev, email]));
    setCustomEmail('');
  };

  const handleSend = async () => {
    if (!sessionId) return;
    if (selectedEmails.size === 0) {
      toast.error('Sélectionnez au moins un destinataire');
      return;
    }

    setIsSending(true);
    try {
      // Call edge function to send transcription emails
      await sendTranscriptionEmail(sessionId, Array.from(selectedEmails));

      toast.success(`Compte-rendu envoyé à ${selectedEmails.size} destinataire(s)`);
      onClose();
    } catch (err: any) {
      debug.error('Error sending transcription:', err);
      toast.error(err.message || 'Erreur lors de l\'envoi');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    onClose();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Partager le compte-rendu
          </DialogTitle>
          <DialogDescription>
            {sessionStatus === 'processing' ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Le résumé est en cours de génération...
              </span>
            ) : sessionStatus === 'ready' ? (
              'Sélectionnez les participants qui recevront le compte-rendu par email.'
            ) : (
              'Le compte-rendu sera envoyé une fois généré.'
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {getInitials(participant.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{participant.displayName}</p>
                      {participant.email && (
                        <p className="text-xs text-muted-foreground truncate">{participant.email}</p>
                      )}
                    </div>
                    {participant.email && (
                      <Checkbox
                        id={`participant-${participant.id}`}
                        checked={selectedEmails.has(participant.email)}
                        onCheckedChange={() => toggleEmail(participant.email!)}
                      />
                    )}
                  </div>
                ))}

                {participants.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun participant trouvé
                  </p>
                )}
              </div>
            </ScrollArea>

            {/* Add custom email */}
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Ajouter un email..."
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomEmail()}
                type="email"
              />
              <Button variant="outline" size="icon" onClick={addCustomEmail} aria-label="E-mail">
                <Mail className="h-4 w-4" />
              </Button>
            </div>

            {selectedEmails.size > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedEmails.size} destinataire(s) sélectionné(s)
              </p>
            )}
          </>
        )}

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            Fermer sans envoyer
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || selectedEmails.size === 0 || isLoading}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
