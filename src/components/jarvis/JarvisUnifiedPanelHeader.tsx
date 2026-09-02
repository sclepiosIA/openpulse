/**
 * JarvisUnifiedPanelHeader - Header immersif unifié (mesh gradient, agent row, tabs)
 * Extrait de JarvisUnifiedPanel.tsx (session 97)
 */
import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowLeftRight, History, X, Zap, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { JarvisAgentAvatar, JarvisAgentRow } from './JarvisAgentAvatar'
import { AGENT_METADATA } from '@/hooks/jarvis/useJarvisTeam'
import type { AgentId } from '@/types/jarvis-agents'
import type { UnifiedMode } from '@/types/jarvis-v6'
import jarvisLogo from '@/assets/jarvis-logo.png'

interface AgentMeta {
  color: string
  gradientFrom: string
  gradientTo: string
  name: string
  domain: string
}

interface JarvisUnifiedPanelHeaderProps {
  displayAgent: AgentMeta | null
  selectedAgent: AgentId | undefined
  setSelectedAgent: React.Dispatch<React.SetStateAction<AgentId | undefined>>
  isProcessing: boolean
  isEnabled: boolean
  isTeamMode: boolean
  pendingCount: number
  setUnifiedMode: (m: UnifiedMode) => void
  setActiveTab: (id: string) => void
  activeTab: string
  setShowHistory: (v: boolean) => void
  onClose?: () => void
  teamActiveAgents: AgentId[]
  enabledAgents: AgentId[] | undefined
  tabs: ReadonlyArray<{ id: string; label: string; icon: LucideIcon }>
}

