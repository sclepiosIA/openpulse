/**
 * JarvisAssistantPanel - JARVIS 12.5 Interface Ultra Premium
 *
 * Refonte complète UI/UX avec:
 * - WelcomeScreen immersif avec animations cinématiques
 * - MessageBubble enrichies avec actions inline
 * - Mode immersif plein écran
 * - Transitions fluides et micro-interactions premium
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { debug } from '@/lib/debug'
import {
  Settings,
  MessageSquare,
  ListTodo,
  FileText,
  BarChart3,
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
  Database,
  Mail,
  Calendar,
  Search,
  AlertTriangle,
  Users,
} from 'lucide-react'
import { JarvisAssistantPanelHeader } from './JarvisAssistantPanelHeader'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvis } from '@/hooks/jarvis/useJarvis'
import { useJarvisStreaming } from '@/hooks/jarvis/useJarvisStreaming'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { useJarvisFocus } from '@/hooks/jarvis/useJarvisFocus'
import { useToast } from '@/hooks/shared/use-toast'
import { invokeEdge } from '@/services/edgeFunctions'
import { JarvisActionCard } from './JarvisActionCard'
import { JarvisVoiceInterface } from './JarvisVoiceInterface'
import { JarvisSettingsContent } from './JarvisSettingsContent'
import { JarvisHistorySheet } from './JarvisHistorySheet'
import { JarvisModifyDialog } from './JarvisModifyDialog'
import { JarvisTemplates } from './JarvisTemplates'
import { JarvisAnalyticsDashboard } from './JarvisAnalyticsDashboard'
import { JarvisFocusIndicator } from './JarvisFocusIndicator'
import { JarvisProactiveSuggestions } from './JarvisProactiveSuggestions'
import { JarvisEmailPreview } from './JarvisEmailPreview'
import { JarvisTeamPanel } from './JarvisTeamPanel'

import { JarvisEnhancedInput } from './JarvisEnhancedInput'
import { JarvisTypingIndicator } from './JarvisSkeletonLoader'
import { JarvisWelcomeScreen } from './JarvisWelcomeScreen'
import { JarvisMessageBubble } from './JarvisMessageBubble'
import { JarvisStreamingMessage } from './JarvisStreamingMessage'

import { StaggerList, StaggerItem } from './JarvisTransitions'
import { useJarvisConversationPersistence } from '@/hooks/jarvis/useJarvisConversationPersistence'
import { useJarvisUnifiedOptional } from '@/contexts/JarvisUnifiedContext'

import { useJarvisFeedback } from '@/hooks/jarvis/useJarvisFeedback'
import { useShouldAnimateLight } from '@/hooks/ui/useShouldAnimate'

import type { JarvisPendingAction, ToolCall } from '@/types/jarvis'
import jarvisLogo from '@/assets/jarvis-logo.png'

interface JarvisAssistantPanelProps {
  onClose?: () => void
  className?: string
}

// Tool icon mapping
const getToolIcon = (toolName: string) => {
  switch (toolName) {
    case 'query_database':
      return Database
    case 'send_email':
      return Mail
    case 'schedule_meeting':
    case 'create_task':
      return Calendar
    case 'search_knowledge_base':
      return Search
    default:
      return Zap
  }
}

// Tab configuration - JARVIS 12.0 avec Team multi-agent
const TABS = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'actions', label: 'Actions', icon: ListTodo },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'analytics', label: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Paramètres', icon: Settings },
]

export function JarvisAssistantPanel({ onClose, className }: JarvisAssistantPanelProps) {
  const shouldAnimate = useShouldAnimateLight()
  const [showHistory, setShowHistory] = useState(false)
  const [modifyingAction, setModifyingAction] = useState<JarvisPendingAction | null>(null)
  const [activeTab, setActiveTab] = useState('chat')
  const [inputValue, setInputValue] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [isImmersive, setIsImmersive] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Récupérer le profil de l'utilisateur courant
  const { data: currentProfile } = useCurrentProfile()
  const { submitMessageFeedback } = useJarvisFeedback()

  const {
    isEnabled,
    pendingActions,
    pendingCount,
    approveAction,
    modifyAction,
    rejectAction,
    messages,
    setMessages,
    isTyping,
    chat,
    getPageContextForInjection,
    clearChat,
    confirmToolCall,
    rejectToolCall,
    isConfirming,
  } = useJarvis()

  // Streaming hook for progressive token display
  const {
    isStreaming: isStreamingActive,
    currentContent: streamingContent,
    activeTools: streamingTools,
    streamChat,
    resetStream,
  } = useJarvisStreaming()

  // Ref to hold latest handleQuickAction (defined later) for use in effects
  const quickActionRef = useRef<(prompt: string) => void>(() => {})

  // Connexion au contexte unifié pour les quick actions du nudge
  const jarvisUnifiedContext = useJarvisUnifiedOptional()

  // Enregistrer le handler de chat dans le contexte unifié
  useEffect(() => {
    if (jarvisUnifiedContext?.registerChatHandler) {
      jarvisUnifiedContext.registerChatHandler(async (msg: string) => {
        quickActionRef.current(msg)
      })
    }
  }, [jarvisUnifiedContext])

  // Exécuter la commande pendante quand le panel s'ouvre
  useEffect(() => {
    if (jarvisUnifiedContext?.pendingQuickCommand) {
      const command = jarvisUnifiedContext.pendingQuickCommand
      jarvisUnifiedContext.clearPendingQuickCommand()
      setTimeout(() => {
        quickActionRef.current(command)
      }, 100)
    }
  }, [jarvisUnifiedContext?.pendingQuickCommand, jarvisUnifiedContext?.clearPendingQuickCommand])

  // Conversation persistence
  const {
    saveMessages,
    loadConversation,
    conversations,
    currentConversationId,
    createConversation,
  } = useJarvisConversationPersistence()

  const { hasFocus } = useJarvisFocus()

  // Auto-scroll on new messages or streaming content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingContent])

  // Load most recent conversation on mount
  const hasLoadedRef = useRef(false)
  useEffect(() => {
    const loadRecent = async () => {
      if (hasLoadedRef.current || messages.length > 0 || conversations.length === 0) return
      hasLoadedRef.current = true

      const recent = conversations[0]
      const loaded = await loadConversation(recent.id)
      if (loaded && loaded.length > 0) {
        setMessages(loaded)
      }
    }
    loadRecent()
  }, [conversations, messages.length, loadConversation, setMessages])

  // Auto-save messages when they change (debounced)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (messages.length === 0) return

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce save to avoid too many writes
    saveTimeoutRef.current = setTimeout(async () => {
      let targetId = currentConversationId
      if (!targetId) {
        targetId = await createConversation()
      }
      if (targetId) {
        await saveMessages(messages, targetId)
      }
    }, 1000) // 1 second debounce

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [messages, currentConversationId, createConversation, saveMessages])

  // Handle new conversation - archive old one and create new
  const handleNewConversation = useCallback(async () => {
    // Save current conversation before clearing
    if (currentConversationId && messages.length > 0) {
      await saveMessages(messages, currentConversationId)
    }
    // Create a new conversation
    await createConversation()
    clearChat()
    resetStream()
  }, [currentConversationId, messages, saveMessages, createConversation, clearChat, resetStream])

  // Trigger proactive scan manually
  const triggerProactiveScan = useCallback(async () => {
    if (isScanning) return
    setIsScanning(true)

    toast({
      title: '🔍 Analyse en cours...',
      description: 'Jarvis recherche des actions à vous proposer',
    })

    try {
      await invokeEdge('jarvis-proactive-scan')

      toast({
        title: '✅ Analyse terminée',
        description: 'Les nouvelles suggestions apparaîtront sous peu',
      })
    } catch (error) {
      debug.error('[JarvisAssistantPanel] Proactive scan error:', error)
      toast({
        title: '❌ Erreur',
        description: "Impossible de lancer l'analyse proactive",
        variant: 'destructive',
      })
    } finally {
      setIsScanning(false)
    }
  }, [isScanning, toast])

  // Handle chat submission - use streaming for progressive display
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!inputValue.trim() || isTyping || isStreamingActive) return

      const message = inputValue
      setInputValue('')

      // Add user message immediately
      const userMsg = {
        id: `user-${Date.now()}`,
        role: 'user' as const,
        content: message,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])

      // Build conversation history from existing messages
      const history = messages.map((m) => ({ role: m.role, content: m.content }))

      // Get page context for intelligent responses
      const pageContext = getPageContextForInjection()

      // Stream the response
      resetStream()
      const result = await streamChat(message, history, pageContext)

      // Add the completed response to messages
      if (result) {
        const assistantMsg = {
          id: `assistant-${Date.now()}`,
          role: 'assistant' as const,
          content: result,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMsg])
        resetStream()
      }
    },
    [
      inputValue,
      isTyping,
      isStreamingActive,
      messages,
      setMessages,
      streamChat,
      resetStream,
      getPageContextForInjection,
    ]
  )

  // Handle voice command
  const handleVoiceCommand = useCallback(
    async (command: string) => {
      setInputValue('')
      // Trigger submit programmatically
      const userMsg = {
        id: `user-${Date.now()}`,
        role: 'user' as const,
        content: command,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const pageContext = getPageContextForInjection()
      resetStream()
      const result = await streamChat(command, history, pageContext)
      if (result) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant' as const,
            content: result,
            timestamp: new Date(),
          },
        ])
        resetStream()
      }
    },
    [messages, setMessages, streamChat, resetStream, getPageContextForInjection]
  )

  // Handle quick action buttons - directly send the message
  const handleQuickAction = useCallback(
    async (prompt: string) => {
      setInputValue('')
      const userMsg = {
        id: `user-${Date.now()}`,
        role: 'user' as const,
        content: prompt,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const pageContext = getPageContextForInjection()
      resetStream()
      const result = await streamChat(prompt, history, pageContext)
      if (result) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant' as const,
            content: result,
            timestamp: new Date(),
          },
        ])
        resetStream()
      }
    },
    [messages, setMessages, streamChat, resetStream, getPageContextForInjection]
  )

  // Keep ref in sync for unified context effects
  useEffect(() => {
    quickActionRef.current = handleQuickAction
  }, [handleQuickAction])

  const handleModify = (actionId: string) => {
    const action = pendingActions.find((a) => a.id === actionId)
    if (action) {
      setModifyingAction(action)
    }
  }

  const handleSaveAndApprove = async (actionId: string, modifications: Record<string, unknown>) => {
    await modifyAction(actionId, modifications)
    setModifyingAction(null)
  }

  // Render tool call badge with prominent confirmation buttons
  // For send_email with requires_confirmation, show full email preview
  const renderToolCall = (toolCall: ToolCall) => {
    const Icon = getToolIcon(toolCall.name)
    const statusColor =
      toolCall.status === 'completed'
        ? 'text-emerald-600 dark:text-emerald-400'
        : toolCall.status === 'failed'
          ? 'text-destructive'
          : toolCall.status === 'requires_confirmation'
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-primary'

    const isConfirmationRequired = toolCall.status === 'requires_confirmation'

    // Special handling for send_email with confirmation required - show full preview
    if (toolCall.name === 'send_email' && isConfirmationRequired && toolCall.arguments) {
      return (
        <JarvisEmailPreview
          key={toolCall.id}
          emailData={
            toolCall.arguments as {
              to: string
              subject?: string
              body: string
              cc?: string[]
              thread_id?: string
            }
          }
          onConfirm={() => confirmToolCall(toolCall.id)}
          onCancel={() => rejectToolCall(toolCall.id)}
          isConfirming={isConfirming}
        />
      )
    }

    // Default rendering for other tools
    return (
      <motion.div
        key={toolCall.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'flex flex-col gap-2 p-3 rounded-xl text-sm border',
          isConfirmationRequired
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-muted/50 border-border/50'
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', statusColor)} />
          <span className="font-medium text-foreground">{toolCall.name.replace(/_/g, ' ')}</span>
          {toolCall.status === 'executing' && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
          {toolCall.status === 'completed' && (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          )}
          {toolCall.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
        </div>

        {/* Prominent confirmation buttons for sensitive actions */}
        {isConfirmationRequired && (
          <div className="flex gap-2 mt-1">
            <Button
              size="sm"
              className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50"
              onClick={() => confirmToolCall(toolCall.id)}
              disabled={isConfirming}
            >
              {isConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmer l'envoi
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => rejectToolCall(toolCall.id)}
              disabled={isConfirming}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Annuler
            </Button>
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <div
      className={cn(
        'h-full flex flex-col overflow-hidden bg-gradient-to-b from-background via-background to-muted/20',
        className
      )}
    >
      <JarvisAssistantPanelHeader
        shouldAnimate={shouldAnimate}
        isEnabled={isEnabled}
        pendingCount={pendingCount}
        isImmersive={isImmersive}
        setIsImmersive={setIsImmersive}
        isScanning={isScanning}
        triggerProactiveScan={triggerProactiveScan}
        handleNewConversation={handleNewConversation}
        setShowHistory={setShowHistory}
        onClose={onClose}
        tabs={TABS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Focus Indicator */}
      {hasFocus && (
        <div className="mx-5 mt-4">
          <JarvisFocusIndicator compact />
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 px-5 py-4" ref={scrollRef}>
              <div className="space-y-4">
                {/* Welcome Screen with animations */}
                {messages.length === 0 && (
                  <JarvisWelcomeScreen
                    userName={currentProfile?.prenom || currentProfile?.nom || 'Utilisateur'}
                    onAction={handleQuickAction}
                  />
                )}

                {/* Chat messages with new MessageBubble component */}
                <StaggerList className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {messages.map((message) => (
                      <StaggerItem key={message.id}>
                        {/* Tool calls rendering for email preview */}
                        {message.toolCalls &&
                        message.toolCalls.some(
                          (tc) => tc.name === 'send_email' && tc.status === 'requires_confirmation'
                        ) ? (
                          <div className="space-y-3">
                            {message.toolCalls.map((tc) => renderToolCall(tc))}
                          </div>
                        ) : (
                          <JarvisMessageBubble
                            role={message.role}
                            content={message.content}
                            timestamp={message.timestamp}
                            onFeedback={(type) => {
                              submitMessageFeedback(message.id, type)
                            }}
                            onRegenerate={
                              message.role === 'assistant'
                                ? () => {
                                    // Get the previous user message and regenerate
                                    const idx = messages.findIndex((m) => m.id === message.id)
                                    if (idx > 0) {
                                      const userMsg = messages[idx - 1]
                                      if (userMsg.role === 'user') {
                                        handleQuickAction(userMsg.content)
                                      }
                                    }
                                  }
                                : undefined
                            }
                          />
                        )}

                        {/* Only show tool calls that require user confirmation */}
                        {message.toolCalls &&
                          message.toolCalls.filter((tc) => tc.status === 'requires_confirmation')
                            .length > 0 && (
                            <div className="ml-12 mt-2 space-y-2">
                              {message.toolCalls
                                .filter((tc) => tc.status === 'requires_confirmation')
                                .map((tc) => renderToolCall(tc))}
                            </div>
                          )}
                      </StaggerItem>
                    ))}
                  </AnimatePresence>
                </StaggerList>

                {/* Streaming message - shows progressive content */}
                {isStreamingActive && (
                  <JarvisStreamingMessage
                    content={streamingContent}
                    isStreaming={true}
                    activeTools={streamingTools}
                  />
                )}

                {/* Legacy typing indicator (fallback for non-streaming calls) */}
                {isTyping && !isStreamingActive && <JarvisTypingIndicator className="px-2" />}
              </div>
            </ScrollArea>

            {/* Premium Input Area with Enhanced Input */}
            <div className="p-5 pt-3 border-t border-border/30 bg-gradient-to-t from-muted/30 to-transparent">
              <JarvisEnhancedInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmit}
                isLoading={isTyping || isStreamingActive}
                placeholder="Demandez n'importe quoi... (/ pour commandes)"
              />

              {/* Footer actions */}
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-muted-foreground/60">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-mono">⌘J</kbd>{' '}
                  ouvrir ·
                  <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono mx-1">/</kbd>{' '}
                  commandes
                </p>
                <div className="flex items-center gap-2">
                  <JarvisVoiceInterface
                    onCommand={handleVoiceCommand}
                    className="scale-75 opacity-60 hover:opacity-100 transition-opacity"
                  />
                  {messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      onClick={handleNewConversation}
                    >
                      Nouvelle conversation
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Team Tab - Multi-Agent JARVIS 12.0 */}
        {activeTab === 'team' && (
          <div className="flex-1 overflow-hidden">
            <JarvisTeamPanel className="h-full" onOpenSettings={() => setActiveTab('settings')} />
          </div>
        )}

        {/* Actions Tab */}
        {activeTab === 'actions' && (
          <ScrollArea className="flex-1">
            <div className="p-5 space-y-4">
              <JarvisProactiveSuggestions
                onAskJarvis={async (prompt) => {
                  handleQuickAction(prompt)
                }}
                maxSuggestions={3}
              />

              {pendingActions.length === 0 && (
                <div className="text-center py-12">
                  <motion.div
                    className="inline-flex items-center justify-center p-5 rounded-3xl bg-emerald-500/10 ring-1 ring-emerald-500/20 mb-4"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  </motion.div>
                  <p className="text-muted-foreground font-medium">Aucune action en attente</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">Tout est sous contrôle ✨</p>
                </div>
              )}

              <AnimatePresence mode="popLayout">
                {pendingActions.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Actions en attente
                    </h4>

                    {pendingActions.map((action, index) => (
                      <motion.div
                        key={action.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ delay: index * 0.05 }}
                        layout
                      >
                        <JarvisActionCard
                          action={action}
                          onApprove={approveAction}
                          onReject={rejectAction}
                          onModify={handleModify}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="flex-1 overflow-hidden">
            <JarvisTemplates />
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="flex-1 overflow-hidden">
            <JarvisAnalyticsDashboard />
          </div>
        )}

        {/* Settings Tab - Integrated directly instead of Sheet */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-hidden">
            <JarvisSettingsContent />
          </div>
        )}
      </div>

      {/* Sheets and dialogs */}
      <JarvisHistorySheet open={showHistory} onOpenChange={setShowHistory} />
      <JarvisModifyDialog
        action={modifyingAction}
        open={!!modifyingAction}
        onOpenChange={(open) => !open && setModifyingAction(null)}
        onSaveAndApprove={handleSaveAndApprove}
      />
    </div>
  )
}
