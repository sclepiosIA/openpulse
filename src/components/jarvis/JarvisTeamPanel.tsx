/**
 * JarvisTeamPanel - Interface multi-agent premium
 *
 * Affiche l'équipe d'agents, la conversation multi-agent,
 * et permet les interactions avec jarvis-prime.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Users,
  Send,
  Loader2,
  Sparkles,
  Coffee,
  Trash2,
  Settings,
  MessageSquare,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useJarvisTeam, AGENT_METADATA } from '@/hooks/jarvis/useJarvisTeam'
import { JarvisAgentAvatar, JarvisAgentRow } from './JarvisAgentAvatar'
import type { AgentId, AgentMessage } from '@/types/jarvis-agents'

interface JarvisTeamPanelProps {
  className?: string
  onOpenSettings?: () => void
}

export function JarvisTeamPanel({ className, onOpenSettings }: JarvisTeamPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<AgentId | undefined>()
  const scrollRef = useRef<HTMLDivElement>(null)

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

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [teamState.conversationHistory])

  const handleSubmit = useCallback(
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

  const handleStandup = useCallback(async () => {
    setInputValue('')
    await requestStandup()
  }, [requestStandup])

  const handleQuickAction = useCallback(
    async (prompt: string) => {
      setInputValue(prompt)
      await sendToTeam(prompt)
    },
    [sendToTeam]
  )

  const renderMessage = (message: AgentMessage) => {
    const isUser = message.agentId === 'user'
    const isPrime = message.agentId === 'prime'
    const agent = !isUser && !isPrime ? getAgentMeta(message.agentId as AgentId) : null

    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'flex gap-3 p-3 rounded-xl',
          isUser ? 'bg-primary/5 ml-8' : 'bg-muted/50 mr-4'
        )}
      >
        {/* Avatar */}
        {!isUser && (
          <div className="flex-shrink-0">
            {isPrime ? (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
            ) : (
              <JarvisAgentAvatar agentId={message.agentId as AgentId} size="md" status="idle" />
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Agent name */}
          {!isUser && (
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm" style={{ color: agent?.color }}>
                {isPrime ? 'JARVIS TEAM' : agent?.name}
              </span>
              {agent && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                  {agent.domain}
                </Badge>
              )}
            </div>
          )}

          {/* Message content */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>

          {/* Timestamp */}
          <span className="text-[10px] text-muted-foreground mt-1 block">
            {new Date(message.timestamp).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {/* User indicator */}
        {isUser && (
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                JARVIS Team
                <Badge className="bg-gradient-to-r from-primary/80 to-primary/60 text-white border-0 text-[10px]">
                  <Sparkles className="h-2.5 w-2.5 mr-1" />
                  v12.0
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">6 agents spécialisés à votre service</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={clearConversation}
                  disabled={teamState.conversationHistory.length === 0}
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Effacer la conversation</TooltipContent>
            </Tooltip>
            {onOpenSettings && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={onOpenSettings}
                aria-label="Paramètres"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Agent Row */}
        <div className="flex items-center justify-between">
          <JarvisAgentRow
            activeAgents={teamState.activeAgents}
            selectedAgent={selectedAgent}
            onSelectAgent={(id) => setSelectedAgent((prev) => (prev === id ? undefined : id))}
            size="md"
            showNames
            enabledAgents={enabledAgents}
          />
        </div>

        {selectedAgent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 p-2 rounded-lg bg-muted/50 text-sm"
          >
            <span className="text-muted-foreground">
              Mode agent unique:{' '}
              <strong style={{ color: AGENT_METADATA[selectedAgent].color }}>
                {AGENT_METADATA[selectedAgent].name}
              </strong>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 h-6 text-xs"
              onClick={() => setSelectedAgent(undefined)}
            >
              Annuler
            </Button>
          </motion.div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
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
                <h4 className="font-medium mb-2">Bienvenue dans JARVIS Team</h4>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                  Posez une question à l'équipe ou cliquez sur un agent pour une conversation
                  ciblée.
                </p>

                {/* Quick actions */}
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleStandup}
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
              teamState.conversationHistory.map(renderMessage)
            )}
          </AnimatePresence>

          {/* Processing indicator */}
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

      {/* Input */}
      <div className="p-4 border-t bg-muted/30">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              selectedAgent
                ? `Message pour ${AGENT_METADATA[selectedAgent].displayName}...`
                : "Posez une question à l'équipe..."
            }
            className="flex-1"
            disabled={isProcessing}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                size="icon"
                disabled={!inputValue.trim() || isProcessing}
                className="bg-primary hover:bg-primary/90"
                aria-label="Chargement"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Envoyer</TooltipContent>
          </Tooltip>
        </form>
      </div>
    </div>
  )
}
