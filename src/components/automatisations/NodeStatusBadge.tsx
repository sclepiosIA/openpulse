import { CheckCircle2, XCircle, FlaskConical, AlertTriangle, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { NodeExecution } from '@/contexts/WorkflowExecutionContext';
import type { ValidationIssue } from '@/lib/workflow/validateGraph';

interface Props {
  execution?: NodeExecution;
  issues?: ValidationIssue[];
}

export function NodeStatusBadge({ execution, issues }: Props) {
  if (execution?.status === 'success') {
    return (
      <span className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-0.5 shadow">
        <CheckCircle2 className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (execution?.status === 'simulated') {
    return (
      <span
        className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-0.5 shadow"
        title="Simulé (mode test)"
      >
        <FlaskConical className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (execution?.status === 'scheduled') {
    return (
      <span className="absolute -top-2 -right-2 bg-amber-500 text-white rounded-full p-0.5 shadow">
        <Clock className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (execution?.status === 'failed') {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow animate-pulse"
            aria-label="Voir l'erreur"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-xs space-y-2" side="right">
          <div className="font-semibold text-destructive flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5" /> Erreur d'exécution
          </div>
          <p className="text-muted-foreground break-words">
            {execution.error || 'Erreur inconnue'}
          </p>
        </PopoverContent>
      </Popover>
    );
  }

  // Pas d'exécution → afficher les issues de validation
  const errors = issues?.filter((i) => i.severity === 'error') || [];
  const warnings = issues?.filter((i) => i.severity === 'warning') || [];
  if (errors.length || warnings.length) {
    const isError = errors.length > 0;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'absolute -top-2 -right-2 rounded-full p-0.5 shadow text-white',
              isError ? 'bg-destructive' : 'bg-amber-500'
            )}
            aria-label="Voir les avertissements"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 text-xs space-y-1.5" side="right">
          {errors.map((i, k) => (
            <p key={`e-${k}`} className="text-destructive">• {i.message}</p>
          ))}
          {warnings.map((i, k) => (
            <p key={`w-${k}`} className="text-amber-600 dark:text-amber-400">• {i.message}</p>
          ))}
        </PopoverContent>
      </Popover>
    );
  }
  return null;
}

export function getNodeRingClass(execution?: NodeExecution, issues?: ValidationIssue[]): string {
  if (execution?.status === 'success') return 'ring-2 ring-emerald-500/60';
  if (execution?.status === 'failed') return 'ring-2 ring-destructive animate-pulse';
  if (execution?.status === 'simulated') return 'ring-2 ring-blue-500/70 ring-dashed';
  if (execution?.status === 'scheduled') return 'ring-2 ring-amber-500/60';
  if (issues?.some((i) => i.severity === 'error')) return 'ring-2 ring-destructive/60';
  if (issues?.some((i) => i.severity === 'warning')) return 'ring-2 ring-amber-500/50';
  return '';
}
