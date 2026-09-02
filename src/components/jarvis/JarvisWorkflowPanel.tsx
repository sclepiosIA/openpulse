/**
 * JarvisWorkflowPanel - Panneau des workflows automatisés
 * 
 * Affiche et permet d'exécuter les workflows disponibles.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Clock,
  Zap,
  Loader2,
  CheckCircle,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useJarvisEnhanced } from '@/hooks/jarvis/useJarvisEnhanced';

interface JarvisWorkflowPanelProps {
  onExecuteWorkflow?: (command: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  sales: '🎯',
  finance: '💰',
  hr: '👥',
  support: '🎫',
  operations: '⚙️',
  management: '📊',
};

const CATEGORY_COLORS: Record<string, string> = {
  sales: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  finance: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  hr: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  support: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  operations: 'bg-slate-500/10 text-foreground border-slate-500/20',
  management: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
};

export function JarvisWorkflowPanel({ onExecuteWorkflow }: JarvisWorkflowPanelProps) {
  const { workflows, isWorkflowsLoading, executeWorkflow, isExecutingWorkflow, getSuggestedWorkflows } = useJarvisEnhanced();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());

  const suggestedWorkflows = getSuggestedWorkflows();
  
  const filteredWorkflows = selectedCategory 
    ? workflows.filter(w => w.category === selectedCategory)
    : workflows;

  const categories = [...new Set(workflows.map(w => w.category))];

  const handleExecute = async (workflow: { id: string; triggerCommand: string }) => {
    setExecutingId(workflow.id);
    try {
      if (onExecuteWorkflow) {
        onExecuteWorkflow(workflow.triggerCommand);
      } else {
        await executeWorkflow({ workflowId: workflow.id });
      }
      setExecutedIds(prev => new Set([...prev, workflow.id]));
    } finally {
      setExecutingId(null);
    }
  };

  if (isWorkflowsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Suggested Workflows */}
      {suggestedWorkflows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-muted-foreground">
              Suggérés maintenant
            </span>
          </div>
          <div className="space-y-2">
            {suggestedWorkflows.map((workflow) => (
              <WorkflowCard 
                key={workflow.id}
                workflow={workflow}
                isExecuting={executingId === workflow.id}
                isExecuted={executedIds.has(workflow.id)}
                onExecute={() => handleExecute(workflow)}
                highlighted
              />
            ))}
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-1 flex-wrap">
        <Button
          variant={selectedCategory === null ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setSelectedCategory(null)}
        >
          Tous
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedCategory(cat)}
          >
            {CATEGORY_ICONS[cat]} {cat}
          </Button>
        ))}
      </div>

      {/* Workflows List */}
      <ScrollArea className="max-h-[300px]">
        <AnimatePresence mode="popLayout">
          <div className="space-y-2">
            {filteredWorkflows.map((workflow, index) => (
              <motion.div
                key={workflow.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.03 }}
              >
                <WorkflowCard 
                  workflow={workflow}
                  isExecuting={executingId === workflow.id}
                  isExecuted={executedIds.has(workflow.id)}
                  onExecute={() => handleExecute(workflow)}
                />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      </ScrollArea>

      {filteredWorkflows.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <Workflow className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucun workflow dans cette catégorie</p>
        </div>
      )}
    </div>
  );
}

interface WorkflowCardProps {
  workflow: {
    id: string;
    name: string;
    description: string;
    category: string;
    triggerCommand: string;
    stepsCount: number;
    estimatedDurationMs: number;
  };
  isExecuting: boolean;
  isExecuted: boolean;
  onExecute: () => void;
  highlighted?: boolean;
}

function WorkflowCard({ workflow, isExecuting, isExecuted, onExecute, highlighted }: WorkflowCardProps) {
  const categoryColor = CATEGORY_COLORS[workflow.category] || CATEGORY_COLORS.operations;
  const categoryIcon = CATEGORY_ICONS[workflow.category] || '⚙️';

  return (
    <div 
      className={cn(
        "group p-3 rounded-xl border transition-all",
        highlighted ? "border-primary/30 bg-primary/5" : "border-border/50 hover:border-border",
        "hover:bg-muted/30"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Category Icon */}
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg border",
          categoryColor
        )}>
          {categoryIcon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{workflow.name}</span>
            {highlighted && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                Suggéré
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
            {workflow.description}
          </p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Workflow className="h-3 w-3" />
              {workflow.stepsCount} étapes
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ~{Math.round(workflow.estimatedDurationMs / 1000)}s
            </span>
          </div>
        </div>

        {/* Execute Button */}
        <Button
          size="sm"
          variant={isExecuted ? 'ghost' : 'default'}
          className={cn(
            "h-8 px-3 gap-1.5",
            isExecuted && "text-emerald-600"
          )}
          onClick={onExecute}
          disabled={isExecuting}
        >
          {isExecuting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isExecuted ? (
            <CheckCircle className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {isExecuted ? 'Fait' : 'Lancer'}
        </Button>
      </div>
    </div>
  );
}
