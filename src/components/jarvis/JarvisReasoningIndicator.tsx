/**
 * JarvisReasoningIndicator - Affiche les étapes de raisonnement de Jarvis
 * 
 * Montre à l'utilisateur le "chain of thought" pendant le traitement:
 * - Analyse de la requête
 * - Détection d'intentions multiples
 * - Recherche de contexte
 * - Exécution d'outils
 * - Formulation de la réponse
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Search,
  Cog,
  MessageSquare,
  CheckCircle2,
  Loader2,
  GitBranch,
  Database,
  Mail,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReasoningStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  icon?: 'brain' | 'search' | 'cog' | 'message' | 'branch' | 'database' | 'mail' | 'file';
  detail?: string;
}

interface JarvisReasoningIndicatorProps {
  steps: ReasoningStep[];
  isActive: boolean;
  className?: string;
  compact?: boolean;
}

const iconMap = {
  brain: Brain,
  search: Search,
  cog: Cog,
  message: MessageSquare,
  branch: GitBranch,
  database: Database,
  mail: Mail,
  file: FileText,
};

export function JarvisReasoningIndicator({
  steps,
  isActive,
  className,
  compact = false,
}: JarvisReasoningIndicatorProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Auto-advance through steps for demo/visual feedback
  useEffect(() => {
    if (!isActive) {
      setCurrentStepIndex(0);
      return;
    }

    const activeIndex = steps.findIndex(s => s.status === 'active');
    if (activeIndex >= 0) {
      setCurrentStepIndex(activeIndex);
    }
  }, [steps, isActive]);

  if (!isActive && steps.every(s => s.status === 'pending')) {
    return null;
  }

  const activeStep = steps[currentStepIndex];

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground",
          className
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
        <span>{activeStep?.label || 'Traitement...'}</span>
        {activeStep?.detail && (
          <span className="text-muted-foreground/60">({activeStep.detail})</span>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        "bg-muted/30 rounded-lg p-3 border border-border/50",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Brain className="h-4 w-4 text-primary animate-pulse" />
        <span className="text-xs font-medium text-foreground/80">
          Raisonnement en cours...
        </span>
      </div>

      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {steps.map((step, index) => {
            const Icon = step.icon ? iconMap[step.icon] : Cog;
            const isActive = step.status === 'active';
            const isCompleted = step.status === 'completed';
            const isSkipped = step.status === 'skipped';
            const isPending = step.status === 'pending';

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "flex items-center gap-2 text-xs py-1 px-2 rounded-md transition-colors",
                  isActive && "bg-primary/10 text-primary",
                  isCompleted && "text-muted-foreground",
                  isSkipped && "text-muted-foreground/50 line-through",
                  isPending && "text-muted-foreground/60"
                )}
              >
                {isActive ? (
                  <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                ) : isCompleted ? (
                  <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
                ) : (
                  <Icon className="h-3 w-3 flex-shrink-0" />
                )}
                
                <span className="flex-1">{step.label}</span>
                
                {step.detail && isActive && (
                  <span className="text-[10px] text-muted-foreground">
                    {step.detail}
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Hook pour générer des étapes de raisonnement basées sur le contexte
export function useReasoningSteps(context: {
  isMultiIntent?: boolean;
  intentCount?: number;
  hasToolCalls?: boolean;
  toolNames?: string[];
  isSearching?: boolean;
  isSending?: boolean;
}): ReasoningStep[] {
  const [steps, setSteps] = useState<ReasoningStep[]>([]);

  useEffect(() => {
    const newSteps: ReasoningStep[] = [
      {
        id: 'analyze',
        label: 'Analyse de la requête',
        status: 'completed',
        icon: 'brain',
      },
    ];

    if (context.isMultiIntent && context.intentCount) {
      newSteps.push({
        id: 'multi-intent',
        label: `Détection de ${context.intentCount} intentions`,
        status: 'completed',
        icon: 'branch',
        detail: 'multi-intent',
      });
    }

    if (context.isSearching) {
      newSteps.push({
        id: 'search',
        label: 'Recherche dans la base de données',
        status: 'active',
        icon: 'database',
      });
    }

    if (context.hasToolCalls && context.toolNames?.length) {
      context.toolNames.forEach((name, i) => {
        const isLast = i === context.toolNames!.length - 1;
        newSteps.push({
          id: `tool-${name}`,
          label: `Exécution: ${formatToolName(name)}`,
          status: isLast ? 'active' : 'completed',
          icon: getToolIcon(name),
        });
      });
    }

    if (context.isSending) {
      newSteps.push({
        id: 'sending',
        label: 'Envoi du message',
        status: 'active',
        icon: 'mail',
      });
    }

    newSteps.push({
      id: 'response',
      label: 'Formulation de la réponse',
      status: 'pending',
      icon: 'message',
    });

    setSteps(newSteps);
  }, [context]);

  return steps;
}

function formatToolName(name: string): string {
  const nameMap: Record<string, string> = {
    query_database: 'Requête base de données',
    send_email: 'Envoi d\'email',
    create_task: 'Création de tâche',
    schedule_meeting: 'Planification réunion',
    translate_email: 'Traduction',
    correct_email: 'Correction orthographique',
    web_search: 'Recherche web',
    manage_memory: 'Mémorisation',
  };
  return nameMap[name] || name.replace(/_/g, ' ');
}

function getToolIcon(name: string): ReasoningStep['icon'] {
  if (name.includes('email') || name.includes('send')) return 'mail';
  if (name.includes('database') || name.includes('query')) return 'database';
  if (name.includes('search')) return 'search';
  if (name.includes('file') || name.includes('document')) return 'file';
  return 'cog';
}

export default JarvisReasoningIndicator;
