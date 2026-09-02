/**
 * JarvisBackgroundIndicator - Indicateur persistant des jobs en arrière-plan
 * 
 * Widget flottant qui s'affiche même quand le modal Jarvis est fermé
 * pour montrer la progression des tâches en cours.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  XCircle,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  Pause,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useJarvisBackgroundJobs } from '@/hooks/jarvis/useJarvisBackgroundJobs';
import { useJarvisActionContext } from '@/hooks/jarvis/useJarvisActionContext';
import jarvisLogo from '@/assets/jarvis-logo.png';

interface JarvisBackgroundIndicatorProps {
  className?: string;
}

export function JarvisBackgroundIndicator({ className }: JarvisBackgroundIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const { 
    activeJobs, 
    hasActiveJobs, 
    processingJob,
    cancelJob,
  } = useJarvisBackgroundJobs();

  const {
    pendingContexts,
    hasPendingContexts,
    resumeAction,
    cancelContext,
    getContextSummary,
    isResuming,
  } = useJarvisActionContext();

  // Don't show if nothing to display or dismissed
  if ((!hasActiveJobs && !hasPendingContexts) || isDismissed) {
    return null;
  }

  const totalItems = activeJobs.length + pendingContexts.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      className={cn(
        "fixed bottom-4 right-4 z-50",
        "bg-card/95 backdrop-blur-xl border border-border/50",
        "rounded-2xl shadow-2xl shadow-black/20",
        "min-w-[280px] max-w-[360px]",
        className
      )}
    >
      {/* Header */}
      <div 
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="relative">
          <img loading="lazy" decoding="async" src={jarvisLogo} 
            alt="Jarvis" 
            className="h-8 w-8 object-contain" />
          {hasActiveJobs && (
            <motion.div
              className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              JARVIS en arrière-plan
            </span>
            <Badge variant="secondary" className="text-xs">
              {totalItems}
            </Badge>
          </div>
          
          {processingJob && (
            <div className="flex items-center gap-2 mt-1">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground truncate">
                {processingJob.action_type}
              </span>
              <span className="text-xs text-primary font-medium">
                {processingJob.progress}%
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }} aria-label="Suivant">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setIsDismissed(true);
            }} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/50"
          >
            <div className="p-3 space-y-3 max-h-[300px] overflow-y-auto">
              {/* Active jobs */}
              {activeJobs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    En cours
                  </h4>
                  {activeJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex-shrink-0">
                        {job.status === 'processing' ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <Pause className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{job.action_type}</p>
                        <Progress value={job.progress} className="h-1 mt-1" />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => cancelJob(job.id)} aria-label="Fermer">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending contexts (resumable actions) */}
              {pendingContexts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    En attente
                  </h4>
                  {pendingContexts.map((context) => (
                    <div
                      key={context.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          {getContextSummary(context)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(context.created_at).toLocaleTimeString('fr-FR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary hover:bg-primary/10"
                          onClick={() => resumeAction(context.id)}
                          disabled={isResuming} aria-label="Chargement">
                          {isResuming ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => cancelContext(context.id)} aria-label="Fermer">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
