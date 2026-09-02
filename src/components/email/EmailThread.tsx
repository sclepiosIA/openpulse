import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Progress } from "@/components/ui/progress";

import {
  ArrowLeft,
  Loader2,
  Reply,
  ReplyAll,
  Forward,
  ChevronsUpDown,
  Keyboard,
} from "lucide-react";

import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { toast as sonnerToast } from "sonner";
import { EmailReply } from "./EmailReply";

import { UnifiedEmailContextCard } from "./UnifiedEmailContextCard";

import { EmailReplyAll } from "./EmailReplyAll";

import { EmailForwardDialog } from "./EmailForwardDialog";
import { AIProgressIndicator } from "./AIProgressIndicator";

import { EmailKeyboardShortcutsDialog } from "./EmailKeyboardShortcutsDialog";
import { AssignThreadDialog } from "./AssignThreadDialog";

import { MobileThreadHeader } from "./MobileThreadHeader";
import { EmailThreadGroupeCard } from "./EmailThreadGroupeCard";
import { MobileEstablishmentCard } from "./MobileEstablishmentCard";

import { useIsMobile } from "@/hooks/ui/use-mobile";
import { useEmailThreadActions } from "@/hooks/email/useEmailThreadActions";
import { getAllThreadParticipants, sanitizeAllEmailFields } from "@/lib/emailUtils";

import { useThreadGroupeParticipants } from "@/hooks/email/useThreadGroupeParticipants";
import { useGroupeEtablissements } from "@/hooks/crm/useGroupeEtablissements";
import { useErrorHandler } from "@/hooks/shared/useErrorHandler";
import { useEmailThreadKeyboard } from "@/hooks/email/useEmailThreadKeyboard";

import { debug } from "@/lib/debug";
import type { EmailMessage } from "@/types/email";
import { useAuth } from "@/hooks/shared/useAuth";
import { EMAIL_THREAD_DETAIL_SELECT, type ThreadData } from "./EmailThread.types";
import { EmailThreadStickyHeader } from "./EmailThreadStickyHeader";
import { EmailThreadMessageItem } from "./EmailThreadMessageItem";

import {
  Dialog,
} from "@/components/ui/dialog";

interface EmailThreadProps {
  threadId: string;
  onBack: () => void;
  /** When true, the component is embedded in a panel - hides back button and expands all messages by default */
  embedded?: boolean;
}

