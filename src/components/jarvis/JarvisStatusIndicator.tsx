/**
 * JarvisStatusIndicator - Indicateur de statut IA premium (v12.7)
 * 
 * Affiche l'état de connexion avec l'IA en temps réel
 * avec des animations et couleurs contextuelles
 */

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Zap, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error' | 'idle';

interface JarvisStatusIndicatorProps {
  status?: ConnectionStatus;
  isTyping?: boolean;
  latencyMs?: number;
  className?: string;
  compact?: boolean;
}

const statusConfig = {
  connected: {
    icon: CheckCircle2,
    label: 'En ligne',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500',
    ringColor: 'ring-emerald-500/30',
    pulseColor: 'bg-emerald-400',
  },
  connecting: {
    icon: Loader2,
    label: 'Connexion...',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500',
    ringColor: 'ring-amber-500/30',
    pulseColor: 'bg-amber-400',
  },
  disconnected: {
    icon: WifiOff,
    label: 'Hors ligne',
    color: 'text-muted-foreground',
    bgColor: 'bg-gray-400',
    ringColor: 'ring-gray-400/30',
    pulseColor: 'bg-gray-300',
  },
  error: {
    icon: AlertTriangle,
    label: 'Erreur',
    color: 'text-red-500',
    bgColor: 'bg-red-500',
    ringColor: 'ring-red-500/30',
    pulseColor: 'bg-red-400',
  },
  idle: {
    icon: Wifi,
    label: 'Prêt',
    color: 'text-primary',
    bgColor: 'bg-primary',
    ringColor: 'ring-primary/30',
    pulseColor: 'bg-primary/70',
  },
};

export const JarvisStatusIndicator = memo(function JarvisStatusIndicator({
  status = 'connected',
  isTyping = false,
  latencyMs,
  className,
  compact = false,
}: JarvisStatusIndicatorProps) {
  const config = statusConfig[isTyping ? 'connecting' : status];
  const Icon = isTyping ? Zap : config.icon;
  const label = isTyping ? 'Réflexion...' : config.label;

  // Latency quality indicator
  const latencyQuality = latencyMs 
    ? latencyMs < 200 ? 'excellent' 
      : latencyMs < 500 ? 'good' 
      : latencyMs < 1000 ? 'medium' 
      : 'poor'
    : null;

  const latencyColor = {
    excellent: 'text-emerald-500',
    good: 'text-cyan-500',
    medium: 'text-amber-500',
    poor: 'text-red-500',
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          className={cn(
            "flex items-center gap-2 px-2.5 py-1.5 rounded-xl",
            "bg-white/[0.08] backdrop-blur-sm border border-white/10",
            "cursor-default select-none",
            className
          )}
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          {/* Status dot with pulse animation */}
          <div className="relative">
            <motion.div
              className={cn(
                "absolute inset-0 rounded-full",
                config.pulseColor
              )}
              animate={isTyping || status === 'connecting' ? {
                scale: [1, 1.8, 1],
                opacity: [0.5, 0, 0.5],
              } : {
                scale: [1, 1.4, 1],
                opacity: [0.3, 0, 0.3],
              }}
              transition={{
                duration: isTyping ? 1 : 2,
                repeat: Infinity,
              }}
            />
            <div className={cn(
              "relative w-2.5 h-2.5 rounded-full ring-2",
              config.bgColor,
              config.ringColor
            )} />
          </div>

          {/* Status text */}
          {!compact && (
            <AnimatePresence mode="wait">
              <motion.span
                key={label}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 5 }}
                className={cn(
                  "text-xs font-medium text-white/80",
                  isTyping && "text-cyan-200"
                )}
              >
                {label}
              </motion.span>
            </AnimatePresence>
          )}

          {/* Animated icon for typing state */}
          <AnimatePresence mode="wait">
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, rotate: -180, scale: 0 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 180, scale: 0 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Zap className="h-3.5 w-3.5 text-cyan-400" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", config.color)} />
          <span className="font-medium">{label}</span>
        </div>
        {latencyMs && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Latence:</span>
            <span className={cn("font-mono", latencyColor[latencyQuality!])}>
              {latencyMs}ms
            </span>
          </div>
        )}
        {isTyping && (
          <span className="text-xs text-muted-foreground">
            GPT-5 traite votre demande...
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
});

// Mini version for tight spaces
export const JarvisStatusDot = memo(function JarvisStatusDot({
  status = 'connected',
  isTyping = false,
  className,
}: Pick<JarvisStatusIndicatorProps, 'status' | 'isTyping' | 'className'>) {
  const config = statusConfig[isTyping ? 'connecting' : status];
  
  return (
    <div className={cn("relative", className)}>
      <motion.div
        className={cn(
          "absolute inset-0 rounded-full",
          config.pulseColor
        )}
        animate={{
          scale: [1, 1.6, 1],
          opacity: [0.4, 0, 0.4],
        }}
        transition={{
          duration: isTyping ? 1 : 2,
          repeat: Infinity,
        }}
      />
      <div className={cn(
        "relative w-3 h-3 rounded-full ring-2 ring-background shadow-lg",
        config.bgColor
      )} />
    </div>
  );
});
