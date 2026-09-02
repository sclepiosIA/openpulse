/**
 * JarvisAlertCard - Carte d'alerte unifiée pour triggers et prédictions
 * 
 * Design cohérent utilisé dans:
 * - JarvisProactiveNudge
 * - JarvisAssistantPanel (onglet Actions)
 * - Notifications toast
 */

import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  Lightbulb, 
  Sparkles,
  ChevronRight,
  X 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { JARVIS_COLORS, JARVIS_ANIMATIONS, type JarvisAlert } from '@/contexts/JarvisUnifiedContext';

interface JarvisAlertCardProps {
  alert: JarvisAlert;
  onAction?: (command: string) => void;
  onDismiss?: () => void;
  compact?: boolean;
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

const ALERT_LABELS = {
  urgent: 'Urgent',
  risk: 'Risque',
  opportunity: 'Opportunité',
  reminder: 'Rappel',
  insight: 'Insight',
  prediction: 'Suggestion',
} as const;

export const JarvisAlertCard = memo(forwardRef<HTMLDivElement, JarvisAlertCardProps>(function JarvisAlertCard({
  alert,
  onAction,
  onDismiss,
  compact = false,
  className,
}, _ref) {
  const colors = JARVIS_COLORS[alert.type];
  const Icon = ALERT_ICONS[alert.type];
  const label = ALERT_LABELS[alert.type];
  
  const handleAction = () => {
    if (alert.actionCommand && onAction) {
      onAction(alert.actionCommand);
    }
  };
  
  if (compact) {
    return (
      <motion.div
        {...JARVIS_ANIMATIONS.fadeIn}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border',
          colors.bg,
          colors.border,
          'hover:shadow-sm transition-shadow',
          className
        )}
      >
        <Icon className={cn('h-4 w-4 flex-shrink-0', colors.icon)} />
        <span className="text-sm truncate flex-1">{alert.message}</span>
        {alert.actionLabel && onAction && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={handleAction}
          >
            {alert.actionLabel}
          </Button>
        )}
        {onDismiss && (
          <Button
            size="sm"
            variant="ghost"
            aria-label="Fermer cette alerte"
            title="Fermer"
            className="h-6 w-6 p-0"
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </motion.div>
    );
  }
  
  return (
    <motion.div
      {...JARVIS_ANIMATIONS.slideUp}
      className={cn(
        'p-3 rounded-xl border transition-all',
        colors.bg,
        colors.border,
        'hover:shadow-md',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          'mt-0.5 p-1.5 rounded-lg',
          colors.bg,
          'flex-shrink-0'
        )}>
          <Icon className={cn('h-4 w-4', colors.icon)} />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'text-[10px] font-semibold uppercase tracking-wider',
              colors.icon
            )}>
              {label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {alert.source}
            </span>
          </div>
          
          <h4 className="text-sm font-medium text-foreground mb-1">
            {alert.title}
          </h4>
          
          <p className="text-xs text-muted-foreground line-clamp-2">
            {alert.message}
          </p>
          
          {/* Actions */}
          {(alert.actionLabel || onDismiss) && (
            <div className="flex items-center gap-2 mt-3">
              {alert.actionLabel && onAction && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs gap-1"
                  onClick={handleAction}
                >
                  {alert.actionLabel}
                  <ChevronRight className="h-3 w-3" />
                </Button>
              )}
              {onDismiss && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={onDismiss}
                >
                  Ignorer
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}));
