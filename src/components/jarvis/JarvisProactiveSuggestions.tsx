/**
 * JarvisProactiveSuggestions - Affichage des suggestions proactives JARVIS 8.0
 * 
 * Composant amélioré avec:
 * - Boutons d'exécution directe
 * - Badges de confiance
 * - Catégorisation par type
 * - Animations d'urgence pour alertes critiques
 * - Feedback tracking
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  AlertTriangle,
  Bell,
  TrendingUp,
  X,
  ChevronRight,
  Zap,
  Play,
  Flame,
  Target,
  Mail,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useJarvisProactive, type ProactiveSuggestion } from '@/hooks/jarvis/useJarvisProactive';
import { useJarvisProactiveAlerts, type ProactiveAlert } from '@/hooks/jarvis/useJarvisProactiveAlerts';
import { useJarvisFeedback } from '@/hooks/jarvis/useJarvisFeedback';

interface JarvisProactiveSuggestionsProps {
  onAskJarvis?: (prompt: string) => void;
  maxSuggestions?: number;
  compact?: boolean;
  showAlerts?: boolean;
}

// Type icons mapping
const suggestionIcons: Record<ProactiveSuggestion['type'], typeof Lightbulb> = {
  tip: Lightbulb,
  action: Zap,
  reminder: Bell,
  insight: TrendingUp,
  warning: AlertTriangle,
};

// Alert type icons
const alertTypeIcons: Record<string, typeof AlertTriangle> = {
  overdue_task: Target,
  pending_emails: Mail,
  cold_prospect: Flame,
  unpaid_invoices: AlertTriangle,
  pending_ticket: Bell,
  expiring_contract: Calendar,
  ca_anomaly: TrendingUp,
  hot_opportunity: Flame,
  churn_risk: AlertTriangle,
  suggested_followup_email: Mail,
  upcoming_event: Calendar,
};

const suggestionColors: Record<ProactiveSuggestion['type'], string> = {
  tip: 'text-primary bg-gradient-to-br from-primary/15 to-primary/5 border-primary/20',
  action: 'text-sky-600 dark:text-sky-400 bg-gradient-to-br from-sky-500/15 to-sky-500/5 border-sky-500/20',
  reminder: 'text-amber-600 dark:text-amber-400 bg-gradient-to-br from-amber-500/15 to-amber-500/5 border-amber-500/20',
  insight: 'text-emerald-600 dark:text-emerald-400 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border-emerald-500/20',
  warning: 'text-destructive bg-gradient-to-br from-destructive/15 to-destructive/5 border-destructive/20',
};

const priorityColors: Record<string, string> = {
  critical: 'border-l-destructive shadow-destructive/20 bg-destructive/5',
  high: 'border-l-destructive shadow-destructive/10',
  medium: 'border-l-amber-500 shadow-amber-500/10',
  low: 'border-l-muted-foreground/30',
};

const priorityBadgeColors: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-destructive/80 text-destructive-foreground',
  medium: 'bg-amber-500 text-white',
  low: 'bg-muted text-muted-foreground',
};

export function JarvisProactiveSuggestions({ 
  onAskJarvis, 
  maxSuggestions = 5,
  compact = false,
  showAlerts = true
}: JarvisProactiveSuggestionsProps) {
  const { submitSuggestionFeedback } = useJarvisFeedback();
  const { 
    suggestions, 
    dismissSuggestion, 
    isAnalyzing,
    hasSuggestions 
  } = useJarvisProactive();
  
  const { 
    alerts, 
    unreadCount, 
    dismissAlert, 
    markAsRead 
  } = useJarvisProactiveAlerts();

  const [executingId, setExecutingId] = useState<string | null>(null);

  // Track suggestion feedback
  const trackFeedback = useCallback(async (
    suggestionType: string, 
    suggestionId: string, 
    action: 'accepted' | 'rejected' | 'dismissed' | 'executed',
    context?: Record<string, unknown>
  ) => {
    await submitSuggestionFeedback(suggestionType, suggestionId, action, context);
  }, [submitSuggestionFeedback]);

  // Handle execute action
  const handleExecute = useCallback(async (
    command: string, 
    suggestionId: string, 
    suggestionType: string,
    isAlert: boolean = false
  ) => {
    if (!onAskJarvis) return;
    
    setExecutingId(suggestionId);
    
    try {
      // Track as executed
      await trackFeedback(suggestionType, suggestionId, 'executed', { command });
      
      // Execute the command
      onAskJarvis(command);
      
      // Dismiss if it's an alert
      if (isAlert) {
        dismissAlert(suggestionId);
      } else {
        dismissSuggestion(suggestionId);
      }
    } finally {
      setExecutingId(null);
    }
  }, [onAskJarvis, trackFeedback, dismissAlert, dismissSuggestion]);

  // Handle dismiss with feedback
  const handleDismiss = useCallback(async (
    suggestionId: string, 
    suggestionType: string,
    isAlert: boolean = false
  ) => {
    await trackFeedback(suggestionType, suggestionId, 'dismissed');
    
    if (isAlert) {
      dismissAlert(suggestionId);
    } else {
      dismissSuggestion(suggestionId);
    }
  }, [trackFeedback, dismissAlert, dismissSuggestion]);

  const displayedSuggestions = suggestions.slice(0, maxSuggestions);
  const displayedAlerts = showAlerts ? alerts.slice(0, maxSuggestions) : [];

  // Combine and prioritize
  const allItems = [
    ...displayedAlerts.map(a => ({ ...a, isAlert: true })),
    ...displayedSuggestions.map(s => ({ ...s, isAlert: false })),
  ].slice(0, maxSuggestions);

  if (allItems.length === 0 && !isAnalyzing) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      {!compact && (allItems.length > 0 || isAnalyzing) && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              Suggestions proactives
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5 animate-pulse">
                {unreadCount} nouveau{unreadCount > 1 ? 'x' : ''}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {allItems.length}
            </Badge>
          </div>
        </div>
      )}

      {/* Items List */}
      <ScrollArea className="max-h-[350px]">
        <AnimatePresence mode="popLayout">
          {allItems.map((item, index) => {
            const isAlert = 'isAlert' in item && item.isAlert;
            
            if (isAlert) {
              const alert = item as ProactiveAlert & { isAlert: boolean };
              return (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  index={index}
                  isExecuting={executingId === alert.id}
                  onExecute={(cmd) => handleExecute(cmd, alert.id, alert.type, true)}
                  onDismiss={() => handleDismiss(alert.id, alert.type, true)}
                  onMarkRead={() => markAsRead(alert.id)}
                />
              );
            } else {
              const suggestion = item as ProactiveSuggestion & { isAlert: boolean };
              return (
                <SuggestionItem
                  key={suggestion.id}
                  suggestion={suggestion}
                  index={index}
                  isExecuting={executingId === suggestion.id}
                  onExecute={(cmd) => handleExecute(cmd, suggestion.id, suggestion.type, false)}
                  onDismiss={() => handleDismiss(suggestion.id, suggestion.type, false)}
                  onAskJarvis={onAskJarvis}
                />
              );
            }
          })}
        </AnimatePresence>
      </ScrollArea>

      {/* Show more indicator */}
      {(suggestions.length + alerts.length) > maxSuggestions && (
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-muted-foreground text-center py-1"
        >
          +{(suggestions.length + alerts.length) - maxSuggestions} autres
        </motion.p>
      )}

      {/* Loading state */}
      {isAnalyzing && allItems.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2 py-4 text-muted-foreground"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Zap className="h-4 w-4" />
          </motion.div>
          <span className="text-xs">Analyse du contexte...</span>
        </motion.div>
      )}
    </div>
  );
}