export function EmailThread({ threadId, onBack, embedded = false }: EmailThreadProps) {
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showReply, setShowReply] = useState<'none' | 'single' | 'all'>('none');
  const [showForward, setShowForward] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [refetchingContent, setRefetchingContent] = useState<string | null>(null);
  const { user } = useAuth();
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [isHeaderSticky, setIsHeaderSticky] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { handleError } = useErrorHandler();
  const isMobile = useIsMobile();
  const { 
    archiveThread, 
    isArchiving, 
    markAsSpam, 
    isMarkingSpam,
    markAsRead,
    updateTags,
    isUpdatingTags,
    forwardEmail,
    isForwarding
  } = useEmailThreadActions();

  const groupeInfo = useThreadGroupeParticipants(thread);
  const { data: etablissementsGroupe } = useGroupeEtablissements(
    groupeInfo?.hasMultipleEtablissementsInGroupe && groupeInfo.groupeId
      ? groupeInfo.groupeId
      : null
  );

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const handleAssign = () => {
    setAssignDialogOpen(true);
  };

  const handleAssigned = () => {
    fetchThread();
  };

  // Expand/Collapse all messages
  const handleExpandAll = () => {
    if (thread?.messages) {
      setExpandedMessages(new Set(thread.messages.map((m: EmailMessage) => m.id)));
    }
  };

  const handleCollapseAll = () => {
    setExpandedMessages(new Set());
  };

  // Navigation between messages
  const handleNextMessage = () => {
    if (thread?.messages && currentMessageIndex < thread.messages.length - 1) {
      const nextIndex = currentMessageIndex + 1;
      setCurrentMessageIndex(nextIndex);
      const nextMessageId = thread.messages[nextIndex].id;
      setExpandedMessages(new Set([nextMessageId]));
      // Scroll to message
      document.getElementById(`message-${nextMessageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handlePreviousMessage = () => {
    if (thread?.messages && currentMessageIndex > 0) {
      const prevIndex = currentMessageIndex - 1;
      setCurrentMessageIndex(prevIndex);
      const prevMessageId = thread.messages[prevIndex].id;
      setExpandedMessages(new Set([prevMessageId]));
      // Scroll to message
      document.getElementById(`message-${prevMessageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleToggleSelection = () => {
    // Toggle current message expand/collapse
    if (thread?.messages && thread.messages[currentMessageIndex]) {
      const messageId = thread.messages[currentMessageIndex].id;
      const newExpanded = new Set(expandedMessages);
      if (newExpanded.has(messageId)) {
        newExpanded.delete(messageId);
      } else {
        newExpanded.add(messageId);
      }
      setExpandedMessages(newExpanded);
    }
  };

  // Keyboard shortcuts
  useEmailThreadKeyboard({
    onReply: () => setShowReply('single'),
    onReplyAll: () => setShowReply('all'),
    onArchive: async () => {
      if (thread && !isArchiving) {
        await archiveThread({ 
          threadId: thread.id, 
          archived: !thread.is_archived 
        });
        onBack();
      }
    },
    onForward: () => setShowForward(true),
    onExpandAll: handleExpandAll,
    onCollapseAll: handleCollapseAll,
    onNextMessage: handleNextMessage,
    onPreviousMessage: handlePreviousMessage,
    onToggleSelection: handleToggleSelection,
    onShowShortcuts: () => setShowShortcuts(true),
    disabled: showReply !== 'none' || showForward,
  });

  // Sticky header scroll handler
  useEffect(() => {
    const handleScroll = () => {
      setIsHeaderSticky(window.scrollY > 100);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchThread();
  }, [threadId]);

  // Expand all messages by default after thread loads (both embedded and standalone)
  // Use a ref to track if we've already initialized to avoid stale closure issues
  const hasInitializedExpansion = useRef(false);
  
  useEffect(() => {
    if (thread?.messages && thread.messages.length > 0 && !hasInitializedExpansion.current) {
      hasInitializedExpansion.current = true;
      // Only expand the last (most recent) message by default
      const sorted = [...thread.messages].sort(
        (a: any, b: any) => new Date(b.sent_date).getTime() - new Date(a.sent_date).getTime()
      );
      setExpandedMessages(new Set([sorted[0].id]));
    }
  }, [thread?.messages]);

  // Reset expansion tracking when threadId changes
  useEffect(() => {
    hasInitializedExpansion.current = false;
  }, [threadId]);

  const fetchThread = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_threads")
      .select(EMAIL_THREAD_DETAIL_SELECT)

      .eq("id", threadId)
      .maybeSingle();

    if (error) {
      debug.error('[EmailThread] fetchThread error:', error);
      toast({
        title: "Impossible de charger la conversation",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
      setThread(null);
      setLoading(false);
      return;
    }

    setThread(data as unknown as ThreadData);
    setLoading(false);

    // Silent mark-as-read: persist to DB without triggering mutation/invalidation cascade
    // The EmailListPanel already handles optimistic UI + DB persistence + badge invalidation
    // so we do NOT call markAsRead() here to avoid duplicate refreshes
  };

  const processWithAI = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke("process-email-with-ai", {
        body: { thread_id: threadId },
      });

      if (error) throw error;

      toast({ title: "Analyse IA terminée" });
      fetchThread();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRefetchContent = async (messageId: string) => {
    setRefetchingContent(messageId);
    try {
      const { data, error } = await supabase.functions.invoke('resync-empty-emails');
      
      if (error) throw error;
      
      sonnerToast.success("Contenu récupéré avec succès");
      fetchThread();
    } catch (error: unknown) {
      debug.error('Error refetching content:', error);
      sonnerToast.error("Erreur lors de la récupération du contenu");
    } finally {
      setRefetchingContent(null);
    }
  };

  // Sanitize all messages at component level (MUST be before any conditional returns)
  const sanitizedMessages = useMemo(() => {
    if (!thread?.messages) return [];
    
    const sorted = [...thread.messages].sort(
      (a: any, b: any) => new Date(b.sent_date).getTime() - new Date(a.sent_date).getTime()
    );
    
    return sorted.map((message: any) => {
      const result = sanitizeAllEmailFields({
        subject: message.subject,
        from_name: message.from_name,
        body_html: message.body_html,
        body_text: message.body_text,
      });
      
      return {
        ...message,
        subject: result.subject,
        from_name: result.from_name,
        body_html: result.body_html,
        body_text: result.body_text,
        _wasEncoded: result.encodingWasCorrected,
      };
    });
  }, [thread?.messages]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!loading && !thread) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Conversation introuvable ou inaccessible.</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
      </div>
    );
  }

  if (!thread) return null;

  return (
    <div className={isMobile ? "space-y-2" : "space-y-4"}>
      {/* AI Progress Indicator */}
      {processing && (
        <AIProgressIndicator operationType="analyze" />
      )}

      {/* Mobile Header */}
      {isMobile && (
        <MobileThreadHeader
          thread={thread}
          onBack={onBack}
          onReply={() => setShowReply('single')}
          onReplyAll={() => setShowReply('all')}
          onArchive={() => archiveThread({ threadId, archived: !thread.is_archived })}
          onMarkSpam={() => markAsSpam({ threadId, isSpam: !thread.is_spam })}
          isArchiving={isArchiving}
        />
      )}

      {/* Desktop Sticky Header - Only in standalone mode */}
      {!isMobile && !embedded && (
        <EmailThreadStickyHeader
          thread={thread}
          sanitizedMessagesCount={sanitizedMessages.length}
          currentMessageIndex={currentMessageIndex}
          threadId={threadId}
          processing={processing}
          isArchiving={isArchiving}
          onBack={onBack}
          onPreviousMessage={handlePreviousMessage}
          onNextMessage={handleNextMessage}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
          onReply={() => setShowReply('single')}
          onReplyAll={() => setShowReply('all')}
          onForward={() => setShowForward(true)}
          onArchiveToggle={() => archiveThread({ threadId, archived: !thread.is_archived })}
          onProcessAI={processWithAI}
          onMarkSpam={() => markAsSpam({ threadId, isSpam: !thread.is_spam })}
          onShowShortcuts={() => setShowShortcuts(true)}
        />
      )}

      {/* Thread Header - Desktop */}
      {!isMobile && (
        <Card className="p-3 lg:p-4">
          {/* Unified Context Card: Establishment + Sender Info first */}
          {!groupeInfo?.hasMultipleEtablissementsInGroupe && (thread.ai_summary || thread.etablissement || thread.partenaire || sanitizedMessages.length > 0) && (
            <UnifiedEmailContextCard 
              thread={thread as Record<string, unknown>}
              className="border-0 shadow-none bg-transparent"
              compact
              onAssign={handleAssign}
              senderEmail={sanitizedMessages[0]?.from_address}
              senderInfo={sanitizedMessages.length > 0 ? {
                from_name: sanitizedMessages[0].from_name,
                from_address: sanitizedMessages[0].from_address,
                to_addresses: sanitizedMessages[0].to_addresses || [],
                cc_addresses: sanitizedMessages[0].cc_addresses,
                bcc_addresses: sanitizedMessages[0].bcc_addresses,
                sent_date: sanitizedMessages[0].sent_date,
              } : null}
              onReply={() => { setSelectedMessageId(sanitizedMessages[0]?.id); setShowReply('single'); }}
              onReplyAll={() => { setSelectedMessageId(sanitizedMessages[0]?.id); setShowReply('all'); }}
              onForward={() => { setSelectedMessageId(sanitizedMessages[0]?.id); setShowForward(true); }}
              threadTitle={thread.ai_generated_title || thread.subject}
              threadCategory={thread.category}
              threadTags={thread.tags}
              threadPriority={thread.priority}
              isArchived={thread.is_archived}
              isSpam={thread.is_spam}
              accountEmail={thread.account?.email_address}
              isUpdatingTags={isUpdatingTags}
              onUpdateTags={(tags) => {
                updateTags({ threadId, tags });
                setThread({ ...thread, tags });
              }}
            />
          )}

          {/* Groupe/GHT Card - Kept as separate full-width card */}
          {groupeInfo?.hasMultipleEtablissementsInGroupe && etablissementsGroupe && etablissementsGroupe.length > 0 && (
            <EmailThreadGroupeCard
              groupeNom={groupeInfo.groupeNom}
              groupeId={groupeInfo.groupeId}
              etablissementsGroupe={etablissementsGroupe as any}
            />
          )}

        {/* Partenaire Card - Now handled by UnifiedEmailContextCard */}
        </Card>
      )}

      {/* Mobile Entity Cards */}
      {isMobile && (
        <>
          {/* Mobile Etablissement Card */}
          {!groupeInfo?.hasMultipleEtablissementsInGroupe && thread.etablissement && (
            <MobileEstablishmentCard etablissement={thread.etablissement} />
          )}
        </>
      )}

      {/* Reply Composer */}
      {showReply === 'single' && thread && user && (() => {
        // Extract threading info from messages
        const messages = thread.messages || [];
        const sortedByDate = [...messages].sort((a, b) => new Date(b.sent_date).getTime() - new Date(a.sent_date).getTime());
        const lastReceivedMessage = sortedByDate.find((m: EmailMessage) => m.from_address.toLowerCase() !== user.email?.toLowerCase());
        const lastMessageId = lastReceivedMessage?.message_id || sortedByDate[0]?.message_id;
        const allMessageIds = sortedByDate.map((m: EmailMessage) => m.message_id).filter(Boolean);
        
        return (
          <EmailReply
            threadId={thread.id}
            accountId={thread.user_email_account_id}
            toAddress={lastReceivedMessage?.from_address || ''}
            subject={thread.subject}
            onCancel={() => setShowReply('none')}
            onSent={() => {
              setShowReply('none');
              fetchThread();
            }}
            threadParticipants={getAllThreadParticipants(thread, user.email || '').all}
            threadMessages={messages.map((m: EmailMessage) => ({
              from_name: m.from_name ?? undefined,
              from_address: m.from_address,
              body_text: m.body_text ?? undefined,
              sent_date: m.sent_date || m.received_date,
            }))}
            lastMessageId={lastMessageId}
            allMessageIds={allMessageIds}
          />
        );
      })()}

      {showReply === 'all' && thread && user && (() => {
        const messages = thread.messages || [];
        const sortedByDate = [...messages].sort((a, b) => new Date(b.sent_date).getTime() - new Date(a.sent_date).getTime());
        const lastReceivedMessage = sortedByDate.find((m: EmailMessage) => m.from_address.toLowerCase() !== user.email?.toLowerCase());
        const lastMessageId = lastReceivedMessage?.message_id || sortedByDate[0]?.message_id;
        const allMessageIds = sortedByDate.map((m: EmailMessage) => m.message_id).filter(Boolean);
        
        return (
          <EmailReplyAll
            threadId={thread.id}
            accountId={thread.user_email_account_id}
            toAddresses={getAllThreadParticipants(thread, user.email || '').to}
            ccAddresses={getAllThreadParticipants(thread, user.email || '').cc}
            subject={thread.subject}
            onCancel={() => setShowReply('none')}
            onSent={() => {
              setShowReply('none');
              fetchThread();
            }}
            threadParticipants={getAllThreadParticipants(thread, user.email || '').all}
            threadMessages={messages.map((m: EmailMessage) => ({
              from_name: m.from_name ?? undefined,
              from_address: m.from_address,
              body_text: m.body_text ?? undefined,
              sent_date: m.sent_date || m.received_date,
            }))}
            lastMessageId={lastMessageId}
            allMessageIds={allMessageIds}
          />
        );
      })()}

      {/* Messages */}
      <div className={isMobile ? "space-y-0 divide-y" : "space-y-3"}>
        {/* Show previous messages toggle */}
        {sanitizedMessages.length > 1 && expandedMessages.size <= 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 rounded-lg gap-2"
            onClick={handleExpandAll}
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            Afficher les {sanitizedMessages.length - 1} message{sanitizedMessages.length > 2 ? 's' : ''} précédent{sanitizedMessages.length > 2 ? 's' : ''}
          </Button>
        )}
        {sanitizedMessages.map((message: any, index: number) => {
          const isExpanded = expandedMessages.has(message.id);
          return (
            <EmailThreadMessageItem
              key={message.id}
              message={message}
              index={index}
              isExpanded={isExpanded}
              isMobile={isMobile}
              threadId={thread.id}
              threadSubject={thread.subject}
              onExpand={(id: string) => {
                const next = new Set(expandedMessages);
                next.add(id);
                setExpandedMessages(next);
              }}
              onCollapse={(id: string) => {
                const next = new Set(expandedMessages);
                next.delete(id);
                setExpandedMessages(next);
              }}
              onReplySingle={(id: string) => { setSelectedMessageId(id); setShowReply('single'); }}
              onReplyAll={(id: string) => { setSelectedMessageId(id); setShowReply('all'); }}
              onForward={(id: string) => { setSelectedMessageId(id); setShowForward(true); }}
            />
          );
        })}
        </div>

      {/* Bottom Reply CTA - After all messages */}
      {showReply === 'none' && !showForward && !isMobile && (
        <div className="flex items-center gap-2 pt-2">
          <Button 
            onClick={() => setShowReply('single')}
            className="flex-1 h-10 gap-2 rounded-xl shadow-sm"
          >
            <Reply className="h-4 w-4" />
            Répondre
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowReply('all')}
            className="h-10 gap-2 rounded-xl"
          >
            <ReplyAll className="h-4 w-4" />
            Répondre à tous
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowForward(true)}
            className="h-10 gap-2 rounded-xl"
          >
            <Forward className="h-4 w-4" />
            Transférer
          </Button>
        </div>
      )}

      {/* Keyboard Shortcuts Dialog */}
      <EmailKeyboardShortcutsDialog 
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
      />

      {/* Assign Thread Dialog */}
      <AssignThreadDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        threadId={thread.id}
        participants={
          thread.participants
            ? Object.entries(thread.participants as Record<string, { name?: string }>).map(([email, data]) => ({
                email,
                name: data?.name,
              }))
            : []
        }
        onAssigned={handleAssigned}
      />

      {/* Forward Dialog */}
      <EmailForwardDialog
        open={showForward}
        onOpenChange={setShowForward}
        onForward={(toAddresses, additionalContent) => {
          if (selectedMessageId) {
            forwardEmail({
              messageId: selectedMessageId,
              toAddresses,
              additionalContent,
            });
          }
        }}
        isForwarding={isForwarding}
      />
    </div>
  );
}