/**
 * JarvisUnifiedPanel renderers — extracted from JarvisUnifiedPanel.tsx
 * Sub-renderers for tool calls and team messages (no behavior change).
 */

import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { Loader2, CheckCircle2, XCircle, Users, MessageSquare, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { JarvisAgentAvatar } from './JarvisAgentAvatar'
import { getToolIcon } from './JarvisUnifiedPanel.constants'
import type { ToolCall } from '@/types/jarvis'
import type { AgentId, AgentMessage } from '@/types/jarvis-agents'

export interface RenderToolCallOptions {
  toolCall: ToolCall
  isConfirming: boolean
  onConfirm: (id: string) => void
  onReject: (id: string) => void
}

export function ToolCallCard({
  toolCall,
  isConfirming,
  onConfirm,
  onReject,
}: RenderToolCallOptions) {
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

      {isConfirmationRequired && (
        <div className="flex gap-2 mt-1">
          <Button
            size="sm"
            className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50"
            onClick={() => onConfirm(toolCall.id)}
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
                Confirmer
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => onReject(toolCall.id)}
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

export interface TeamMessageProps {
  message: AgentMessage
  getAgentMeta: (id: AgentId) => { name: string; color: string; domain: string } | undefined
}

export function TeamMessage({ message, getAgentMeta }: TeamMessageProps) {
  const isUser = message.agentId === 'user'
  const isPrime = message.agentId === 'prime'
  const agent = !isUser && !isPrime ? getAgentMeta(message.agentId as AgentId) : null

  return (
    <motion.div
      key={message.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3 p-3 rounded-xl', isUser ? 'bg-primary/5 ml-8' : 'bg-muted/50 mr-4')}
    >
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

      <div className="flex-1 min-w-0">
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

        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
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

        <span className="text-[10px] text-muted-foreground mt-1 block">
          {new Date(message.timestamp).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {isUser && (
        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  )
}
