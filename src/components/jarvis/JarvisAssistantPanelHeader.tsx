/**
 * JarvisAssistantPanelHeader - Header premium (gradient, particules, tabs)
 * Extrait de JarvisAssistantPanel.tsx (session 96)
 */
import React from 'react'
import { motion } from 'framer-motion'
import { X, Sparkles, Zap, RefreshCw, History, Plus, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ImmersiveToggle } from './JarvisImmersiveMode'
import { vibrateSelection } from '@/lib/haptics'
import jarvisLogo from '@/assets/jarvis-logo.png'

export interface JarvisHeaderTab {
  id: string
  label: string
  icon: LucideIcon
}

interface JarvisAssistantPanelHeaderProps {
  shouldAnimate: boolean
  isEnabled: boolean
  pendingCount: number
  isImmersive: boolean
  setIsImmersive: (v: boolean) => void
  isScanning: boolean
  triggerProactiveScan: () => void
  handleNewConversation: () => void
  setShowHistory: (v: boolean) => void
  onClose?: () => void
  tabs: JarvisHeaderTab[]
  activeTab: string
  setActiveTab: (id: string) => void
}

export function JarvisAssistantPanelHeader({
  shouldAnimate,
  isEnabled,
  pendingCount,
  isImmersive,
  setIsImmersive,
  isScanning,
  triggerProactiveScan,
  handleNewConversation,
  setShowHistory,
  onClose,
  tabs,
  activeTab,
  setActiveTab,
}: JarvisAssistantPanelHeaderProps) {
  return (
    <div className="relative overflow-hidden">
      {/* Deep navy gradient with subtle noise texture */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 10% 0%, hsl(220 90% 20% / 0.95), transparent 50%),
            radial-gradient(ellipse 100% 60% at 90% 100%, hsl(200 85% 18% / 0.8), transparent 50%),
            radial-gradient(ellipse 80% 40% at 50% 50%, hsl(210 80% 22% / 0.6), transparent),
            linear-gradient(135deg, hsl(220 85% 15%) 0%, hsl(210 80% 18%) 40%, hsl(200 75% 20%) 100%)
          `,
        }}
      />

      {shouldAnimate && (
        <motion.div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              'linear-gradient(45deg, transparent 30%, hsl(180 70% 50% / 0.15) 50%, transparent 70%)',
            backgroundSize: '200% 200%',
          }}
          animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {shouldAnimate && (
        <>
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 100,
              height: 100,
              background: 'radial-gradient(circle, hsl(180 80% 60% / 0.2) 0%, transparent 70%)',
              right: '10%',
              top: '10%',
              filter: 'blur(20px)',
            }}
            animate={{
              y: [0, -20, 0],
              x: [0, 15, 0],
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 60,
              height: 60,
              background: 'radial-gradient(circle, hsl(210 90% 70% / 0.25) 0%, transparent 70%)',
              left: '15%',
              bottom: '20%',
              filter: 'blur(15px)',
            }}
            animate={{ y: [0, 15, 0], scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />
        </>
      )}

      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <motion.div
              className="relative"
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              {shouldAnimate && (
                <motion.div
                  className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-cyan-400/30 to-blue-500/20 blur-md"
                  animate={{ opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              )}
              <div className="relative p-2.5 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/20 shadow-2xl shadow-black/20">
                <img
                  src={jarvisLogo}
                  alt="Jarvis"
                  className="h-10 w-10 object-contain drop-shadow-lg"
                />
                {isEnabled && (
                  <motion.div
                    className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 ring-2 ring-marque-sombre flex items-center justify-center shadow-lg shadow-emerald-500/40"
                    animate={shouldAnimate ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles className="h-2.5 w-2.5 text-white" />
                  </motion.div>
                )}
              </div>
            </motion.div>

            <div>
              <h3 className="font-bold text-xl text-white tracking-wide flex items-center gap-2.5">
                <span className="bg-gradient-to-r from-white via-white/90 to-cyan-100 bg-clip-text text-transparent">
                  JARVIS
                </span>
                <motion.div className="relative" whileHover={{ scale: 1.08, y: -1 }}>
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/50 to-blue-500/50 blur-lg" />
                  <Badge className="relative text-[10px] h-5 px-2.5 bg-gradient-to-r from-cyan-500/90 via-blue-500/90 to-indigo-500/90 text-white border-0 shadow-lg shadow-blue-500/30 rounded-full">
                    <Zap className="h-2.5 w-2.5 mr-1" />
                    GPT-5
                  </Badge>
                </motion.div>
              </h3>
              <p className="text-[11px] text-cyan-100/50 mt-0.5 font-medium tracking-wide">
                Assistant IA intelligent
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
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

            <ImmersiveToggle
              isImmersive={isImmersive}
              onToggle={() => {
                vibrateSelection()
                setIsImmersive(!isImmersive)
              }}
              className="text-white/70 hover:text-white hover:bg-card/10"
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-white/70 hover:text-white hover:bg-card/10"
                  onClick={triggerProactiveScan}
                  disabled={isScanning}
                  aria-label="Actualiser"
                >
                  <RefreshCw className={cn('h-4 w-4', isScanning && 'animate-spin')} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Actualiser les suggestions</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-white/70 hover:text-white hover:bg-card/10"
                  onClick={handleNewConversation}
                  aria-label="Ajouter"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Nouvelle conversation</p>
              </TooltipContent>
            </Tooltip>

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

        <div className="relative flex gap-1 mt-4 p-1 bg-white/[0.06] backdrop-blur-xl rounded-2xl border border-white/10">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all flex-1',
                  isActive ? 'text-primary' : 'text-white/50 hover:text-white/80'
                )}
                whileHover={{ scale: isActive ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-card/95 backdrop-blur-sm rounded-xl shadow-xl shadow-black/10"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className={cn('relative h-4 w-4', isActive ? 'text-primary' : '')} />
                <span className="relative hidden md:inline text-xs">{tab.label}</span>
                {tab.id === 'actions' && pendingCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={cn(
                      'relative flex items-center justify-center h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full',
                      isActive
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                        : 'bg-amber-500/80 text-white'
                    )}
                  >
                    {pendingCount}
                  </motion.span>
                )}
              </motion.button>
            )
          })}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />
    </div>
  )
}
