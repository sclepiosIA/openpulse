/**
 * JarvisConversation - Interface de conversation avec Jarvis - Premium Immersive
 *
 * V3: Streaming temps réel + Actions contextuelles + Markdown
 */

import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import { debug } from '@/lib/debug'
import { Bot, User, Send, Copy, Check, RotateCcw, StopCircle, Keyboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/shared/useAuth'
import { useJarvisFeedback } from '@/hooks/jarvis/useJarvisFeedback'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { useToast } from '@/hooks/shared/use-toast'
import { useJarvisStreaming } from '@/hooks/jarvis/useJarvisStreaming'
import { useJarvisContextualActions } from '@/hooks/jarvis/useJarvisContextualActions'
import { useJarvisConversationPersistence } from '@/hooks/jarvis/useJarvisConversationPersistence'
import { JarvisThinkingIndicator } from './JarvisThinkingIndicator'
import { JarvisMessageFeedback } from './JarvisMessageFeedback'
import { JarvisCommandPalette } from './JarvisCommandPalette'
import { JarvisShortcutsHelp } from './JarvisShortcutsHelp'
import { JarvisEmailReference } from './JarvisEmailReference'
import ReactMarkdown from 'react-markdown'

// Pattern for detecting email references in Jarvis responses: [[email:UUID|title]]
const EMAIL_REF_PATTERN = /\[\[email:([a-f0-9-]+)\|([^\]]+)\]\]/g

