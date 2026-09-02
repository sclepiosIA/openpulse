/**
 * JarvisAlertBadge - Composant unifié pour les badges d'alerte
 * 
 * Utilisé partout dans l'UI Jarvis pour garantir une cohérence visuelle
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  TrendingUp,
  Clock,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { JARVIS_COLORS, type JarvisAlertType } from '@/contexts/JarvisUnifiedContext';

interface JarvisAlertBadgeProps {
  type: JarvisAlertType;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showPulse?: boolean;
  className?: string;
}

const ALERT_ICONS = {
  urgent: AlertTriangle,
  risk: AlertTriangle,
  opportunity: TrendingUp,
  reminder: Clock,
  insight: Lightbulb,
  prediction: Sparkles,
} as const;

const SIZE_CLASSES = {
  sm: 'h-4 w-4 text-[10px]',
  md: 'h-5 w-5 text-xs',
  lg: 'h-6 w-6 text-sm',
} as const;

const ICON_SIZES = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-3.5 w-3.5',
} as const;

export const JarvisAlertBadge = memo(function JarvisAlertBadge({
  type,
  count,
  size = 'md',
  showIcon = false,
  showPulse = false,
  className,
}: JarvisAlertBadgeProps) {
  const colors = JARVIS_COLORS[type];
  const Icon = ALERT_ICONS[type];
  
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={cn(
        'relative flex items-center justify-center rounded-full font-semibold',
        SIZE_CLASSES[size],
        colors.bg,
        colors.border,
        'border',
        className
      )}
    >
      {showIcon ? (
        <Icon className={cn(ICON_SIZES[size], colors.icon)} />
      ) : (
        <span className={colors.icon}>{count ?? 1}</span>
      )}
      
      {showPulse && (
        <motion.span
          className={cn(
            'absolute inset-0 rounded-full',
            type === 'urgent' ? 'bg-destructive' : 'bg-primary'
          )}
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
});