// Alert Item Component
interface AlertItemProps {
  alert: ProactiveAlert;
  index: number;
  isExecuting: boolean;
  onExecute: (command: string) => void;
  onDismiss: () => void;
  onMarkRead: () => void;
}

function AlertItem({ alert, index, isExecuting, onExecute, onDismiss, onMarkRead }: AlertItemProps) {
  const navigate = useNavigate();
  const Icon = alertTypeIcons[alert.type] || AlertTriangle;
  const actionData = alert.action_data as { command?: string; executable?: boolean; path?: string } | null;
  const command = actionData?.command;
  const isExecutable = actionData?.executable || !!command;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.95 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className={cn(
        'relative rounded-xl border border-l-4 p-3.5 mb-2 bg-card/80 backdrop-blur-sm shadow-md hover:shadow-lg transition-all',
        priorityColors[alert.priority],
        alert.priority === 'critical' && 'animate-pulse',
        !alert.read && 'ring-1 ring-primary/20'
      )}
      onClick={() => !alert.read && onMarkRead()}
    >
      {/* Dismiss button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="absolute top-2 right-2 p-1 rounded-md hover:bg-muted transition-colors z-10"
        aria-label="Ignorer"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>

      <div className="flex gap-3">
        {/* Icon with priority indicator */}
        <div className={cn(
          'flex-shrink-0 p-1.5 rounded-lg border',
          alert.priority === 'critical' ? 'bg-destructive/20 border-destructive/30 text-destructive' :
          alert.priority === 'high' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
          'bg-primary/10 border-primary/20 text-primary'
        )}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium leading-tight truncate">
              {alert.title}
            </h4>
            <Badge className={cn('text-[9px] h-4 px-1.5', priorityBadgeColors[alert.priority])}>
              {alert.priority === 'critical' ? '🔴 Urgent' : 
               alert.priority === 'high' ? '🟠 Important' : 
               alert.priority === 'medium' ? '🟡 Normal' : '🟢 Info'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {alert.message}
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-2.5">
            {isExecutable && command && (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs gap-1.5 px-3 rounded-lg font-medium"
                onClick={(e) => { e.stopPropagation(); onExecute(command); }}
                disabled={isExecuting}
              >
                {isExecuting ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
                    <Zap className="h-3 w-3" />
                  </motion.div>
                ) : (
                  <Play className="h-3 w-3" />
                )}
                Exécuter
              </Button>
            )}
            {actionData?.path && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5 px-3 rounded-lg"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  navigate(actionData.path!); 
                }}
              >
                Voir
                <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Suggestion Item Component