// Helper to parse content and render email references
function renderMessageWithEmailRefs(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match
  let keyIndex = 0

  // Reset regex state
  EMAIL_REF_PATTERN.lastIndex = 0

  while ((match = EMAIL_REF_PATTERN.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${keyIndex++}`}>{content.slice(lastIndex, match.index)}</span>)
    }

    // Add the email reference component
    const [, threadId, title] = match
    parts.push(
      <JarvisEmailReference
        key={`email-${threadId}-${keyIndex++}`}
        threadId={threadId}
        title={title}
      />
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(<span key={`text-${keyIndex++}`}>{content.slice(lastIndex)}</span>)
  }

  return parts.length > 0 ? parts : [<span key="content">{content}</span>]
}

// Check if content contains email references
function hasEmailRefs(content: string): boolean {
  EMAIL_REF_PATTERN.lastIndex = 0
  return EMAIL_REF_PATTERN.test(content)
}

// Process React children to replace email refs with components
function processChildrenForEmailRefs(children: React.ReactNode): React.ReactNode {
  if (!children) return children

  // If it's an array, process each child
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === 'string' && hasEmailRefs(child)) {
        return (
          <React.Fragment key={`email-ref-fragment-${i}-${child.slice(0, 16)}`}>
            {renderMessageWithEmailRefs(child)}
          </React.Fragment>
        )
      }
      return child
    })
  }

  // If it's a string with email refs, process it
  if (typeof children === 'string' && hasEmailRefs(children)) {
    return <>{renderMessageWithEmailRefs(children)}</>
  }

  return children
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: Array<{
    titre: string
    base_type: string
  }>
}

interface JarvisConversationProps {
  onActionProposed?: () => void
  className?: string
}

export function JarvisConversation({ onActionProposed, className }: JarvisConversationProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: currentProfile } = useCurrentProfile()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Streaming hook
  const { isStreaming, currentContent, streamChat, cancelStream, resetStream } =
    useJarvisStreaming()

  // Contextual actions based on current route
  const { quickActions } = useJarvisContextualActions()
  const { submitMessageFeedback } = useJarvisFeedback()

  // Conversation persistence
  const {
    saveMessages,
    loadConversation,
    conversations,
    currentConversationId,
    createConversation,
    setCurrentConversation,
  } = useJarvisConversationPersistence()

  // Auto-scroll on new messages or streaming content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, currentContent])

  // Load most recent conversation on mount
  useEffect(() => {
    const loadRecent = async () => {
      if (conversations.length > 0 && !currentConversationId) {
        const recent = conversations[0]
        const loaded = await loadConversation(recent.id)
        if (loaded && loaded.length > 0) {
          setMessages(
            loaded.map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              timestamp: new Date(m.timestamp),
            }))
          )
        }
      }
    }
    if (user?.id) loadRecent()
  }, [user?.id, conversations, currentConversationId, loadConversation])

  // Save conversation when messages change
  useEffect(() => {
    const save = async () => {
      if (messages.length > 0 && user?.id) {
        let targetConversationId = currentConversationId

        // Create conversation if none exists
        if (!targetConversationId) {
          const newId = await createConversation()
          if (newId) {
            targetConversationId = newId
          }
        }

        // Save with the conversation ID directly
        if (targetConversationId) {
          await saveMessages(
            messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
            })),
            targetConversationId
          )
        }
      }
    }
    save()
  }, [messages, user?.id, currentConversationId, createConversation, saveMessages])

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!input.trim() || isStreaming || !user?.id) return

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: input.trim(),
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      const userInput = input.trim()
      setInput('')
      resetStream()

      try {
        // Build conversation history
        const history = messages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        }))

        // Stream the response
        const finalContent = await streamChat(userInput, history)

        if (finalContent) {
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: finalContent,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, assistantMessage])
          onActionProposed?.()
        }
      } catch (error) {
        debug.error('[JarvisConversation] Error:', error)
        toast({
          title: 'Erreur',
          description: 'Impossible de contacter Jarvis',
          variant: 'destructive',
        })

        // Retirer le message utilisateur en cas d'erreur
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
        setInput(userInput)
      }
    },
    [input, isStreaming, user?.id, messages, streamChat, resetStream, toast, onActionProposed]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (showCommandPalette) {
        setShowCommandPalette(false)
      } else {
        handleSubmit()
      }
    }
    if (e.key === 'Escape' && showCommandPalette) {
      e.preventDefault()
      setShowCommandPalette(false)
    }
  }

  // Handle input changes for command palette
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInput(value)

    // Show command palette when typing /
    if (value.startsWith('/') && !showCommandPalette) {
      setShowCommandPalette(true)
    } else if (!value.startsWith('/') && showCommandPalette) {
      setShowCommandPalette(false)
    }
  }

  // Handle command selection from palette
  const handleCommandSelect = (prompt: string) => {
    setInput(prompt)
    setShowCommandPalette(false)
    inputRef.current?.focus()
  }

  // Handle message feedback
  const handleFeedback = useCallback(
    (messageId: string, feedback: 'positive' | 'negative' | 'report') => {
      submitMessageFeedback(messageId, feedback)
    },
    [submitMessageFeedback]
  )

  const copyToClipboard = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const clearConversation = async () => {
    setMessages([])
    resetStream()
    setCurrentConversation(null)
    // Create a new conversation for the next session
  }

  // Handle quick action - directly send the message
  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || isStreaming || !user?.id) return

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: prompt.trim(),
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      resetStream()

      try {
        const history = messages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const finalContent = await streamChat(prompt.trim(), history)

        if (finalContent) {
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: finalContent,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, assistantMessage])
          onActionProposed?.()
        }
      } catch (error) {
        debug.error('[JarvisConversation] Quick action error:', error)
        toast({
          title: 'Erreur',
          description: 'Impossible de contacter Jarvis',
          variant: 'destructive',
        })
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
      }
    },
    [isStreaming, user?.id, messages, streamChat, resetStream, toast, onActionProposed]
  )

  const handleQuickAction = useCallback(
    (prompt: string) => {
      setInput(prompt)
      sendMessage(prompt)
    },
    [sendMessage]
  )

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages */}
      <ScrollArea className="flex-1 px-5 py-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && !isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-10 space-y-6"
            >
              <div>
                <h4 className="font-semibold text-xl">
                  Bonjour{currentProfile?.prenom ? `, ${currentProfile.prenom}` : ''} 👋
                </h4>
                <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                  Posez une question ou choisissez une action rapide ci-dessous
                </p>
              </div>

              {/* Glassmorphism Quick Actions Grid */}
              <div className="grid grid-cols-2 gap-3 pt-4 max-w-md mx-auto">
                {quickActions.slice(0, 4).map((action, i) => (
                  <motion.button
                    key={action.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'group flex items-center gap-3 p-4 rounded-2xl text-left',
                      'bg-gradient-to-br from-muted/50 to-muted/20 backdrop-blur-sm',
                      'border border-border/50 hover:border-primary/30',
                      'shadow-md hover:shadow-xl hover:shadow-primary/10',
                      'transition-all duration-300'
                    )}
                    onClick={() => handleQuickAction(action.prompt)}
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">
                      {action.icon}
                    </span>
                    <span className="text-sm font-medium">{action.label}</span>
                  </motion.button>
                ))}
              </div>

              {/* Static suggestions as fallback */}
              {quickActions.length === 0 && (
                <div className="grid grid-cols-2 gap-3 pt-4 max-w-md mx-auto">
                  {[
                    {
                      label: '📧 Résumer emails',
                      prompt: 'Résume mes emails non lus importants',
                      color: 'from-emerald-500/20 to-emerald-600/10',
                    },
                    {
                      label: '✅ Mes priorités',
                      prompt: "Quelles sont mes tâches prioritaires aujourd'hui ?",
                      color: 'from-amber-500/20 to-amber-600/10',
                    },
                    {
                      label: '🎫 Tickets urgents',
                      prompt: 'Y a-t-il des tickets support nécessitant mon attention ?',
                      color: 'from-red-500/20 to-red-600/10',
                    },
                    {
                      label: '📊 État du jour',
                      prompt: 'Fais-moi un résumé de mon activité du jour',
                      color: 'from-blue-500/20 to-blue-600/10',
                    },
                  ].map((suggestion, i) => (
                    <motion.button
                      key={`suggestion-${suggestion.prompt.slice(0, 20)}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        'group flex items-center gap-3 p-4 rounded-2xl text-left',
                        'bg-gradient-to-br backdrop-blur-sm',
                        'border border-border/50 hover:border-primary/30',
                        'shadow-md hover:shadow-xl hover:shadow-primary/10',
                        'transition-all duration-300',
                        suggestion.color
                      )}
                      onClick={() => handleQuickAction(suggestion.prompt)}
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">
                        {suggestion.label.split(' ')[0]}
                      </span>
                      <span className="text-sm font-medium">
                        {suggestion.label.slice(suggestion.label.indexOf(' ') + 1)}
                      </span>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.02 }}
                className={cn('flex gap-3 group', message.role === 'user' && 'flex-row-reverse')}
              >
                <div
                  className={cn(
                    'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ring-1',
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-primary to-primary/90 ring-primary/30'
                      : 'bg-gradient-to-br from-primary/15 to-primary/5 ring-primary/20'
                  )}
                >
                  {message.role === 'user' ? (
                    <User className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <Bot className="h-4 w-4 text-primary" />
                  )}
                </div>

                <div
                  className={cn(
                    'flex-1 max-w-[85%] space-y-2',
                    message.role === 'user' && 'flex flex-col items-end'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-3 text-sm shadow-sm',
                      message.role === 'user'
                        ? 'bg-gradient-to-br from-primary to-primary/90 text-white rounded-tr-md'
                        : 'bg-card border border-border/50 rounded-tl-md'
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => {
                              // Handle email references within paragraphs
                              const processedChildren = processChildrenForEmailRefs(children)
                              return (
                                <p className="mb-2 last:mb-0 leading-relaxed">
                                  {processedChildren}
                                </p>
                              )
                            },
                            strong: ({ children }) => (
                              <strong className="font-semibold text-foreground">{children}</strong>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
                            ),
                            li: ({ children }) => {
                              const processedChildren = processChildrenForEmailRefs(children)
                              return <li className="leading-relaxed">{processedChildren}</li>
                            },
                            code: ({ children }) => (
                              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                                {children}
                              </code>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed text-white">
                        {message.content}
                      </p>
                    )}
                  </div>

                  {/* Sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {message.sources.map((source, i) => (
                        <span
                          key={`source-${message.id}-${source.titre}-${i}`}
                          className={cn(
                            'text-[10px] px-2 py-1 rounded-full border',
                            source.base_type === 'solution'
                              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          )}
                        >
                          {source.titre}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs hover:bg-muted/50"
                        onClick={() => copyToClipboard(message.content, message.id)}
                      >
                        {copiedId === message.id ? (
                          <>
                            <Check className="h-3 w-3 mr-1 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Copié</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copier
                          </>
                        )}
                      </Button>
                      <JarvisMessageFeedback messageId={message.id} onFeedback={handleFeedback} />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Streaming/Thinking indicator */}
          {isStreaming && (
            <JarvisThinkingIndicator isStreaming={isStreaming} streamingContent={currentContent} />
          )}
        </div>
      </ScrollArea>

      {/* Clear button */}
      {messages.length > 0 && (
        <div className="px-4 py-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
            onClick={clearConversation}
          >
            <RotateCcw className="h-3 w-3 mr-1.5" />
            Nouvelle conversation
          </Button>
        </div>
      )}

      {/* Premium Input Area */}
      <form
        onSubmit={handleSubmit}
        className="p-5 border-t border-border/30 bg-gradient-to-t from-muted/50 to-transparent"
      >
        <div className="flex gap-3 items-end relative">
          {/* Command Palette */}
          <JarvisCommandPalette
            isOpen={showCommandPalette}
            searchQuery={input}
            onSelect={handleCommandSelect}
            onClose={() => setShowCommandPalette(false)}
          />

          <div className="flex-1 relative group">
            {/* Animated gradient border on focus */}
            <motion.div
              className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-primary/50 via-primary/30 to-primary/50 blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: isFocused ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            />
            <Textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                setIsFocused(false)
                // Delay closing palette to allow click
                setTimeout(() => setShowCommandPalette(false), 200)
              }}
              placeholder="Tapez / pour les commandes ou posez une question..."
              className="relative min-h-[52px] max-h-32 resize-none rounded-xl bg-card border-border/50 focus-visible:ring-0 focus-visible:border-transparent pr-4 shadow-sm"
              rows={1}
              disabled={isStreaming}
            />

            {/* Character count */}
            {input.length > 0 && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute right-3 bottom-2 text-[10px] text-muted-foreground/50"
              >
                {input.length}
              </motion.span>
            )}
          </div>

          {isStreaming ? (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="shrink-0 h-[52px] w-[52px] rounded-xl shadow-lg"
                onClick={cancelStream}
                aria-label="Arrêter"
              >
                <StopCircle className="h-5 w-5" />
              </Button>
            </motion.div>
          ) : (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || showCommandPalette}
                className={cn(
                  'shrink-0 h-[52px] w-[52px] rounded-xl transition-colors',
                  input.trim() && !showCommandPalette ? 'bg-primary hover:bg-primary/90' : ''
                )}
                aria-label="Envoyer"
              >
                <Send className="h-5 w-5" />
              </Button>
            </motion.div>
          )}
        </div>

        {/* Keyboard hint with shortcuts help */}
        <div className="flex items-center justify-center gap-3 mt-3">
          <p className="text-[10px] text-muted-foreground/60">
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-mono">⌘J</kbd> ouvrir •
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-mono ml-1">/</kbd>{' '}
            commandes •
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-mono ml-1">↵</kbd>{' '}
            envoyer
          </p>
          <JarvisShortcutsHelp />
        </div>
      </form>
    </div>
  )
}
