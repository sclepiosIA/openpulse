/**
 * JarvisProactiveNudge - Widget de micro-suggestions non-intrusif (Unifié v12.4)
 * 
 * Affiche des suggestions contextuelles discrètes basées sur
 * le contexte unifié Jarvis (triggers + prédictions)
 * 
 * Refactorisé pour utiliser JarvisUnifiedContext et composants partagés
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useJarvisUnifiedOptional, JARVIS_ANIMATIONS } from '@/contexts/JarvisUnifiedContext';
import { useJarvisSmartTriggers } from '@/hooks/jarvis/useJarvisSmartTriggers';
import { useJarvisIntentPrediction } from '@/hooks/jarvis/useJarvisIntentPrediction';
import { JarvisAlertCard } from './JarvisAlertCard';
import type { JarvisAlert } from '@/contexts/JarvisUnifiedContext';

interface JarvisProactiveNudgeProps {
  onAskJarvis?: (prompt: string) => void;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  maxNudges?: number;
  className?: string;
}

export function JarvisProactiveNudge({
  onAskJarvis,
  position = 'bottom-right',
  maxNudges = 2,
  className
}: JarvisProactiveNudgeProps) {
  const jarvisContext = useJarvisUnifiedOptional();
  const isPanelOpen = jarvisContext?.isPanelOpen ?? false;
  const isProcessingInBackground = jarvisContext?.isProcessingInBackground ?? false;
  const { triggers, dismissTrigger, hasUrgent } = useJarvisSmartTriggers({ enabled: !isPanelOpen, isStreaming: isProcessingInBackground });
  const { topPrediction, dismissPrediction } = useJarvisIntentPrediction({ enabled: !isPanelOpen });
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Convertir triggers et predictions en alertes unifiées
  const alerts: JarvisAlert[] = React.useMemo(() => {
    const items: JarvisAlert[] = [];

    // Ajouter les triggers prioritaires
    for (const trigger of triggers.slice(0, 3)) {
      if (dismissedIds.has(trigger.id)) continue;
      
      items.push({
        id: trigger.id,
        type: trigger.type,
        source: trigger.source,
        title: trigger.title,
        message: trigger.message,
        priority: trigger.priority,
        actionLabel: trigger.actionLabel,
        actionCommand: trigger.actionCommand,
        entityType: trigger.entityType,
        entityId: trigger.entityId,
        timestamp: trigger.timestamp,
        expiresAt: trigger.expiresAt,
        autoDismissSeconds: trigger.autoDismissSeconds,
        dismissed: false,
      });
    }

    // Ajouter la top prediction si confiance > 0.65
    if (topPrediction && topPrediction.confidence >= 0.65 && !dismissedIds.has(topPrediction.id)) {
      items.push({
        id: topPrediction.id,
        type: 'prediction',
        source: 'prediction',
        title: 'Suggestion',
        message: topPrediction.suggestedPrompt,
        priority: (10 - Math.round(topPrediction.confidence * 10)) as 1 | 2 | 3 | 4 | 5,
        actionLabel: 'Demander',
        actionCommand: topPrediction.suggestedPrompt,
        timestamp: new Date(),
        dismissed: false,
      });
    }

    // Trier par priorité et limiter
    return items.sort((a, b) => a.priority - b.priority).slice(0, maxNudges);
  }, [triggers, topPrediction, dismissedIds, maxNudges]);

  // Auto-expand si alerte urgente
  useEffect(() => {
    if (hasUrgent && alerts.length > 0) {
      setIsExpanded(true);
    }
  }, [hasUrgent, alerts.length]);

  // Dismiss une alerte
  const handleDismiss = useCallback((alert: JarvisAlert) => {
    setDismissedIds(prev => new Set([...prev, alert.id]));
    
    if (alert.source === 'prediction') {
      dismissPrediction(alert.id);
    } else {
      dismissTrigger(alert.id);
    }
  }, [dismissTrigger, dismissPrediction]);

  // Exécuter l'action - toujours via le contexte unifié
  const handleAction = useCallback((command: string) => {
    // Dismiss all nudges après action
    setIsExpanded(false);
    
    if (onAskJarvis) {
      onAskJarvis(command);
    } else if (jarvisContext) {
      // Le contexte unifié gère l'ouverture du panel et l'exécution
      jarvisContext.executeQuickAction(command);
    }
  }, [onAskJarvis, jarvisContext]);

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-20 right-4',
    'top-left': 'top-[4.5rem] left-4 md:left-[4.5rem]'
  };

  if (alerts.length === 0) return null;

  return (
    <div className={cn(
      'fixed z-40',
      positionClasses[position],
      className
    )}>
      <AnimatePresence mode="popLayout">
        {/* Collapsed: Just the indicator */}
        {!isExpanded && (
          <motion.button
            key="collapsed"
            {...JARVIS_ANIMATIONS.scale}
            onClick={() => setIsExpanded(true)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-full',
              'bg-background/95 backdrop-blur-sm border shadow-lg',
              'hover:shadow-xl transition-all duration-200',
              hasUrgent && 'border-destructive/50 animate-pulse'
            )}
          >
            <Sparkles className={cn(
              'w-4 h-4',
              hasUrgent ? 'text-destructive' : 'text-primary'
            )} />
            <span className="text-sm font-medium">
              {alerts.length} suggestion{alerts.length > 1 ? 's' : ''}
            </span>
            {hasUrgent && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
              </span>
            )}
          </motion.button>
        )}

        {/* Expanded: Show alerts */}
        {isExpanded && (
          <motion.div
            key="expanded"
            {...JARVIS_ANIMATIONS.slideUp}
            className={cn(
              'w-80 bg-background/95 backdrop-blur-sm border rounded-xl shadow-2xl',
              'overflow-hidden'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Jarvis suggère</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsExpanded(false)} aria-label="Fermer">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Alerts list */}
            <div className="divide-y max-h-64 overflow-y-auto p-2 space-y-2">
              <AnimatePresence mode="popLayout">
                {alerts.map((alert) => (
                  <JarvisAlertCard
                    key={alert.id}
                    alert={alert}
                    onAction={handleAction}
                    onDismiss={() => handleDismiss(alert)}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 bg-muted/20 border-t">
              <p className="text-xs text-muted-foreground text-center">
                Suggestions basées sur votre activité
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