export function JarvisUnifiedPanelHeader({
  displayAgent,
  selectedAgent,
  setSelectedAgent,
  isProcessing,
  isEnabled,
  isTeamMode,
  pendingCount,
  setUnifiedMode,
  setActiveTab,
  activeTab,
  setShowHistory,
  onClose,
  teamActiveAgents,
  enabledAgents,
  tabs,
}: JarvisUnifiedPanelHeaderProps) {
  return (
    <div className="relative overflow-hidden">
      <motion.div
        className="absolute inset-0"
        animate={{
          background: displayAgent
            ? `radial-gradient(ellipse 80% 50% at 20% 40%, ${displayAgent.gradientFrom}40, transparent),
               radial-gradient(ellipse 60% 40% at 80% 60%, ${displayAgent.gradientTo}30, transparent),
               linear-gradient(180deg, hsl(210 85% 18%) 0%, hsl(200 80% 20%) 100%)`
            : `radial-gradient(ellipse 80% 50% at 20% 40%, hsl(210 85% 25% / 0.8), transparent),
               radial-gradient(ellipse 60% 40% at 80% 60%, hsl(200 80% 20% / 0.6), transparent),
               linear-gradient(180deg, hsl(210 85% 18%) 0%, hsl(200 80% 20%) 100%)`,
        }}
        transition={{ duration: 0.5 }}
      />

      <motion.div
        className="absolute rounded-full blur-3xl opacity-20"
        style={{
          width: 120,
          height: 120,
          background: displayAgent?.color || 'hsl(197 64% 60% / 0.4)',
          right: '5%',
          top: '-20%',
        }}
        animate={{ y: [0, -15, 0], x: [0, 10, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative px-5 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              className="relative p-2.5 rounded-2xl bg-card/10 backdrop-blur-sm border border-white/20 shadow-xl"
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              {displayAgent ? (
                <JarvisAgentAvatar
                  agentId={selectedAgent!}
                  size="lg"
                  status={isProcessing ? 'thinking' : 'idle'}
                />
              ) : (
                <>
                  <img
                    loading="lazy"
                    decoding="async"
                    src={jarvisLogo}
                    alt="Jarvis"
                    className="h-10 w-10 object-contain"
                  />
                  {isEnabled && (
                    <motion.div
                      className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-400 ring-2 ring-marque-grille flex items-center justify-center"
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Sparkles className="h-2.5 w-2.5 text-emerald-900" />
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>

            <div>
              <h3 className="font-bold text-xl text-white tracking-tight flex items-center gap-2.5">
                {displayAgent ? displayAgent.name : 'JARVIS'}
                <motion.div className="relative" whileHover={{ scale: 1.1 }}>
                  <div className="absolute inset-0 rounded-md bg-primary/40 blur-md" />
                  <Badge className="relative text-[10px] h-5 px-2 bg-gradient-to-r from-primary/80 to-primary/60 text-white border-0 shadow-lg shadow-primary/30">
                    <Zap className="h-2.5 w-2.5 mr-1" />
                    {isTeamMode ? 'v6.0 Team' : 'GPT-5'}
                  </Badge>
                </motion.div>
              </h3>
              <p className="text-xs text-white/50 mt-0.5">
                {displayAgent
                  ? displayAgent.domain
                  : isTeamMode
                    ? '🤖 6 agents spécialisés'
                    : '🤖 Assistant IA proactif'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-9 w-9 rounded-xl text-white/70 hover:text-white hover:bg-card/10',
                    isTeamMode && 'bg-card/10 text-white'
                  )}
                  onClick={() => {
                    setUnifiedMode(isTeamMode ? 'solo' : 'team')
                    setActiveTab(isTeamMode ? 'chat' : 'team')
                  }}
                  aria-label={isTeamMode ? 'Passer en mode Solo' : 'Passer en mode Équipe'}
                  aria-pressed={isTeamMode}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isTeamMode ? 'Mode Solo' : 'Mode Équipe'}
              </TooltipContent>
            </Tooltip>

            {pendingCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500 }}
              >
                <Badge className="bg-amber-500/90 text-white border-0 shadow-lg shadow-amber-500/30">
                  {pendingCount} action{pendingCount > 1 ? 's' : ''}
                </Badge>
              </motion.div>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-white/70 hover:text-white hover:bg-card/10"
              onClick={() => setShowHistory(true)}
              aria-label="Historique des conversations"
            >
              <History className="h-4 w-4" />
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-white/70 hover:text-white hover:bg-card/10"
                onClick={onClose}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {isTeamMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 pt-4 border-t border-white/10"
          >
            <JarvisAgentRow
              activeAgents={teamActiveAgents}
              selectedAgent={selectedAgent}
              onSelectAgent={(id) => setSelectedAgent((prev) => (prev === id ? undefined : id))}
              size="md"
              showNames
              enabledAgents={enabledAgents}
            />
            {selectedAgent && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 text-xs text-white/60"
              >
                Mode agent unique:{' '}
                <strong style={{ color: AGENT_METADATA[selectedAgent].color }}>
                  {AGENT_METADATA[selectedAgent].name}
                </strong>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 h-5 text-[10px] text-white/60 hover:text-white"
                  onClick={() => setSelectedAgent(undefined)}
                >
                  Annuler
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}

        <div className="relative flex gap-1.5 mt-5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon
            if ((tab.id === 'chat' && isTeamMode) || (tab.id === 'team' && !isTeamMode)) return null

            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                  isActive ? 'text-primary' : 'text-white/60 hover:text-white hover:bg-card/10'
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-card rounded-xl shadow-lg"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className={cn('relative h-4 w-4', isActive && 'text-primary')} />
                <span className="relative hidden sm:inline">{tab.label}</span>
                {tab.id === 'actions' && pendingCount > 0 && (
                  <Badge
                    className={cn(
                      'relative ml-1 h-5 min-w-[20px] px-1.5 text-[10px]',
                      isActive ? 'bg-primary text-white' : 'bg-amber-500 text-white border-0'
                    )}
                  >
                    {pendingCount}
                  </Badge>
                )}
              </motion.button>
            )
          })}
        </div>
      </div>

      <svg
        className="absolute bottom-0 left-0 right-0 w-full h-6"
        viewBox="0 0 1440 24"
        preserveAspectRatio="none"
      >
        <path
          d="M0,12 C240,20 480,4 720,12 C960,20 1200,4 1440,12 L1440,24 L0,24 Z"
          fill="hsl(var(--background))"
        />
      </svg>
    </div>
  )
}
