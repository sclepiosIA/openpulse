/**
 * JarvisGlobalAlertIndicator - Indicateur flottant pour alertes critiques Jarvis
 * 
 * Visible sur toutes les pages quand des alertes critiques/high sont en attente
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useJarvisProactiveAlerts } from '@/hooks/jarvis/useJarvisProactiveAlerts';
import { cn } from '@/lib/utils';

interface JarvisGlobalAlertIndicatorProps {
  className?: string;
  onOpenJarvis?: () => void;
}

export function JarvisGlobalAlertIndicator({ className, onOpenJarvis }: JarvisGlobalAlertIndicatorProps) {
  const { alerts, unreadCount, markAsRead, dismissAlert } = useJarvisProactiveAlerts();
  const [isDismissed, setIsDismissed] = useState(false);
  const [lastAlertId, setLastAlertId] = useState<string | null>(null);

  // Reset dismissed state when new critical alerts arrive
  useEffect(() => {
    const criticalAlerts = alerts.filter(a => 
      (a.priority === 'critical' || a.priority === 'high') && !a.read
    );
    
    if (criticalAlerts.length > 0 && criticalAlerts[0].id !== lastAlertId) {
      setIsDismissed(false);
      setLastAlertId(criticalAlerts[0].id);
    }
  }, [alerts, lastAlertId]);

  // Only show for critical/high priority unread alerts
  const criticalAlerts = alerts.filter(a => 
    (a.priority === 'critical' || a.priority === 'high') && !a.read
  );

  if (criticalAlerts.length === 0 || isDismissed) {
    return null;
  }

  const mostUrgent = criticalAlerts[0];
  const isCritical = mostUrgent.priority === 'critical';

  const handleDismiss = () => {
    setIsDismissed(true);
    markAsRead(mostUrgent.id);
  };

  const handleClick = () => {
    markAsRead(mostUrgent.id);
    onOpenJarvis?.();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        className={cn(
          "fixed bottom-24 right-4 z-50 md:bottom-6 md:right-6",
          className
        )}
      >
        <div
          className={cn(
            "relative flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-xl max-w-sm",
            isCritical 
              ? "bg-destructive/10 border-destructive/30 shadow-destructive/20" 
              : "bg-warning/10 border-warning/30 shadow-warning/20"
          )}
        >
          {/* Pulsing indicator */}
          <motion.div
            className={cn(
              "absolute -top-1 -right-1 h-4 w-4 rounded-full",
              isCritical ? "bg-destructive" : "bg-warning"
            )}
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [1, 0.7, 1]
            }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          {/* Icon */}
          <div className={cn(
            "flex-shrink-0 p-2 rounded-xl",
            isCritical ? "bg-destructive/20" : "bg-warning/20"
          )}>
            {isCritical ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <Bell className="h-5 w-5 text-warning" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                "font-semibold text-sm",
                isCritical ? "text-destructive" : "text-warning"
              )}>
                {mostUrgent.title}
              </span>
              {criticalAlerts.length > 1 && (
                <Badge variant="outline" className="text-xs">
                  +{criticalAlerts.length - 1}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {mostUrgent.message}
            </p>
            
            {/* Action button */}
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "mt-2 h-7 text-xs",
                isCritical ? "hover:bg-destructive/20" : "hover:bg-warning/20"
              )}
              onClick={handleClick}
            >
              Voir les détails →
            </Button>
          </div>

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0 hover:bg-background/50"
            onClick={handleDismiss} aria-label="Fermer">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default JarvisGlobalAlertIndicator;
