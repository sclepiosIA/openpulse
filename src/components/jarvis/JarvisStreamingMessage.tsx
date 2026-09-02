/**
 * JarvisStreamingMessage - Message streaming with tool execution display (v15.3)
 * Now with full Markdown rendering + clickable email references
 */

import React, { memo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Search,
  Database,
  Sparkles,
  Zap,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Wrench,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import jarvisLogo from '@/assets/jarvis-logo.png';
import { JarvisMarkdownRenderer } from './JarvisMarkdownRenderer';
import type { ToolExecution } from '@/hooks/jarvis/useJarvisStreaming';

interface ReasoningStep {
  step: number;
  phase: 'analyze' | 'context' | 'memory' | 'tools' | 'generate' | 'complete';
  label: string;
  detail?: string;
  status: 'active' | 'completed';
}

const PHASE_CONFIG = {
  analyze: { icon: Brain, label: 'Analyse', colorClass: 'text-purple-500' },
  context: { icon: Search, label: 'Contexte', colorClass: 'text-blue-500' },
  memory: { icon: Database, label: 'Mémoire', colorClass: 'text-amber-500' },
  tools: { icon: Zap, label: 'Outils', colorClass: 'text-emerald-500' },
  generate: { icon: Sparkles, label: 'Génération', colorClass: 'text-primary' },
  complete: { icon: CheckCircle2, label: 'Terminé', colorClass: 'text-emerald-500' },
};

const TOOL_LABELS: Record<string, string> = {
  query_database: 'Interrogation BDD',
  create_task: 'Création tâche',
  send_email: 'Envoi email',
  schedule_meeting: 'Planification réunion',
  search_knowledge_base: 'Recherche KB',
  calculate_metrics: 'Calcul métriques',
  manage_absence: 'Gestion absence',
  manage_expense: 'Gestion dépense',
  update_entity_status: 'Mise à jour statut',
  get_user_context: 'Contexte utilisateur',
  web_search: 'Recherche web',
  generate_briefing: 'Génération briefing',
  manage_memory: 'Mémorisation',
  get_my_calendar: 'Consultation calendrier',
};

function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] || toolName.replace(/_/g, ' ');
}

interface JarvisStreamingMessageProps {
  content: string;
  isStreaming: boolean;
  isDone?: boolean;
  reasoningSteps?: ReasoningStep[];
  showReasoning?: boolean;
  activeTools?: ToolExecution[];
  className?: string;
}

export const JarvisStreamingMessage = memo(function JarvisStreamingMessage({
  content,
  isStreaming,
  isDone = false,
  reasoningSteps = [],
  showReasoning = true,
  activeTools = [],
  className,
}: JarvisStreamingMessageProps) {
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll is handled by the parent panel — no scrollIntoView here

  const completedSteps = reasoningSteps.filter(s => s.status === 'completed').length;
  const hasActiveTools = activeTools.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2.5", className)}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 self-end">
        <div className="relative">
          <motion.div
            className={cn(
              "w-7 h-7 rounded-full",
              "bg-gradient-to-br from-primary to-primary/80",
              "flex items-center justify-center",
              "shadow-sm shadow-primary/15",
              "ring-2 ring-background"
            )}
            animate={isStreaming ? { rotate: [0, 3, -3, 0] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <img loading="lazy" decoding="async" src={jarvisLogo} 
              alt="Jarvis" 
              className="w-4 h-4 object-contain" />
          </motion.div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 max-w-[82%] sm:max-w-[72%]" ref={contentRef}>
        {/* Reasoning steps */}
        {showReasoning && reasoningSteps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="overflow-hidden"
          >
            <button
              onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg w-full",
                "bg-muted/40 hover:bg-muted/60 border border-border/30",
                "text-xs text-muted-foreground",
                "transition-colors duration-200"
              )}
            >
              <Brain className="w-3 h-3 text-primary" />
              <span className="flex-1 text-left">
                {isStreaming 
                  ? `Raisonnement... (${completedSteps}/${reasoningSteps.length})`
                  : `${reasoningSteps.length} étapes`
                }
              </span>
              {isReasoningExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <AnimatePresence>
              {isReasoningExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-1.5 space-y-0.5"
                >
                  {reasoningSteps.map((step, index) => {
                    const config = PHASE_CONFIG[step.phase];
                    const Icon = config.icon;
                    const isActive = step.status === 'active';
                    const isCompleted = step.status === 'completed';

                    return (
                      <motion.div
                        key={step.step}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1 rounded-md",
                          "text-xs",
                          isActive && "bg-primary/10 border border-primary/20",
                          isCompleted && "text-muted-foreground"
                        )}
                      >
                        {isActive ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                            <Loader2 className={cn("w-3 h-3", config.colorClass)} />
                          </motion.div>
                        ) : isCompleted ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Icon className={cn("w-3 h-3", config.colorClass)} />
                        )}
                        <span className={cn("font-medium", isActive && "text-foreground")}>
                          {step.label}
                        </span>
                        {step.detail && (
                          <span className="text-muted-foreground truncate">— {step.detail}</span>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Tool execution indicators */}
        {hasActiveTools && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-0.5"
          >
            {activeTools.map((tool, index) => (
              <motion.div
                key={`${tool.tool}-${index}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                  "text-xs border",
                  tool.status === 'running' && "bg-primary/5 border-primary/20 text-primary",
                  tool.status === 'success' && "bg-emerald-500/5 border-emerald-500/20 text-emerald-600",
                  tool.status === 'error' && "bg-destructive/5 border-destructive/20 text-destructive",
                )}
              >
                {tool.status === 'running' ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                    <Loader2 className="w-3 h-3" />
                  </motion.div>
                ) : tool.status === 'success' ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                <Wrench className="w-3 h-3 opacity-60" />
                <span className="font-medium">{getToolLabel(tool.tool)}</span>
                {tool.summary && (
                  <span className="text-muted-foreground truncate max-w-[180px]">— {tool.summary}</span>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            "px-3.5 py-2.5 rounded-2xl rounded-bl-lg",
            "bg-muted/60",
            "border border-border/50",
          )}
        >
          {content ? (
            <div>
              <JarvisMarkdownRenderer content={content} />
              {isStreaming && !isDone && (
                <motion.span
                  className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle rounded-full"
                  animate={{ opacity: [1, 0.3] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                />
              )}
            </div>
          ) : isStreaming ? (
            <div className="flex items-center gap-2">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <Loader2 className="w-4 h-4 text-primary" />
              </motion.div>
              <span className="text-sm text-muted-foreground">
                {hasActiveTools ? 'Jarvis exécute des actions...' : 'Jarvis réfléchit...'}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
});

/**
 * JarvisProgressBar - Barre de progression pendant le streaming
 */
export const JarvisProgressBar = memo(function JarvisProgressBar({
  progress,
  phase,
  className,
}: {
  progress: number;
  phase?: string;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn("px-4 py-2", className)}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
        {phase && (
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {phase}
          </span>
        )}
      </div>
    </motion.div>
  );
});
