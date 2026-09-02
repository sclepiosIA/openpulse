/**
 * JarvisAgentAvatar - Avatar animé pour un agent
 * 
 * Affiche l'avatar d'un agent avec son initiale, gradient de couleur,
 * et animations de statut (idle, thinking, speaking).
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { debug } from '@/lib/debug';
import type { AgentId } from '@/types/jarvis-agents';
import { AGENT_METADATA } from '@/hooks/jarvis/useJarvisTeam';

interface JarvisAgentAvatarProps {
  agentId: AgentId;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'idle' | 'thinking' | 'speaking' | 'executing' | 'error';
  showName?: boolean;
  showDomain?: boolean;
  customName?: string;
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const statusBadgeClasses = {
  idle: 'bg-muted-foreground/50',
  thinking: 'bg-amber-500 animate-pulse',
  speaking: 'bg-emerald-500 animate-pulse',
  executing: 'bg-primary animate-pulse',
  error: 'bg-destructive',
};

export function JarvisAgentAvatar({
  agentId,
  size = 'md',
  status = 'idle',
  showName = false,
  showDomain = false,
  customName,
  className,
  onClick,
}: JarvisAgentAvatarProps) {
  const agent = AGENT_METADATA[agentId];
  
  if (!agent) {
    debug.warn(`[JarvisAgentAvatar] Unknown agent: ${agentId}`);
    return null;
  }

  const displayName = customName || agent.displayName;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div 
      className={cn(
        "flex flex-col items-center gap-1",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <motion.div
        className={cn(
          "relative rounded-full flex items-center justify-center font-semibold text-white shadow-lg",
          sizeClasses[size],
        )}
        style={{
          background: `linear-gradient(135deg, ${agent.gradientFrom}, ${agent.gradientTo})`,
          boxShadow: status === 'speaking' 
            ? `0 0 20px ${agent.color}` 
            : status === 'thinking'
            ? `0 0 15px ${agent.color}`
            : `0 4px 15px ${agent.color}30`,
        }}
        whileHover={onClick ? { scale: 1.1 } : undefined}
        whileTap={onClick ? { scale: 0.95 } : undefined}
        animate={
          status === 'thinking' 
            ? { scale: [1, 1.05, 1] }
            : status === 'speaking'
            ? { scale: [1, 1.08, 1] }
            : undefined
        }
        transition={{
          duration: status === 'speaking' ? 0.8 : 1.2,
          repeat: status === 'thinking' || status === 'speaking' ? Infinity : 0,
          ease: 'easeInOut',
        }}
      >
        {/* Emoji or Initial */}
        <span className="select-none">{agent.emoji}</span>
        
        {/* Status indicator */}
        <motion.div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-background",
            size === 'sm' ? 'h-2.5 w-2.5' : size === 'md' ? 'h-3 w-3' : 'h-4 w-4',
            statusBadgeClasses[status],
          )}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        />

        {/* Speaking wave effect */}
        {status === 'speaking' && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: `2px solid ${agent.color}` }}
              animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: `2px solid ${agent.color}` }}
              animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.3 }}
            />
          </>
        )}

        {/* Thinking dots */}
        {status === 'thinking' && (
          <div className="absolute -top-1 right-0 flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={`jarvis-agent-avatar-thinking-${i}`}
                className="h-1.5 w-1.5 rounded-full bg-amber-400"
                animate={{ y: [0, -3, 0] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Name */}
      {showName && (
        <span className="text-xs font-medium text-muted-foreground">
          {displayName}
        </span>
      )}

      {/* Domain */}
      {showDomain && (
        <span className="text-[10px] text-muted-foreground/70">
          {agent.domain}
        </span>
      )}
    </div>
  );
}

/**
 * Row of all agent avatars with selection
 */
interface JarvisAgentRowProps {
  activeAgents?: AgentId[];
  selectedAgent?: AgentId;
  onSelectAgent?: (agentId: AgentId) => void;
  size?: 'sm' | 'md' | 'lg';
  showNames?: boolean;
  enabledAgents?: AgentId[];
}

const ALL_AGENT_IDS: AgentId[] = ['sophia', 'marcus', 'olivia', 'noah', 'emma', 'alex'];

export function JarvisAgentRow({
  activeAgents = [],
  selectedAgent,
  onSelectAgent,
  size = 'md',
  showNames = false,
  enabledAgents = ALL_AGENT_IDS,
}: JarvisAgentRowProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {ALL_AGENT_IDS.filter(id => enabledAgents.includes(id)).map((agentId) => {
        const isActive = activeAgents.includes(agentId);
        const isSelected = selectedAgent === agentId;
        
        return (
          <motion.div
            key={agentId}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: ALL_AGENT_IDS.indexOf(agentId) * 0.05 }}
          >
            <JarvisAgentAvatar
              agentId={agentId}
              size={size}
              status={isActive ? 'thinking' : 'idle'}
              showName={showNames}
              onClick={onSelectAgent ? () => onSelectAgent(agentId) : undefined}
              className={cn(
                isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-full",
                !enabledAgents.includes(agentId) && "opacity-40"
              )}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
