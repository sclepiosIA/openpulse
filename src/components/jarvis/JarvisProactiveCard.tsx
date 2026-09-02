/**
 * JarvisProactiveCard - Carte de suggestion proactive (v15.0)
 * 
 * Affiche les alertes et suggestions proactives avec:
 * - Catégorisation visuelle (urgent, warning, info, opportunity)
 * - Actions rapides intégrées
 * - Animations d'entrée élégantes
 * - Design glassmorphism
 */

import { memo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  Lightbulb,
  TrendingUp,
  ChevronRight,
  X,
  Clock,
  Zap,
  Mail,
  CheckCircle2,
  Users,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { vibrateSelection } from '@/lib/haptics';

type AlertCategory = 'urgent' | 'warning' | 'info' | 'opportunity';

interface ProactiveAlert {
  id: string;
  category: AlertCategory;
  title: string;
  description: string;
  actionLabel?: string;
  actionPrompt?: string;
  entityType?: 'task' | 'email' | 'prospect' | 'invoice' | 'ticket';
  entityId?: string;
  timestamp?: Date;
}

const CATEGORY_CONFIG = {
  urgent: {
    icon: AlertTriangle,
    bgClass: 'from-red-500/15 to-red-500/5',
    borderClass: 'border-red-500/30',
    iconClass: 'text-red-500 bg-red-500/10',
    label: 'Urgent',
  },
  warning: {
    icon: Bell,
    bgClass: 'from-amber-500/15 to-amber-500/5',
    borderClass: 'border-amber-500/30',
    iconClass: 'text-amber-500 bg-amber-500/10',
    label: 'Attention',
  },
  info: {
    icon: Lightbulb,
    bgClass: 'from-blue-500/15 to-blue-500/5',
    borderClass: 'border-blue-500/30',
    iconClass: 'text-blue-500 bg-blue-500/10',
    label: 'Info',
  },
  opportunity: {
    icon: TrendingUp,
    bgClass: 'from-emerald-500/15 to-emerald-500/5',
    borderClass: 'border-emerald-500/30',
    iconClass: 'text-emerald-500 bg-emerald-500/10',
    label: 'Opportunité',
  },
};

const ENTITY_ICONS = {
  task: CheckCircle2,
  email: Mail,
  prospect: Users,
  invoice: FileText,
  ticket: Zap,
};

interface JarvisProactiveCardProps {
  alert: ProactiveAlert;
  onAction?: (prompt: string) => void;
  onDismiss?: (id: string) => void;
  className?: string;
}

export const JarvisProactiveCard = memo(function JarvisProactiveCard({
  alert,
  onAction,
  onDismiss,
  className,
}: JarvisProactiveCardProps) {
  const [isDismissing, setIsDismissing] = useState(false);

  const config = CATEGORY_CONFIG[alert.category];
  const CategoryIcon = config.icon;
  const EntityIcon = alert.entityType ? ENTITY_ICONS[alert.entityType] : null;

  const handleAction = useCallback(() => {
    vibrateSelection();
    if (alert.actionPrompt && onAction) {
      onAction(alert.actionPrompt);
    }
  }, [alert.actionPrompt, onAction]);

  const handleDismiss = useCallback(() => {
    vibrateSelection();
    setIsDismissing(true);
    setTimeout(() => {
      onDismiss?.(alert.id);
    }, 200);
  }, [alert.id, onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ 
        opacity: isDismissing ? 0 : 1, 
        y: isDismissing ? -10 : 0, 
        scale: isDismissing ? 0.95 : 1 
      }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={cn(
        "relative group",
        "p-4 rounded-2xl",
        "bg-gradient-to-br",
        config.bgClass,
        "border",
        config.borderClass,
        "shadow-sm hover:shadow-md",
        "transition-shadow duration-200",
        className
      )}
    >
      {/* Dismiss button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={handleDismiss}
        className={cn(
          "absolute top-2 right-2",
          "w-6 h-6 rounded-full",
          "flex items-center justify-center",
          "bg-background/80 hover:bg-background",
          "text-muted-foreground hover:text-foreground",
          "transition-colors duration-200",
          "opacity-0 group-hover:opacity-100"
        )}
      >
        <X className="w-3 h-3" />
      </motion.button>

      <div className="flex gap-3">
        {/* Icon */}
        <div className={cn(
          "flex-shrink-0",
          "w-10 h-10 rounded-xl",
          "flex items-center justify-center",
          config.iconClass
        )}>
          <CategoryIcon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {config.label}
                </span>
                {EntityIcon && (
                  <EntityIcon className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                {alert.title}
              </h4>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {alert.description}
          </p>

          {/* Action button */}
          {alert.actionLabel && (
            <motion.div 
              className="mt-3"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAction}
                className={cn(
                  "h-8 px-3 rounded-full gap-1.5",
                  "bg-background/80 hover:bg-background",
                  "text-xs font-medium"
                )}
              >
                <Zap className="w-3 h-3" />
                {alert.actionLabel}
                <ChevronRight className="w-3 h-3" />
              </Button>
            </motion.div>
          )}

          {/* Timestamp */}
          {alert.timestamp && (
            <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground/60">
              <Clock className="w-3 h-3" />
              {alert.timestamp.toLocaleTimeString('fr-FR', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

/**
 * JarvisProactiveStack - Stack d'alertes proactives
 */
interface JarvisProactiveStackProps {
  alerts: ProactiveAlert[];
  onAction?: (prompt: string) => void;
  onDismiss?: (id: string) => void;
  maxVisible?: number;
  className?: string;
}

export const JarvisProactiveStack = memo(function JarvisProactiveStack({
  alerts,
  onAction,
  onDismiss,
  maxVisible = 3,
  className,
}: JarvisProactiveStackProps) {
  const visibleAlerts = alerts.slice(0, maxVisible);
  const hiddenCount = Math.max(0, alerts.length - maxVisible);

  if (alerts.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <AnimatePresence mode="popLayout">
        {visibleAlerts.map((alert, index) => (
          <JarvisProactiveCard
            key={alert.id}
            alert={alert}
            onAction={onAction}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>

      {hiddenCount > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-2"
        >
          <span className="text-xs text-muted-foreground">
            +{hiddenCount} autre{hiddenCount > 1 ? 's' : ''} alerte{hiddenCount > 1 ? 's' : ''}
          </span>
        </motion.div>
      )}
    </div>
  );
});