interface SuggestionItemProps {
  suggestion: ProactiveSuggestion;
  index: number;
  isExecuting: boolean;
  onExecute: (command: string) => void;
  onDismiss: () => void;
  onAskJarvis?: (prompt: string) => void;
}

function SuggestionItem({ 
  suggestion, 
  index, 
  isExecuting, 
  onExecute, 
  onDismiss,
  onAskJarvis 
}: SuggestionItemProps) {
  const Icon = suggestionIcons[suggestion.type];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.95 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className={cn(
        'relative rounded-xl border border-l-4 p-3.5 mb-2 bg-card/80 backdrop-blur-sm shadow-md hover:shadow-lg transition-shadow',
        priorityColors[suggestion.priority]
      )}
    >
      {/* Dismiss button */}
      {suggestion.dismissable && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 rounded-md hover:bg-muted transition-colors"
          aria-label="Ignorer cette suggestion"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      )}

      <div className="flex gap-3">
        {/* Icon */}
        <div className={cn(
          'flex-shrink-0 p-1.5 rounded-md border',
          suggestionColors[suggestion.type]
        )}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-4">
          <h4 className="text-sm font-medium leading-tight mb-1">
            {suggestion.title}
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {suggestion.description}
          </p>

          {/* Action button */}
          {suggestion.actionLabel && onAskJarvis && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2.5 h-7 text-xs gap-1.5 px-3 bg-primary/5 hover:bg-primary/10 rounded-lg font-medium"
              onClick={() => {
                onAskJarvis(suggestion.title);
                onDismiss();
              }}
            >
              {suggestion.actionLabel}
              <ChevronRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
