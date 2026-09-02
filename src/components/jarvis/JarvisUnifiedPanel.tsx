/**
 * JarvisUnifiedPanel - Interface Unifiée JARVIS 6.0
 *
 * Fusionne les modes Solo et Team en une interface unique premium
 * avec transitions fluides, avatars animés et navigation gestuelle.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Bot, Users, Settings, Send, Loader2, Coffee, Trash2, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvis } from '@/hooks/jarvis/useJarvis'
import { useJarvisTeam, AGENT_METADATA } from '@/hooks/jarvis/useJarvisTeam'
import { useJarvisGestures } from '@/hooks/jarvis/useJarvisGestures'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { useJarvisFocus } from '@/hooks/jarvis/useJarvisFocus'

import { JarvisActionsTab } from './JarvisActionsTab'
import { JarvisVoiceInterface } from './JarvisVoiceInterface'
import { JarvisSettingsContent } from './JarvisSettingsContent'
import { JarvisHistorySheet } from './JarvisHistorySheet'
import { JarvisModifyDialog } from './JarvisModifyDialog'
import { JarvisTemplates } from './JarvisTemplates'
import { JarvisAnalyticsDashboard } from './JarvisAnalyticsDashboard'
import { JarvisFocusIndicator } from './JarvisFocusIndicator'

import { JarvisThinkingIndicator } from './JarvisThinkingIndicator'
import { JarvisAgentAvatar } from './JarvisAgentAvatar'
import { JarvisWorkflowPanel } from './JarvisWorkflowPanel'
import { JarvisPredictionsPanel } from './JarvisPredictionsPanel'
import { JarvisPerformanceWidget } from './JarvisPerformanceWidget'
import { JarvisSmartBriefing } from './JarvisSmartBriefing'
import { JarvisProductivityScore } from './JarvisProductivityScore'
import { JarvisCollectiveInsights } from './JarvisCollectiveInsights'
import { JarvisChallenges } from './JarvisChallenges'
import type { JarvisPendingAction } from '@/types/jarvis'
import type { AgentId } from '@/types/jarvis-agents'
import type { UnifiedMode } from '@/types/jarvis-v6'
import jarvisLogo from '@/assets/jarvis-logo.png'
import { TABS } from './JarvisUnifiedPanel.constants'
import { ToolCallCard, TeamMessage } from './JarvisUnifiedPanel.renderers'
import { JarvisUnifiedPanelHeader } from './JarvisUnifiedPanelHeader'

interface JarvisUnifiedPanelProps {
  onClose?: () => void
  className?: string
  defaultMode?: UnifiedMode
}

export function JarvisUnifiedPanel({
  onClose,
  className,
  defaultMode = 'solo',
}: JarvisUnifiedPanelProps) {
  const [showHistory, setShowHistory] = useState(false)
  const [modifyingAction, setModifyingAction] = useState<JarvisPendingAction | null>(null)
  const [activeTab, setActiveTab] = useState(defaultMode === 'team' ? 'team' : 'chat')
  const [inputValue, setInputValue] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<AgentId | undefined>()
  const [unifiedMode, setUnifiedMode] = useState<UnifiedMode>(defaultMode)

  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Hooks
  const { data: currentProfile } = useCurrentProfile()
  const { hasFocus } = useJarvisFocus()

  // Solo mode (classic Jarvis)
  const {
    isEnabled,
    pendingActions,
    pendingCount,
    approveAction,
    modifyAction,
    rejectAction,
    messages,
    isTyping,
    chat,
    clearChat,
    confirmToolCall,
    rejectToolCall,
    isConfirming,
  } = useJarvis()

  // Team mode (multi-agent)
  const {
    teamState,
    isProcessing,
    enabledAgents,
    sendToTeam,
    sendToAgent,
    requestStandup,
    clearConversation,
    getAgentMeta,
  } = useJarvisTeam()

  // Gesture navigation
  const { activeGesture, swipeDistance, longPressProgress } = useJarvisGestures({
    containerRef,
    enabledAgents,
    currentAgent: selectedAgent,
    onAgentChange: setSelectedAgent,
    onRefresh: () => {
      if (activeTab === 'team') {
        requestStandup()
      }
    },
    onQuickAction: () => {
      // Toggle between solo and team mode
      setUnifiedMode((prev) => (prev === 'solo' ? 'team' : 'solo'))
      setActiveTab((prev) => (prev === 'chat' ? 'team' : 'chat'))
    },
  })

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, teamState.conversationHistory])

  // Sync tab with mode
  useEffect(() => {
    if (unifiedMode === 'team' && activeTab === 'chat') {
      setActiveTab('team')
    } else if (unifiedMode === 'solo' && activeTab === 'team') {
      setActiveTab('chat')
    }
  }, [unifiedMode])

  // Handle chat submission (solo mode)
  const handleSoloSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!inputValue.trim() || isTyping) return

      const message = inputValue
      setInputValue('')

      await chat(message)
    },
    [inputValue, isTyping, chat]
  )

  // Handle chat submission (team mode)
  const handleTeamSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!inputValue.trim() || isProcessing) return

      const message = inputValue
      setInputValue('')

      if (selectedAgent) {
        await sendToAgent(selectedAgent, message)
      } else {
        await sendToTeam(message)
      }
    },
    [inputValue, isProcessing, selectedAgent, sendToTeam, sendToAgent]
  )

  // Unified submit handler
  const handleSubmit = activeTab === 'team' ? handleTeamSubmit : handleSoloSubmit

  // Handle voice command
  const handleVoiceCommand = useCallback(
    async (command: string) => {
      setInputValue(command)
      if (activeTab === 'team') {
        if (selectedAgent) {
          await sendToAgent(selectedAgent, command)
        } else {
          await sendToTeam(command)
        }
      } else {
        await chat(command)
      }
    },
    [activeTab, selectedAgent, chat, sendToAgent, sendToTeam]
  )

  // Handle quick action
  const handleQuickAction = useCallback(
    async (prompt: string) => {
      setInputValue(prompt)
      if (activeTab === 'team') {
        await sendToTeam(prompt)
      } else {
        await chat(prompt)
      }
    },
    [activeTab, chat, sendToTeam]
  )

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

  // Determine current active agent for header display

  const displayAgent = selectedAgent ? AGENT_METADATA[selectedAgent] : null
  const isTeamMode = activeTab === 'team'

  return (
    <div
      ref={containerRef}
      className={cn('h-full flex flex-col overflow-hidden bg-background', className)}
    >
      <JarvisUnifiedPanelHeader
        displayAgent={displayAgent}
        selectedAgent={selectedAgent}
        setSelectedAgent={setSelectedAgent}
        isProcessing={isProcessing}
        isEnabled={isEnabled}
        isTeamMode={isTeamMode}
        pendingCount={pendingCount}
        setUnifiedMode={setUnifiedMode}
        setActiveTab={setActiveTab}
        activeTab={activeTab}
        setShowHistory={setShowHistory}
        onClose={onClose}
        teamActiveAgents={teamState.activeAgents}
        enabledAgents={enabledAgents}
        tabs={TABS}
      />

      {/* Gesture indicator */}
      {activeGesture && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center"
        >
          <div className="px-6 py-3 rounded-full bg-primary/90 text-white font-medium shadow-lg">
            {activeGesture === 'swipe-left' && '→ Agent suivant'}
            {activeGesture === 'swipe-right' && '← Agent précédent'}
            {activeGesture === 'swipe-down' && '↓ Rafraîchir'}
            {activeGesture === 'long-press' && '⏱ Action rapide'}
          </div>
        </motion.div>
      )}

      {/* Focus Indicator */}
      {hasFocus && (
        <div className="mx-5 mt-4">
          <JarvisFocusIndicator compact />
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat Tab (Solo Mode) */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 px-5 py-4" ref={scrollRef}>
              <div className="space-y-4">
                {/* Welcome message */}
                {messages.length === 0 && (
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
                        Je suis JARVIS 6.0, votre assistant IA omniscient.
                      </p>
                    </div>

                    {/* Quick Actions Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-4 max-w-md mx-auto">
                      {[
                        {
                          icon: '📊',
                          text: 'État du pipeline',
                          desc: "Vue d'ensemble",
                          color: 'from-blue-500/20 to-blue-600/10',
                        },
                        {
                          icon: '📧',
                          text: 'Résumer mes emails',
                          desc: 'Non lus importants',
                          color: 'from-emerald-500/20 to-emerald-600/10',
                        },
                        {
                          icon: '✅',
                          text: 'Tâches prioritaires',
                          desc: "Aujourd'hui",
                          color: 'from-amber-500/20 to-amber-600/10',
                        },
                        {
                          icon: '👥',
                          text: 'Mode Équipe',
                          desc: '6 agents experts',
                          color: 'from-purple-500/20 to-purple-600/10',
                        },
                      ].map((example, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          whileHover={{ scale: 1.03, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            'group flex flex-col items-start gap-2 p-4 rounded-2xl text-left',
                            'bg-gradient-to-br backdrop-blur-sm',
                            'border border-border/50 hover:border-primary/30',
                            'shadow-md hover:shadow-xl hover:shadow-primary/10',
                            'transition-all duration-300',
                            example.color
                          )}
                          onClick={() => {
                            if (example.text === 'Mode Équipe') {
                              setUnifiedMode('team')
                              setActiveTab('team')
                            } else {
                              handleQuickAction(example.text)
                            }
                          }}
                        >
                          <span className="text-2xl group-hover:scale-110 transition-transform">
                            {example.icon}
                          </span>
                          <div>
                            <span className="text-sm font-medium block">{example.text}</span>
                            <span className="text-xs text-muted-foreground">{example.desc}</span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Chat messages */}
                <AnimatePresence mode="popLayout">
                  {messages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={cn(
                        'flex gap-3',
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20 flex items-center justify-center shadow-md">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}

                      <div
                        className={cn(
                          'max-w-[80%] rounded-2xl px-4 py-3 shadow-md',
                          message.role === 'user'
                            ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-tr-md shadow-primary/20'
                            : 'bg-card/80 backdrop-blur-sm border border-border/50 rounded-tl-md'
                        )}
                      >
                        {message.toolCalls && message.toolCalls.length > 0 && (
                          <div className="mb-2 space-y-1">
                            {message.toolCalls.map((tc) => (
                              <ToolCallCard
                                key={tc.id}
                                toolCall={tc}
                                isConfirming={isConfirming}
                                onConfirm={confirmToolCall}
                                onReject={rejectToolCall}
                              />
                            ))}
                          </div>
                        )}

                        {message.role === 'user' ? (
                          <p className="whitespace-pre-wrap leading-relaxed text-white">
                            {message.content}
                          </p>
                        ) : (
                          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => (
                                  <p className="mb-2 last:mb-0 leading-relaxed text-foreground">
                                    {children}
                                  </p>
                                ),
                                strong: ({ children }) => (
                                  <strong className="font-semibold text-foreground">
                                    {children}
                                  </strong>
                                ),
                                ul: ({ children }) => (
                                  <ul className="list-disc pl-4 mb-2 space-y-1 text-foreground">
                                    {children}
                                  </ul>
                                ),
                                li: ({ children }) => (
                                  <li className="leading-relaxed text-foreground">{children}</li>
                                ),
                                a: ({ href, children }) => {
                                  const isInternal = href?.startsWith('/')
                                  return (
                                    <a
                                      href={href}
                                      target={isInternal ? '_self' : '_blank'}
                                      rel={isInternal ? undefined : 'noopener noreferrer'}
                                      className="text-primary hover:text-primary/80 underline underline-offset-2 inline-flex items-center gap-1 transition-colors"
                                    >
                                      {children}
                                      {!isInternal && <ExternalLink className="h-3 w-3" />}
                                    </a>
                                  )
                                },
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        )}

                        <p
                          className={cn(
                            'text-[10px] mt-2',
                            message.role === 'user'
                              ? 'text-primary-foreground/60'
                              : 'text-muted-foreground'
                          )}
                        >
                          {message.timestamp.toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      {message.role === 'user' && (
                        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-secondary to-secondary/80 ring-1 ring-border flex items-center justify-center shadow-md">
                          <span className="text-sm">👤</span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isTyping && <JarvisThinkingIndicator />}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-5 border-t border-border/30 bg-gradient-to-t from-muted/50 to-transparent">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1 relative group">
                    <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-primary/50 via-primary/30 to-primary/50 opacity-0 group-focus-within:opacity-100 blur-[1px] transition-opacity duration-300" />
                    <Input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Demandez n'importe quoi..."
                      disabled={isTyping}
                      className="relative pr-12 h-12 rounded-xl bg-card border-border/50 focus-visible:ring-0 focus-visible:border-transparent shadow-sm"
                    />
                    <JarvisVoiceInterface
                      onCommand={handleVoiceCommand}
                      className="absolute right-2 top-1/2 -translate-y-1/2 scale-75 opacity-60 hover:opacity-100 transition-opacity"
                    />
                  </div>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      type="submit"
                      disabled={!inputValue.trim() || isTyping}
                      size="icon"
                      className={cn(
                        'h-12 w-12 rounded-xl transition-colors',
                        inputValue.trim() ? 'bg-primary hover:bg-primary/90' : ''
                      )}
                      aria-label={isTyping ? 'Envoi en cours' : 'Envoyer le message'}
                    >
                      {isTyping ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </motion.div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground/60">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-mono">⌘J</kbd>{' '}
                    pour ouvrir/fermer
                  </p>
                  {messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      onClick={clearChat}
                    >
                      Nouvelle conversation
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Team Tab (Multi-Agent Mode) */}
        {activeTab === 'team' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 px-5 py-4" ref={scrollRef}>
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {teamState.conversationHistory.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-12"
                    >
                      <div className="mb-4 p-4 rounded-full bg-muted/50 inline-flex">
                        <Users className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h4 className="font-medium mb-2">Bienvenue dans JARVIS Team 6.0</h4>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                        6 agents experts collaborent pour vous. Posez une question ou cliquez sur un
                        agent.
                      </p>

                      <div className="flex flex-wrap gap-2 justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => requestStandup()}
                          disabled={isProcessing}
                        >
                          <Coffee className="h-4 w-4" />
                          Briefing du jour
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickAction('État du pipeline commercial')}
                          disabled={isProcessing}
                        >
                          Pipeline
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickAction('Point trésorerie et factures')}
                          disabled={isProcessing}
                        >
                          Trésorerie
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickAction('Tickets support ouverts')}
                          disabled={isProcessing}
                        >
                          Support
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    teamState.conversationHistory.map((m) => (
                      <TeamMessage key={m.id} message={m} getAgentMeta={getAgentMeta} />
                    ))
                  )}
                </AnimatePresence>

                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/30"
                  >
                    <div className="flex gap-1">
                      {teamState.activeAgents.length > 0 ? (
                        teamState.activeAgents.slice(0, 3).map((agentId, i) => (
                          <motion.div
                            key={agentId}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.1 }}
                          >
                            <JarvisAgentAvatar agentId={agentId} size="sm" status="thinking" />
                          </motion.div>
                        ))
                      ) : (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {teamState.activeAgents.length > 0
                        ? `${teamState.activeAgents.map((a) => AGENT_METADATA[a].name).join(', ')} en réflexion...`
                        : 'Analyse en cours...'}
                    </span>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            {/* Team Input Area */}
            <div className="p-5 border-t border-border/30 bg-gradient-to-t from-muted/50 to-transparent">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    selectedAgent
                      ? `Message pour ${AGENT_METADATA[selectedAgent].displayName}...`
                      : "Posez une question à l'équipe..."
                  }
                  className="flex-1 h-12"
                  disabled={isProcessing}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!inputValue.trim() || isProcessing}
                      className="h-12 w-12 bg-primary hover:bg-primary/90"
                      aria-label={isProcessing ? 'Envoi en cours' : 'Envoyer'}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Envoyer</TooltipContent>
                </Tooltip>
              </form>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-muted-foreground/60">
                  Glissez ← → pour changer d'agent
                </p>
                {teamState.conversationHistory.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={clearConversation}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Effacer
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions Tab */}
        {activeTab === 'actions' && (
          <JarvisActionsTab
            pendingActions={pendingActions}
            onAskJarvis={async (prompt: string) => {
              await chat(prompt)
            }}
            onApprove={approveAction}
            onReject={rejectAction}
            onModify={handleModify}
          />
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="flex-1 overflow-hidden">
            <JarvisTemplates />
          </div>
        )}

        {/* Workflows Tab - NEW v9.0 */}
        {activeTab === 'workflows' && (
          <div className="flex-1 overflow-hidden">
            <JarvisWorkflowPanel
              onExecuteWorkflow={async (prompt: string) => {
                await chat(prompt)
              }}
            />
          </div>
        )}

        {/* Predictions Tab - NEW v9.0 */}
        {activeTab === 'predictions' && (
          <div className="flex-1 overflow-hidden p-5 space-y-4">
            <JarvisPredictionsPanel
              onExecutePrediction={async (cmd: string) => {
                await chat(cmd)
              }}
            />
            <JarvisPerformanceWidget />
          </div>
        )}

        {/* Intelligence Tab - NEW v12.0 */}
        {activeTab === 'intelligence' && (
          <ScrollArea className="flex-1">
            <div className="p-5 space-y-6">
              {/* Smart Briefing */}
              <JarvisSmartBriefing />

              {/* Productivity Score */}
              <JarvisProductivityScore />

              {/* Weekly Challenges */}
              <JarvisChallenges />

              {/* Collective Insights */}
              <JarvisCollectiveInsights />
            </div>
          </ScrollArea>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="flex-1 overflow-hidden">
            <JarvisAnalyticsDashboard />
          </div>
        )}

        {/* Settings Tab */}
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
