/**
 * JarvisPremiumPanel - Panel principal ultra-premium (v15.0)
 * 
 * Architecture complète:
 * - Streaming SSE temps réel via useJarvisStreaming
 * - Glassmorphism header avec status
 * - Smart input avec suggestions
 * - Premium messages avec animations
 * - Intelligent thinking indicators
 * - Enhanced welcome screen
 * - Feedback persisté en base
 * - Skeleton loader pendant chargement conversation
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { cn } from '@/lib/utils';
import { useJarvis } from '@/hooks/jarvis/useJarvis';
import { debug } from '@/lib/debug';
import { useJarvisStreaming } from '@/hooks/jarvis/useJarvisStreaming';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { useJarvisConversationPersistence } from '@/hooks/jarvis/useJarvisConversationPersistence';
import { useAuth } from '@/hooks/shared/useAuth';
import { useJarvisFeedback } from '@/hooks/jarvis/useJarvisFeedback';
import { useToast } from '@/hooks/shared/use-toast';
import { useJarvisUnifiedOptional } from '@/contexts/JarvisUnifiedContext';

// Premium components
import { JarvisGlassHeader } from './JarvisGlassHeader';
import { JarvisEnhancedWelcome } from './JarvisEnhancedWelcome';
import { JarvisSmartInput } from './JarvisSmartInput';
import { JarvisPremiumMessage } from './JarvisPremiumMessage';
import { JarvisIntelligentThinking } from './JarvisIntelligentThinking';
import { JarvisStreamingMessage } from './JarvisStreamingMessage';
import { JarvisHistorySheet } from './JarvisHistorySheet';
import { JarvisEmailPreview } from './JarvisEmailPreview';
import { JarvisSettingsSheet } from './JarvisSettingsSheet';
import { JarvisSkeletonLoader } from './JarvisSkeletonLoader';
import { JARVIS_ANIMATIONS } from './JarvisDesignSystem';
import type { ToolCall } from '@/types/jarvis';

interface JarvisPremiumPanelProps {
  onClose?: () => void;
  onMinimize?: () => void;
  className?: string;
}

export const JarvisPremiumPanel = memo(function JarvisPremiumPanel({ onClose, onMinimize, className }: JarvisPremiumPanelProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const { submitMessageFeedback } = useJarvisFeedback();
  const { data: currentProfile } = useCurrentProfile();

  // Connect to unified context for proactive nudge quick actions
  const jarvisUnifiedContext = useJarvisUnifiedOptional();

  const {
    pendingCount,
    messages,
    setMessages,
    isTyping,
    chat,
    clearChat,
    getPageContextForInjection,
    confirmToolCall,
    rejectToolCall,
    isConfirming,
  } = useJarvis();

  // Streaming hook for real-time token display
  const {
    isStreaming,
    isDone: streamingIsDone,
    currentContent: streamingContent,
    streamChat,
    resetStream,
    activeTools,
    cancelStream,
    reasoningSteps,
  } = useJarvisStreaming();

  // Debounce ref to prevent rapid double-clicks on suggestions
  const lastSendTimeRef = useRef(0);
  // Double-submit lock: prevent concurrent sendMessage calls
  const sendInFlightRef = useRef(false);

  const {
    saveMessages,
    loadConversation,
    conversations,
    currentConversationId,
    createConversation,
  } = useJarvisConversationPersistence();

  // Debug: track mount/unmount to detect destructive remounts during streaming
  useEffect(() => {
    debug.log('[JarvisPremiumPanel] MOUNTED');
    return () => {
      debug.log('[JarvisPremiumPanel] UNMOUNTED — isStreaming was:', isStreaming);
    };
  }, []);

  // Auto-scroll on new messages or streaming content
  useEffect(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      });
    }
  }, [messages, isTyping, isStreaming, streamingContent]);

  // Load most recent conversation on mount with skeleton
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    const loadRecent = async () => {
      if (hasLoadedRef.current || messages.length > 0 || conversations.length === 0) return;
      hasLoadedRef.current = true;
      setIsLoadingConversation(true);

      try {
        const recent = conversations[0];
        const loaded = await loadConversation(recent.id);
        if (loaded && loaded.length > 0) {
          setMessages(loaded);
        }
      } finally {
        setIsLoadingConversation(false);
      }
    };
    loadRecent();
  }, [conversations, messages.length, loadConversation, setMessages]);

  // Auto-save messages
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (messages.length === 0) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      let targetId = currentConversationId;
      if (!targetId) {
        targetId = await createConversation();
      }
      if (targetId) {
        await saveMessages(messages, targetId);
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, currentConversationId, createConversation, saveMessages]);

  const handleNewConversation = useCallback(async () => {
    if (currentConversationId && messages.length > 0) {
      await saveMessages(messages, currentConversationId);
    }
    await createConversation();
    clearChat();
    resetStream();
  }, [currentConversationId, messages, saveMessages, createConversation, clearChat, resetStream]);

  // Fork conversation if an active call is in progress
  const forkConversationIfBusy = useCallback(async () => {
    if (!isStreaming && !isTyping) return false;

    // Cancel the active stream
    cancelStream();

    // Save partial streaming content as an interrupted assistant message
    const currentMessages = [...messages];
    if (streamingContent) {
      currentMessages.push({
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: streamingContent + '\n\n---\n*[Réponse interrompue]*',
        timestamp: new Date()
      });
    }

    // Save current conversation
    if (currentConversationId && currentMessages.length > 0) {
      await saveMessages(currentMessages, currentConversationId);
    }

    // Create a fresh conversation
    await createConversation();
    clearChat();
    resetStream();

    return true;
  }, [isStreaming, isTyping, cancelStream, streamingContent, messages, currentConversationId, saveMessages, createConversation, clearChat, resetStream]);

  // Core send logic shared by handleSubmit and handleSendMessage
  const sendMessage = useCallback(async (message: string) => {
    // Double-submit lock
    if (sendInFlightRef.current) {
      debug.log('[JarvisPremiumPanel] sendMessage blocked — already in flight');
      return;
    }
    sendInFlightRef.current = true;

    // Set global activity flag to prevent hard recovery refreshes
    try { localStorage.setItem('jarvis-task-active', '1'); } catch {}

    try {
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: message,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    const conversationHistory = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    const pageContext = getPageContextForInjection();
    resetStream();
    
    const fullContent = await streamChat(message, conversationHistory, pageContext);

    debug.log('jarvis', `[sendMessage] streamChat returned, fullContent length: ${fullContent?.length ?? 'null'}`);

    if (fullContent) {
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: fullContent,
        timestamp: new Date()
      };
      // Batch both updates synchronously so React 18 renders them together,
      // preventing the streaming content from disappearing before the
      // persisted message appears.
      debug.log('jarvis', '[sendMessage] Batching setMessages + resetStream');
      setMessages(prev => [...prev, assistantMessage]);
      resetStream();
      
      // Mark response as ready for MiniFab
      if (jarvisUnifiedContext?.markResponseReady) {
        jarvisUnifiedContext.markResponseReady();
      }
    } else {
      resetStream();
      // Add inline error message with a retry hook (stores the original message
      // in the message metadata so the UI can offer a "Réessayer" action).
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: '⚠️ La réponse n\'a pas pu être générée. Réessayez votre question.',
        timestamp: new Date(),
        metadata: { failed: true, retryMessage: message },
      } as any]);

      if (jarvisUnifiedContext?.markResponseReady) {
        jarvisUnifiedContext.markResponseReady();
      }
    }
    } finally {
      sendInFlightRef.current = false;
      try { localStorage.removeItem('jarvis-task-active'); } catch {}
    }
  }, [messages, chat, streamChat, resetStream, setMessages, getPageContextForInjection, toast, onMinimize, jarvisUnifiedContext]);

  // Submit from input field
  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim()) return;
    const message = inputValue;
    setInputValue('');

    await forkConversationIfBusy();
    await sendMessage(message);
  }, [inputValue, forkConversationIfBusy, sendMessage]);

  // Submit from suggestions / welcome / quick actions (with debounce)
  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    // Debounce: ignore rapid double-clicks (500ms)
    const now = Date.now();
    if (now - lastSendTimeRef.current < 500) return;
    lastSendTimeRef.current = now;

    setInputValue('');
    await forkConversationIfBusy();
    await sendMessage(message);
  }, [forkConversationIfBusy, sendMessage]);

  // Register chat handler in unified context for proactive nudge
  useEffect(() => {
    if (jarvisUnifiedContext?.registerChatHandler) {
      jarvisUnifiedContext.registerChatHandler(handleSendMessage as any);
    }
    return () => {
      if (jarvisUnifiedContext?.registerChatHandler) {
        jarvisUnifiedContext.registerChatHandler((() => {}) as any);
      }
    };
  }, [jarvisUnifiedContext, handleSendMessage]);

  // Process pending quick command from proactive nudge
  useEffect(() => {
    if (jarvisUnifiedContext?.pendingQuickCommand) {
      handleSendMessage(jarvisUnifiedContext.pendingQuickCommand);
      jarvisUnifiedContext.clearPendingQuickCommand?.();
    }
  }, [jarvisUnifiedContext?.pendingQuickCommand, handleSendMessage]);

  const handleVoiceToggle = useCallback(() => {
    setIsVoiceActive(prev => !prev);
  }, []);

  // Feedback handler - persist to database
  const handleFeedback = useCallback(async (messageId: string, type: 'positive' | 'negative' | 'report') => {
    await submitMessageFeedback(messageId, type);
  }, [submitMessageFeedback]);

  // Render tool call (for email preview)
  const renderToolCall = (toolCall: ToolCall) => {
    if (toolCall.name === 'send_email' && toolCall.status === 'requires_confirmation' && toolCall.arguments) {
      return (
        <JarvisEmailPreview
          key={toolCall.id}
          emailData={toolCall.arguments as { to: string; subject?: string; body: string; cc?: string[]; thread_id?: string }}
          onConfirm={() => confirmToolCall(toolCall.id)}
          onCancel={() => rejectToolCall(toolCall.id)}
          isConfirming={isConfirming}
        />
      );
    }
    return null;
  };

  // Recent conversations for welcome screen
  const recentConversations = conversations.slice(0, 3).map(c => ({
    id: c.id,
    title: c.title || 'Conversation sans titre',
    date: new Date(c.updated_at),
  }));

  const isProcessing = isTyping || isStreaming;

  return (
    <motion.div 
      className={cn(
        "h-full flex flex-col",
        "bg-gradient-to-b from-muted/10 via-background to-muted/15",
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Premium Glass Header */}
      <JarvisGlassHeader
        pendingCount={pendingCount}
        isTyping={isProcessing}
        isVoiceActive={isVoiceActive}
        connectionStatus="connected"
        onNewConversation={handleNewConversation}
        onOpenHistory={() => setShowHistory(true)}
        onOpenSettings={() => setShowSettings(true)}
        onToggleVoice={handleVoiceToggle}
        onClose={onClose}
      />

      {/* Messages area with premium scroll */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="min-h-full">
          {/* Skeleton loader during conversation loading */}
          {isLoadingConversation && (
            <JarvisSkeletonLoader variant="panel" />
          )}

          {/* Enhanced Welcome screen when no messages */}
          <AnimatePresence mode="wait">
            {messages.length === 0 && !isProcessing && !isLoadingConversation && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <JarvisEnhancedWelcome
                  userName={currentProfile?.prenom || currentProfile?.nom || 'Utilisateur'}
                  onSendMessage={handleSendMessage}
                  onLoadConversation={async (id) => {
                    setIsLoadingConversation(true);
                    try {
                      const loaded = await loadConversation(id);
                      if (loaded && loaded.length > 0) {
                        setMessages(loaded);
                      }
                    } finally {
                      setIsLoadingConversation(false);
                    }
                  }}
                  recentConversations={recentConversations}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages list with premium styling */}
          {messages.length > 0 && (
            <div className="px-4 py-4 space-y-4">
              <AnimatePresence mode="popLayout">
                {messages.map((message) => (
                  <motion.div 
                    key={message.id}
                    layout
                    initial={JARVIS_ANIMATIONS.fadeIn.initial}
                    animate={JARVIS_ANIMATIONS.fadeIn.animate}
                    exit={JARVIS_ANIMATIONS.fadeIn.exit}
                  >
                    {/* Check for email tool calls */}
                    {message.toolCalls && message.toolCalls.some(
                      tc => tc.name === 'send_email' && tc.status === 'requires_confirmation'
                    ) ? (
                      <div className="space-y-3">
                        {message.toolCalls.map(tc => renderToolCall(tc))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <JarvisPremiumMessage
                          role={message.role}
                          content={message.content}
                          timestamp={message.timestamp}
                          onFeedback={(type) => handleFeedback(message.id, type)}
                        onRegenerate={message.role === 'assistant' ? () => {
                            const idx = messages.findIndex(m => m.id === message.id);
                            if (idx > 0) {
                              const userMsg = messages[idx - 1];
                              if (userMsg.role === 'user') {
                                handleSendMessage(userMsg.content);
                              }
                            }
                          } : undefined}
                        />
                        {(() => {
                          const meta = (message as { metadata?: { failed?: boolean; retryMessage?: string } }).metadata;
                          return meta?.failed && meta?.retryMessage && (
                          <div className="flex justify-start pl-2">
                            <button
                              type="button"
                              onClick={() => {
                                // Remove the failed message and retry
                                setMessages(prev => prev.filter(m => m.id !== message.id));
                                handleSendMessage(meta.retryMessage!);
                              }}
                              className={cn(
                                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
                                "text-xs font-medium",
                                "bg-primary/10 text-primary hover:bg-primary/20",
                                "border border-primary/20",
                                "transition-colors"
                              )}
                            >
                              <span>↻</span>
                              <span>Réessayer</span>
                            </button>
                          </div>
                          );
                        })()}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Streaming message - instant mount/unmount, no AnimatePresence exit animation */}
              {isStreaming && (
                <JarvisStreamingMessage
                  content={streamingContent}
                  isStreaming={isStreaming}
                  isDone={streamingIsDone}
                  activeTools={activeTools}
                  reasoningSteps={reasoningSteps}
                />
              )}

              {/* Intelligent Thinking indicator (for non-streaming jarvis-brain calls) */}
              <AnimatePresence>
                {isTyping && !isStreaming && (
                  <JarvisIntelligentThinking 
                    variant="brain"
                  />
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Thinking/streaming indicator when no messages yet */}
          {messages.length === 0 && isProcessing && !isLoadingConversation && (
            <div className="px-4 py-4">
              {isStreaming ? (
                <JarvisStreamingMessage
                  content={streamingContent}
                  isStreaming={isStreaming}
                  isDone={streamingIsDone}
                  activeTools={activeTools}
                  reasoningSteps={reasoningSteps}
                />
              ) : (
                <JarvisIntelligentThinking variant="brain" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Separator shadow + Smart Input */}
      <div className="shadow-[0_-1px_3px_0_rgba(0,0,0,0.05)]">
      <JarvisSmartInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        onQuickAction={handleSendMessage}
        onVoiceToggle={handleVoiceToggle}
        isLoading={isProcessing}
        isVoiceActive={isVoiceActive}
        placeholder="Demandez-moi n'importe quoi..."
        showQuickSuggestions={messages.length === 0}
      />
      </div>

      {/* History sheet */}
      <JarvisHistorySheet open={showHistory} onOpenChange={setShowHistory} />
      
      {/* Settings sheet */}
      <JarvisSettingsSheet open={showSettings} onOpenChange={setShowSettings} />
    </motion.div>
  );
});
