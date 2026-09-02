/**
 * JarvisApplePanel - Panel principal style Apple (v13.0)
 * 
 * Interface minimaliste, animations fluides, UX premium
 * Inspiré d'iMessage et des apps Apple natives
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useJarvisFeedback } from '@/hooks/jarvis/useJarvisFeedback';
import { AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useJarvis } from '@/hooks/jarvis/useJarvis';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { useJarvisConversationPersistence } from '@/hooks/jarvis/useJarvisConversationPersistence';
import { JarvisAppleHeader } from './JarvisAppleHeader';
import { JarvisAppleWelcome } from './JarvisAppleWelcome';
import { JarvisAppleInput } from './JarvisAppleInput';
import { JarvisAppleMessage } from './JarvisAppleMessage';
import { JarvisAppleThinking } from './JarvisAppleThinking';
import { JarvisHistorySheet } from './JarvisHistorySheet';
import { JarvisEmailPreview } from './JarvisEmailPreview';
import type { ToolCall } from '@/types/jarvis';

interface JarvisApplePanelProps {
  onClose?: () => void;
  className?: string;
}

export function JarvisApplePanel({ onClose, className }: JarvisApplePanelProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: currentProfile } = useCurrentProfile();
  const { submitMessageFeedback } = useJarvisFeedback();

  const {
    pendingCount,
    messages,
    setMessages,
    isTyping,
    chat,
    clearChat,
    confirmToolCall,
    rejectToolCall,
    isConfirming,
  } = useJarvis();

  const {
    saveMessages,
    loadConversation,
    conversations,
    currentConversationId,
    createConversation,
  } = useJarvisConversationPersistence();

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Load most recent conversation on mount
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    const loadRecent = async () => {
      if (hasLoadedRef.current || messages.length > 0 || conversations.length === 0) return;
      hasLoadedRef.current = true;

      const recent = conversations[0];
      const loaded = await loadConversation(recent.id);
      if (loaded && loaded.length > 0) {
        setMessages(loaded);
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
  }, [currentConversationId, messages, saveMessages, createConversation, clearChat]);

  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || isTyping) return;
    const message = inputValue;
    setInputValue('');
    await chat(message);
  }, [inputValue, isTyping, chat]);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isTyping) return;
    await chat(message);
  }, [isTyping, chat]);

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

  return (
    <div className={cn(
      "h-full flex flex-col bg-background",
      className
    )}>
      {/* Minimal Header */}
      <JarvisAppleHeader
        pendingCount={pendingCount}
        isTyping={isTyping}
        onNewConversation={handleNewConversation}
        onOpenHistory={() => setShowHistory(true)}
        onClose={onClose}
      />

      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="min-h-full">
          {/* Welcome screen when no messages */}
          {messages.length === 0 && !isTyping && (
            <JarvisAppleWelcome
              userName={currentProfile?.prenom || currentProfile?.nom || 'Utilisateur'}
              onSendMessage={handleSendMessage}
            />
          )}

          {/* Messages list */}
          {messages.length > 0 && (
            <div className="px-4 py-4 space-y-3">
              <AnimatePresence mode="popLayout">
                {messages.map((message) => (
                  <div key={message.id}>
                    {/* Check for email tool calls */}
                    {message.toolCalls && message.toolCalls.some(
                      tc => tc.name === 'send_email' && tc.status === 'requires_confirmation'
                    ) ? (
                      <div className="space-y-3">
                        {message.toolCalls.map(tc => renderToolCall(tc))}
                      </div>
                    ) : (
                      <JarvisAppleMessage
                        role={message.role}
                        content={message.content}
                        timestamp={message.timestamp}
                        onFeedback={(type) => {
                          submitMessageFeedback(message.id, type);
                        }}
                        onRegenerate={message.role === 'assistant' ? () => {
                          const idx = messages.findIndex(m => m.id === message.id);
                          if (idx > 0) {
                            const userMsg = messages[idx - 1];
                            if (userMsg.role === 'user') {
                              chat(userMsg.content);
                            }
                          }
                        } : undefined}
                      />
                    )}
                  </div>
                ))}
              </AnimatePresence>

              {/* Thinking indicator */}
              <AnimatePresence>
                {isTyping && <JarvisAppleThinking />}
              </AnimatePresence>
            </div>
          )}

          {/* Thinking indicator when no messages yet */}
          {messages.length === 0 && isTyping && (
            <div className="px-4 py-4">
              <JarvisAppleThinking />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <JarvisAppleInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        isLoading={isTyping}
        placeholder="Message Jarvis..."
      />

      {/* History sheet */}
      <JarvisHistorySheet open={showHistory} onOpenChange={setShowHistory} />
    </div>
  );
}
